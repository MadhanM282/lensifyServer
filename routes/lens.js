const express = require('express');
const { db } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateId() {
  return 'lens-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Single JSON shape for clients. Always includes od, os, savedAt, fittingType
 * (null when absent) so fields are not “missing” from JSON.
 * If DB has no od_data/os_data but flat Rx exists, maps flat → od for older rows.
 */
function rowToRecord(row) {
  const odFromDb =
    isPlainObject(row.od_data) && Object.keys(row.od_data).length > 0 ? row.od_data : null;
  const osFromDb =
    isPlainObject(row.os_data) && Object.keys(row.os_data).length > 0 ? row.os_data : null;

  let od = odFromDb;
  let os = osFromDb;

  // Legacy / partial saves: only top-level sphere/cyl/axis — expose as OD so UI can list by eye
  if (!od && !os && (row.sphere || row.power)) {
    od = {
      hvid: row.hvid || undefined,
      diameter: row.diameter || undefined,
      baseCurve: row.base_curve || undefined,
      sphere: row.sphere || row.power,
      cylinder: row.cylinder || undefined,
      axis: row.axis || undefined,
      lensType: row.lens_type || undefined,
      lensColor: row.lens_color || undefined,
      notes: row.notes || undefined,
    };
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    hvid: row.hvid || '',
    diameter: row.diameter || '',
    baseCurve: row.base_curve || '',
    power: row.power,
    powerType: row.power_type,
    sphere: row.sphere ?? null,
    cylinder: row.cylinder ?? null,
    axis: row.axis ?? null,
    lensType: row.lens_type ?? null,
    lensColor: row.lens_color ?? null,
    spectaclePower: row.spectacle_power ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    savedAt: row.saved_at ?? null,
    fittingType: row.fitting_type ?? null,
    od,
    os,
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
    savedAt,
    fittingType,
    od,
    os,
  } = body;

  const odObj = od && typeof od === 'object' ? od : null;
  const osObj = os && typeof os === 'object' ? os : null;
  const odSphere = odObj?.sphere != null ? String(odObj.sphere).trim() : '';
  const osSphere = osObj?.sphere != null ? String(osObj.sphere).trim() : '';

  let effectivePower = (power ?? sphere ?? '').trim();
  if (!effectivePower) effectivePower = (odSphere || osSphere || '').trim();
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
  const saved_at = (savedAt && String(savedAt).trim()) || now;
  const fitting_type = fittingType === 'soft' || fittingType === 'hard' ? fittingType : null;

  const flatHvid = (hvid || '').trim() || (odObj?.hvid ? String(odObj.hvid).trim() : '') || (osObj?.hvid ? String(osObj.hvid).trim() : '');
  const flatDia =
    (diameter || '').trim() || (odObj?.diameter ? String(odObj.diameter).trim() : '') || (osObj?.diameter ? String(osObj.diameter).trim() : '');
  const flatBc =
    (baseCurve || '').trim() || (odObj?.baseCurve ? String(odObj.baseCurve).trim() : '') || (osObj?.baseCurve ? String(osObj.baseCurve).trim() : '');

  const strOr = (v, fallback = '') => (v != null && String(v).trim() !== '' ? String(v).trim() : fallback);
  // Top-level cyl/axis/tint often omitted when client only sends od/os — copy from first available eye
  const flatCylinder =
    strOr(cylinder, '') || strOr(odObj?.cylinder, '') || strOr(osObj?.cylinder, '') || null;
  const flatAxis = strOr(axis, '') || strOr(odObj?.axis, '') || strOr(osObj?.axis, '') || null;
  const flatLensType = lensType || odObj?.lensType || osObj?.lensType || null;
  const flatLensColor = lensColor || odObj?.lensColor || osObj?.lensColor || null;
  const flatNotes = strOr(notes, '') || strOr(odObj?.notes, '') || strOr(osObj?.notes, '') || null;

  const record = {
    id,
    user_id: req.userId,
    patient_id: pid,
    patient_name: (patientName || '').trim(),
    hvid: flatHvid,
    diameter: flatDia,
    base_curve: flatBc,
    power: effectivePower,
    power_type: effectivePowerType,
    sphere: (sphere ?? effectivePower).trim(),
    cylinder: flatCylinder,
    axis: flatAxis,
    lens_type: flatLensType,
    lens_color: flatLensColor,
    spectacle_power: (spectaclePower || '').trim() || null,
    notes: flatNotes,
    created_at: now,
    saved_at,
    fitting_type,
    od_data: odObj && Object.keys(odObj).length ? { ...odObj } : null,
    os_data: osObj && Object.keys(osObj).length ? { ...osObj } : null,
  };

  try {
    await db.addLens(record);
    const saved = await db.getLensById(id, req.userId);
    res.status(201).json(rowToRecord(saved || record));
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
