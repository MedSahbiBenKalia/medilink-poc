# Tâche 2 : Service Patient et Service Couverture / Droits

Deux services REST du domaine Soins, déployés sur le PC Soins (PC2, `192.168.1.12`) :

| Service | Port | Rôle |
|---|---|---|
| Service Patient | 8091 | identité unique du patient (IPG) ; seul propriétaire de la table `patient` |
| Service Couverture / Droits | 8092 | vérifie les droits via l'ESB Soins, régularise la prise en charge ; seul propriétaire de la table `couverture` |

Couverture ne lit jamais la table `patient` : il appelle le Service Patient (appel direct, même domaine),
puis l'ESB Soins pour les droits (routage CNAM ou assureur privé).

Technologie : Node.js 20 ou plus, Express 5, PostgreSQL (`pg`).

## 1. Prérequis

- Node.js 20 ou plus, Docker Desktop.
- La base `soins` de la tâche 1. Les tables et les données de test sont créées par
  [`infra/postgres/init/01-soins.sql`](../../infra/postgres/init/01-soins.sql). Ce dossier ne contient pas de script SQL.

```powershell
cd infra
copy .env.example .env
docker compose --profile pc2 up -d
```

## 2. Lancer les services

```powershell
cd services/patient-couverture
copy .env.example .env      # puis adapter si besoin
npm install
npm run patient             # terminal 1 -> http://localhost:8091
npm run couverture          # terminal 2 -> http://localhost:8092
```

Les variantes `npm run dev:patient` et `npm run dev:couverture` redémarrent à chaque modification du code.

## 3. Configuration (`.env`)

Aucune IP ni aucun port n'est écrit dans le code : tout vient de ce fichier.

| Variable | Défaut | Jour J (PC2) |
|---|---|---|
| `DB_URL` | `postgres://localhost:5432/soins` | inchangé (la base est sur PC2) |
| `DB_USER` / `DB_PASSWORD` | `medilink` / `medilink` | inchangé |
| `PATIENT_PORT` / `COUVERTURE_PORT` | `8091` / `8092` | inchangé |
| `PATIENT_SERVICE_URL` | `http://localhost:8091` | inchangé (même PC) |
| `ESB_SOINS_URL` | `http://localhost:8081/esb-soins` | `http://192.168.1.12:8081/esb-soins` |
| `ESB_MODE` | `mock` | `real` |

## 4. Passer de mock à real (ESB Soins)

- `ESB_MODE=mock` : Couverture simule l'ESB sans appel réseau. `CN-100002` donne des droits expirés ; tous les autres numéros ont des droits valides.
- `ESB_MODE=real` : Couverture appelle `POST {ESB_SOINS_URL}/droits`, avec un timeout de 5 s.

Le passage de l'un à l'autre ne demande **que** de changer `ESB_MODE` dans `.env`, puis de relancer `npm run couverture`.

Pour tester le mode real avant que l'ESB Soins (tâche 6) soit prêt, utilise le faux ESB fourni dans `outils/`.
Il sert aux tests uniquement et n'est pas livré dans l'image Docker.

```powershell
npm run faux-esb                       # écoute sur http://localhost:8081/esb-soins
$env:FAUX_ESB_DELAI_MS=7000; npm run faux-esb   # ESB lent  -> Couverture répond 503 après 5 s
$env:FAUX_ESB_ERREUR=1; npm run faux-esb        # ESB en panne -> 503
```

## 5. API

Les réponses sont en JSON camelCase. Les erreurs ont la forme `{ "erreur": "message lisible" }`.
Tous les services exposent `GET /health`, qui renvoie `{ "statut": "ok", "service": "patient" }` (ou `"couverture"`).

### Service Patient (8091)
| Méthode | Chemin | Réponses |
|---|---|---|
| GET | `/patients/{ipg}` | 200 · 404 |
| GET | `/patients?cin=08123456` | 200 · 400 (cin absent) · 404 |
| POST | `/patients` | 201 (IPG suivant généré, ex. `IPG-0005`) · 400 · 409 (CIN déjà connu) |
| PATCH (ou PUT) | `/patients/{ipg}` | 200 · 400 · 404 · 409 |

Validation : `cin` doit compter 8 chiffres ; `nom`, `prenom`, `dateNaissance` (`AAAA-MM-JJ`) et `numeroAssure` sont obligatoires ;
`typeCouverture` vaut `CNAM` ou `ASSUREUR` ; `assureur` est obligatoire si `ASSUREUR` et doit être null si `CNAM`.

`PATCH` est une **modification partielle** : on n'envoie que les champs qui changent, par exemple `{ "telephone": "+21629999999" }`.
Le patient obtenu après modification est validé en entier. L'IPG n'est pas modifiable. Passer en `CNAM` efface automatiquement `assureur`.

