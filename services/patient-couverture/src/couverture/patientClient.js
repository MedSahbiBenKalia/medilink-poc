// Client HTTP vers le Service Patient (meme domaine Soins : appel direct, pas d'ESB).
// Couverture ne lit jamais la table "patient" : il passe toujours par ce client.
const axios = require('axios');
const config = require('../config');
const { ErreurHttp } = require('../commun');

const http = axios.create({
  baseURL: config.patientServiceUrl,
  timeout: 5000,
  validateStatus: () => true, // on traite nous-memes les codes HTTP
});

// Erreur reseau (service arrete, timeout...) -> 503
async function appeler(requete) {
  try {
    return await requete();
  } catch (err) {
    throw new ErreurHttp(503, 'Service Patient injoignable');
  }
}

// Renvoie le patient, ou null s'il est inconnu (404).
async function lirePatient(ipg) {
  const rep = await appeler(() => http.get(`/patients/${encodeURIComponent(ipg)}`));
  if (rep.status === 404) return null;
  if (rep.status !== 200) throw new ErreurHttp(502, `Service Patient : reponse ${rep.status}`);
  return rep.data;
}

// Modifie partiellement le patient (PATCH) ; renvoie le patient a jour.
// Les erreurs de validation du Service Patient (400, 404, 409) sont renvoyees telles quelles.
async function modifierPatient(ipg, modifications) {
  const rep = await appeler(() => http.patch(`/patients/${encodeURIComponent(ipg)}`, modifications));
  if (rep.status === 200) return rep.data;
  if ([400, 404, 409].includes(rep.status)) {
    throw new ErreurHttp(rep.status, (rep.data && rep.data.erreur) || `Service Patient : reponse ${rep.status}`);
  }
  throw new ErreurHttp(502, `Service Patient : reponse ${rep.status}`);
}

module.exports = { lirePatient, modifierPatient };
