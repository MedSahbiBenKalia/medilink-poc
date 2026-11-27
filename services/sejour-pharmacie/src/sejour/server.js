// Service Séjour & Actes (port SEJOUR_PORT, 8093 par défaut)
// Propriétaire des tables "sejour" et "acte" de la BDD Soins.
// Dépend de la table "lit" et "tarif" (lecture seule), et de la table "patient" (lecture seule).
// Envoie l'événement "sortie validée" à l'ESB Soins lors de la validation de sortie.
const config = require('../config');
const db = require('../db-soins');
const { ErreurHttp, creerApp, demarrer } = require('../commun');
const { publierSortie } = require('./esbClient');

const app = creerApp('sejour');

// ---------- Utilitaires ----------

function estDateIso(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

function validerLigne(l) {
  return l
    && typeof l.codeActe === 'string' && l.codeActe.trim() !== ''
    && Number.isInteger(l.quantite) && l.quantite > 0
    && estDateIso(l.dateActe);
}

// Exécute une fonction dans une transaction PostgreSQL.
async function transaction(callback) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Génère l'ID séjour suivant : SEJ-0001, SEJ-0002...
async function idSejourSuivant(client) {
  const { rows } = await client.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM 5) AS INTEGER)), 0) + 1 AS n FROM sejour WHERE id ~ '^SEJ-[0-9]+$'"
  );
  return `SEJ-${String(rows[0].n).padStart(4, '0')}`;
}

// ---------- Routes ----------

// Lister les lits libres : GET /lits/libres?service=CHIRURGIE
app.get('/lits/libres', async (req, res) => {
  const valeurs = [];
  let filtre = '';
  if (req.query.service) {
    valeurs.push(req.query.service);
    filtre = ' AND service = $1';
  }
  const { rows } = await db.query(
    `SELECT id AS "litId", service FROM lit WHERE libre = TRUE${filtre} ORDER BY id`,
    valeurs
  );
  res.json(rows);
});

// Ouvrir un séjour : POST /sejours { ipg, service, litId }
app.post('/sejours', async (req, res) => {
  const { ipg, service, litId } = req.body || {};
  if (typeof ipg !== 'string' || ipg.trim() === '') throw new ErreurHttp(400, 'ipg obligatoire');
  if (typeof service !== 'string' || service.trim() === '') throw new ErreurHttp(400, 'service obligatoire');
  if (typeof litId !== 'string' || litId.trim() === '') throw new ErreurHttp(400, 'litId obligatoire');

  const sejour = await transaction(async (client) => {
    // Vérifier que le patient existe
    const { rows: patients } = await client.query('SELECT 1 FROM patient WHERE ipg = $1', [ipg]);
    if (patients.length === 0) throw new ErreurHttp(404, `Patient ${ipg} introuvable`);

    // Verrouiller le lit pour éviter les conflits concurrents
    const { rows: lits } = await client.query(
      'SELECT id, service, libre FROM lit WHERE id = $1 FOR UPDATE',
      [litId]
    );
    if (lits.length === 0) throw new ErreurHttp(404, `Lit ${litId} introuvable`);
    if (!lits[0].libre) throw new ErreurHttp(409, `Lit ${litId} déjà occupé`);
    if (lits[0].service !== service.trim()) {
      throw new ErreurHttp(409, `Lit ${litId} appartient au service ${lits[0].service}, pas à ${service}`);
    }

    const id = await idSejourSuivant(client);
    const dateEntree = new Date().toISOString().slice(0, 10);

    await client.query(
      `INSERT INTO sejour (id, ipg, service, lit_id, date_entree) VALUES ($1, $2, $3, $4, $5)`,
      [id, ipg, service.trim(), litId, dateEntree]
    );
    await client.query('UPDATE lit SET libre = FALSE WHERE id = $1', [litId]);

    return { sejourId: id, ipg, service: service.trim(), litId, dateEntree, statut: 'OUVERT' };
  });

  res.status(201).json(sejour);
});

// Lire un séjour : GET /sejours/:sejourId
app.get('/sejours/:sejourId', async (req, res) => {
  const { rows } = await db.query(
    `SELECT id AS "sejourId", ipg, service, lit_id AS "litId",
            date_entree AS "dateEntree", date_sortie AS "dateSortie", statut
       FROM sejour WHERE id = $1`,
    [req.params.sejourId]
  );
  if (rows.length === 0) throw new ErreurHttp(404, `Séjour ${req.params.sejourId} introuvable`);
  res.json(rows[0]);
});