### Service Couverture / Droits (8092)
| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/couvertures/verification` | `{ "ipg": "IPG-0001" }` → lit le patient, appelle l'ESB, enregistre, répond |
| PATCH (ou PUT) | `/couvertures/{ipg}` | régularisation par l'agent d'accueil |
| GET | `/couvertures/{ipg}` | dernière couverture enregistrée |

Réponse commune :
```json
{ "ipg": "IPG-0001", "droitsValides": true, "organisme": "CNAM", "motif": null, "accordId": "ACC-0001" }
```
`organisme` vaut `CNAM`, ou le nom de l'assureur privé (`STAR`, `COMAR`…).

Régularisation (`PATCH`), où tous les champs sont optionnels :
```json
{ "numeroAssure": "CN-100002B", "typeCouverture": "CNAM", "assureur": null,
  "accordId": "ACC-MANUEL-01", "motif": "Carte CNAM renouvelée" }
```
Si le type, le numéro ou l'assureur changent, Couverture fait un `PATCH /patients/{ipg}` vers le Service Patient,
qui reste propriétaire de ces champs. Les droits sont ensuite enregistrés comme valides.

Codes d'erreur : 400 (corps invalide) · 404 (patient inconnu) · 503 (Service Patient, ESB Soins ou base injoignable) ·
502 (réponse de l'ESB mal formée).

## 6. Tests Postman

Collection : [`postman/medilink-tache2.postman_collection.json`](postman/medilink-tache2.postman_collection.json).
Elle contient 18 requêtes, chacune avec un test automatique.

1. Importer la collection dans Postman, lancer les deux services, puis faire *Run collection*.
2. Les variables de la collection `patientUrl` et `couvertureUrl` valent `http://localhost:8091` et `:8092`.
   Pour la démo, remplacer `localhost` par `192.168.1.12`.
3. La collection peut être relancée : le CIN du nouveau patient est aléatoire, et la dernière requête remet IPG-0002 à `CN-100002`.

| Scénario | Résultat attendu |
|---|---|
| Vérification IPG-0001 (CNAM) | `droitsValides: true` |
| Vérification IPG-0002 (CNAM expiré) | `false`, motif « Droits expirés… » |
| Régularisation IPG-0002 avec `CN-100002B` | `true`, numéro mis à jour dans le Service Patient |
| Vérification IPG-0003 (STAR) | `true`, organisme `STAR` |
| Vérification IPG-0004 (CNAM) | `true` |
| Vérification IPG-9999 | 404 |
| `GET /patients?cin=08123456` | fiche d'Ali Ben Salah |
| `POST /patients` | 201, IPG généré |

En ligne de commande, sans Postman : `npx newman run postman/medilink-tache2.postman_collection.json`.

## 7. Docker (plan B, optionnel)

Une seule image sert aux deux services :
```powershell
docker build -t medilink-tache2 .
docker run -d -p 8091:8091 -e DB_URL=postgres://host.docker.internal:5432/soins medilink-tache2
docker run -d -p 8092:8092 -e DB_URL=postgres://host.docker.internal:5432/soins `
  -e PATIENT_SERVICE_URL=http://host.docker.internal:8091 medilink-tache2 node src/couverture/server.js
```

## 8. Jour J (PC2)

1. Mettre PC2 en IP fixe `192.168.1.12`, puis lancer `infra/scripts/pare-feu.ps1 -Pc PC2`, qui ouvre notamment 8091 et 8092.
2. Lancer la base : `docker compose --profile pc2 up -d` (dans `infra/`).
3. Dans `.env` : `ESB_MODE=real` et `ESB_SOINS_URL=http://192.168.1.12:8081/esb-soins`.
4. Lancer `npm run patient` et `npm run couverture`, puis tester `http://192.168.1.12:8091/health` depuis un autre PC.

## 9. Écarts avec `interfaces.md` et simplifications du POC

- **`PATCH` en plus de `PUT`** pour `/patients/{ipg}` et `/couvertures/{ipg}`. `PATCH` est la méthode recommandée : modification partielle, où l'on n'envoie que ce qui change.
  `PUT`, annoncé dans `interfaces.md`, reste accepté et appelle le même code, ce qui garde la compatibilité avec le contrat (Camunda, Kong). Un objet complet envoyé en `PUT` donne un remplacement.
- **Une seule couverture par patient**, alignée sur la table de la tâche 1 : chaque vérification ou régularisation remplace la précédente, sans historique.
  `organisme` n'est pas stocké : il est calculé à partir du patient.
- `date_fin_droits` n'est pas renseignée, car la réponse de l'ESB définie dans `interfaces.md` ne la contient pas.
- Hors périmètre du POC : l'événement « patient créé ou modifié » sur RabbitMQ et la correspondance IPP ↔ IPG.

## 10. Arborescence

```
src/config.js              variables d'environnement (seul endroit avec ports et URL)
src/db.js                  pool PostgreSQL
src/commun.js              Express, CORS, /health, gestion des erreurs, écoute sur 0.0.0.0
src/patient/               Service Patient (server.js, validation.js)
src/couverture/            Service Couverture (server.js, patientClient.js, esbClient.js)
outils/faux-esb.js         faux ESB Soins pour les tests (non livré)
postman/                   collection Postman
captures/                  captures d'écran des tests (chapitre « résultats » du rapport)
```
