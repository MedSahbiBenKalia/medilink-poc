// Client vers l'ESB Soins : POST {ESB_SOINS_URL}/droits (interfaces.md §4).
// Entree : { numeroAssure, typeCouverture, assureur }
// Sortie : { droitsValides, motif, accordId }
// ESB_MODE=mock : reponse simulee sans appel reseau ; ESB_MODE=real : appel HTTP reel.
const config = require('../config');
const { ErreurHttp } = require('../commun');

// Simulation (tant que l'ESB Soins n'est pas pret) : CN-100002 a des droits expires.
async function verifierDroitsMock({ numeroAssure }) {
  if (numeroAssure === 'CN-100002') {
    return { droitsValides: false, motif: 'Droits expirés le 2026-06-30', accordId: null };
  }
  // Numero d'accord derive des 4 derniers chiffres du numero d'assure : CN-100001 -> ACC-0001
  const chiffres = String(numeroAssure).replace(/\D/g, '').slice(-4).padStart(4, '0');
  return { droitsValides: true, motif: null, accordId: `ACC-${chiffres}` };
}

// Appel reel : implemente en phase 4.
async function verifierDroitsReel() {
  throw new ErreurHttp(503, 'Mode real pas encore implemente (phase 4)');
}

async function verifierDroits(demande) {
  return config.esbMode === 'real' ? verifierDroitsReel(demande) : verifierDroitsMock(demande);
}

module.exports = { verifierDroits };
