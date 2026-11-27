// Client vers l'ESB Soins : POST {ESB_SOINS_URL}/droits (interfaces.md §4).
// Entree : { numeroAssure, typeCouverture, assureur }
// Sortie : { droitsValides, motif, accordId }
// ESB_MODE=mock : reponse simulee sans appel reseau ; ESB_MODE=real : appel HTTP reel.
// Passer de l'un a l'autre ne demande que de changer ESB_MODE dans le .env.
const axios = require('axios');
const config = require('../config');
const { ErreurHttp } = require('../commun');

// ---------- Mode mock (tant que l'ESB Soins n'est pas pret) ----------

// CN-100002 a des droits expires ; les autres numeros sont valides.
async function verifierDroitsMock({ numeroAssure }) {
  if (numeroAssure === 'CN-100002') {
    return { droitsValides: false, motif: 'Droits expirés le 2026-06-30', accordId: null };
  }
  // Numero d'accord derive des 4 derniers chiffres du numero d'assure : CN-100001 -> ACC-0001
  const chiffres = String(numeroAssure).replace(/\D/g, '').slice(-4).padStart(4, '0');
  return { droitsValides: true, motif: null, accordId: `ACC-${chiffres}` };
}

// ---------- Mode real (appel HTTP a l'ESB Soins) ----------

const http = axios.create({
  baseURL: config.esbSoinsUrl,
  timeout: 5000, // au-dela de 5 s, l'ESB est considere comme injoignable
  validateStatus: () => true,
});

async function verifierDroitsReel(demande) {
  let rep;
  try {
    rep = await http.post('/droits', demande);
  } catch (err) {
    // ESB arrete, connexion refusee ou delai depasse
    throw new ErreurHttp(503, 'ESB Soins injoignable');
  }
  if (rep.status >= 500) throw new ErreurHttp(503, 'ESB Soins injoignable');
  if (rep.status !== 200 || !rep.data || typeof rep.data.droitsValides !== 'boolean') {
    throw new ErreurHttp(502, `Reponse inattendue de l'ESB Soins (HTTP ${rep.status})`);
  }
  return {
    droitsValides: rep.data.droitsValides,
    motif: rep.data.motif ?? null,
    accordId: rep.data.accordId ?? null,
  };
}

async function verifierDroits(demande) {
  return config.esbMode === 'real' ? verifierDroitsReel(demande) : verifierDroitsMock(demande);
}

module.exports = { verifierDroits };
