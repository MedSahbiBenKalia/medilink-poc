// Service Couverture / Droits (port COUVERTURE_PORT, 8092 par defaut)
// Verifie les droits via l'ESB Soins et regularise la prise en charge ;
// seul proprietaire de la table "couverture". Ne lit jamais la table "patient" : passe par le Service Patient.
//
// Table "couverture" (creee par la tache 1) : une ligne par patient = derniere verification
// (ipg, droits_valides, date_fin_droits, motif, accord_id). L'organisme n'est pas stocke :
// il est calcule a partir du patient.
const config = require('../config');
const db = require('../db');
const { ErreurHttp, creerApp, demarrer } = require('../commun');
const { lirePatient, modifierPatient } = require('./patientClient');
const { verifierDroits } = require('./esbClient');

const app = creerApp('couverture');

// ---------- Fonctions utilitaires ----------

// Organisme payeur : CNAM, ou le nom de l'assureur prive (STAR, COMAR...).
function organismeDe(patient) {
  return patient.typeCouverture === 'CNAM' ? 'CNAM' : patient.assureur;
}

// Enregistre (ou remplace) la derniere couverture connue du patient.
async function enregistrerCouverture(ipg, droitsValides, motif, accordId) {
  await db.query(
    `INSERT INTO couverture (ipg, droits_valides, date_fin_droits, motif, accord_id)
     VALUES ($1, $2, NULL, $3, $4)
     ON CONFLICT (ipg) DO UPDATE
       SET droits_valides = EXCLUDED.droits_valides,
           date_fin_droits = NULL,
           motif = EXCLUDED.motif,
           accord_id = EXCLUDED.accord_id`,
    [ipg, droitsValides, motif, accordId]
  );
}

// Reponse commune aux trois routes (format de interfaces.md §2).
function reponse(patient, droitsValides, motif, accordId) {
  return { ipg: patient.ipg, droitsValides, organisme: organismeDe(patient), motif, accordId };
}

async function patientExistant(ipg) {
  const patient = await lirePatient(ipg);
  if (!patient) throw new ErreurHttp(404, `Patient ${ipg} inconnu`);
  return patient;
}

const texteOuNull = (v) => v === undefined || v === null || typeof v === 'string';

// ---------- Routes ----------

// Verification des droits (appelee par le workflow Camunda) : { "ipg": "IPG-0001" }
app.post('/couvertures/verification', async (req, res) => {
  const ipg = req.body && req.body.ipg;
  if (typeof ipg !== 'string' || ipg.trim() === '') throw new ErreurHttp(400, 'ipg obligatoire');

  // 1. Lire le patient (Service Patient)
  const patient = await patientExistant(ipg);

  // 2. Demander les droits a l'ESB Soins (qui route vers la CNAM ou l'assureur)
  const droits = await verifierDroits({
    numeroAssure: patient.numeroAssure,
    typeCouverture: patient.typeCouverture,
    assureur: patient.assureur,
  });

  // 3. Enregistrer le resultat, 4. repondre
  await enregistrerCouverture(ipg, droits.droitsValides, droits.motif, droits.accordId);
  res.json(reponse(patient, droits.droitsValides, droits.motif, droits.accordId));
});

// Regularisation par l'agent d'accueil (modification partielle) :
// { "typeCouverture"?, "numeroAssure"?, "assureur"?, "accordId"?, "motif"? }
app.patch('/couvertures/:ipg', async (req, res) => {
  const { ipg } = req.params;
  const corps = req.body || {};
  if (!texteOuNull(corps.accordId)) throw new ErreurHttp(400, 'accordId doit etre un texte');
  if (!texteOuNull(corps.motif)) throw new ErreurHttp(400, 'motif doit etre un texte');

  let patient = await patientExistant(ipg);

  // Les champs de couverture du patient appartiennent au Service Patient :
  // s'ils changent, on lui demande la modification (PATCH) au lieu d'ecrire dans sa table.
  const modifications = {};
  for (const champ of ['typeCouverture', 'numeroAssure', 'assureur']) {
    if (champ in corps && corps[champ] !== patient[champ]) modifications[champ] = corps[champ];
  }
  if (Object.keys(modifications).length > 0) {
    patient = await modifierPatient(ipg, modifications);
  }

  // La prise en charge est regularisee : droits consideres comme valides
  const motif = corps.motif ?? null;
  const accordId = corps.accordId ?? null;
  await enregistrerCouverture(ipg, true, motif, accordId);
  res.json(reponse(patient, true, motif, accordId));
});

// Derniere couverture enregistree d'un patient
app.get('/couvertures/:ipg', async (req, res) => {
  const { ipg } = req.params;
  const { rows } = await db.query('SELECT * FROM couverture WHERE ipg = $1', [ipg]);
  if (rows.length === 0) throw new ErreurHttp(404, `Aucune couverture enregistree pour ${ipg}`);
  const patient = await patientExistant(ipg);
  const c = rows[0];
  res.json(reponse(patient, c.droits_valides, c.motif, c.accord_id));
});

console.log(`[couverture] mode ESB : ${config.esbMode}`);
demarrer(app, config.couverturePort, 'couverture');
