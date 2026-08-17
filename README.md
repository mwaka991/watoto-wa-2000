# PalmPesa Pay-to-Unlock MVP

A minimal web app that gates access behind a PalmPesa phone payment prompt.

## Setup

1. Install dependencies:

```bash
cd e:\winga
npm install
```

2. Create environment variables:

- `PALMPESA_API_TOKEN` — your PalmPesa bearer token
- `APP_BASE_URL` — the public URL for this app, e.g. `https://YOURDOMAIN.com`

For local development without a public webhook URL, you can run the app locally and use a tunneling service such as ngrok. The fallback polling route still works if the webhook is delayed or unavailable.

3. Start the server:

```bash
npm start
```

4. Open `http://localhost:4009` in the browser.

## How it works

- The landing page plays a preview video for 5 seconds.
- After 5 seconds, a non-closable modal appears requesting a Tanzanian phone number.
- The frontend calls `/api/pay/start` and the backend initiates PalmPesa payment for TSH 1000.
- The frontend polls `/api/pay/status/:orderRef` until the payment is completed, failed, or times out.
- On success, the backend issues a short-lived paid session cookie and redirects the user to `/videos`.
- The `/videos` page and the protected video route are guarded server-side.

## Notes

- The app uses in-memory storage for orders and sessions. Restarting the server clears pending payments.
- Make sure your `APP_BASE_URL` is public if you want PalmPesa callbacks to reach the webhook endpoint.
