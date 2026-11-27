// FAUX ESB SOINS - outil de test uniquement (ne fait pas partie des services livres).
// Imite le flux POST /esb-soins/droits de l'ESB Soins (interfaces.md §4) pour tester
// le Service Couverture en ESB_MODE=real avant que la tache 6 soit prete.
//
// Lancement : npm run faux-esb
// Variables (optionnelles) :
//   FAUX_ESB_PORT      port d'ecoute (defaut 8081, celui de l'ESB Soins)
//   FAUX_ESB_DELAI_MS  delai avant reponse, pour simuler un ESB lent (defaut 0)
//   FAUX_ESB_ERREUR    si "1", repond 500 a chaque appel (ESB en panne)
const express = require('express');

const port = Number(process.env.FAUX_ESB_PORT || 8081);
const delaiMs = Number(process.env.FAUX_ESB_DELAI_MS || 0);
const enPanne = process.env.FAUX_ESB_ERREUR === '1';

const app = express();
app.use(express.json());

app.post('/esb-soins/droits', async (req, res) => {
  const { numeroAssure, typeCouverture, assureur } = req.body || {};
  console.log(`[faux-esb] demande : ${typeCouverture} ${assureur || ''} ${numeroAssure}`);

  if (delaiMs > 0) await new Promise((r) => setTimeout(r, delaiMs));
  if (enPanne) return res.status(500).json({ erreur: 'Panne simulee du faux ESB' });

  // Meme logique que le vrai ESB : CNAM (SOAP) ou assureur prive (REST)
  if (numeroAssure === 'CN-100002') {
    return res.json({ droitsValides: false, motif: 'Droits expirés le 2026-06-30', accordId: null });
  }
  const chiffres = String(numeroAssure).replace(/\D/g, '').slice(-4).padStart(4, '0');
  const accordId = typeCouverture === 'ASSUREUR' ? `${assureur}-ACC-${chiffres}` : `ACC-${chiffres}`;
  res.json({ droitsValides: true, motif: null, accordId });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[faux-esb] a l'ecoute sur 0.0.0.0:${port}/esb-soins (delai ${delaiMs} ms${enPanne ? ', EN PANNE' : ''})`);
});
