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

## Deploy on Render

This repository includes `render.yaml` for a Render Web Service. In Render,
create a new Blueprint from the repository, or create a Web Service with:

- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`

Add `MONGODB_URI` as a Render environment variable and enter the MongoDB Atlas
connection string there. Do not commit it to the repository. `MONGODB_DB` is
set to `snackify` by the Blueprint. Render supplies `PORT` automatically, and
the server listens on `0.0.0.0` by default as required by Render.

In MongoDB Atlas, add access for the Render service's outbound IP addresses.
For a service whose outbound addresses can change, Atlas may require `0.0.0.0/0`;
use a strong, rotated database credential and least-privilege database user if
you choose that option.

After deployment, verify:

```text
https://<your-render-service>.onrender.com/health
```

The frontend and API are served from the same Render URL, so no frontend URL
or CORS setting is needed.

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
