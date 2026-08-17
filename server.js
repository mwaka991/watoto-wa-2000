const express = require('express');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4009;
const PALMPESA_BASE = 'https://palmpesa.drmlelwa.co.tz';
const PALMPESA_TOKEN = process.env.PALMPESA_API_TOKEN || '';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const PAYMENT_AMOUNT = 1000;

const orders = new Map();
const accessTokens = new Map();

const fetchFn = global.fetch || ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/assets', express.static(__dirname));

function validatePhone(phone) {
  // Accept: 0XXXXXXXXX (10 digits), 255XXXXXXXXX (12 digits), +255XXXXXXXXX (13 chars)
  return /^(?:0[0-9]{9}|255[0-9]{9}|\+255[0-9]{9})$/.test(phone);
}

function normalizePhone(phone) {
  // Convert all formats to PalmPesa format: 0XXXXXXXXX (local)
  phone = phone.trim();
  if (phone.startsWith('+255')) {
    return '0' + phone.slice(4);  // +255744000000 → 0744000000
  }
  if (phone.startsWith('255')) {
    return '0' + phone.slice(3);  // 255744000000 → 0744000000
  }
  return phone;  // already 0XXXXXXXXX
}

function createOrder(phone) {
  const orderRef = randomUUID();
  const transactionId = `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const order = {
    orderRef,
    phone,
    status: 'pending',
    createdAt: Date.now(),
    orderId: null,
    transactionId,
    lastStatusCheckAt: 0,
    accessToken: null,
    tokenExpiry: null,
  };
  orders.set(orderRef, order);
  return order;
}

async function initiatePalmPesaPayment(order) {
  if (!PALMPESA_TOKEN) {
    throw new Error('PALMPESA_API_TOKEN is not configured.');
  }

  const url = `${PALMPESA_BASE}/api/palmpesa/initiate`;
  const normalizedPhone = normalizePhone(order.phone);
  
  const body = {
    name: 'Customer User',
    email: 'customer@example.com',
    phone: normalizedPhone,  // PalmPesa requires local format (0XXXXXXXXX)
    amount: PAYMENT_AMOUNT,
    transaction_id: order.transactionId,
    address: 'Dar es Salaam',
    postcode: '00000',
    callback_url: `${APP_BASE_URL}/api/webhook/palmpesa`,
  };

  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PALMPESA_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PalmPesa initiate failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  if (!json.order_id) {
    throw new Error(`PalmPesa initiate response missing order_id: ${JSON.stringify(json)}`);
  }

  return json.order_id;
}

async function fetchPalmPesaOrderStatus(orderId) {
  if (!PALMPESA_TOKEN) {
    throw new Error('PALMPESA_API_TOKEN is not configured.');
  }

  const url = `${PALMPESA_BASE}/api/order-status`;
  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PALMPESA_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PalmPesa order-status failed (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const status = json?.data?.[0]?.payment_status;
  return status || 'PENDING';
}

function ensurePaid(req, res, next) {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(403).send('<h1>Access denied</h1><p>Payment is required to view this page.</p>');
  }
  const saved = accessTokens.get(token);
  if (!saved || saved.expiresAt < Date.now()) {
    return res.status(403).send('<h1>Access denied</h1><p>Your paid session has expired or is invalid.</p>');
  }
  next();
}

app.post('/api/pay/start', async (req, res) => {
  try {
    const phone = String(req.body.phone || '').trim();
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Please enter a valid Tanzanian phone number like 0744000000.' });
    }

    const order = createOrder(phone);
    const orderId = await initiatePalmPesaPayment(order);
    order.orderId = orderId;
    order.lastStatusCheckAt = Date.now();

    return res.json({ orderRef: order.orderRef });
  } catch (error) {
    console.error('Pay start error:', error);
    return res.status(500).json({ error: 'Unable to initiate payment. Please try again.' });
  }
});

app.get('/api/pay/status/:orderRef', async (req, res) => {
  try {
    const orderRef = req.params.orderRef;
    const order = orders.get(orderRef);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'paid') {
      if (!order.accessToken || order.tokenExpiry < Date.now()) {
        const accessToken = randomUUID();
        order.accessToken = accessToken;
        order.tokenExpiry = Date.now() + 2 * 60 * 1000;
        accessTokens.set(accessToken, { orderRef, expiresAt: order.tokenExpiry });
      }
      res.cookie('access_token', order.accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 2 * 60 * 1000,
      });
      return res.json({ status: 'paid' });
    }

    if (order.status === 'failed') {
      return res.json({ status: 'failed', message: 'Payment failed. Please try again with a new phone number.' });
    }

    const now = Date.now();
    const shouldQueryExternal = order.orderId && now - order.lastStatusCheckAt > 15000;
    if (shouldQueryExternal) {
      order.lastStatusCheckAt = now;
      const remoteStatus = await fetchPalmPesaOrderStatus(order.orderId);
      if (['COMPLETED', 'FAILED'].includes(remoteStatus)) {
        order.status = remoteStatus === 'COMPLETED' ? 'paid' : 'failed';
      }
    }

    return res.json({ status: order.status });
  } catch (error) {
    console.error('Pay status error:', error);
    return res.status(500).json({ error: 'Unable to retrieve payment status. Please try again.' });
  }
});

app.post('/api/webhook/palmpesa', (req, res) => {
  const { order_id: orderId, payment_status: paymentStatus } = req.body || {};
  if (!orderId || !paymentStatus) {
    res.status(400).send('Missing order_id or payment_status');
    return;
  }

  for (const order of orders.values()) {
    if (order.orderId === orderId) {
      if (paymentStatus === 'COMPLETED') {
        order.status = 'paid';
      } else if (paymentStatus === 'FAILED') {
        order.status = 'failed';
      } else if (paymentStatus === 'PENDING') {
        order.status = 'pending';
      }
      break;
    }
  }

  res.sendStatus(200);
});

app.get('/videos', ensurePaid, (req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Video Library</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; min-height: 100vh; background: #111; color: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; padding: 32px; }
    h1 { margin-bottom: 16px; }
    .video-card { background: #161616; border: 1px solid #333; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    video { width: 100%; border-radius: 10px; display: block; }
    .note { color: #aaa; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Full Video Library</h1>
    <div class="video-card">
      <p>Thank you for paying. Enjoy the full video.</p>
      <video controls autoplay>
        <source src="/protected/full-video.mp4" type="video/mp4">
        Your browser does not support video playback.
      </video>
      <p class="note">The protected video stream is only accessible after payment.</p>
    </div>
  </div>
</body>
</html>`);
});

app.get('/protected/full-video.mp4', ensurePaid, async (req, res) => {
  try {
    const remoteUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
    const response = await fetchFn(remoteUrl);
    if (!response.ok) {
      return res.status(502).send('Unable to load protected video content.');
    }

    res.setHeader('Content-Type', 'video/mp4');
    response.body.pipe(res);
  } catch (error) {
    console.error('Protected video fetch error:', error);
    res.status(500).send('Unable to load protected video content.');
  }
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('its working');
});
