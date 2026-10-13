# Snackify backend

The existing frontend submits orders with `POST /submit-order`. The Node.js
backend serves those same frontend files, validates each order on the server,
and stores accepted orders in MongoDB.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB
   connection string. Keep `.env` private; it is ignored by Git. `MONGODB_DB`
   defaults to `snackify` when the URI does not specify a database.

3. Start the server:

   ```bash
   npm start
   ```

   Open <http://127.0.0.1:3000/>. The frontend is intentionally unchanged.

For development, use `npm run dev` to restart the server when backend files
change.

## API

- `GET /health` returns `200` when MongoDB is reachable and `503` otherwise.
- `POST /submit-order` accepts the payload already produced by `menu.js`.
  Prices are recalculated by the backend, and only sanitized order fields are
  inserted into the `orders` collection. The selected payment method is
  recorded as an order preference; this backend does not charge a card or UPI
  account.

The server returns JSON validation errors and does not provide an endpoint for
listing customer orders.

## Checks

```bash
npm test
```
