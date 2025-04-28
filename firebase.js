// firebase.js
const admin = require('firebase-admin');
const path  = require('path');

// Path ke serviceAccountKey.json
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// expose firestore db
const db = admin.firestore();
module.exports = { db };
