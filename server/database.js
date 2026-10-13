'use strict';

const { MongoClient } = require('mongodb');

const PING_INTERVAL_MS = 5000;
const TIMEOUT_MS = 5000;

function resolveDatabaseName(uri, dbName) {
  if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
  }

  if (dbName !== undefined && dbName !== null && dbName !== '') {
    if (typeof dbName !== 'string' || !dbName.trim()) {
      throw new Error('MONGODB_DB must be a non-empty database name.');
    }
    return dbName.trim();
  }

  try {
    const pathname = new URL(uri).pathname;
    if (pathname && pathname !== '/') {
      return decodeURIComponent(pathname.slice(1));
    }
  } catch {
    throw new Error('MONGODB_URI is not a valid MongoDB connection string.');
  }

  return 'snackify';
}

function createDatabase({ uri, dbName } = {}) {
  const name = resolveDatabaseName(uri, dbName);
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: TIMEOUT_MS,
    connectTimeoutMS: TIMEOUT_MS
  });
  const db = client.db(name);
  let ready = false;
  let closed = false;
  let checking = false;
  let monitor;

  async function ping() {
    if (closed || checking) return;
    checking = true;
    try {
      await db.command({ ping: 1 });
      if (!closed) ready = true;
    } catch {
      ready = false;
    } finally {
      checking = false;
    }
  }

  async function connect() {
    if (closed) throw new Error('Database connection has been closed.');
    try {
      await client.connect();
      await db.command({ ping: 1 });
      if (closed) throw new Error('Database connection has been closed.');
      ready = true;
      monitor = setInterval(() => { void ping(); }, PING_INTERVAL_MS);
      monitor.unref();
    } catch (error) {
      ready = false;
      await client.close().catch(() => {});
      throw error;
    }
  }

  async function close() {
    closed = true;
    ready = false;
    clearInterval(monitor);
    await client.close();
  }

  return {
    ordersCollection: db.collection('orders'),
    connect,
    close,
    isDatabaseReady: () => ready
  };
}

module.exports = { createDatabase, resolveDatabaseName };
