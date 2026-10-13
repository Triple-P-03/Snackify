'use strict';

const path = require('node:path');
const dotenv = require('dotenv');
const { createDatabase } = require('./database');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = 3000;
const DEFAULT_SERVE_FRONTEND = true;
// Render requires public services to listen on all interfaces. This also works
// for local development; use HOST=127.0.0.1 locally when loopback-only access
// is preferred.
const DEFAULT_HOST = '0.0.0.0';

class ConfigurationError extends Error {}

function parseBoolean(value, name, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new ConfigurationError(`${name} must be true or false.`);
}

function loadConfig(env = process.env) {
  const rawUri = env.MONGODB_URI;
  if (typeof rawUri !== 'string' || !rawUri.trim()) {
    throw new ConfigurationError('MONGODB_URI is required.');
  }

  const uri = rawUri.trim();
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new ConfigurationError(
      'MONGODB_URI must start with mongodb:// or mongodb+srv://.'
    );
  }
  try {
    new URL(uri);
  } catch {
    throw new ConfigurationError('MONGODB_URI is not a valid MongoDB connection string.');
  }

  const rawPort = env.PORT === undefined || env.PORT === '' ? DEFAULT_PORT : env.PORT;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('PORT must be an integer from 1 to 65535.');
  }

  const host = env.HOST === undefined || env.HOST === '' ? DEFAULT_HOST : String(env.HOST).trim();
  if (!host) {
    throw new ConfigurationError('HOST must be a non-empty hostname or address.');
  }

  return {
    uri,
    dbName: env.MONGODB_DB,
    port,
    host,
    serveFrontend: parseBoolean(env.SERVE_FRONTEND, 'SERVE_FRONTEND', DEFAULT_SERVE_FRONTEND),
    publicDir: PROJECT_ROOT
  };
}

function closeHttpServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function listen(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });
}

async function startServer({
  env = process.env,
  createApp,
  databaseFactory = createDatabase
} = {}) {
  const config = loadConfig(env);
  const makeApp = createApp || require('./app').createApp;
  const database = databaseFactory({ uri: config.uri, dbName: config.dbName });
  let server;

  try {
    await database.connect();
    const app = makeApp({
      ordersCollection: database.ordersCollection,
      isDatabaseReady: database.isDatabaseReady,
      serveFrontend: config.serveFrontend,
      publicDir: config.publicDir
    });
    server = await listen(app, config.port, config.host);
  } catch (error) {
    await closeHttpServer(server).catch(() => {});
    await database.close().catch(() => {});
    throw error;
  }

  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await closeHttpServer(server);
    } finally {
      await database.close();
    }
  };
  const onSignal = () => {
    void shutdown().catch(() => { process.exitCode = 1; });
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  return { server, database, config, shutdown };
}

async function main() {
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
  try {
    await startServer();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`Startup configuration error: ${error.message}`);
    } else {
      console.error('Unable to start Snackify server. Check MongoDB availability and server configuration.');
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  ConfigurationError,
  closeHttpServer,
  loadConfig,
  listen,
  main,
  startServer
};
