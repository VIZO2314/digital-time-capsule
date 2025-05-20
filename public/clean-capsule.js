const apiBase = '/capsules';

// Ambil elemen
const form    = document.getElementById('capsuleForm');
const listDiv = document.getElementById('capsules');

// Notifikasi
function showNotification(msg, type='info') {
  let c = document.getElementById('notif-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'notif-container';
    Object.assign(c.style, {
      position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999
    });
    document.body.appendChild(c);
  }
  const a = document.createElement('div');
  a.className = `alert alert-${type}`;
  a.textContent   = msg;
  c.appendChild(a);
  setTimeout(() => a.remove(), 4000);
}

// Render
function renderCapsules(items) {
  listDiv.innerHTML = '';               // clear

  if (!items.length) {
    listDiv.innerHTML = '<p>Tidak ada capsule.</p>';
    return;
  }

  // hitung tanggal hari ini
  const d     = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  items.forEach(c => {
    const card   = document.createElement('div');
    card.className = 'card mb-3 shadow-sm';

    // header
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `<strong>${c.title}</strong> <small class="text-muted">by ${c.author}</small>`;

    // body
    const body = document.createElement('div');
    body.className = 'card-body';
    const created = new Date(c.createdAt).toLocaleString();
    const createdHTML = `<p class="small text-muted mb-2">Dibuat: ${created}</p>`;

    if (c.sendDate > today) {
      body.innerHTML = `
        ${createdHTML}
        <p class="text-secondary">⌛ Akan terbuka pada ${c.sendDate}</p>
      `;
    } else if (!c.opened) {
      body.innerHTML = `
        ${createdHTML}
        <p><em>Waktunya telah tiba!</em></p>
        <button class="btn btn-sm btn-primary" id="open-${c.id}">Buka Kapsul</button>
      `;
    } else {
      body.innerHTML = `
        ${createdHTML}
        <p>${c.message}</p>
      `;
    }

    // footer
    const footer = document.createElement('div');
    footer.className = 'card-footer text-end';

    // Delete
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-sm btn-outline-danger';
    btnDel.textContent = 'Delete';
    btnDel.addEventListener('click', async () => {
      try {
        await fetch(`${apiBase}/${c.id}`, { method: 'DELETE' });
        showNotification('Capsule berhasil dihapus', 'success');
        fetchCapsules();
      } catch (error) {
        showNotification('Gagal menghapus capsule', 'danger');
      }
    });
    footer.appendChild(btnDel);

    // Buka (jika waktunya tiba)
    if (c.sendDate <= today && !c.opened) {
      const btnOpen = body.querySelector(`#open-${c.id}`);
      btnOpen.addEventListener('click', async () => {
        try {
          await fetch(`${apiBase}/${c.id}`, {
            method:'PATCH',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ opened:true })
          });
          showNotification('Kapsul berhasil dibuka!', 'success');
          fetchCapsules();
        } catch (error) {
          showNotification('Gagal membuka kapsul', 'danger');
        }
      });
    }

    card.append(header, body, footer);
    listDiv.appendChild(card);
  });
}

// Fetch & init
async function fetchCapsules() {
  try {
    const res = await fetch(apiBase);
    if (!res.ok) throw new Error('Gagal load capsules');
    renderCapsules(await res.json());
  } catch (e) {
    showNotification(e.message, 'danger');
  }
}

// submit form
form.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(form);
  await fetch(apiBase, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      title: fd.get('title'),
      author: fd.get('author'),
      message: fd.get('message'),
      sendDate: fd.get('sendDate'),
      email: fd.get('email')
    })
  });
  form.reset();
  fetchCapsules();
});

// kick off
fetchCapsules();
