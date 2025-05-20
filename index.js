// index.js

require('dotenv').config();               // load .env
const express = require('express');
const nodemailer = require('nodemailer');
// const cron = require('node-cron'); // Tidak lagi dibutuhkan di sini jika semua logika cron ada di cronjob.js
const path = require('path');

// Firestore setup
const admin = require('firebase-admin');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json')); // Pastikan path ini benar
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const CAPSULES = db.collection('capsules');

// Impor fungsi startCron dari cronjob.js
const startAppCron = require('./cronjob.js'); // Pastikan nama file dan path ini benar

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Sajikan file statis dari folder 'public'

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
  return /^\d{4}-\d{2}-\d{2}$/.test(date); // Validates YYYY-MM-DD
}

// ─── CRUD helpers with Firestore (digunakan oleh API Endpoints) ─────────────

async function loadCapsules() { // Fungsi ini digunakan oleh GET /capsules endpoint
  const snap = await CAPSULES.get();
  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title:   data.title,
      author:  data.author,
      message: data.message,
      sendDate: data.sendDate, // Asumsi ini adalah string YYYY-MM-DD
      email:   data.email,
      sent:    data.sent,
      opened:  data.opened,
      createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null
    };
  });
}

async function createCapsule({ title, author, message, sendDate, email }) {
  const ref = await CAPSULES.add({
    title,
    author,
    message,
    sendDate, // Simpan sebagai string YYYY-MM-DD
    email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sent: false,
    opened: false
  });
  const snap = await ref.get();
  const data = snap.data();
  return { 
    id: snap.id, 
    ...data,
    createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null
  };
}

// Fungsi updateCapsule ini hanya untuk 'opened' via API.
// Cron job akan melakukan update 'sent' secara langsung.
async function updateCapsule(id, data) {
  if (data.opened === undefined) {
    const err = new Error('Only `opened` status can be updated via this API endpoint');
    err.status = 400;
    throw err;
  }
  const docRef = CAPSULES.doc(id);
  const snap = await docRef.get();
  if (!snap.exists) {
    const err = new Error('Capsule not found');
    err.status = 404;
    throw err;
  }
  await docRef.update({ opened: data.opened });
  const updatedSnap = await docRef.get();
  const updatedData = updatedSnap.data();
  return { 
    id: updatedSnap.id, 
    ...updatedData,
    createdAt: updatedData.createdAt && updatedData.createdAt.toDate ? updatedData.createdAt.toDate().toISOString() : null
  };
}

async function deleteCapsule(id) {
  const docRef = CAPSULES.doc(id);
  const snap = await docRef.get();
  if (!snap.exists) {
    const err = new Error('Capsule not found');
    err.status = 404;
    throw err;
  }
  await docRef.delete();
}

// ─── Nodemailer setup ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail', // Atau layanan email lain
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Tambahkan opsi logging untuk Nodemailer jika diperlukan untuk debugging lebih lanjut
  // logger: true,
  // debug: true // Pindahkan ke opsi transport jika ingin log koneksi
});

transporter.verify(function(error, success) { // Verifikasi koneksi SMTP saat startup
  if (error) {
    console.error("Nodemailer configuration error:", error);
  } else {
    console.log("Nodemailer is ready to send emails.");
  }
});


// ─── API Endpoints ───────────────────────────────────────────────────────────

