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

// Form edit (pesan + tanggal)
function showEditForm(capsule, bodyEl, footerEl) {
  // kosongkan
  bodyEl.innerHTML   = '';
  footerEl.innerHTML = '';

  bodyEl.innerHTML = `
    <div class="mb-2">
      <label class="form-label">Pesan</label>
      <textarea id="edit-msg-${capsule.id}" class="form-control" rows="3">${capsule.message}</textarea>
    </div>
    <div class="mb-2">
      <label class="form-label">Send Date</label>
      <input id="edit-date-${capsule.id}" type="date" class="form-control" value="${capsule.sendDate}">
    </div>
  `;

  const btnSave = document.createElement('button');
  btnSave.className = 'btn btn-sm btn-success me-2';
  btnSave.textContent = 'Simpan';
  btnSave.addEventListener('click', async () => {
    const newMsg  = document.getElementById(`edit-msg-${capsule.id}`).value;
    const newDate = document.getElementById(`edit-date-${capsule.id}`).value;
    try {
      const res = await fetch(`${apiBase}/${capsule.id}`, {
        method: 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ message: newMsg, sendDate: newDate })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan');
      }
      showNotification('Berhasil diperbarui!', 'success');
      fetchCapsules();
    } catch (e) {
      showNotification(e.message, 'danger');
    }
  });

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-sm btn-secondary';
  btnCancel.textContent = 'Batal';
  btnCancel.addEventListener('click', fetchCapsules);

  footerEl.append(btnSave, btnCancel);
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

    // Edit (hanya sebelum tanggal & sebelum sent)
    if (c.sendDate > today && !c.sent) {
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn btn-sm btn-outline-secondary me-2';
      btnEdit.textContent = 'Edit';
      btnEdit.addEventListener('click', () => showEditForm(c, body, footer));
      footer.appendChild(btnEdit);
    }

    // Delete
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-sm btn-outline-danger';
    btnDel.textContent = 'Delete';
    btnDel.addEventListener('click', async () => {
      await fetch(`${apiBase}/${c.id}`, { method: 'DELETE' });
      fetchCapsules();
    });
    footer.appendChild(btnDel);

    // Buka (jika waktunya tiba)
    if (c.sendDate <= today && !c.opened) {
      const btnOpen = body.querySelector(`#open-${c.id}`);
      btnOpen.addEventListener('click', async () => {
        await fetch(`${apiBase}/${c.id}`, {
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ opened:true })
        });
        fetchCapsules();
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
