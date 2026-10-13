'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadConfig } = require('./index');

const baseEnv = {
  MONGODB_URI: 'mongodb+srv://user:password@example.mongodb.net',
};

test('Render-style config uses the platform port and public host default', () => {
  const config = loadConfig({ ...baseEnv, PORT: '10000' });

  assert.equal(config.port, 10000);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.serveFrontend, true);
});

test('HOST can still be overridden for local development', () => {
  const config = loadConfig({ ...baseEnv, PORT: '3000', HOST: '127.0.0.1' });

  assert.equal(config.host, '127.0.0.1');
});

test('SERVE_FRONTEND accepts an explicit backend-only setting', () => {
  const config = loadConfig({ ...baseEnv, SERVE_FRONTEND: 'false' });

  assert.equal(config.serveFrontend, false);
});

test('SERVE_FRONTEND rejects values other than true or false', () => {
  assert.throws(() => loadConfig({ ...baseEnv, SERVE_FRONTEND: 'off' }),
    /SERVE_FRONTEND must be true or false/);
});
