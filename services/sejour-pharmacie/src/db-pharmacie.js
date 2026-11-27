// Pool de connexions à la BDD Pharmacie, utilisé par le Service Stock Pharmacie.
const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.dbPharmacieUrl });

pool.on('error', (err) => {
  console.warn(`[pharmacie] connexion PostgreSQL perdue (${err.code || err.message}), reconnexion à la prochaine requête`);
});

module.exports = {
  query: (sql, params) => pool.query(sql, params),
  connect: () => pool.connect(),
  pool,
};
