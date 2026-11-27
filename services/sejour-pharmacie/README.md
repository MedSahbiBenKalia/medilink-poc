# MediLink – Tâche 3 : Service Séjour & Actes (8093) & Service Stock Pharmacie (8094)

Ce dossier contient les deux services REST de la Tâche 3, construits **selon le même principe que la Tâche 2** (`patient-couverture`) : Node.js / Express 5, PostgreSQL (`pg`), architecture en `src/<service>/`, configuration 100 % via `.env`.

---

## Architecture

```
sejour-pharmacie/
├── src/
│   ├── config.js           ← Variables d'environnement (ports, BDD, ESB, RabbitMQ)
│   ├── commun.js           ← ErreurHttp, creerApp(), demarrer() – identique à la tâche 2
│   ├── db-soins.js         ← Pool PostgreSQL → BDD soins
│   ├── db-pharmacie.js     ← Pool PostgreSQL → BDD pharmacie
│   ├── sejour/
│   │   ├── server.js       ← Service Séjour & Actes (port 8093)
│   │   └── esbClient.js    ← Publie "sortie validée" vers l'ESB (mock / real)
│   └── stock/
│       ├── server.js       ← Service Stock Pharmacie (port 8094)
│       └── rabbitmqClient.js ← Patron Outbox → publie stockSousSeuil sur RabbitMQ
├── outils/
│   └── faux-esb.js         ← Simule l'ESB Soins (pour ESB_MODE=real sans l'ESB réel)
├── postman/
│   └── medilink-tache3.postman_collection.json
├── .env.example
├── .gitignore
└── package.json
```

---

## Prérequis

| Composant | Version | Notes |
|-----------|---------|-------|
| Node.js | ≥ 20 | `node --version` |
| PostgreSQL | 16 | Lancé via `docker compose --profile pc2 up -d` (tâche 1) |
| RabbitMQ | 3-management | Lancé via `docker compose --profile pc4 up -d` (tâche 1) |

> La BDD **soins** doit contenir les tables créées par `01-soins.sql` (patient, sejour, acte, lit, tarif).  
> La BDD **pharmacie** doit contenir les tables créées par `02-pharmacie.sql` **mis à jour** (article, stock, consommation, reception, **stock_event_outbox**).

---

## Installation

```bash
cd medilink-poc/services/sejour-pharmacie
cp .env.example .env        # Ajuster les valeurs si besoin
npm install
```

---

## Démarrage

```bash
# Fenêtre 1 – Service Séjour & Actes
npm run sejour

# Fenêtre 2 – Service Stock Pharmacie
npm run stock

# Optionnel : Faux ESB (si ESB_MODE=real et ESB Soins absent)
npm run faux-esb
```

Développement avec rechargement automatique :

```bash
npm run dev:sejour
npm run dev:stock
```

---

## Variables d'environnement (`.env`)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SEJOUR_PORT` | `8093` | Port du Service Séjour & Actes |
| `STOCK_PORT` | `8094` | Port du Service Stock Pharmacie |
| `DB_URL` | `postgres://localhost:5432/soins` | URL de base pour PostgreSQL |
| `DB_SOINS` | `soins` | Nom de la base Soins |
| `DB_PHARMACIE` | `pharmacie` | Nom de la base Pharmacie |
| `DB_USER` | `medilink` | Utilisateur PostgreSQL |
| `DB_PASSWORD` | `medilink` | Mot de passe PostgreSQL |
| `ESB_MODE` | `mock` | `mock` = simulé, `real` = appel HTTP réel |
| `ESB_SOINS_URL` | `http://localhost:8081/esb-soins` | URL de l'ESB Soins |
| `RABBITMQ_URL` | `amqp://medilink:medilink@localhost:5672` | URL RabbitMQ |
| `RABBITMQ_EXCHANGE` | `soins.evenements` | Exchange topic |
| `RABBITMQ_ROUTING_KEY` | `stock.sous-seuil` | Clé de routage |
| `STOCK_OUTBOX_POLL_MS` | `5000` | Polling Outbox (ms) |

---

## Endpoints

### Service Séjour & Actes – port 8093

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/lits/libres` | Lits disponibles (`?service=CHIRURGIE`) |
| `POST` | `/sejours` | Ouvrir un séjour `{ipg, service, litId}` |
| `GET` | `/sejours/:sejourId` | Lire un séjour |
| `POST` | `/sejours/:sejourId/actes` | Enregistrer des actes `{lignes:[{codeActe,quantite,dateActe}]}` |
| `GET` | `/sejours/:sejourId/actes` | Lister les actes d'un séjour |
| `PUT` | `/sejours/:sejourId/sortie` | Valider la sortie → envoie événement à l'ESB |

### Service Stock Pharmacie – port 8094

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/stocks` | Lister tous les articles avec stock |
| `GET` | `/stocks/:codeArticle` | Consulter le stock d'un article |
| `POST` | `/consommations` | Enregistrer une consommation `{sejourId,codeArticle,quantite}` |
| `GET` | `/consommations?sejourId=` | Historique des consommations d'un séjour |
| `POST` | `/receptions` | Enregistrer une réception `{commandeId?,codeArticle,quantite}` |

---

## Scénario de démonstration RabbitMQ

1. Vérifier le stock PARA500 : `GET /stocks/PARA500` → `stockActuel: 105, seuil: 100`
2. Consommer 10 unités : `POST /consommations { sejourId, codeArticle: "PARA500", quantite: 10 }`
3. Le stock passe à 95 < seuil 100 → la réponse indique `evenementCree: true, publication: "PUBLIE"`
4. Ouvrir la console RabbitMQ : `http://localhost:15672` (medilink / medilink)
5. Aller dans **Queues → stock.sous-seuil** → le message est visible dans **Get messages**

---

## Collection Postman

Importer `postman/medilink-tache3.postman_collection.json` dans Postman.  
La requête **3.1** capture automatiquement le `sejourId` dans une variable de collection réutilisée par toutes les requêtes suivantes.

---

## Codes HTTP renvoyés

| Code | Situation |
|------|-----------|
| `200` | Succès lecture / sortie validée |
| `201` | Séjour créé / actes enregistrés / consommation / réception |
| `400` | Corps invalide ou champ manquant |
| `404` | Patient / séjour / lit / article introuvable |
| `409` | Lit occupé, séjour clôturé, stock insuffisant |
| `502` | ESB Soins indisponible (mode real) |
| `503` | Base de données injoignable |

---

## Différences avec la Tâche 2

| Tâche 2 | Tâche 3 |
|---------|---------|
| BDD Soins uniquement | BDD Soins + BDD Pharmacie |
| Pas de messaging | RabbitMQ (patron Outbox) |
| Appels ESB HTTP | Appels ESB HTTP + publication AMQP |
| 2 BDD virtuellement séparées | 2 pools distincts (`db-soins.js`, `db-pharmacie.js`) |
