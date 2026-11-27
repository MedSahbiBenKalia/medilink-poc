// Configuration des deux services : tout vient des variables d'environnement (fichier .env).
// Aucune IP ni aucun port ne doit être écrit ailleurs dans le code.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;

// Construit l'URL de connexion PostgreSQL en y ajoutant l'utilisateur et le mot de passe.
function urlBase(nomBase) {
  const url = new URL(env.DB_URL || `postgres://localhost:5432/${nomBase}`);
  url.username = encodeURIComponent(env.DB_USER || 'medilink');
  url.password = encodeURIComponent(env.DB_PASSWORD || 'medilink');
  return url.toString();
}

module.exports = {
  dbSoinsUrl: urlBase(env.DB_SOINS || 'soins'),
  dbPharmacieUrl: urlBase(env.DB_PHARMACIE || 'pharmacie'),
  sejourPort: Number(env.SEJOUR_PORT || 8093),
  stockPort: Number(env.STOCK_PORT || 8094),
  esbSoinsUrl: env.ESB_SOINS_URL || 'http://localhost:8081/esb-soins',
  esbMode: (env.ESB_MODE || 'mock').toLowerCase(), // 'mock' ou 'real'
  rabbitmqUrl: env.RABBITMQ_URL || 'amqp://medilink:medilink@localhost:5672',
  rabbitmqExchange: env.RABBITMQ_EXCHANGE || 'soins.evenements',
  rabbitmqRoutingKey: env.RABBITMQ_ROUTING_KEY || 'stock.sous-seuil',
  outboxPollMs: Number(env.STOCK_OUTBOX_POLL_MS || 5000),
};
