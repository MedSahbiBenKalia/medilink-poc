# Captures : tâche 2

Captures Postman des tests, dans l'ordre de la collection, pour le chapitre « résultats » du rapport.
La légende de chaque capture peut être reprise telle quelle dans le rapport.

## Service Patient (8091)
| Fichier | Requête | Légende |
|---|---|---|
| `01-patient-health.png` | Health | Le Service Patient est démarré et répond sur son port 8091. |
| `02-patient-lecture-ipg.png` | Lire IPG-0001 | Le Service Patient renvoie la fiche unique d'Ali Ben Salah à partir de son IPG. |
| `03-patient-recherche-cin.png` | Rechercher par CIN 08123456 | L'agent d'accueil retrouve un patient par son CIN, sans créer de doublon. |
| `04-patient-inconnu-404.png` | Lire IPG-9999 | Un IPG inconnu renvoie une erreur 404 claire. |
| `05-patient-creation-201.png` | Créer un patient | Le Service Patient attribue lui-même l'IPG suivant au nouveau patient. |
| `06-patient-doublon-409.png` | Créer le même patient | Un CIN déjà connu est refusé (409) : pas de doublon de patient. |
| `07-patient-invalide-400.png` | Créer un patient invalide | Les données invalides sont refusées avec la liste des erreurs (400). |
| `08-patient-modification-patch.png` | Modifier le téléphone (PATCH) | Une modification partielle ne change que le champ envoyé. |

## Service Couverture / Droits (8092)
| Fichier | Requête | Légende |
|---|---|---|
| `09-couverture-health.png` | Health | Le Service Couverture est démarré et répond sur son port 8092. |
| `10-droits-ipg0001-cnam-valides.png` | Vérifier IPG-0001 | Les droits CNAM d'Ali sont vérifiés automatiquement, sans appel téléphonique. |
| `11-droits-ipg0002-expires.png` | Vérifier IPG-0002 | Les droits expirés de Sarra sont détectés avant l'ouverture du séjour. |
| `12-droits-ipg0003-assureur-star.png` | Vérifier IPG-0003 | Pour un assuré STAR, la vérification est faite auprès de l'assureur privé (organisme STAR). |
| `13-droits-ipg0004-cnam-valides.png` | Vérifier IPG-0004 | Les droits CNAM d'Amira sont valides. |
| `14-droits-ipg9999-404.png` | Vérifier IPG-9999 | La vérification d'un patient inconnu renvoie 404. |
| `15-regularisation-ipg0002-patch.png` | Régulariser IPG-0002 | L'agent d'accueil régularise la prise en charge avec le nouveau numéro CN-100002B. |
| `16-regularisation-controle-patient.png` | Contrôle Service Patient | Le nouveau numéro d'assuré est enregistré dans le Service Patient, seul propriétaire du patient. |
| `17-regularisation-couverture-lue.png` | Lire la couverture de IPG-0002 | La couverture de Sarra est désormais valide, avec l'accord manuel. |
| `18-remise-a-zero-ipg0002.png` | Remise à zéro | IPG-0002 retrouve son numéro initial pour pouvoir rejouer les tests. |

## Exécution complète de la collection
| Fichier | Légende |
|---|---|
| `19-collection-runner-1.png` à `22-collection-runner-4.png` | Les 18 tests automatiques de la collection passent (18 passed, 0 failed). |
