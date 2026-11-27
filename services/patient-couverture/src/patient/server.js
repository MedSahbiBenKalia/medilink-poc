// Service Patient (port PATIENT_PORT, 8091 par defaut)
// Identite unique du patient (IPG) ; seul proprietaire de la table "patient" de la BDD Soins.
const config = require('../config');
const { creerApp, demarrer } = require('../commun');

const app = creerApp('patient');

// Les routes /patients seront ajoutees en phase 2.

demarrer(app, config.patientPort, 'patient');
