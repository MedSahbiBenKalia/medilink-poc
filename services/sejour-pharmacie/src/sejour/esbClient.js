// Client vers l'ESB Soins : POST {ESB_SOINS_URL}/evenements/sortie (interfaces.md §4).
// Entrée : { ipg, sejourId, dateSortie, actes }
// ESB_MODE=mock : réponse simulée sans appel réseau ; ESB_MODE=real : appel HTTP réel.
const config = require('../config');
const { ErreurHttp } = require('../commun');

// ---------- Mode mock (tant que l'ESB Soins n'est pas prêt) ----------

async function publierSortieMock(evenement) {
  // Simule l'envoi : on affiche juste l'événement dans la console
  console.log(`[sejour][mock-esb] Événement sortie validée simulé :`, JSON.stringify(evenement));
  return { accepte: true };
}

// ---------- Mode real (appel HTTP à l'ESB Soins) ----------

async function publierSortieReel(evenement) {
  let rep;
  try {
    rep = await fetch(`${config.esbSoinsUrl}/evenements/sortie`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(evenement),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throw new ErreurHttp(502, `ESB Soins indisponible : ${err.message}`);
  }
  if (!rep.ok) {
    throw new ErreurHttp(502, `ESB Soins a répondu HTTP ${rep.status}`);
  }
  return { accepte: true };
}

async function publierSortie(evenement) {
  return config.esbMode === 'real' ? publierSortieReel(evenement) : publierSortieMock(evenement);
}

module.exports = { publierSortie };
