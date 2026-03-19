const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateId() {
  return 'lens-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function rowToRecord(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    hvid: row.hvid || '',
    diameter: row.diameter || '',
    baseCurve: row.base_curve || '',
    power: row.power,
    powerType: row.power_type,
    sphere: row.sphere || undefined,
    cylinder: row.cylinder || undefined,
    axis: row.axis || undefined,
    lensType: row.lens_type || undefined,
    lensColor: row.lens_color || undefined,
    spectaclePower: row.spectacle_power || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const rows = await db.getLensByUser(req.userId);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    res.json({ records: rows.map(rowToRecord) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authMiddleware, async (req, res) => {
  const body = req.body || {};
  const {
    patientId,
    patientName,
    hvid = '',
    diameter = '',
    baseCurve = '',
    power,
    powerType,
    sphere,
    cylinder,
    axis,
    lensType,
    lensColor,
    spectaclePower,
    notes,
  } = body;

  const effectivePower = (power ?? sphere ?? '').trim();
  const parsedPower = parseFloat(effectivePower.replace(',', '.'));
  if (!patientName || !effectivePower) {
    return res.status(400).json({ error: 'Patient name and power are required' });
  }
  const effectivePowerType =
    ['minus', 'plus'].includes(powerType)
      ? powerType
      : Number.isFinite(parsedPower) && parsedPower < 0
        ? 'minus'
        : 'plus';
  if (!['minus', 'plus'].includes(effectivePowerType)) {
    return res.status(400).json({ error: 'powerType must be minus or plus' });
  }

  const id = generateId();
  const pid = patientId || 'p-' + Date.now();
  const now = new Date().toISOString();

  const record = {
    id,
    user_id: req.userId,
    patient_id: pid,
    patient_name: (patientName || '').trim(),
    hvid: (hvid || '').trim(),
    diameter: (diameter || '').trim(),
    base_curve: (baseCurve || '').trim(),
    power: effectivePower,
    power_type: effectivePowerType,
    sphere: (sphere ?? effectivePower).trim(),
    cylinder: (cylinder || '').trim() || null,
    axis: (axis || '').trim() || null,
    lens_type: lensType || null,
    lens_color: lensColor || null,
    spectacle_power: (spectaclePower || '').trim() || null,
    notes: (notes || '').trim() || null,
    created_at: now,
  };

  try {
    await db.addLens(record);
    res.status(201).json(rowToRecord(record));
  } catch (err) {
    console.error('Lens save error:', err);
    res.status(500).json({ error: err.message || 'Failed to save lens record' });
  }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteLens(id, req.userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
