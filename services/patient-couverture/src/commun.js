// Briques communes aux deux services : creation de l'app Express, /health,
// gestion des erreurs au format { "erreur": "..." } et demarrage sur 0.0.0.0.
const express = require('express');
const cors = require('cors');

// Erreur metier avec un code HTTP (ex. throw new ErreurHttp(404, 'Patient inconnu')).
class ErreurHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Cree une app Express avec CORS (formulaires Camunda dans le navigateur), JSON et GET /health.
function creerApp(nomService) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ statut: 'ok', service: nomService }));
  return app;
}

// Ajoute les gestionnaires 404 / erreurs puis demarre l'ecoute sur toutes les interfaces.
function demarrer(app, port, nomService) {
  // Route inconnue
  app.use((req, res) => {
    res.status(404).json({ erreur: `Route inconnue : ${req.method} ${req.path}` });
  });

  // Gestionnaire d'erreurs (Express 5 y envoie aussi les erreurs des routes async)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ erreur: 'Corps JSON invalide' });
    }
    const status = err.status || 500;
    if (status >= 500) console.error(`[${nomService}]`, err);
    res.status(status).json({ erreur: status >= 500 && !err.status ? 'Erreur interne du service' : err.message });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`[${nomService}] a l'ecoute sur 0.0.0.0:${port}`);
  });
}

module.exports = { ErreurHttp, creerApp, demarrer };
