# Wallet Counter Pro

This app is now a role-based counter system for KBZPay / WavePay style operations backed by a Node server and Neon Postgres.

## Features

- Login and sign up
- Two roles: `admin` and `cashier`
- Admin can see profit
- Cashier cannot see profit
- Normal sign up creates `cashier` accounts only
- Floating plus button to create transactions
- Image upload OCR import that can create a transaction automatically using free local OCR
- Transaction types:
  - `ငွေထုတ်`
  - `ငွေသွင်း`
- Required fields:
  - `name`
  - `money`
  - `phone number` is optional

## Profit rules

- `ငွေထုတ်`
  - under `100,000 MMK` => `1%`
  - `100,000 MMK` and above => `0.5%`
- `ငွေသွင်း`
  - `0.1%`

## Files

- `index.html`: app entry
- `app.js`: frontend auth, dashboard, and API calls
- `styles.css`: dashboard styling
- `server.js`: API server, session handling, and Neon/Postgres integration
- `.env`: local server configuration, including `DATABASE_URL`
- `OCR_LANGUAGES`: optional Tesseract language pack setting for local OCR, defaults to `eng`

## Run

Install dependencies and start the server:

```powershell
npm install
npm start
```

Then open `http://127.0.0.1:4173`

If your local `.env` sets a different `PORT`, open that port instead.

## Image OCR Import

The app now uses free local OCR via `tesseract.js`, so no paid API key is required.

Optional environment variable:

```powershell
OCR_LANGUAGES=eng
```

Then restart the server. Inside the transaction modal, use `Upload Image And Create` to send a receipt or screenshot to the OCR flow. The app will try to extract:

- transaction type
- customer name
- amount
- phone number

and then create the transaction automatically.

Notes:

- Local OCR is free, but less accurate than paid vision APIs.
- The first OCR request can be slower because Tesseract may need to initialize language data.
- If your screenshots contain Burmese text, you can experiment with `OCR_LANGUAGES=eng+mya`.

## Deploy To Railway

1. Push this project to a GitHub repository.
2. In Railway, create a new project and choose `Deploy from GitHub repo`.
3. Select this repository.
4. In the Railway service variables, add:
   - `DATABASE_URL`
5. Generate a public domain from the Railway service Networking settings.

Railway will provide its own `PORT` automatically. The app is set up to use that port in production.

## Default admin

- Username: `admin`
- Password: `admin123`

Only existing admin accounts should be used for admin access. The public sign-up form creates cashier users only.

## Important note

Users and transactions now live in Neon Postgres. Theme preference still stays in browser local storage, and sessions are stored in an in-memory server session map, so restarting the server signs everyone out.
