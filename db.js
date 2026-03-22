const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    password_hash: { type: String, required: true },
  },
  { versionKey: false }
);

const lensSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    patient_id: { type: String, required: true },
    patient_name: { type: String, required: true },
    hvid: { type: String, default: '' },
    diameter: { type: String, default: '' },
    base_curve: { type: String, default: '' },
    power: { type: String, required: true },
    power_type: { type: String, enum: ['minus', 'plus'], required: true },
    sphere: { type: String, default: null },
    cylinder: { type: String, default: null },
    axis: { type: String, default: null },
    lens_type: { type: String, default: null },
    lens_color: { type: String, default: null },
    spectacle_power: { type: String, default: null },
    notes: { type: String, default: null },
    created_at: { type: String, required: true, index: true },
    saved_at: { type: String, default: null },
    fitting_type: { type: String, enum: ['soft', 'hard'], default: null },
    od_data: { type: mongoose.Schema.Types.Mixed, default: null },
    os_data: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { versionKey: false, strict: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
const LensRecord = mongoose.models.LensRecord || mongoose.model('LensRecord', lensSchema);

const db = {
  async getUserByEmail(email) {
    return User.findOne({ email }).lean();
  },
  async getUserById(id) {
    return User.findOne({ id }).lean();
  },
  async addUser(user) {
    await User.create(user);
  },
  async getLensByUser(userId) {
    return LensRecord.find({ user_id: userId }).sort({ created_at: -1 }).lean();
  },
  async getLensById(id, userId) {
    return LensRecord.findOne({ id, user_id: userId }).lean();
  },
  async addLens(record) {
    await LensRecord.create(record);
  },
  async deleteLens(id, userId) {
    const result = await LensRecord.deleteOne({ id, user_id: userId });
    return result.deletedCount > 0;
  },
};

async function initDb() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Set it in server/.env');
  }
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB connected');
}

module.exports = { db, initDb };
