// Service Patient (port PATIENT_PORT, 8091 par defaut)
// Identite unique du patient (IPG) ; seul proprietaire de la table "patient" de la BDD Soins.
const config = require('../config');
const db = require('../db');
const { ErreurHttp, creerApp, demarrer } = require('../commun');
const { COLONNES, CHAMPS, versJson, extraireChamps, validerPatient } = require('./validation');

const app = creerApp('patient');

// ---------- Acces a la base ----------

async function lireParIpg(ipg) {
  const { rows } = await db.query('SELECT * FROM patient WHERE ipg = $1', [ipg]);
  return rows[0] ? versJson(rows[0]) : null;
}

// IPG suivant : plus grand numero existant + 1 (IPG-0004 -> IPG-0005).
async function ipgSuivant() {
  const { rows } = await db.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(ipg FROM 5) AS INTEGER)), 0) + 1 AS n FROM patient WHERE ipg ~ '^IPG-[0-9]+$'"
  );
  return `IPG-${String(rows[0].n).padStart(4, '0')}`;
}

// Traduit les erreurs PostgreSQL utiles en erreurs HTTP lisibles.
function erreurBase(err) {
  if (err.code === '23505') return new ErreurHttp(409, 'Un patient avec ce CIN existe deja');
  if (err.code === '22001') return new ErreurHttp(400, 'Une valeur depasse la longueur autorisee');
  return err;
}

function verifierValide(patient) {
  const erreurs = validerPatient(patient);
  if (erreurs.length > 0) throw new ErreurHttp(400, erreurs.join(' ; '));
}

// ---------- Routes ----------

// Lire un patient par son IPG
app.get('/patients/:ipg', async (req, res) => {
  const patient = await lireParIpg(req.params.ipg);
  if (!patient) throw new ErreurHttp(404, `Patient ${req.params.ipg} inconnu`);
  res.json(patient);
});

// Rechercher un patient par CIN : GET /patients?cin=08123456
app.get('/patients', async (req, res) => {
  const { cin } = req.query;
  if (!cin) throw new ErreurHttp(400, 'Parametre cin obligatoire (ex. /patients?cin=08123456)');
  const { rows } = await db.query('SELECT * FROM patient WHERE cin = $1', [cin]);
  if (rows.length === 0) throw new ErreurHttp(404, `Aucun patient avec le CIN ${cin}`);
  res.json(versJson(rows[0]));
});

// Creer un patient : l'IPG est genere par le service
app.post('/patients', async (req, res) => {
  const patient = { telephone: null, email: null, assureur: null, ...extraireChamps(req.body) };
  verifierValide(patient);

  const ipg = await ipgSuivant();
  const colonnes = ['ipg', ...CHAMPS.map((c) => COLONNES[c])];
  const valeurs = [ipg, ...CHAMPS.map((c) => patient[c])];
  const parametres = valeurs.map((_, i) => `$${i + 1}`);
  try {
    await db.query(`INSERT INTO patient (${colonnes.join(', ')}) VALUES (${parametres.join(', ')})`, valeurs);
  } catch (err) {
    throw erreurBase(err);
  }
  res.status(201).json(await lireParIpg(ipg));
});

// Modifier un patient (modification partielle) : seuls les champs envoyes changent
app.patch('/patients/:ipg', async (req, res) => {
  const { ipg } = req.params;
  const existant = await lireParIpg(ipg);
  if (!existant) throw new ErreurHttp(404, `Patient ${ipg} inconnu`);

  if (req.body && req.body.ipg !== undefined && req.body.ipg !== ipg) {
    throw new ErreurHttp(400, "L'IPG ne peut pas etre modifie");
  }
  const modifications = extraireChamps(req.body);
  if (Object.keys(modifications).length === 0) throw new ErreurHttp(400, 'Aucun champ a modifier');

  // Passage en CNAM sans preciser l'assureur : on l'efface automatiquement
  if (modifications.typeCouverture === 'CNAM' && !('assureur' in modifications)) {
    modifications.assureur = null;
  }

  // On valide le patient tel qu'il sera apres modification
  const patient = { ...existant, ...modifications };
  verifierValide(patient);

  const champs = Object.keys(modifications);
  const affectations = champs.map((c, i) => `${COLONNES[c]} = $${i + 1}`);
  try {
    await db.query(
      `UPDATE patient SET ${affectations.join(', ')} WHERE ipg = $${champs.length + 1}`,
      [...champs.map((c) => patient[c]), ipg]
    );
  } catch (err) {
    throw erreurBase(err);
  }
  res.json(await lireParIpg(ipg));
});

demarrer(app, config.patientPort, 'patient');
