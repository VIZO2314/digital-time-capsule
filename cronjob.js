// cronjob.js
const cron = require('node-cron');

/**
 * Jalankan cron job untuk mengirim kapsul tepat waktu.
 *
 * @param {Object} opts
 * @param {import('firebase-admin').firestore.CollectionReference} opts.capsulesCollection - Referensi ke koleksi Firestore 'capsules'.
 * @param {import('nodemailer').Transporter} opts.transporter – nodemailer transporter.
 * @param {string} opts.emailUser - Alamat email pengirim untuk header 'From'.
 * @param {string} opts.timeZone – Nama timezone, misal 'Asia/Makassar'.
 */
module.exports = function startCron({
  capsulesCollection,
  transporter,
  emailUser, // Dibutuhkan untuk field 'from' di email
  timeZone = 'UTC'
}) {
  // Jadwalkan setiap menit. Anda bisa menggantinya ke interval lain jika perlu.
  // Misalnya, '0 * * * *' untuk setiap jam, atau '0 1 * * *' untuk setiap jam 1 pagi.
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    console.log(`[Cron] Running check at ${now.toLocaleString('en-US', { timeZone })} (System time: ${now.toISOString()})`);

    // Format YYYY-MM-DD di zona waktu yang dipilih
    // 'en-CA' menghasilkan format YYYY-MM-DD yang cocok untuk perbandingan string
    const todayString = now.toLocaleDateString('en-CA', { timeZone });

    try {
      const querySnapshot = await capsulesCollection
        .where('sent', '==', false)
        .where('sendDate', '<=', todayString) // Ambil yang sudah jatuh tempo atau terlewat
        .get();

      if (querySnapshot.empty) {
        console.log('[Cron] No pending capsules to send for today or earlier.');
        return;
      }

      console.log(`[Cron] Found ${querySnapshot.size} capsule(s) to process.`);

      for (const doc of querySnapshot.docs) {
        const capsule = { id: doc.id, ...doc.data() };

        // Pengecekan ganda (seharusnya sudah ditangani oleh query, tapi untuk keamanan)
        if (capsule.sent) {
            console.log(`[Cron] Capsule ${capsule.id} already marked as sent. Skipping.`);
            continue;
        }
        if (capsule.sendDate > todayString) {
            console.log(`[Cron] Capsule ${capsule.id} is for a future date (${capsule.sendDate}). Skipping.`);
            continue;
        }


        console.log(`[Cron] Preparing to send capsule ${capsule.id} to ${capsule.email}`);

        try {
          await transporter.sendMail({
            from: `"Digital Time Capsule" <${emailUser}>`, // Gunakan emailUser dari parameter
            to: capsule.email,
            subject: `Kapsul Waktu Terbuka: ${capsule.title}`,
            html: `
              <p>Halo ${capsule.author || 'Penerima'},</p>
              <p>Ini adalah pesan dari masa lalu yang Anda jadwalkan untuk hari ini:</p>
              <hr>
              <h3>${capsule.title}</h3>
              <p><strong>Dari:</strong> ${capsule.author}</p>
              <p><strong>Pesan:</strong></p>
              <p style="white-space: pre-wrap; padding: 10px; border-left: 3px solid #eee; background-color: #f9f9f9;">${capsule.message}</p>
              <hr>
              <p>Semoga hari Anda menyenangkan!</p>
              <p><em>— Digital Time Capsule Anda</em></p>
            `
          });

          console.log(`[Cron] ✅ Sent capsule ${capsule.id} to ${capsule.email}`);

          // Update Firestore agar tidak terkirim dua kali
          // Ini adalah perbaikan krusial: update langsung ke koleksi
          await capsulesCollection.doc(capsule.id).update({ sent: true });
          console.log(`[Cron] Capsule ${capsule.id} marked as sent in Firestore.`);

        } catch (err) {
          console.error(`[Cron] ❌ Error sending or updating capsule ${capsule.id}:`, err);
          // Biarkan 'sent' tetap false agar bisa dicoba lagi di run berikutnya.
          // Pertimbangkan mekanisme retry yang lebih canggih untuk produksi.
        }
      }
    } catch (err) {
      console.error('[Cron] Failed to query or process capsules:', err);
    }
    console.log(`[Cron] Check finished at ${new Date().toLocaleString('en-US', { timeZone })}`);
  }, {
    scheduled: true,
    timezone: timeZone
  });

  console.log(`[Cron] Scheduled job every minute (timezone=${timeZone})`);
};
