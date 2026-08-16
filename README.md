# Manpower 3 Shift — Dashboard Jadwal & Manajemen Karyawan

Website jadwal 3 shift dengan rotasi libur otomatis 6:1, database Google Sheet,
gratis penuh (GitHub Pages + Google Apps Script + Google Sheets).

## Arsitektur singkat

```
GitHub Pages (frontend statis)  →  Google Apps Script Web App (backend)  →  Google Sheet (database)
```

Frontend **tidak pernah** menyentuh Google Sheet secara langsung. Semua baca/tulis
lewat Apps Script, supaya tidak ada kredensial yang bocor di browser, dan supaya
logika rotasi 6:1 + pencarian pengganti otomatis tidak bisa "dilewati" dari luar.

Ada 68 karyawan dari file yang kamu unggah (Shift 1: 16 orang, Shift 2 & 3: masing-masing 26 orang),
sudah dipetakan ke template Sheet dengan offset libur yang disebar merata supaya
satu shift tidak kehilangan banyak orang di hari yang sama.

---

## Langkah 1 — Siapkan Google Sheet

1. Buka [sheets.google.com](https://sheets.google.com), buat spreadsheet baru, beri nama misalnya **Manpower 3 Shift DB**.
2. Import data awal: **File → Import → Upload**, pilih file `google-sheet/template.xlsx` dari folder ini.
   Saat diminta, pilih **"Insert new sheet(s)"** supaya keempat sheet (Karyawan, SwapLog, AdminWhitelist, Pengaturan) masuk semua.
3. Buka sheet **AdminWhitelist**, hapus baris contoh, isi dengan email Gmail setiap admin yang boleh login (satu email per baris).
4. Buka sheet **Pengaturan**, baris `TanggalReferensi` sudah diisi `2025-01-06` — biarkan saja, ini acuan perhitungan siklus 6:1 dan sebaiknya tidak diubah setelah sistem berjalan.

## Langkah 2 — Deploy backend (Apps Script)

1. Di spreadsheet tadi: **Extensions → Apps Script**.
2. Hapus isi `Code.gs` bawaan, tempel isi file `apps-script/Code.gs` dari folder ini.
3. **Belum** diisi `GOOGLE_CLIENT_ID` — lakukan Langkah 3 dulu, lalu kembali ke sini untuk mengisinya.
4. Klik **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Klik **Deploy**, salin URL yang muncul (`https://script.google.com/macros/s/xxxxx/exec`) — ini `API_URL`.

https://script.google.com/macros/s/AKfycbyfmQEb2S--QgY9s1FTnRgEoZ8fOLhh5BkZfJHvVN9Xq5BBZ3Ta10oFvdmdkTxCmrQoeg/exec

6. Setiap kali kamu mengubah `Code.gs` setelahnya, harus **Deploy → Manage deployments → Edit → New version** agar perubahan aktif.

## Langkah 3 — Buat Google OAuth Client ID (untuk login admin)

Ini dipakai supaya website bisa mengenali "siapa yang login dengan Google", lalu
backend mengecek apakah emailnya ada di sheet AdminWhitelist.

1. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project baru (bebas nama).
2. **APIs & Services → OAuth consent screen** → pilih **External** → isi nama app & email, simpan (status testing tidak masalah, atau publish kalau mau).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - **Authorized JavaScript origins**: isi URL GitHub Pages kamu, contoh `https://namamu.github.io`
4. Salin **Client ID** yang dihasilkan (`xxxx.apps.googleusercontent.com`).

781818100904-11s9663nr39psh8c0eqnf7uh3pq2vegc.apps.googleusercontent.com

5. Kembali ke Apps Script (`Code.gs`), isi `GOOGLE_CLIENT_ID` dengan nilai ini, lalu **Deploy → Manage deployments → Edit → New version**.

## Langkah 4 — Isi konfigurasi frontend

Buka `frontend/config.js`, isi dua nilai:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/xxxxx/exec",       // dari Langkah 2
  GOOGLE_CLIENT_ID: "xxxx.apps.googleusercontent.com",             // dari Langkah 3
};
```

## Langkah 5 — Publish ke GitHub Pages

1. Buat repository baru di GitHub (bisa public, gratis).
2. Upload seluruh isi folder `frontend/` (index.html, style.css, app.js, config.js) ke root repository.
3. **Settings → Pages** → Source: pilih branch `main`, folder `/ (root)` → Save.
4. Tunggu 1–2 menit, website akan aktif di `https://namamu.github.io/nama-repo/`.
5. Kalau kamu ganti URL GitHub Pages, jangan lupa update **Authorized JavaScript origins** di Langkah 3 poin 3.

---

## Cara kerja rotasi 6:1

Setiap karyawan punya `OffsetLibur` (0–6) di sheet Karyawan. Untuk tanggal mana pun:

```
selisihHari = tanggal − TanggalReferensi
cycle = (selisihHari + OffsetLibur) mod 7
cycle == 6  →  karyawan itu LIBUR hari itu
```

Karena offset tiap orang disebar 0,1,2,...,6 secara bergiliran per shift saat data
diimpor, di hari mana pun hanya sekitar 1 dari 7 orang per shift yang libur —
shift tidak pernah kosong drastis.

## Cara kerja pengganti otomatis

Saat seseorang libur (baik dari dashboard maupun lewat "Ajukan Tukar Libur"):
1. Sistem cek `BackupLibur` orang itu — kalau backup itu sendiri sedang tidak libur, dia jadi pengganti.
2. Kalau backup resminya juga sedang libur, sistem cari rekan lain di **shift & jabatan yang sama** yang sedang masuk kerja, sebagai fallback.
3. Kalau tetap tidak ada, dashboard menampilkan **⚠ Belum ada pengganti** — ini sinyal untuk admin turun tangan manual.

## Mengubah/menambah/menghapus karyawan

Semua lewat tab **Kelola Karyawan** setelah login admin — jangan edit sheet
`Karyawan` secara manual kalau bisa dihindari, supaya `ID` dan histori tetap konsisten.
"Hapus" di aplikasi ini sebenarnya soft-delete (Status → Nonaktif), supaya jadwal
lama yang sudah tercatat tidak jadi rusak referensinya.

## Batasan yang perlu kamu tahu (paket gratis)

- Apps Script Web App: kuota ~20.000 request/hari, tiap eksekusi maks 6 menit — jauh lebih dari cukup untuk 68 karyawan.
- Tidak ada real-time sync antar browser; dashboard perlu di-refresh (ganti tanggal atau reload) untuk lihat perubahan terbaru.
- GitHub Pages tidak punya server-side rendering — semua logic tampilan jalan di browser pengguna, tapi data sensitif (siapa admin, hak tulis) tetap aman karena diverifikasi di Apps Script, bukan di browser.
