// ===================== State =====================
let adminToken = null; // idToken Google, dikirim ulang di tiap request admin
let adminInfo = null;
const SHIFT_LABEL = { 1: '07:00–15:00', 2: '15:00–23:00', 3: '23:00–07:00' };

// ===================== Helpers =====================
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url).then(r => r.json());
}

// text/plain menghindari CORS preflight (Apps Script tidak menangani OPTIONS
// secara default). Backend tetap membaca body sebagai JSON.
function apiPost(payload) {
  return fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }).then(r => r.json());
}

function showMsg(elId, text, ok) {
  const el = document.getElementById(elId);
  el.innerHTML = `<div class="msg ${ok ? 'ok' : 'err'}">${text}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 6000);
}

// ===================== Tabs =====================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'admin') loadAdminTable();
  });
});

// ===================== Dashboard =====================
function renderSchedule(date, data) {
  const container = document.getElementById('shift-columns');
  container.innerHTML = '';

  [1, 2, 3].forEach(shiftNo => {
    const col = document.createElement('div');
    col.className = 'shift-col';

    const head = document.createElement('div');
    head.className = 'shift-col-head';
    head.innerHTML = `<span>Shift ${shiftNo}</span><span class="jam">${SHIFT_LABEL[shiftNo]}</span>`;
    col.appendChild(head);

    const members = data.filter(e => Number(e.shift) === shiftNo);
    if (members.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Tidak ada data';
      col.appendChild(empty);
    }

    members.forEach(e => {
      const row = document.createElement('div');
      row.className = 'emp-row';
      const isOff = e.status === 'LIBUR';
      const picBadge = e.peranPIC ? `<span class="pic-badge">${e.peranPIC}</span>` : '';
      const picWarn = isOff && e.picGap
        ? `<div class="pengganti-note pic-gap">⚠ Peran "${e.peranPIC}" tidak tercover hari ini</div>`
        : '';
      row.innerHTML = `
        <div>
          <span class="emp-name">${e.nama}</span> ${picBadge}
          <span class="emp-role">${e.jabatan}${e.posisiTugas ? ' · ' + e.posisiTugas : ''}</span>
          ${isOff ? `<div class="pengganti-note">${e.pengganti ? '→ Pengganti: ' + e.pengganti : '⚠ Belum ada pengganti'}</div>` : ''}
          ${picWarn}
        </div>
        <span class="status-pill ${isOff ? 'libur' : 'kerja'}">${e.status}</span>
      `;
      col.appendChild(row);
    });

    container.appendChild(col);
  });
}

function loadSchedule() {
  const date = document.getElementById('dash-date').value || todayStr();
  document.getElementById('shift-columns').innerHTML = '<div class="empty-state">Memuat jadwal…</div>';
  apiGet('schedule', { date })
    .then(res => {
      if (!res.ok) { showMsg('dash-msg', res.error, false); return; }
      renderSchedule(date, res.data);
    })
    .catch(() => showMsg('dash-msg', 'Gagal memuat jadwal. Cek koneksi / konfigurasi API_URL.', false));
}

document.getElementById('dash-date').value = todayStr();
document.getElementById('dash-date').addEventListener('change', loadSchedule);
document.getElementById('today-label').textContent = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

// ===================== Daftar nama untuk datalist (swap) =====================
function loadEmployeeList() {
  apiGet('employees').then(res => {
    if (!res.ok) return;
    const dl = document.getElementById('employee-list');
    dl.innerHTML = res.data.map(e => `<option value="${e.Nama}">`).join('');
  });
}

// ===================== Swap =====================
document.getElementById('btn-swap').addEventListener('click', () => {
  const nama = document.getElementById('swap-nama').value.trim();
  const tanggal = document.getElementById('swap-tanggal').value;
  if (!nama || !tanggal) {
    showMsg('swap-msg', 'Isi nama dan tanggal terlebih dahulu.', false);
    return;
  }
  apiPost({ action: 'requestSwap', nama, tanggal })
    .then(res => {
      if (res.ok) {
        showMsg('swap-msg', `Berhasil. Pengganti untuk tanggal ${tanggal}: ${res.pengganti}`, true);
      } else {
        showMsg('swap-msg', res.error, false);
      }
    })
    .catch(() => showMsg('swap-msg', 'Gagal mengirim permintaan.', false));
});

// ===================== Login Admin (Google Identity Services) =====================
function handleCredentialResponse(response) {
  apiPost({ action: 'verifyAdmin', idToken: response.credential }).then(res => {
    if (res.ok && res.isAdmin) {
      adminToken = response.credential;
      adminInfo = res.admin;
      document.getElementById('admin-badge').textContent = adminInfo.nama;
      document.getElementById('admin-badge').style.display = 'inline-block';
      document.getElementById('btn-logout').hidden = false;
      document.getElementById('g_id_signin_container').style.display = 'none';
      document.getElementById('tab-admin').hidden = false;
    } else {
      alert('Akun ini tidak terdaftar sebagai admin.');
    }
  });
}

window.onload = () => {
  if (window.google && CONFIG.GOOGLE_CLIENT_ID.indexOf('GANTI_DENGAN') === -1) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });
    google.accounts.id.renderButton(
      document.getElementById('g_id_signin_container'),
      { theme: 'filled_black', size: 'medium', text: 'signin' }
    );
  }
  loadSchedule();
  loadEmployeeList();
};

document.getElementById('btn-logout').addEventListener('click', () => {
  adminToken = null;
  adminInfo = null;
  document.getElementById('admin-badge').style.display = 'none';
  document.getElementById('btn-logout').hidden = true;
  document.getElementById('g_id_signin_container').style.display = 'inline-block';
  document.getElementById('tab-admin').hidden = true;
  document.querySelector('.tab-btn[data-view="dashboard"]').click();
});

// ===================== Admin: kelola karyawan =====================
function loadAdminTable() {
  apiGet('employees').then(res => {
    const tbody = document.getElementById('admin-table-body');
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${res.error}</td></tr>`;
      return;
    }
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">Belum ada karyawan</td></tr>`;
      return;
    }
    tbody.innerHTML = res.data.map(e => `
      <tr>
        <td>${e.ID}</td>
        <td>${e.Nama}</td>
        <td>${e.Shift}</td>
        <td>${e.Jabatan}</td>
        <td>${e.PeranPIC || '—'}</td>
        <td>${e.BackupLibur || '—'}</td>
        <td>${e.OffsetLibur}</td>
        <td><button class="btn-danger" data-id="${e.ID}">Nonaktifkan</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Nonaktifkan karyawan ini?')) return;
        apiPost({ action: 'deleteEmployee', idToken: adminToken, id: btn.dataset.id })
          .then(res => {
            if (res.ok) { loadAdminTable(); loadSchedule(); loadEmployeeList(); }
            else showMsg('admin-msg', res.error, false);
          });
      });
    });
  });
}

document.getElementById('btn-add-employee').addEventListener('click', () => {
  if (!adminToken) { showMsg('admin-msg', 'Login admin terlebih dahulu.', false); return; }

  const employee = {
    nama: document.getElementById('f-nama').value.trim(),
    departemen: document.getElementById('f-departemen').value.trim(),
    jabatan: document.getElementById('f-jabatan').value.trim(),
    posisiTugas: document.getElementById('f-posisi').value.trim(),
    shift: document.getElementById('f-shift').value,
    offsetLibur: document.getElementById('f-offset').value,
    backupLibur: document.getElementById('f-backup').value.trim(),
    peranPIC: document.getElementById('f-peranpic').value.trim(),
  };
  if (!employee.nama || !employee.jabatan) {
    showMsg('admin-msg', 'Nama dan jabatan wajib diisi.', false);
    return;
  }

  apiPost({ action: 'addEmployee', idToken: adminToken, employee }).then(res => {
    if (res.ok) {
      showMsg('admin-msg', `Karyawan ditambahkan (ID: ${res.id}).`, true);
      ['f-nama', 'f-jabatan', 'f-posisi', 'f-backup', 'f-peranpic'].forEach(id => document.getElementById(id).value = '');
      loadAdminTable(); loadSchedule(); loadEmployeeList();
    } else {
      showMsg('admin-msg', res.error, false);
    }
  });
});