// Create
app.post('/capsules', async (req, res) => {
  try {
    const { title, author, message, sendDate, email } = req.body;
    if (!title || !author || !message || !sendDate || !email) {
      return res.status(400).json({
        error: 'Title, author, message, sendDate, and email are required fields.'
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!isValidDate(sendDate)) {
      return res.status(400).json({ error: 'Date format must be YYYY-MM-DD.' });
    }
    // Validasi tambahan: sendDate tidak boleh di masa lalu
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set ke awal hari untuk perbandingan yang adil
    const inputSendDate = new Date(sendDate + "T00:00:00"); // Pastikan perbandingan tanggal akurat
    
    if (inputSendDate < today) {
        return res.status(400).json({ error: 'Send date cannot be in the past.' });
    }

    const newCap = await createCapsule({ title, author, message, sendDate, email });
    res.status(201).json(newCap);
  } catch (e) {
    console.error("Error creating capsule:", e.message, e.stack);
    res.status(e.status || 500).json({ error: e.message || "Internal server error." });
  }
});

// Read all with optional filter & sort
app.get('/capsules', async (req, res) => {
  try {
    let capsules = await loadCapsules(); // Menggunakan helper yang mengambil semua data
    const { date, author, sent, opened, sortBy, sortOrder } = req.query;
    
    if (date)   capsules = capsules.filter(c => c.sendDate === date);
    if (author) capsules = capsules.filter(c => c.author && c.author.toLowerCase().includes(author.toLowerCase())); // Case-insensitive search
    if (sent)   capsules = capsules.filter(c => c.sent     === (sent === 'true'));
    if (opened) capsules = capsules.filter(c => c.opened   === (opened === 'true'));

    if (sortBy) {
      const order = sortOrder === 'desc' ? -1 : 1;
      capsules.sort((a, b) => {
        if (a[sortBy] === undefined || a[sortBy] === null) return 1 * order; // Pindahkan null/undefined ke akhir
        if (b[sortBy] === undefined || b[sortBy] === null) return -1 * order;
        if (a[sortBy] < b[sortBy]) return -1 * order;
        if (a[sortBy] > b[sortBy]) return 1 * order;
        return 0;
      });
    }
    res.json(capsules);
  } catch (e) {
    console.error("Error loading capsules for API:", e.message, e.stack);
    res.status(500).json({ error: e.message || "Internal server error." });
  }
});

// Read one
app.get('/capsules/:id', async (req, res) => {
  try {
    const snap = await CAPSULES.doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Capsule not found.' });
    const data = snap.data();
    res.json({ 
      id: snap.id, 
      ...data,
      createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null
    });
  } catch (e) {
    console.error("Error fetching capsule by ID:", e.message, e.stack);
    res.status(500).json({ error: e.message || "Internal server error." });
  }
});

// Update → hanya untuk membuka kapsul
app.patch('/capsules/:id', async (req, res) => {
  try {
    // Validasi bahwa hanya 'opened' yang ada di body dan nilainya boolean
    if (req.body.opened === undefined || typeof req.body.opened !== 'boolean' || Object.keys(req.body).length !== 1) {
        return res.status(400).json({ error: 'Request body must only contain the `opened` field with a boolean value.' });
    }
    const updated = await updateCapsule(req.params.id, { opened: req.body.opened });
    res.json(updated);
  } catch (e) {
    console.error("Error updating capsule (opened status):", e.message, e.stack);
    res.status(e.status || 500).json({ error: e.message || "Internal server error." });
  }
});

// Delete
app.delete('/capsules/:id', async (req, res) => {
  try {
    await deleteCapsule(req.params.id);
    res.status(200).json({ status: 'Capsule deleted successfully.' }); // Memberikan respons yang lebih jelas
  } catch (e) {
    console.error("Error deleting capsule:", e.message, e.stack);
    res.status(e.status || 500).json({ error: e.message || "Internal server error." });
  }
});


// ─── Jalankan Cron Job ───────────────────────────────────────────────────────
// Pastikan CAPSULES, transporter, dan EMAIL_USER sudah terdefinisi dengan benar
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  startAppCron({
    capsulesCollection: CAPSULES,
    transporter: transporter,
    emailUser: process.env.EMAIL_USER,
    timeZone: process.env.TIME_ZONE || 'Asia/Makassar' // Ambil dari .env atau default
  });
} else {
  console.warn('[CRON_SETUP_WARNING] EMAIL_USER or EMAIL_PASS not found in .env. Cron job for sending emails will not start.');
  console.warn('[CRON_SETUP_WARNING] Please ensure Nodemailer email credentials are set in your .env file.');
}


// ─── Server Start ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Digital Time Capsule API is active.');
  // Pesan status cron job sudah ada di dalam cronjob.js atau startAppCron
});
