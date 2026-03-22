require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const lensRoutes = require('./routes/lens');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
/** Set in .env for local runs so logs/health show the deployed URL clients should use (e.g. Expo). */
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');

const corsOptions = {
  origin(origin, callback) {
    if (CORS_ORIGIN === '*') return callback(null, true);

    const allowedOrigins = CORS_ORIGIN.split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    // Allow mobile/native and server-to-server clients without browser origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);

    return callback(new Error('Not allowed by CORS'));
  },
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/lens', lensRoutes);

app.get('/health', (req, res) => {
  const payload = { ok: true, service: 'eyecare-api' };
  if (PUBLIC_API_URL) {
    payload.publicUrl = PUBLIC_API_URL;
  }
  res.json(payload);
});

app.use((err, req, res, next) => {
  console.error('API error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`EyeCare API running at http://localhost:${PORT}`);
    if (PUBLIC_API_URL) {
      console.log(`Public API URL (for app / testing): ${PUBLIC_API_URL}`);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err.message || err);
  process.exit(1);
});
