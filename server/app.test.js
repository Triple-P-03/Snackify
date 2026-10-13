'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const path = require('node:path');
const { createApp } = require('./app');
const { validateOrder } = require('./order');

function request(server, options = {}, body) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      host: '127.0.0.1',
      port: server.address().port,
      path: '/',
      method: 'GET',
      ...options,
    };
    const req = http.request(requestOptions, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: responseBody,
        json: () => JSON.parse(responseBody),
      }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function withApp({ ordersCollection, isDatabaseReady = () => true } = {}, callback) {
  const app = createApp({
    ordersCollection,
    isDatabaseReady,
    publicDir: path.resolve(__dirname, '..'),
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    return await callback(server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function validOrder(overrides = {}) {
  return {
    name: 'Test Customer',
    phone: '9876543210',
    isParcel: false,
    paymentMethod: 'UPI',
    totalPrice: 90,
    items: { donut: 1, coffee: 1 },
    ...overrides,
  };
}

test('validateOrder calculates and sanitizes a valid order', () => {
  const result = validateOrder(validOrder({ name: '  Test Customer  ' }));

  assert.equal(result.message, undefined);
  assert.equal(result.order.name, 'Test Customer');
  assert.equal(result.order.totalPrice, 90);
  assert.equal(result.order.currency, 'INR');
  assert.equal(result.order.status, 'pending');
  assert.ok(result.order.createdAt instanceof Date);
  assert.equal(result.order.phone, '9876543210');
});

test('validateOrder rejects client totals that do not match server prices', () => {
  const result = validateOrder(validOrder({ totalPrice: 1 }));

  assert.equal(result.message, 'Order total does not match the selected items.');
});

test('POST /submit-order inserts only a valid order and returns its id', async () => {
  let insertedOrder;
  const collection = {
    async insertOne(order) {
      insertedOrder = order;
      return { acknowledged: true, insertedId: 'test-order-id' };
    },
  };

  await withApp({ ordersCollection: collection }, async (server) => {
    const response = await request(server, {
      path: '/submit-order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify(validOrder()));

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), {
      message: 'Order placed successfully.',
      orderId: 'test-order-id',
    });
    assert.equal(insertedOrder.totalPrice, 90);
    assert.equal(insertedOrder.currency, 'INR');
    assert.equal(insertedOrder.createdAt instanceof Date, true);
  });
});

test('POST /submit-order returns JSON errors for empty carts and wrong content types', async () => {
  const collection = { async insertOne() { throw new Error('must not insert'); } };

  await withApp({ ordersCollection: collection }, async (server) => {
    const emptyCart = await request(server, {
      path: '/submit-order',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify(validOrder({ items: {}, totalPrice: 0 })));
    assert.equal(emptyCart.statusCode, 400);
    assert.equal(emptyCart.json().message, 'Your cart is empty.');

    const wrongContentType = await request(server, {
      path: '/submit-order',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
    }, JSON.stringify(validOrder()));
    assert.equal(wrongContentType.statusCode, 415);
  });
});

test('health reflects database readiness and frontend files remain available', async () => {
  await withApp({ ordersCollection: {}, isDatabaseReady: () => false }, async (server) => {
    const health = await request(server, { path: '/health' });
    assert.equal(health.statusCode, 503);

    const home = await request(server, { path: '/' });
    assert.equal(home.statusCode, 200);
    assert.match(home.headers['content-type'], /text\/html/);
  });
});
