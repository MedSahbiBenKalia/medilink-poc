// Pool de connexions a la BDD Soins, partage par les deux services.
const { Pool, types } = require('pg');
const config = require('./config');

// Les colonnes DATE sont renvoyees telles quelles ("1980-04-12") au lieu d'objets Date,
// pour eviter les decalages de fuseau horaire et respecter le format ISO du contrat.
types.setTypeParser(types.builtins.DATE, (valeur) => valeur);

const pool = new Pool({ connectionString: config.dbUrl });

// Si PostgreSQL redemarre, une connexion inactive du pool est coupee : sans ce gestionnaire,
// l'erreur ferait planter tout le service. On la journalise ; le pool ouvrira une nouvelle connexion.
pool.on('error', (err) => {
  console.warn(`[base] connexion PostgreSQL perdue (${err.code || err.message}), reconnexion a la prochaine requete`);
});

module.exports = {
  query: (sql, params) => pool.query(sql, params),
  pool,
};
