# Kasir Kayasha

Aplikasi kasir butik **offline-first untuk pameran**, dibuat untuk **Kayasha Clothing**.
Dipakai pemilik butik sendiri lewat HP atau tablet Android, dipasang sebagai PWA,
dan tetap bisa dipakai saat internet di lokasi pameran buruk atau tidak ada.

> Ringkasnya: pilih barang lewat foto → masukkan jumlah → simpan transaksi → buat resi PDF.
> Tanpa internet pun tetap jalan.

---

## Daftar isi

1. [Status proyek](#status-proyek)
2. [Untuk siapa aplikasi ini](#untuk-siapa-aplikasi-ini)
3. [Fitur yang direncanakan](#fitur-yang-direncanakan)
4. [Tumpukan teknologi](#tumpukan-teknologi)
5. [Struktur repositori](#struktur-repositori)
6. [Mulai menjalankan (lokal)](#mulai-menjalankan-lokal)
7. [Cloudflare: D1, R2, secret, dan Pages](#cloudflare-d1-r2-secret-dan-pages)
8. [Instal PWA di Android](#instal-pwa-di-android)
9. [Backup dan pemulihan](#backup-dan-pemulihan)
10. [Batasan printer thermal Bluetooth](#batasan-printer-thermal-bluetooth)
11. [Model data](#model-data)
12. [Aturan uang dan diskon](#aturan-uang-dan-diskon)
13. [Biaya dan kuota gratis](#biaya-dan-kuota-gratis)
14. [Keamanan dan privasi](#keamanan-dan-privasi)
15. [Cara kerja bertahap](#cara-kerja-bertahap)
16. [Panduan pemilik (ringkas)](#panduan-pemilik-ringkas)
17. [Kontak dan tautan](#kontak-dan-tautan)

---

## Status proyek

| Fase | Isi | Status |
| --- | --- | --- |
| Phase 0 | Audit repo, workspace lokal, brief proyek, rencana fase | ✅ Selesai — 10 Nov 2026 |
| Phase 1 | Alur & wireframe (5 alur, 17 layar) + keputusan bazar/parkir/ongkir/resi | ✅ Selesai — 10 Nov 2026 |
| Phase 2 | Fondasi Vite + React + TS, PWA offline, skema IndexedDB, 79 unit test | ✅ Selesai — 10 Nov 2026 |
| Phase 3 | Katalog, foto produk (progres wajib, aman >80 MB), penjualan langsung | ✅ Selesai — 10 Nov 2026 |
| Phase 3B | Bazar (buka/alokasi/tutup) + parkir transaksi maks 3 | ✅ Selesai — 10 Nov 2026 |
| Phase 4 | Pre-order, DP/pelunasan, status pesanan, ongkir menyusul, ringkasan | ⏳ Berikutnya |
| Phase 5 | Profil usaha, logo, rekening, resi PDF, berbagi | ⬜ Belum |
| Phase 6 | Sinkronisasi D1 + unggah foto R2 | ⬜ Belum |
| Phase 7 | QA, backup, deployment, panduan pemilik | ⬜ Belum |
| To be develop | Cetak printer thermal 58/80 mm (Web Bluetooth) | ⏸️ Ditunda |

**Status saat ini:** barang dapat ditambahkan dengan foto, dijual, dan tersimpan menjadi
transaksi nyata di perangkat. Aplikasi **terbukti tetap terbuka saat internet dimatikan**.
Bazar (stok terpisah dari gudang) dan parkir transaksi sudah ada. Resi PDF belum ada;
belum deploy; belum ada layanan berbayar.

Dokumentasi penting:

- [docs/PROJECT-BRIEF.md](docs/PROJECT-BRIEF.md) — ruang lingkup, keputusan, pertanyaan terbuka, rencana fase
- [docs/design/FLOW.md](docs/design/FLOW.md) — alur pengguna (jual, tambah barang, pesanan, pengaturan, pembatalan)
- [docs/design/UI-SPEC.md](docs/design/UI-SPEC.md) — **kontrak visual**: warna (kontras terukur), ukuran, tipografi, teks
- [docs/design/BAZAR-PARKIR-RESI.md](docs/design/BAZAR-PARKIR-RESI.md) — bazar & stok, parkir, ongkir 4 keadaan, resi
- [docs/design/screens/](docs/design/screens/01-beranda.md) — 17 layar MVP, satu berkas per layar
- [docs/project-history/](docs/project-history/README.md) — catatan serah-terima tiap fase (wajib dibaca agent berikutnya)

---

## Untuk siapa aplikasi ini

- **Pemakai utama:** pemilik butik, perempuan berusia di atas 62 tahun.
- **Prinsip:** kesederhanaan adalah syarat utama. Satu layar satu tugas, tombol besar berlabel
  jelas (target sentuh minimal ±48 px), teks besar dan berkontras kuat, kata sehari-hari dalam
  Bahasa Indonesia, tanpa animasi atau popup yang cepat hilang.
- **Skala:** satu butik, satu pemilik, satu perangkat kasir aktif. Bukan SaaS, bukan multi-cabang.
- **Bahasa & format:** Bahasa Indonesia, Rupiah (IDR), format angka Indonesia (`Rp 1.250.000`),
  zona waktu Asia/Jakarta.

---

## Fitur yang direncanakan

### Pengaturan usaha
Nama butik, kontak opsional, logo untuk resi, teks kaki resi, dan daftar rekening tujuan
(nama bank, nomor rekening, nama pemilik rekening, penanda rekening aktif) dengan pratinjau resi.

### Katalog barang
Tambah, ubah, arsipkan barang. Nama, harga jual, stok siap jual, dan **maksimal 3 foto**.
Kode barang dan catatan bersifat opsional. Barang yang sudah pernah dijual tidak dihapus —
diarsipkan agar riwayat transaksi tetap utuh. Foto dikompres di perangkat (±1600 px,
250–400 KB, WebP bila didukung, JPEG sebagai fallback).

### Penjualan barang siap jual
Pilih lewat grid foto atau pencarian → lihat detail (hingga 3 sudut) → tentukan jumlah →
tinjau keranjang → simpan transaksi → resi. Stok tidak boleh negatif. Ketukan berulang tidak
membuat transaksi ganda.

### Diskon (nominal Rupiah, bukan persen)
- **Diskon per item:** Rp per unit × kuantitas, per barang.
- **Diskon total:** satu nominal untuk seluruh transaksi, diterapkan setelah diskon item.

### Pre-order dan pembayaran
Nama pemesan, kontak WhatsApp/telepon opsional, catatan, perkiraan tanggal siap opsional.
Status pembayaran (**Belum dibayar / DP / Lunas**) terpisah dari status pesanan
(**Diproses / Siap diambil atau dikirim / Selesai / Dibatalkan**). Mendukung beberapa
pembayaran lanjutan. Pembatalan tidak menghapus riwayat pembayaran.

### Ongkos kirim
1. Ambil sendiri / tanpa pengiriman — ongkir Rp0.
2. Ongkir ditagihkan butik — masuk ke total tagihan butik.
3. Ongkir dibayar pemesan langsung ke kurir — **tidak** masuk tagihan butik.

### Resi, logo, dan berbagi
PDF dibuat di perangkat (bisa saat offline), dipratinjau, lalu dibagikan lewat menu berbagi
Android (misalnya ke WhatsApp) atau diunduh bila menu berbagi tidak tersedia.

### Ringkasan sederhana
Jumlah transaksi hari ini, nilai penjualan setelah diskon, uang yang benar-benar diterima,
sisa pembayaran PO, status sinkron dalam bahasa sehari-hari, tombol "coba lagi", dan ekspor
cadangan.

---

## Tumpukan teknologi

| Bagian | Pilihan |
| --- | --- |
| Bahasa & UI | TypeScript, React, Vite |
| PWA | service worker (app shell), manifest, dapat dipasang di Android |
| Penyimpanan lokal | IndexedDB (katalog, foto terkompresi, transaksi, pembayaran, antrean sync) |
| Hosting statis | Cloudflare Pages |
| API | Cloudflare Pages Functions (Workers) |
| Database cloud | Cloudflare D1 (SQLite), salinan/sinkronisasi |
| Foto produk | Cloudflare R2 |
| Repo & deploy | GitHub → Cloudflare Pages |

Dengan sengaja **tidak** dipakai: Supabase, Vercel, Google Apps Script, Firebase, analitik
pihak ketiga, integrasi pembayaran online, WhatsApp Business API.

---

## Struktur repositori

```
kasir-kayasha/
├─ README.md                     ← berkas ini
├─ LICENSE                       ← lisensi MIT
├─ .gitignore
├─ index.html                    ← entry aplikasi
├─ package.json                  ← skrip dev/build/lint/test
├─ vite.config.ts · vitest.config.ts · eslint.config.js
├─ tsconfig.json · tsconfig.app.json · tsconfig.node.json
├─ public/
│  ├─ manifest.webmanifest       ← PWA
│  ├─ sw.js                      ← service worker app-shell
│  └─ icons/                     ← 192 · 512 · maskable
├─ src/
│  ├─ main.tsx · App.tsx         ← bootstrap + navigasi
│  ├─ lib/                       ← fungsi MURNI (money, ongkir, sapaan, keranjang, stok) + tes
│  ├─ db/                        ← skema IndexedDB + repositori (+ tes)
│  ├─ pwa/register.ts            ← pendaftaran SW & penyimpanan permanen
│  ├─ screens/                   ← Beranda, Placeholder
│  └─ styles/                    ← tokens.css (warna/ukuran), base.css
├─ docs/
│  ├─ PROJECT-BRIEF.md           ← ruang lingkup, keputusan, rencana fase
│  ├─ design/                    ← alur, spesifikasi, 17 layar, wireframe
│  └─ project-history/           ← catatan serah-terima per fase (jangan ditimpa)
└─ (Phase 6 akan menambahkan: migrations/ D1, functions/ Pages Functions)
```

Wireframe Phase 1 tidak disimpan di repo; hasilnya berada di workspace lokal
`Kasir-Butik-Kayasha/artifacts/PHASE-01/wireframe.html` dan dapat dibuat ulang dengan:

```bash
node docs/design/tools/build-wireframe.mjs <path-keluaran.html>
```

Saat Phase 2 selesai, struktur yang ditargetkan:

```
├─ src/
│  ├─ screens/          ← layar: beranda, katalog, keranjang, PO, admin, pengaturan, ringkasan
│  ├─ db/               ← ✅ selesai: skema IndexedDB & repositori data
│  ├─ lib/              ← ✅ selesai: uang/diskon/ongkir/sapaan/stok (fungsi murni + tes)
│  └─ sync/             ← antrean & sinkronisasi idempoten (Phase 6)
├─ public/              ← ✅ selesai: manifest, ikon, service worker
├─ functions/api/       ← Pages Functions (endpoint pemilik) — Phase 6
└─ migrations/          ← migrasi D1 — Phase 6
```

---

## Mulai menjalankan (lokal)

> Sudah aktif sejak **Phase 2**. Perintah di bawah adalah yang benar-benar dipakai.

**Prasyarat**

- Node.js 20 atau lebih baru (dikembangkan pada Node 24)
- npm 10 atau lebih baru
- Git

**Langkah**

```bash
git clone https://github.com/dfhstores-design/kasir-kayasha.git
cd kasir-kayasha
npm install
npm run dev
```

Buka alamat yang dicetak di terminal (biasanya `http://localhost:5173`).

Untuk mencoba aplikasi dari HP di jaringan Wi-Fi yang sama:

```bash
npm run dev -- --host
```

Lalu buka `http://<IP-komputer>:5173` di HP. Aplikasi tidak bisa dipasang sebagai PWA lewat
HTTP biasa; untuk uji pemasangan gunakan HTTPS (lihat bagian [Cloudflare](#cloudflare-d1-r2-secret-dan-pages)).

**Menguji mode offline**

```bash
npm run build
npm run preview
```

Buka `http://localhost:4173`, muat ulang sekali agar service worker terpasang, lalu matikan
jaringan di DevTools (Network → Offline) dan muat ulang. Aplikasi harus tetap terbuka.
Service worker **tidak** aktif saat `npm run dev` — itu disengaja agar hot reload tidak rusak.

**Perintah**

| Perintah | Arti |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi ke `dist/` |
| `npm run preview` | Pratinjau hasil build (mengaktifkan service worker) |
| `npm run lint` | Pemeriksaan kode |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm test` | Unit test (165 tes per Phase 3B) |

---

## Cloudflare: D1, R2, secret, dan Pages

> Semua langkah di bawah **belum dijalankan**. Jangan mengaktifkan billing, membeli domain,
> atau menautkan kartu tanpa persetujuan pemilik.

### 1. Masuk ke Cloudflare

```bash
npx wrangler login
```

### 2. Buat database D1

```bash
npx wrangler d1 create kasir-kayasha
```

Salin `database_id` yang dicetak ke bagian `[[d1_databases]]` pada `wrangler.toml`.

### 3. Terapkan migrasi

```bash
# database lokal (untuk pengembangan)
npx wrangler d1 migrations apply kasir-kayasha --local

# database cloud
npx wrangler d1 migrations apply kasir-kayasha --remote
```

### 4. Buat bucket R2 untuk foto produk

```bash
npx wrangler r2 bucket create kasir-kayasha-photos
```

Binding R2 dideklarasikan di `wrangler.toml`:

```toml
[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "kasir-kayasha-photos"
```

> **Catatan biaya:** R2 diaktifkan sebagai *subscription* akun dan memakai alur checkout
> (<https://developers.cloudflare.com/r2/get-started/>). Pemakaian di dalam kuota gratis tetap
> Rp0, tetapi Cloudflare umumnya meminta metode pembayaran. Tanpa R2, foto produk tetap
> disimpan di perangkat (IndexedDB) dan aplikasi tetap berfungsi penuh secara offline.

### 5. Menyetel secret dengan aman

- Secret **tidak pernah** ditulis ke kode, repo, atau berkas yang di-commit.
- Lokal: simpan di `.dev.vars` (sudah masuk `.gitignore`).
- Produksi: gunakan `wrangler secret` atau menu **Settings → Variables** di dashboard Pages.

```bash
npx wrangler pages secret put OWNER_TOKEN --project-name kasir-kayasha
```

Endpoint pemilik wajib memeriksa token tersebut; **jangan** membuat endpoint data publik.

### 6. Deploy ke Cloudflare Pages

Cara A — dari dashboard (disarankan untuk pemilik):

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Pilih repositori `dfhstores-design/kasir-kayasha`
3. Build command: `npm run build` · Output directory: `dist`
4. Tambahkan binding D1 (`DB`) dan R2 (`PHOTOS`) di **Settings → Bindings**
5. Simpan. Setiap `git push` ke `main` membuat deploy baru (kuota gratis: 500 build/bulan).

Cara B — dari terminal:

```bash
npm run build
npx wrangler pages deploy dist --project-name kasir-kayasha
```

---

## Instal PWA di Android

1. Buka alamat aplikasi (harus **HTTPS**) di Chrome Android.
2. Ketuk menu titik tiga → **Tambahkan ke layar utama** / **Instal aplikasi**.
3. Buka dari ikon di layar utama. Aplikasi berjalan layar penuh seperti aplikasi biasa.
4. Biarkan aplikasi terbuka sekali saat online agar aset & katalog tersimpan.
   Setelah itu aplikasi tetap bisa dibuka tanpa internet.

---

## Backup dan pemulihan

**Ekspor (dari aplikasi, menu Ringkasan/Backup):**

- File JSON berisi katalog, transaksi, item, pembayaran, dan pengaturan.
- File CSV untuk membaca transaksi di aplikasi spreadsheet.

**Pemulihan dasar:**

1. Pastikan aplikasi versi yang sama atau lebih baru.
2. Buka menu Backup → **Pulihkan dari cadangan** → pilih file JSON.
3. Aplikasi menampilkan ringkasan isi cadangan sebelum menulis data; konfirmasi di akhir.
4. Data yang sudah ada tidak terhapus kecuali diminta dan dikonfirmasi.

**Selain aplikasi:**

- Repositori ini dan `docs/project-history/` adalah arsip dokumentasi.
- Salinan dokumentasi juga disimpan di Google Drive → `AI GPT/Kasir Kayasha/`.

---

## Batasan printer thermal Bluetooth

- Resi utama berbentuk **PDF** yang dibuat di perangkat dan dibagikan lewat menu berbagi Android.
- Cetak thermal Bluetooth hanya disediakan **jika merek dan model printer diketahui dan
  protokolnya kompatibel** dengan Web Bluetooth (umumnya BLE/GATT).
- Banyak printer thermal murah memakai Bluetooth Classic (SPP) yang **tidak** dapat diakses
  dari PWA. Untuk model seperti ini, gunakan PDF → cetak dari aplikasi lain atau fallback lain.
- **Tidak akan ada tombol printer palsu.** Jika model belum diketahui, fitur ini tidak ditampilkan
  dan batasan dicatat di catatan fase terkait.

---

## Model data

Nominal disimpan sebagai **integer Rupiah**. Semua tabel memakai **UUID** sebagai kunci utama,
serta `created_at` dan `updated_at`. Status sync dicatat di antrean lokal.

### Lokal (IndexedDB)

| Store | Isi |
| --- | --- |
| `settings` | Profil usaha, logo (blob), daftar rekening, teks kaki resi, PIN admin |
| `products` | Produk + status aktif/arsip + stok |
| `product_photos` | Foto terkompresi, urutan 1–3, tipe, ukuran |
| `transactions` | Nomor resi, waktu, jenis, status pesanan, pemesan, mode & nominal ongkir, subtotal, total diskon item, diskon total, total akhir, status pembayaran |
| `transaction_items` | Snapshot nama & harga, kuantitas, diskon per unit, total diskon item, subtotal bersih |
| `payments` | Transaksi, nominal, waktu, metode/catatan opsional |
| `outbox` | Antrean perubahan yang belum terkirim (ID unik agar retry idempoten) |

### Cloud (D1)

Tabel: `business_profile`, `bank_accounts`, `products`, `product_photos`, `transactions`,
`transaction_items`, `payments`. Setiap perubahan dikirim dengan ID yang sudah dibuat di perangkat,
sehingga pengiriman ulang **tidak** menggandakan baris.

### Keputusan

- Transaksi menyimpan **snapshot** nama, harga, diskon, rekening, dan logo yang dipakai saat itu,
  agar resi lama tetap akurat meskipun katalog atau pengaturan berubah kemudian.

---

## Aturan uang dan diskon

```
subtotal_awal     = Σ (harga_satuan × kuantitas)
diskon_item       = Σ (diskon_per_unit × kuantitas)
subtotal_setelah  = subtotal_awal − diskon_item
total_ditagihkan  = subtotal_awal − diskon_item − diskon_total + ongkir_ditagihkan_butik
sudah_dibayar     = Σ pembayaran
sisa_tagihan      = total_ditagihkan − sudah_dibayar
```

Batasan yang divalidasi:

- `diskon_per_unit ≤ harga_satuan`
- `diskon_total ≤ subtotal_setelah`
- Pembayaran tidak boleh melebihi `sisa_tagihan` kecuali lewat alur koreksi/refund yang tercatat
- Ongkir yang dibayar langsung ke kurir **tidak** masuk `total_ditagihkan`
- Total akhir tidak boleh negatif

Tidak ada diskon persentase di MVP.

---

## Biaya dan kuota gratis

Target biaya **Rp0**. Kuota gratis Cloudflare (dicek dari dokumentasi resmi, 10 November 2026):

| Layanan | Kuota gratis |
| --- | --- |
| Workers / Pages Functions | 100.000 request/hari, CPU 10 ms/request, 128 MB memori |
| D1 | 5 juta row read/hari, 100.000 row written/hari, 5 GB penyimpanan, maks. 10 database |
| R2 (Standard) | 10 GB-bulan, 1 juta Class A + 10 juta Class B per bulan, egress gratis |
| Pages | 500 build/bulan, 20.000 file, 25 MiB per file |

Perkiraan untuk satu butik (≈200 transaksi/hari pameran, ±1.200 row written) jauh di bawah batas.
Sumber: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) ·
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) ·
[R2 pricing](https://developers.cloudflare.com/r2/pricing/) ·
[Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

Yang **tidak boleh** dilakukan tanpa persetujuan pemilik: mengaktifkan billing, membeli domain,
menautkan kartu pembayaran.

---

## Keamanan dan privasi

- Tidak ada secret, token, atau kunci privat di repo, frontend, atau IndexedDB.
- `.dev.vars`, `.wrangler/`, dan berkas kredensial lain diabaikan Git.
- Data pembeli seminimal mungkin. Nama, nomor telepon, nomor rekening, isi transaksi, dan diskon
  **tidak** ditulis ke log teknis.
- Tidak ada analitik pihak ketiga.
- Endpoint pemilik dilindungi token; tidak ada endpoint data publik.
- HTTPS wajib (disediakan Cloudflare Pages), input divalidasi, query D1 terparameterisasi.
- Penghapusan transaksi/pembayaran permanen selalu meminta konfirmasi yang jelas.

---

## Cara kerja bertahap

Proyek ini dikerjakan satu fase per sesi agar dapat dilanjutkan agent lain kapan saja.

**Aturan untuk setiap agent:**

1. Baca `README.md` (berkas ini) dan catatan **terbaru** di `docs/project-history/`.
2. Baca [docs/PROJECT-BRIEF.md](docs/PROJECT-BRIEF.md).
3. Kerjakan **hanya** fase berikutnya yang belum selesai. Jangan mengulang atau menimpa pekerjaan lama.
4. Jalankan lint, type-check, test, dan build yang relevan. Jangan mengaku tes lulus bila tidak dijalankan.
5. Buat catatan historis baru `docs/project-history/PHASE-XX-YYYY-MM-DD-HHMM.md`
   (aturan lengkap di [docs/project-history/README.md](docs/project-history/README.md)).
6. Salin catatan itu ke Google Drive → `AI GPT/Kasir Kayasha/project-history/` sebagai berkas baru.
7. Laporkan: apa yang selesai, tes yang dijalankan, letak catatan, yang tertunda, dan fase berikutnya.
8. Berhenti dan tunggu instruksi. Jangan mulai fase berikutnya sebelum diminta.

---

## Panduan pemilik (ringkas)

> Ditulis untuk pemilik butik. Akan disempurnakan pada Phase 7.

1. **Pasang aplikasi** — buka tautan aplikasi di Chrome Android, ketuk menu → *Tambahkan ke layar utama*.
2. **Isi Pengaturan sekali saja** — nama butik, logo, rekening tujuan, teks penutup resi.
3. **Tambah barang** — menu **Barang** → **Tambah Barang** → isi nama, harga, stok → ambil foto
   (maksimal 3) → simpan.
4. **Jual** — menu **Transaksi** → ketuk foto barang → masukkan jumlah → **Keranjang** →
   **Simpan** → resi terbuka → **Bagikan**.
5. **Tanda internet** — kalimat kecil di layar: *Tersimpan di perangkat*, *Menunggu internet*,
   *Tersinkron*, atau *Belum tersinkron — coba lagi*. **Transaksi tetap aman** meskipun belum
   tersinkron.
6. **Pre-order** — menu **Pesanan** → **Pre-order baru** → isi nama pemesan, barang, DP →
   simpan. Pelunasan dicatat dari halaman detail pesanan.
7. **Akhir hari pameran** — menu **Ringkasan** → lihat jumlah transaksi, uang diterima, sisa PO →
   **Simpan cadangan**.

---

## Kontak dan tautan

- Repositori: <https://github.com/dfhstores-design/kasir-kayasha>
- Backup dokumentasi: Google Drive → `AI GPT/Kasir Kayasha`
- Lisensi: [MIT](LICENSE)
