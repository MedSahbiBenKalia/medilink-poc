// Service Stock Pharmacie (port STOCK_PORT, 8094 par défaut)
// Propriétaire des tables "stock", "consommation" et "reception" de la BDD Pharmacie.
// Publie l'événement "stockSousSeuil" sur RabbitMQ via le patron Outbox quand le seuil est atteint.
const config = require('../config');
const db = require('../db-pharmacie');
const { ErreurHttp, creerApp, demarrer } = require('../commun');
const { flushOutbox } = require('./rabbitmqClient');

const app = creerApp('stock');

// ---------- Utilitaires ----------

function validerEntreeStock({ codeArticle, quantite }) {
  return typeof codeArticle === 'string' && codeArticle.trim() !== ''
    && Number.isInteger(quantite) && quantite > 0;
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

// ---------- Routes ----------

// Consulter le stock d'un article : GET /stocks/:codeArticle
app.get('/stocks/:codeArticle', async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.code AS "codeArticle", a.libelle, a.seuil, a.fournisseur,
            s.quantite AS "stockActuel"
       FROM article a
       JOIN stock s ON s.code_article = a.code
      WHERE a.code = $1`,
    [req.params.codeArticle]
  );
  if (rows.length === 0) throw new ErreurHttp(404, `Article ${req.params.codeArticle} introuvable`);
  res.json(rows[0]);
});

// Lister tous les articles avec leur stock : GET /stocks
app.get('/stocks', async (req, res) => {
  const { rows } = await db.query(
    `SELECT a.code AS "codeArticle", a.libelle, a.seuil, a.fournisseur,
            s.quantite AS "stockActuel"
       FROM article a
       JOIN stock s ON s.code_article = a.code
      ORDER BY a.code`
  );
  res.json(rows);
});

// Enregistrer une consommation : POST /consommations { sejourId, codeArticle, quantite }
// Décrémente le stock et publie stockSousSeuil sur RabbitMQ si le seuil est franchi.
app.post('/consommations', async (req, res) => {
  const { sejourId, codeArticle, quantite } = req.body || {};
  if (typeof sejourId !== 'string' || sejourId.trim() === '') {
    throw new ErreurHttp(400, 'sejourId obligatoire');
  }
  if (!validerEntreeStock({ codeArticle, quantite })) {
    throw new ErreurHttp(400, 'codeArticle (texte) et quantite (entier > 0) obligatoires');
  }

  const resultat = await transaction(async (client) => {
    // Lire l'article et son stock (verrouillage de la ligne stock pour éviter les conflits)
    const { rows: articles } = await client.query(
      `SELECT a.libelle, a.seuil, s.quantite AS stock_actuel
         FROM article a
         JOIN stock s ON s.code_article = a.code
        WHERE a.code = $1
        FOR UPDATE OF s`,
      [codeArticle]
    );
    if (articles.length === 0) throw new ErreurHttp(404, `Article ${codeArticle} introuvable`);

    const { libelle, seuil, stock_actuel: stockActuel } = articles[0];
    if (stockActuel < quantite) {
      throw new ErreurHttp(409, `Stock insuffisant : disponible ${stockActuel}, demandé ${quantite}`);
    }

    const nouveauStock = stockActuel - quantite;

    // Décrémenter le stock
    await client.query(
      'UPDATE stock SET quantite = $1 WHERE code_article = $2',
      [nouveauStock, codeArticle]
    );

    // Enregistrer la consommation
    await client.query(
      'INSERT INTO consommation (sejour_id, code_article, quantite) VALUES ($1, $2, $3)',
      [sejourId.trim(), codeArticle, quantite]
    );

    // Vérifier si le seuil vient d'être franchi (passage de >= seuil à < seuil)
    let evenementCree = false;
    let outboxId = null;
    if (stockActuel >= seuil && nouveauStock < seuil) {
      const payload = {
        codeArticle,
        libelle,
        stockActuel: nouveauStock,
        seuil,
        clinique: 'TUNIS',
        timestamp: new Date().toISOString(),
      };
      const { rows: outbox } = await client.query(
        'INSERT INTO stock_event_outbox (payload) VALUES ($1) RETURNING id',
        [JSON.stringify(payload)]
      );
      outboxId = outbox[0].id;
      evenementCree = true;
    }

    return {
      codeArticle,
      libelle,
      stockActuel: nouveauStock,
      seuil,
      evenementCree,
      outboxId,
    };
  });

  // Publier l'événement RabbitMQ en dehors de la transaction (patron Outbox)
  let publication = 'AUCUN';
  if (resultat.evenementCree) {
    try {
      await flushOutbox(db);
      const { rows } = await db.query(
        'SELECT publie FROM stock_event_outbox WHERE id = $1',
        [resultat.outboxId]
      );
      publication = rows[0].publie ? 'PUBLIE' : 'EN_ATTENTE';
    } catch (err) {
      console.error('[stock] Publication RabbitMQ différée, événement conservé dans l\'outbox :', err.message);
      publication = 'EN_ATTENTE';
    }
  }

  const { outboxId: _ignored, ...reponse } = resultat;
  res.status(201).json({ ...reponse, publication });
});

// Enregistrer une réception : POST /receptions { commandeId?, codeArticle, quantite }
// Incrémente le stock après livraison.
app.post('/receptions', async (req, res) => {
  const { commandeId = null, codeArticle, quantite } = req.body || {};
  if (!validerEntreeStock({ codeArticle, quantite })) {
    throw new ErreurHttp(400, 'codeArticle (texte) et quantite (entier > 0) obligatoires');
  }
  if (commandeId !== null && typeof commandeId !== 'string') {
    throw new ErreurHttp(400, 'commandeId doit être un texte (ou absent)');
  }

  const reception = await transaction(async (client) => {
    const { rows: articles } = await client.query(
      'SELECT 1 FROM article WHERE code = $1',
      [codeArticle]
    );
    if (articles.length === 0) throw new ErreurHttp(404, `Article ${codeArticle} introuvable`);

    const { rows } = await client.query(
      `INSERT INTO reception (commande_id, code_article, quantite)
       VALUES ($1, $2, $3)
       RETURNING id, commande_id AS "commandeId",
                 code_article AS "codeArticle", quantite`,
      [commandeId || null, codeArticle, quantite]
    );

    await client.query(
      'UPDATE stock SET quantite = quantite + $1 WHERE code_article = $2',
      [quantite, codeArticle]
    );

    const { rows: stock } = await client.query(
      'SELECT quantite AS "stockActuel" FROM stock WHERE code_article = $1',
      [codeArticle]
    );

    return { ...rows[0], stockActuel: stock[0].stockActuel };
  });

  res.status(201).json(reception);
});

// Consulter l'historique des consommations d'un séjour : GET /consommations?sejourId=SEJ-0001
app.get('/consommations', async (req, res) => {
  const { sejourId } = req.query;
  if (!sejourId) throw new ErreurHttp(400, 'Paramètre sejourId obligatoire');

  const { rows } = await db.query(
    `SELECT c.id, c.sejour_id AS "sejourId", c.code_article AS "codeArticle",
            c.quantite, c.date_conso AS "dateConso", a.libelle
       FROM consommation c
       JOIN article a ON a.code = c.code_article
      WHERE c.sejour_id = $1
      ORDER BY c.id`,
    [sejourId]
  );
  res.json(rows);
});

// Lancer le polling Outbox pour publier les événements en attente
const pollTimer = setInterval(() => {
  flushOutbox(db).catch((err) => {
    console.error('[stock] Échec de publication des événements en attente :', err.message);
  });
}, config.outboxPollMs);

process.on('SIGINT', () => { clearInterval(pollTimer); process.exit(0); });
process.on('SIGTERM', () => { clearInterval(pollTimer); process.exit(0); });

console.log(`[stock] mode ESB/RabbitMQ : ${config.rabbitmqUrl}`);
demarrer(app, config.stockPort, 'stock');
