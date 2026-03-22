# Wallet Counter Pro

This app is now a role-based counter system for KBZPay / WavePay style operations backed by a Node server and Neon Postgres.

## Features

- Login and sign up
- Two roles: `admin` and `cashier`
- Admin can see profit
- Cashier cannot see profit
- Normal sign up creates `cashier` accounts only
- Floating plus button to create transactions
- Image upload OCR import that fills the transaction form for review using Gemini
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
- `GEMINI_API_KEY`: required for Gemini OCR image import
- `GEMINI_MODEL`: optional Gemini model name, defaults to `gemini-2.5-flash`

## Run

Install dependencies and start the server:

```powershell
npm install
npm start
```

Then open `http://127.0.0.1:4173`

If your local `.env` sets a different `PORT`, open that port instead.

## Backup

You can create a local backup of `users` and `transactions` anytime with:

```powershell
npm run backup
```

This exports both JSON and CSV files into a timestamped folder inside `backups/`, so the data can be opened directly in Excel.

## Image OCR Import

The app now uses the Gemini API to read receipt images and fill the transaction form for review.

Required environment variable:

```powershell
GEMINI_API_KEY=your_gemini_api_key
```

Optional environment variable:

```powershell
GEMINI_MODEL=gemini-2.5-flash
```

Then restart the server. Inside the transaction modal, use `Upload Image And Fill Form` to send a receipt or screenshot to the OCR flow. The app will try to extract:

- transaction type
- customer name
- amount
- phone number

and fill the form so the cashier can review it before saving.

Notes:

- Gemini may still miss fields on blurry photos, so the cashier should review the filled form before saving.
- The Gemini Developer API offers a free tier with rate limits; you need your own API key from Google AI Studio.

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
