// Faux ESB Soins - reçoit l'événement "sortie validée" envoyé par le Service Séjour & Actes.
// Lancer avant de passer ESB_MODE=real dans .env.
// Usage : node outils/faux-esb.js
const http = require('http');

const PORT = 8081;

const server = http.createServer((req, res) => {
  let corps = '';
  req.on('data', (chunk) => { corps += chunk; });
  req.on('end', () => {
    console.log(`\n[faux-esb] ${req.method} ${req.url}`);
    if (corps) {
      try { console.log('[faux-esb] corps :', JSON.stringify(JSON.parse(corps), null, 2)); }
      catch (_) { console.log('[faux-esb] corps (brut) :', corps); }
    }

    // POST /esb-soins/evenements/sortie -> accepté
    if (req.method === 'POST' && req.url === '/esb-soins/evenements/sortie') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ accepte: true, message: 'Événement sortie reçu par le faux-ESB' }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ erreur: `Route inconnue : ${req.method} ${req.url}` }));
  });
});

server.listen(PORT, () => {
  console.log(`[faux-esb] écoute sur http://localhost:${PORT}`);
  console.log('[faux-esb] Routes disponibles :');
  console.log('  POST /esb-soins/evenements/sortie  <- Séjour & Actes (sortie validée)');
});
