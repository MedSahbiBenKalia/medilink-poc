# MediLink – POC : contrat d'interfaces

Ce fichier est la référence commune. **On ne change rien sans prévenir le groupe.**
Si un champ ou une URL doit changer : modifier ce fichier dans le repo et l'annoncer sur le groupe.

Conventions :
- JSON en camelCase, dates au format ISO `2026-12-10`, montants en DT avec 3 décimales max (`1200.000`).
- Aucune IP ni aucun port écrit en dur dans les flux ou le code : tout passe par un fichier de propriétés
  (`config.properties`, `application.yml`, variables d'environnement…). Le jour J, on ne change que ce fichier.
- Identifiants : patient `IPG-0001`, séjour `SEJ-0001`, facture `FAC-0001`, bordereau `BRD-0001`, commande `CMD-0001`.

---

## 1. Répartition sur les PC et adresses

Réseau de démo : un seul routeur ou partage de connexion, sous-réseau `192.168.1.0/24`.
Chaque PC se met en **IP fixe** le jour J (pas besoin de connaître les IP avant).

| PC | Rôle | IP fixe | Contenu | Ports |
|---|---|---|---|---|
| PC1 | Workflow / agents | 192.168.1.11 | Camunda 7 (Tasklist, Cockpit, Admin) | 8080 |
| PC2 | Domaine Soins | 192.168.1.12 | ESB Soins, Service Patient, Couverture/Droits, Séjour & Actes, Stock Pharmacie, BDD Soins + BDD Pharmacie, dossier DossierSoins | 8081, 8091–8094, 5432 |
| PC3 | Domaine Gestion | 192.168.1.13 | ESB Gestion, Service Facturation, Commandes & Fournisseurs, BDD Gestion, dossier Sage | 8082, 8095–8096, 5432 |
| PC4 | Entrée et outils | 192.168.1.14 | Kong (API Gateway), RabbitMQ, Mailpit | 8000, 8001, 5672, 15672, 1025, 8025 |
| PC5 | Partenaires externes | 192.168.1.15 | Faux CNAM (SOAP), faux assureur, faux portail CNAM, faux fournisseur | 8101–8104 |

Plan B (un seul PC) : tous les ports ci-dessus sont différents, donc tout peut tourner sur `localhost`.

| Composant | URL de base |
|---|---|
| Camunda REST | http://192.168.1.11:8080/engine-rest |
| ESB Soins | http://192.168.1.12:8081/esb-soins |
| ESB Gestion | http://192.168.1.13:8082/esb-gestion |
| Service Patient | http://192.168.1.12:8091 |
| Service Couverture / Droits | http://192.168.1.12:8092 |
| Service Séjour & Actes | http://192.168.1.12:8093 |
| Service Stock Pharmacie | http://192.168.1.12:8094 |
| Service Facturation | http://192.168.1.13:8095 |
| Service Commandes & Fournisseurs | http://192.168.1.13:8096 |
| Faux CNAM (SOAP) | http://192.168.1.15:8101/cnam/droits?wsdl |
| Faux assureur privé (REST) | http://192.168.1.15:8102 |
| Faux portail CNAM | http://192.168.1.15:8103 |
| Faux fournisseur | http://192.168.1.15:8104 |
| Kong (proxy / admin) | http://192.168.1.14:8000 / :8001 |
| RabbitMQ (AMQP / console) | amqp://192.168.1.14:5672 / http://192.168.1.14:15672 |
| Mailpit (SMTP / interface) | 192.168.1.14:1025 / http://192.168.1.14:8025 |

Comptes communs (POC uniquement) : PostgreSQL `medilink / medilink`, RabbitMQ `medilink / medilink`.

---

## 2. Services du domaine Soins (PC2)

### Service Patient – port 8091 – BDD Soins
| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/patients/{ipg}` | lire un patient |
| GET | `/patients?cin=08123456` | rechercher par CIN |
| POST | `/patients` | créer |
| PUT | `/patients/{ipg}` | modifier |

Objet Patient :
```json
{ "ipg": "IPG-0001", "cin": "08123456", "nom": "Ben Salah", "prenom": "Ali",
  "dateNaissance": "1980-04-12", "telephone": "+21620111222", "email": "ali@test.tn",
  "typeCouverture": "CNAM", "numeroAssure": "CN-100001", "assureur": null }
```
`typeCouverture` vaut `CNAM` ou `ASSUREUR` (alors `assureur` = `"STAR"`, `"COMAR"`…).

### Service Couverture / Droits – port 8092 – BDD Soins
| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/couvertures/verification` | vérifie les droits (appelle l'ESB Soins) |
| PUT | `/couvertures/{ipg}` | régularise la prise en charge |

Entrée : `{ "ipg": "IPG-0001" }`
Sortie :
```json
{ "ipg": "IPG-0001", "droitsValides": true, "organisme": "CNAM",
  "motif": null, "accordId": "ACC-0001" }
```
Le service lit le patient, puis appelle `POST /esb-soins/droits` (voir §4).

### Service Séjour & Actes – port 8093 – BDD Soins
| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/lits/libres` | lits disponibles |
| POST | `/sejours` | ouvrir un séjour |
| POST | `/sejours/{sejourId}/actes` | enregistrer des actes (appelé par l'ESB Soins) |
| GET | `/sejours/{sejourId}/actes` | lister les actes |
| PUT | `/sejours/{sejourId}/sortie` | valider la sortie → appelle `POST /esb-soins/evenements/sortie` |

Ouvrir un séjour : `{ "ipg": "IPG-0001", "service": "CHIRURGIE", "litId": "L-12" }` → `{ "sejourId": "SEJ-0001", "dateEntree": "2026-12-10" }`

Ajouter des actes :
```json
{ "lignes": [ { "codeActe": "CHIR-A", "quantite": 1, "date": "2026-12-10" },
              { "codeActe": "NUIT",   "quantite": 2, "date": "2026-12-11" } ] }
```

Valider la sortie : corps vide. Le service envoie à l'ESB Soins l'objet **SortieValidee** :
```json
{ "ipg": "IPG-0001", "sejourId": "SEJ-0001", "dateSortie": "2026-12-12",
  "actes": [ { "codeActe": "CHIR-A", "quantite": 1, "prixUnitaire": 800.000 },
             { "codeActe": "NUIT",   "quantite": 2, "prixUnitaire": 200.000 } ] }
```
Les actes partent avec l'événement : le domaine Gestion ne lit jamais la BDD Soins.

### Service Stock Pharmacie – port 8094 – BDD Pharmacie
| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/consommations` | décrémente le stock (appelé par l'ESB Soins) |
| GET | `/stocks/{codeArticle}` | stock actuel et seuil |
| POST | `/receptions` | entrée en stock après livraison (processus 2) |

Consommation : `{ "sejourId": "SEJ-0001", "codeArticle": "PARA500", "quantite": 10 }`
Si le stock passe sous le seuil → publication de l'événement **StockSousSeuil** (voir §7).

---

## 3. Services du domaine Gestion (PC3)

### Service Facturation – port 8095 – BDD Gestion
| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/factures` | calcule la facture à partir des actes reçus |
| POST | `/factures/{factureId}/encaissement` | enregistre la part patient payée |
| PUT | `/factures/{factureId}/controle` | résultat du contrôle (facture signalée) |
| POST | `/bordereaux` | crée le bordereau d'une facture |
| PUT | `/bordereaux/{bordereauId}/correction` | corrige après rejet (incrémente `version`) |

Créer une facture – entrée = l'objet **SortieValidee** ci-dessus + `numeroAssure` et `organisme`.
Sortie :
```json
{ "factureId": "FAC-0001", "ipg": "IPG-0001", "sejourId": "SEJ-0001",
  "montantTotal": 1200.000, "partOrganisme": 960.000, "partPatient": 240.000,
  "aControler": false, "anomalie": null }
```
Règles : part organisme = 80 %, part patient = 20 % ; `aControler = true` si `montantTotal > 3000` ou si un code d'acte est inconnu (`anomalie` = message).

Bordereau (JSON, avant transformation par l'ESB) :
```json
{ "bordereauId": "BRD-0001", "version": 1, "factureId": "FAC-0001", "ipg": "IPG-0001",
  "numeroAssure": "CN-100001", "organisme": "CNAM", "montantOrganisme": 960.000,
  "actes": [ { "codeActe": "CHIR-A", "quantite": 1, "montant": 800.000 },
             { "codeActe": "NUIT", "quantite": 2, "montant": 400.000 } ] }
```

### Service Commandes & Fournisseurs – port 8096 – BDD Gestion
| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/commandes/proposition` | propose une commande pour un article sous le seuil |
| PUT | `/commandes/{commandeId}/statut` | change le statut |
| POST | `/commandes/{commandeId}/reception` | enregistre la livraison |

Proposition – entrée : `{ "codeArticle": "PARA500", "stockActuel": 95, "seuil": 100 }`
Sortie :
```json
{ "commandeId": "CMD-0001", "codeArticle": "PARA500", "fournisseur": "SIPHAT",
  "quantite": 500, "prixUnitaire": 2.000, "montant": 1000.000, "statut": "PROPOSEE" }
```
Statuts : `PROPOSEE`, `VALIDEE`, `ENVOYEE`, `LIVREE`, `FACTUREE`, `PAYEE`.

---

## 4. ESB Soins (PC2, port 8081)

| Flux | Entrée | Ce qu'il fait |
|---|---|---|
| `POST /esb-soins/droits` | `{ "numeroAssure": "CN-100001", "typeCouverture": "CNAM", "assureur": null }` | **Choice** : si `CNAM` → appel SOAP du faux CNAM ; sinon → REST du faux assureur. Renvoie toujours `{ "droitsValides": true, "motif": null, "accordId": "ACC-0001" }` |
| Dossier `C:/medilink/dossiersoins/entree` (File) | fichier CSV d'actes (voir §9) | lignes `ACTE` → `POST /sejours/{id}/actes` ; lignes `MEDICAMENT` → `POST /consommations` ; le fichier est ensuite déplacé dans `.../traite` |
| `POST /esb-soins/evenements/sortie` | objet **SortieValidee** | envoie le message `sortieValidee` à Camunda (voir §6) |
| Écoute RabbitMQ `stock.sous-seuil` | objet **StockSousSeuil** | démarre le processus 2 dans Camunda (voir §6) |

## 5. ESB Gestion (PC3, port 8082)

| Flux | Entrée | Ce qu'il fait |
|---|---|---|
| `POST /esb-gestion/factures` | **SortieValidee** + `numeroAssure`, `organisme` | transmet au Service Facturation, renvoie la facture |
| `POST /esb-gestion/bordereaux` | `{ "factureId": "FAC-0001" }` | demande le bordereau à Facturation, **transforme en XML CNAM** (§9), envoie au faux portail avec **Until Successful** (5 essais, 10 s) |
| `POST /esb-gestion/cnam/reponses` | `{ "bordereauId": "BRD-0001", "decision": "REJETE", "motif": "Code acte invalide" }` | envoie le message `reponseCnam` à Camunda ; si `REJETE` → e-mail à `facturation@medilink.tn` (Mailpit) |
| `POST /esb-gestion/sage/factures` | `{ "factureId": "FAC-0001" }` | lit la facture, convertit l'IPG en code client (`IPG-0001` → `CLI-0001`), ajoute une ligne au CSV Sage (§9) |
| `POST /esb-gestion/commandes` | objet commande (§3) | transforme et envoie au faux fournisseur |
| `POST /esb-gestion/sage/factures-fournisseurs` | `{ "commandeId": "CMD-0001", "montant": 1000.000 }` | ajoute une ligne au CSV Sage fournisseurs |

---

## 6. Camunda (PC1)

### Processus
| Processus | Clé (id BPMN) | Démarrage |
|---|---|---|
| Processus 1 | `processus1-admission-facturation` | par l'agent d'accueil dans Tasklist |
| Processus 2 | `processus2-reapprovisionnement` | par l'ESB Soins : `POST /engine-rest/process-definition/key/processus2-reapprovisionnement/start` |

### Messages
| Message | Envoyé par | Corrélation |
|---|---|---|
| `sortieValidee` | ESB Soins | variable `ipg` |
| `reponseCnam` | ESB Gestion | variable `bordereauId` |

Appel type (`POST /engine-rest/message`) :
```json
{ "messageName": "reponseCnam",
  "correlationKeys": { "bordereauId": { "value": "BRD-0001", "type": "String" } },
  "processVariables": { "decisionCnam": { "value": "REJETE", "type": "String" },
                        "motifRejet":   { "value": "Code acte invalide", "type": "String" } } }
```

### Variables du processus 1
`ipg`, `numeroAssure`, `typeCouverture`, `droitsValides` (Boolean), `motifDroits`, `sejourId`, `actes` (JSON),
`factureId`, `montantTotal` (Double), `partPatient`, `partOrganisme`, `aControler` (Boolean),
`bordereauId`, `decisionCnam` (`ACCEPTE` / `REJETE`), `motifRejet`.

### Variables du processus 2
`codeArticle`, `stockActuel`, `seuil`, `commandeId`, `fournisseur`, `quantite`, `montant` (Double),
`valideePharmacien` (Boolean), `valideeDaf` (Boolean, demandée si `montant > 2000`), `statutCommande`.

### Groupes et utilisateurs (login = mot de passe)
| Groupe | Utilisateur | Tâches |
|---|---|---|
| `accueil` | `accueil1` | accueil, régularisation, ouverture du séjour, encaissement |
| `soins` | `medecin1` | (la sortie est validée via le Service Séjour & Actes) |
| `facturation` | `factu1` | contrôle de facture, correction d'un rejet |
| `pharmacie` | `pharma1` | validation de commande, réception |
| `daf` | `daf1` | validation des commandes > 2000 DT |

---

## 7. RabbitMQ (PC4)

| Élément | Nom |
|---|---|
| Exchange (topic) | `soins.evenements` |
| Clé de routage | `stock.sous-seuil` |
| File | `stock.sous-seuil` (consommée par l'ESB Soins) |

Objet **StockSousSeuil** :
```json
{ "codeArticle": "PARA500", "libelle": "Paracétamol 500 mg", "stockActuel": 95, "seuil": 100, "clinique": "TUNIS" }
```

## 8. API Gateway Kong (PC4, port 8000)

Toutes les requêtes des postes passent par `http://192.168.1.14:8000/api/...` avec l'en-tête `apikey`.

| Route Kong | Redirige vers |
|---|---|
| `/api/patients` | Service Patient |
| `/api/sejours`, `/api/lits` | Service Séjour & Actes |
| `/api/factures` | Service Facturation |
| `/api/workflow` | Camunda `/engine-rest` |
| `/api/esb-soins`, `/api/esb-gestion` | ESB Soins / ESB Gestion |

Clés (consommateurs Kong) : `cle-accueil`, `cle-soins`, `cle-facturation`, `cle-pharmacie`, `cle-admin`.
Sans clé → 401 (à montrer en démo).

---

## 9. Formats de fichiers et messages externes

### CSV DossierSoins (déposé dans `dossiersoins/entree`, séparateur `;`)
```
type;ipg;sejourId;code;quantite;date
ACTE;IPG-0001;SEJ-0001;CHIR-A;1;2026-12-10
ACTE;IPG-0001;SEJ-0001;NUIT;2;2026-12-11
MEDICAMENT;IPG-0001;SEJ-0001;PARA500;10;2026-12-10
```

### CSV Sage (écrit par l'ESB Gestion dans `sage/import/factures.csv`)
```
codeClient;ipg;numeroFacture;date;montantTotal;partPatient;partOrganisme;statut
CLI-0001;IPG-0001;FAC-0001;2026-12-12;1200.000;240.000;960.000;ACCEPTEE
```
Fournisseurs : `sage/import/factures-fournisseurs.csv` → `codeFournisseur;commandeId;date;montant`.

### Bordereau XML envoyé au faux portail (`POST http://192.168.1.15:8103/portail/bordereaux`)
```xml
<bordereau xmlns="urn:cnam:tiers-payant">
  <numero>BRD-0001</numero>
  <version>1</version>
  <clinique>MEDILINK-TUNIS</clinique>
  <dateEnvoi>2026-12-12</dateEnvoi>
  <dossier>
    <numeroAssure>CN-100001</numeroAssure>
    <ipg>IPG-0001</ipg>
    <montantOrganisme>960.000</montantOrganisme>
    <actes>
      <acte code="CHIR-A" quantite="1" montant="800.000"/>
      <acte code="NUIT" quantite="2" montant="400.000"/>
    </actes>
  </dossier>
</bordereau>
```
Le portail répond `202 Accepted` (« reçu »). La décision arrive ensuite : la personne du PC5 (la « CNAM »)
l'envoie avec Postman à `POST /esb-gestion/cnam/reponses`.

### Faux CNAM SOAP – opération `verifierDroits`
Entrée : `numeroAssure`. Sortie : `droitsValides` (boolean), `dateFinDroits`, `motif`.

### Faux assureur REST – `GET http://192.168.1.15:8102/assureurs/{assureur}/droits/{numeroAssure}`
Sortie : `{ "droitsValides": true, "accordId": "STAR-ACC-77", "motif": null }`

### Faux fournisseur – `POST http://192.168.1.15:8104/fournisseurs/commandes`
Sortie : `{ "commandeId": "CMD-0001", "statut": "RECUE", "delaiLivraisonJours": 2 }`

---

## 10. Données de test (communes à tout le monde)

### Patients et scénarios du processus 1
| IPG | Patient | Couverture | Scénario | Résultat attendu |
|---|---|---|---|---|
| IPG-0001 | Ali Ben Salah | CNAM, CN-100001 | nominal | droits OK, 1200 DT, pas de contrôle, accepté |
| IPG-0002 | Sarra Trabelsi | CNAM, CN-100002 (droits expirés) | droits invalides | tâche « régulariser » |
| IPG-0003 | Mohamed Gharbi | ASSUREUR STAR, ST-300003 | facture à contrôler | 4500 DT → tâche « contrôler » |
| IPG-0004 | Amira Jlassi | CNAM, CN-100004 | rejet CNAM | rejet version 1, e-mail, correction, accepté version 2 |

### Tarifs des actes
| Code | Libellé | Prix (DT) |
|---|---|---|
| CONS | Consultation | 50.000 |
| RADIO | Radiographie | 120.000 |
| NUIT | Nuitée | 200.000 |
| CHIR-A | Chirurgie simple | 800.000 |
| CHIR-B | Chirurgie lourde | 3500.000 |

### Articles de pharmacie
| Code | Libellé | Stock initial | Seuil | Fournisseur |
|---|---|---|---|---|
| PARA500 | Paracétamol 500 mg | 105 | 100 | SIPHAT |
| AMOX1G | Amoxicilline 1 g | 300 | 80 | SAIPH |

Consommer 10 PARA500 fait passer le stock à 95 → déclenche le processus 2.

### Lits
`L-10`, `L-11`, `L-12` (libres), service `CHIRURGIE`.
