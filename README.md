# 📦 Digital Time Capsule
**Simpan pesan untuk masa depan secara digital**  
_Dokumentasi dibuat pada: 01 Mei 2025_

---

## 📝 Deskripsi Proyek
**Digital Time Capsule** adalah aplikasi web yang memungkinkan pengguna membuat pesan pribadi yang akan dikirimkan ke email tertentu di masa depan pada tanggal yang telah ditentukan.

---

## 🔧 Fitur Utama

- Tambah kapsul waktu (judul, penulis, isi pesan, tanggal kirim, email penerima)
- Buka kapsul ketika tanggal kirim telah tiba
- Kirim email otomatis via cronjob menggunakan **Nodemailer**
- Penyimpanan data menggunakan **Firestore**
- UI responsif menggunakan Bootstrap
- Notifikasi error dan berhasil

---

## 💻 Teknologi yang Digunakan

| Teknologi         | Deskripsi                       |
|------------------|---------------------------------|
| Node.js + Express| Backend server & API            |
| Firestore (Firebase)| Database                     |
| Nodemailer       | Mengirim email                  |
| node-cron        | Menjadwalkan pengiriman otomatis|
| Bootstrap + Vanilla JS | Tampilan antarmuka        |
| dotenv           | Mengelola variabel environment  |

---

## 🗂️ Struktur Direktori Singkat

```
.
├── public/                 # Frontend (HTML, CSS, JS)
├── index.js                # Entry point backend Express
├── cronjob.js              # Penjadwalan pengiriman email
├── serviceAccountKey.json  # Credential Firebase (disimpan sebagai secret)
├── .env                    # Email credentials (disembunyikan)
```

---

## 🚀 Cara Menjalankan (Local Dev)

```bash
# 1. Clone repositori
git clone <repo-url>
cd digital-time-capsule

# 2. Install dependensi
npm install

# 3. Siapkan .env
# EMAIL_USER, EMAIL_PASS harus valid
# FIREBASE SERVICE ACCOUNT berada di serviceAccountKey.json

# 4. Jalankan server
node index.js
```

---

## ☁️ Catatan Deploy

- Telah diuji untuk deployment di:
  - [Render](https://digitaltimecapsule-caon.onrender.com)

---

## 👤 Dibuat oleh
**Athif Naufal Shafy Al Fathi**  
Kelas X Backend – SMA IT Al Fityan School Gowa
