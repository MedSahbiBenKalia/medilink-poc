// Client RabbitMQ pour le Service Stock Pharmacie.
// Patron Outbox : publie tous les événements non encore publiés depuis stock_event_outbox.
// Si RabbitMQ est indisponible, les événements restent en base et seront publiés au prochain passage.
const amqp = require('amqplib');
const config = require('../config');

let enCours = false;

async function flushOutbox(db) {
  if (enCours) return; // Évite les appels concurrents
  enCours = true;
  let connexion;
  let canal;
  try {
    // Lire les événements non publiés
    const { rows } = await db.query(
      `SELECT id, payload FROM stock_event_outbox WHERE publie = FALSE ORDER BY id`
    );
    if (rows.length === 0) return;

    connexion = await amqp.connect(config.rabbitmqUrl);
    canal = await connexion.createConfirmChannel();
    await canal.assertExchange(config.rabbitmqExchange, 'topic', { durable: true });

    for (const evt of rows) {
      canal.publish(
        config.rabbitmqExchange,
        config.rabbitmqRoutingKey,
        Buffer.from(JSON.stringify(evt.payload)),
        { contentType: 'application/json', persistent: true }
      );
      await canal.waitForConfirms();

      // Marquer comme publié
      await db.query('UPDATE stock_event_outbox SET publie = TRUE WHERE id = $1', [evt.id]);
      console.log(`[stock] Événement stockSousSeuil publié (outbox #${evt.id}) :`, JSON.stringify(evt.payload));
    }
  } finally {
    try { if (canal) await canal.close(); } catch (_) { /* ignore */ }
    try { if (connexion) await connexion.close(); } catch (_) { /* ignore */ }
    enCours = false;
  }
}

module.exports = { flushOutbox };
