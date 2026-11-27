// Briques communes aux deux services : création de l'app Express, /health,
// gestion des erreurs au format { "erreur": "..." } et démarrage sur 0.0.0.0.
const express = require('express');
const cors = require('cors');

// Erreur métier avec un code HTTP (ex. throw new ErreurHttp(404, 'Séjour inconnu')).
class ErreurHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Crée une app Express avec CORS (formulaires Camunda dans le navigateur), JSON et GET /health.
function creerApp(nomService) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ statut: 'ok', service: nomService }));
  return app;
}

// Ajoute les gestionnaires 404 / erreurs puis démarre l'écoute sur toutes les interfaces.
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
    // Base PostgreSQL arrêtée ou mal configurée -> 503 plutôt qu'une erreur interne
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', '28P01', '3D000'].includes(err.code)) {
      console.warn(`[${nomService}] 503 Base de données injoignable (${err.code})`);
      return res.status(503).json({ erreur: 'Base de données injoignable' });
    }
    const status = err.status || 500;
    if (!err.status) console.error(`[${nomService}] erreur inattendue :`, err);
    else if (status >= 500) console.warn(`[${nomService}] ${status} ${err.message}`);
    res.status(status).json({ erreur: status >= 500 && !err.status ? 'Erreur interne du service' : err.message });
  });

  const serveur = app.listen(port, '0.0.0.0', () => {
    console.log(`[${nomService}] à l'écoute sur 0.0.0.0:${port}`);
  });
  serveur.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[${nomService}] le port ${port} est déjà utilisé : arrêter l'autre programme ou changer le port dans .env`);
    } else {
      console.error(`[${nomService}] impossible de démarrer :`, err.message);
    }
    process.exit(1);
  });
}

module.exports = { ErreurHttp, creerApp, demarrer };
