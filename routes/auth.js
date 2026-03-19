const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const e = (email || '').trim().toLowerCase();
    const p = password || '';
    const n = (name || e.split('@')[0] || '').trim();

    if (!e || !p) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (p.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (await db.getUserByEmail(e)) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const id = generateId('user');
    const passwordHash = bcrypt.hashSync(p, 10);
    await db.addUser({ id, email: e, name: n, password_hash: passwordHash });

    const token = jwt.sign(
      { userId: id, email: e, name: n },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      user: { id, email: e, name: n },
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const e = (email || '').trim().toLowerCase();
    const p = password || '';

    if (!e || !p) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const row = await db.getUserByEmail(e);
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!bcrypt.compareSync(p, row.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: row.id, email: row.email, name: row.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: { id: row.id, email: row.email, name: row.name },
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.userId,
      email: req.userEmail,
      name: req.userName,
    },
  });
});

module.exports = router;
