# MediLink - POC

POC d'integration : domaine Soins + domaine Gestion, ESB Mule, workflow Camunda 7,
API Gateway Kong, faux partenaires externes.

## Contrat d'interfaces
Le fichier [`interfaces.md`](./interfaces.md) est la reference commune :
IP, ports, URLs, JSON, variables Camunda, formats de fichiers, donnees de test.
**On ne change rien sans prevenir le groupe.**

## Arborescence
| Dossier | Contenu | Tache(s) |
|---|---|---|
| `archimate/` | Modele Archi + export XML | 11 |
| `bpmn/` | Processus 1 & 2 (BPMN) + formulaires | 8, 9 |
| `esb-soins/` | Projet Mule ESB Soins | 6 |
| `esb-gestion/` | Projet Mule ESB Gestion | 7 |
| `services/` | 6 services REST | 2, 3, 4 |
| `mocks/` | Faux partenaires (SoapUI, Mockoon) | 5 |
| `gateway/` | Kong (`kong.yml`) | 10 |
| `infra/` | Docker Compose, SQL, RabbitMQ, Mailpit | 1 |
| `docs/` | Schema reseau, captures, rapport | 1, 11 |

## Regles communes
- Aucune IP ni port ecrit en dur -> fichier de config uniquement.
- Middlewares configures, pas codes (Mule, kong.yml, http-connector Camunda).
- Chacun teste sa brique seul (Postman/SoapUI) avant l'integration.
- Chaque livraison : fichiers + collection Postman + capture avec explication.
