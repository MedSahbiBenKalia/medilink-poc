// Service Couverture / Droits (port COUVERTURE_PORT, 8092 par defaut)
// Verifie les droits via l'ESB Soins et regularise la prise en charge ;
// seul proprietaire de la table "couverture". Ne lit jamais la table "patient" : passe par le Service Patient.
const config = require('../config');
const { creerApp, demarrer } = require('../commun');

const app = creerApp('couverture');

// Les routes /couvertures seront ajoutees en phase 3.

console.log(`[couverture] mode ESB : ${config.esbMode}`);
demarrer(app, config.couverturePort, 'couverture');
