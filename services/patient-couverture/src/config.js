// Configuration des deux services : tout vient des variables d'environnement (fichier .env).
// Aucune IP ni aucun port ne doit etre ecrit ailleurs dans le code.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;

// Construit l'URL de connexion PostgreSQL en y ajoutant l'utilisateur et le mot de passe.
function urlBase() {
  const url = new URL(env.DB_URL || 'postgres://localhost:5432/soins');
  url.username = encodeURIComponent(env.DB_USER || 'medilink');
  url.password = encodeURIComponent(env.DB_PASSWORD || 'medilink');
  return url.toString();
}

module.exports = {
  dbUrl: urlBase(),
  patientPort: Number(env.PATIENT_PORT || 8091),
  couverturePort: Number(env.COUVERTURE_PORT || 8092),
  patientServiceUrl: env.PATIENT_SERVICE_URL || 'http://localhost:8091',
  esbSoinsUrl: env.ESB_SOINS_URL || 'http://localhost:8081/esb-soins',
  esbMode: (env.ESB_MODE || 'mock').toLowerCase(), // 'mock' ou 'real'
};
