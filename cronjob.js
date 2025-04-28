// cronjob.js
const cron = require('node-cron');

/**
 * Jalankan cron job untuk mengirim kapsul tepat waktu.
 *
 * @param {Object} opts
 * @param {() => Promise<Array>} opts.loadCapsules   – async, baca semua kapsul dari Firestore
 * @param {(id: string, data: Object) => Promise} opts.updateCapsule – async, update kapsul by ID
 * @param {import('nodemailer').Transporter} opts.transporter – nodemailer transporter
 * @param {string} opts.timeZone                     – nama timezone, misal 'Asia/Makassar'
 */
module.exports = function startCron({
  loadCapsules,
  updateCapsule,
  transporter,
  timeZone = 'UTC'
}) {
  // schedule setiap menit
  cron.schedule('* * * * *', async () => {
    console.log(`[Cron] Running check at ${new Date().toLocaleString('en-US', { timeZone })}`);

    // format YYYY-MM-DD di zona waktu yang dipilih
    const today = new Date().toLocaleDateString('en-CA', { timeZone });

    let capsules;
    try {
      capsules = await loadCapsules();
    } catch (err) {
      console.error('[Cron] Failed to load capsules:', err);
      return;
    }

    for (const c of capsules) {
      if (!c.sent && c.sendDate === today) {
        try {
          await transporter.sendMail({
            from: transporter.options.auth.user,
            to: c.email,
            subject: `Kapsul Waktu: ${c.title}`,
            text: 
              `🔔 Waktunya tiba! Pesanmu:\n\n` +
              `From: ${c.author}\n\n` +
              `Message:\n${c.message}\n\n` +
              `— Digital Time Capsule`
          });
          console.log(`[Cron] Sent capsule ${c.id} to ${c.email}`);

          // tandai sent = true di Firestore
          await updateCapsule(c.id, { sent: true });
        } catch (err) {
          console.error(`[Cron] Error sending capsule ${c.id}:`, err);
        }
      }
    }
  }, {
    scheduled: true,
    timezone: timeZone
  });

  console.log(`[Cron] Scheduled job every minute (timezone=${timeZone})`);
};
