require('dotenv').config();             // load .env
const express = require('express');
const nodemailer = require('nodemailer');
const cron      = require('node-cron');
const path      = require('path');

// Firestore setup
const admin = require('firebase-admin');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db        = admin.firestore();
const CAPSULES  = db.collection('capsules');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// simple request logger
app.use((req, res, next) => {
  console.log(`> ${req.method} ${req.url}`);
  next();
});

// helper validators
function isValidEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}
function isValidDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// ─── CRUD helpers with Firestore ─────────────────────────────────────────────

async function loadCapsules() {
  const snap = await CAPSULES.get();
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title:   data.title,
      author:  data.author,
      message: data.message,
      sendDate: data.sendDate,
      email:   data.email,
      sent:    data.sent,
      opened:  data.opened,
      // ★ convert Timestamp → Date → ISO string
      createdAt: data.createdAt.toDate().toISOString()
    };
  });
}

async function createCapsule({ title, author, message, sendDate, email }) {
  const ref = await CAPSULES.add({
    title,
    author,
    message,
    sendDate,
    email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sent: false,
    opened: false
  });
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() };
}

async function updateCapsule(id, data) {
  if (data.sendDate && !isValidDate(data.sendDate)) {
    const err = new Error('Format tanggal harus YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  if (data.email && !isValidEmail(data.email)) {
    const err = new Error('Format email tidak valid');
    err.status = 400;
    throw err;
  }
  const docRef = CAPSULES.doc(id);
  const snap   = await docRef.get();
  if (!snap.exists) {
    const err = new Error('Capsule not found');
    err.status = 404;
    throw err;
  }
  // only update provided fields
  await docRef.update(data);
  const updated = await docRef.get();
  return { id: updated.id, ...updated.data() };
}

async function deleteCapsule(id) {
  const docRef = CAPSULES.doc(id);
  const snap   = await docRef.get();
  if (!snap.exists) {
    const err = new Error('Capsule not found');
    err.status = 404;
    throw err;
  }
  await docRef.delete();
}

// ─── Nodemailer setup ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─── API Endpoints ───────────────────────────────────────────────────────────

// Create
app.post('/capsules', async (req, res) => {
  try {
    const { title, author, message, sendDate, email } = req.body;
    if (!title || !author || !message || !sendDate || !email) {
      return res.status(400).json({
        error: 'title, author, message, sendDate, and email are required'
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Format email tidak valid' });
    }
    if (!isValidDate(sendDate)) {
      return res.status(400).json({ error: 'Format tanggal harus YYYY-MM-DD' });
    }
    const newCap = await createCapsule({ title, author, message, sendDate, email });
    res.status(201).json(newCap);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Read all with optional filter & sort
app.get('/capsules', async (req, res) => {
  try {
    let capsules = await loadCapsules();
    const { date, author, sent, opened, sortBy, sortOrder } = req.query;
    if (date)   capsules = capsules.filter(c => c.sendDate === date);
    if (author) capsules = capsules.filter(c => c.author   === author);
    if (sent)   capsules = capsules.filter(c => c.sent     === (sent === 'true'));
    if (opened) capsules = capsules.filter(c => c.opened   === (opened === 'true'));
    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      capsules.sort((a, b) => (a[sortBy] < b[sortBy] ? -1 : 1) * order);
    }
    res.json(capsules);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Read one
app.get('/capsules/:id', async (req, res) => {
  try {
    const snap = await CAPSULES.doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Capsule not found' });
    res.json({ id: snap.id, ...snap.data() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Update
app.patch('/capsules/:id', async (req, res) => {
  try {
    const updated = await updateCapsule(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Delete
app.delete('/capsules/:id', async (req, res) => {
  try {
    await deleteCapsule(req.params.id);
    res.json({ status: 'Capsule deleted' });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({ error: e.message });
  }
});


const startCron = require('./cronjob');
startCron({ loadCapsules, updateCapsule, transporter, timeZone: 'Asia/Makassar' });

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});