// Enregistrer des actes sur un séjour : POST /sejours/:sejourId/actes { lignes: [...] }
// Chaque ligne : { codeActe, quantite, dateActe }
app.post('/sejours/:sejourId/actes', async (req, res) => {
  const lignes = req.body && req.body.lignes;
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new ErreurHttp(400, 'lignes doit être un tableau non vide');
  }
  for (const l of lignes) {
    if (!validerLigne(l)) {
      throw new ErreurHttp(400, 'Chaque ligne doit avoir codeActe (texte), quantite (entier > 0) et dateActe (AAAA-MM-JJ)');
    }
  }

  const inseres = await transaction(async (client) => {
    // Vérifier que le séjour existe et est ouvert
    const { rows: sejours } = await client.query(
      'SELECT statut FROM sejour WHERE id = $1 FOR UPDATE',
      [req.params.sejourId]
    );
    if (sejours.length === 0) throw new ErreurHttp(404, `Séjour ${req.params.sejourId} introuvable`);
    if (sejours[0].statut !== 'OUVERT') throw new ErreurHttp(409, 'Le séjour est déjà clôturé');

    const resultat = [];
    for (const l of lignes) {
      // Vérifier que le code acte existe dans la table tarif
      const { rows: tarifs } = await client.query('SELECT prix FROM tarif WHERE code = $1', [l.codeActe]);
      if (tarifs.length === 0) throw new ErreurHttp(400, `Code acte inconnu : ${l.codeActe}`);

      const { rows: inserted } = await client.query(
        `INSERT INTO acte (sejour_id, code_acte, quantite, date_acte)
         VALUES ($1, $2, $3, $4)
         RETURNING id, code_acte AS "codeActe", quantite, date_acte AS "dateActe"`,
        [req.params.sejourId, l.codeActe, l.quantite, l.dateActe]
      );
      resultat.push({ ...inserted[0], prixUnitaire: Number(tarifs[0].prix) });
    }
    return resultat;
  });

  res.status(201).json({ sejourId: req.params.sejourId, lignes: inseres });
});

// Lister les actes d'un séjour : GET /sejours/:sejourId/actes
app.get('/sejours/:sejourId/actes', async (req, res) => {
  const { rows: s } = await db.query('SELECT 1 FROM sejour WHERE id = $1', [req.params.sejourId]);
  if (s.length === 0) throw new ErreurHttp(404, `Séjour ${req.params.sejourId} introuvable`);

  const { rows } = await db.query(
    `SELECT a.id, a.code_acte AS "codeActe", a.quantite, a.date_acte AS "dateActe",
            t.prix AS "prixUnitaire"
       FROM acte a
       JOIN tarif t ON t.code = a.code_acte
      WHERE a.sejour_id = $1
      ORDER BY a.id`,
    [req.params.sejourId]
  );
  res.json(rows.map((a) => ({ ...a, prixUnitaire: Number(a.prixUnitaire) })));
});

// Valider la sortie d'un séjour : PUT /sejours/:sejourId/sortie
// Clôture le séjour, libère le lit et publie l'événement "sortie validée" vers l'ESB Soins.
app.put('/sejours/:sejourId/sortie', async (req, res) => {
  const evenement = await transaction(async (client) => {
    const { rows: sejours } = await client.query(
      `SELECT s.ipg, s.statut, s.lit_id AS "litId", s.service
         FROM sejour s
        WHERE s.id = $1
        FOR UPDATE`,
      [req.params.sejourId]
    );
    if (sejours.length === 0) throw new ErreurHttp(404, `Séjour ${req.params.sejourId} introuvable`);
    const sejour = sejours[0];
    if (sejour.statut !== 'OUVERT') throw new ErreurHttp(409, 'La sortie est déjà validée');

    const { rows: actes } = await client.query(
      `SELECT a.code_acte AS "codeActe", a.quantite, t.prix AS "prixUnitaire"
         FROM acte a
         JOIN tarif t ON t.code = a.code_acte
        WHERE a.sejour_id = $1
        ORDER BY a.id`,
      [req.params.sejourId]
    );

    const dateSortie = new Date().toISOString().slice(0, 10);

    // Construire l'événement à envoyer à l'ESB Soins
    const evt = {
      ipg: sejour.ipg,
      sejourId: req.params.sejourId,
      dateSortie,
      actes: actes.map((a) => ({ ...a, prixUnitaire: Number(a.prixUnitaire) })),
    };

    // Publier vers l'ESB (mock ou réel selon ESB_MODE)
    await publierSortie(evt);

    // Clôturer le séjour et libérer le lit
    await client.query(
      `UPDATE sejour SET statut = 'SORTI', date_sortie = $1 WHERE id = $2`,
      [dateSortie, req.params.sejourId]
    );
    await client.query('UPDATE lit SET libre = TRUE WHERE id = $1', [sejour.litId]);

    return evt;
  });

  res.json({ message: 'Sortie validée', ...evenement });
});

console.log(`[sejour] mode ESB : ${config.esbMode}`);
demarrer(app, config.sejourPort, 'sejour');
