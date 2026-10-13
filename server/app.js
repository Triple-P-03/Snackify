'use strict';

const path = require('node:path');
const express = require('express');
const { validateOrder } = require('./order');

const PUBLIC_FILES = [
  'index.html',
  'menu.html',
  'menu.js',
  'back.jpg',
  'coffee.jpg',
  'coffee.png',
  'donut.png',
  'logo.png',
  'pexels-ravikant-913816.jpg',
  'snacki.png',
];

function createOrderRateLimiter() {
  const clients = new Map();
  const windowMs = 60_000;
  const maxRequests = 20;
  const maxClients = 1024;

  return (req, res, next) => {
    const now = Date.now();
    const client = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = clients.get(client);

    if (entry && entry.expiresAt <= now) {
      clients.delete(client);
      entry = undefined;
    }
    if (!entry) {
      // Prune expired clients and cap storage even when addresses vary.
      for (const [address, value] of clients) {
        if (value.expiresAt <= now) clients.delete(address);
      }
      if (clients.size >= maxClients) clients.delete(clients.keys().next().value);
      entry = { count: 0, expiresAt: now + windowMs };
      clients.set(client, entry);
    }

    if (entry.count >= maxRequests) {
      res.set('Retry-After', String(Math.ceil((entry.expiresAt - now) / 1000)));
      return res.status(429).json({ message: 'Too many order attempts. Please try again shortly.' });
    }
    entry.count += 1;
    next();
  };
}

function createApp({
  ordersCollection,
  isDatabaseReady = () => true,
  publicDir = path.resolve(__dirname, '..'),
} = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', async (req, res) => {
    try {
      if (await isDatabaseReady()) {
        return res.status(200).json({ message: 'OK' });
      }
    } catch (_) {
      // Readiness failures must not reveal database details.
    }
    return res.status(503).json({ message: 'Service unavailable.' });
  });

  app.post('/submit-order', createOrderRateLimiter(), (req, res, next) => {
    if (!req.is('application/json')) {
      return res.status(415).json({ message: 'Content-Type must be application/json.' });
    }
    next();
  }, express.json({ limit: '16kb' }), async (req, res) => {
    const result = validateOrder(req.body);
    if (result.message) return res.status(400).json({ message: result.message });

    try {
      if (!await isDatabaseReady() || !ordersCollection || typeof ordersCollection.insertOne !== 'function') {
        return res.status(503).json({ message: 'Order service is temporarily unavailable.' });
      }
      const inserted = await ordersCollection.insertOne(result.order);
      if (!inserted || inserted.acknowledged !== true || inserted.insertedId == null) {
        return res.status(503).json({ message: 'Order service is temporarily unavailable.' });
      }
      return res.status(201).json({ message: 'Order placed successfully.', orderId: String(inserted.insertedId) });
    } catch (_) {
      return res.status(503).json({ message: 'Order service is temporarily unavailable.' });
    }
  });

  const sendPublicFile = (file) => (req, res, next) => {
    res.sendFile(file, { root: publicDir }, (error) => {
      if (error) next(error);
    });
  };

  app.get('/', sendPublicFile('index.html'));
  for (const file of PUBLIC_FILES) {
    app.get(`/${file}`, sendPublicFile(file));
  }

  app.use((req, res) => res.status(404).json({ message: 'Not found.' }));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ message: 'Order request is too large.' });
    }
    if (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported') {
      return res.status(415).json({ message: 'Unsupported request encoding.' });
    }
    if (err.status === 400) {
      return res.status(400).json({ message: 'Malformed JSON request.' });
    }
    if (err.status === 404) {
      return res.status(404).json({ message: 'Not found.' });
    }
    return res.status(500).json({ message: 'Service unavailable.' });
  });

  return app;
}

module.exports = { createApp };
