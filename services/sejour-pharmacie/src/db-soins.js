// Pool de connexions à la BDD Soins, partagé par le Service Séjour & Actes.
const { Pool, types } = require('pg');
const config = require('./config');

// Les colonnes DATE sont renvoyées telles quelles ("2026-11-27") au lieu d'objets Date.
types.setTypeParser(types.builtins.DATE, (valeur) => valeur);

const pool = new Pool({ connectionString: config.dbSoinsUrl });

pool.on('error', (err) => {
  console.warn(`[soins] connexion PostgreSQL perdue (${err.code || err.message}), reconnexion à la prochaine requête`);
});

module.exports = {
  query: (sql, params) => pool.query(sql, params),
  connect: () => pool.connect(),
  pool,
};
