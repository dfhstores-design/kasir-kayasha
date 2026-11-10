# Kasir Kayasha — Ringkasan Proyek, Keputusan, dan Rencana Fase

Berkas ini adalah ringkasan tetap dari arah proyek. Dokumen ini bukan catatan historis;
catatan historis per fase ada di [`docs/project-history/`](project-history/README.md).

Sumber perintah utama (tidak diubah isinya) disimpan di folder kerja lokal:
`Kasir-Butik-Kayasha/Kasir_Butik_Pameran_—_Master_Prompt_untuk_AI_Agent.md`.

---

## 1. Identitas proyek

| Hal | Isi |
| --- | --- |
| Nama aplikasi | **Kasir Kayasha** |
| Pemilik usaha | Kayasha Clothing (butik) |
| Repositori | <https://github.com/dfhstores-design/kasir-kayasha> (publik) |
| Folder kerja lokal | `D:\Documents\AI-GPT\Kasir-Butik-Kayasha` |
| Backup online | Google Drive → `AI GPT/Kasir Kayasha` |
| Mulai proyek | 10 November 2026, waktu Asia/Jakarta |

## 2. Ruang lingkup (dari perintah utama)

- Aplikasi kasir butik **offline-first untuk pameran**, dipakai lewat HP/tablet Android sebagai PWA.
- **Satu butik, satu pemilik, satu perangkat kasir aktif.** Bukan SaaS, bukan multi-tenant, bukan multi-cabang.
- Pemakai utama: **pemilik butik perempuan berusia di atas 62 tahun**. Simplicity adalah syarat utama;
  rancangan harus tenang, jelas, dan tidak kekanak-kanakan.
- Bahasa Indonesia, Rupiah (IDR) integer, format angka Indonesia, zona waktu Asia/Jakarta.
- Biaya target **Rp0** selama pemakaian masih dalam kuota gratis Cloudflare.
- Alur kerja **bertahap**: satu fase per sesi, lalu catatan historis baru, lalu berhenti.

### Di luar cakupan (jangan ditambahkan)

Akun banyak pegawai, role bertingkat, multi-cabang, langganan, integrasi pembayaran online,
WhatsApp Business API, analitik pihak ketiga, e-commerce, diskon persentase, domain khusus,
Supabase/Vercel/Apps Script atau layanan pihak ketiga lain tanpa kebutuhan teknis nyata.

## 3. Arah teknis

| Bagian | Pilihan |
| --- | --- |
| Frontend | React + TypeScript + Vite, responsif, dapat dipasang sebagai PWA |
| Offline | Service worker (app shell) + IndexedDB untuk katalog, foto terkompresi, transaksi, pembayaran, diskon, antrean sync |
| Hosting/API | Cloudflare Pages + Pages Functions |
| Data cloud | Cloudflare D1 (salinan/sinkronisasi) + R2 (foto produk) |
| Repo & deploy | GitHub → Cloudflare Pages |
| Identitas | UUID dibuat di perangkat + operasi idempoten agar retry sync tidak menggandakan data |
| Keamanan | Tanpa secret di frontend/repo; endpoint pemilik dilindungi; tidak ada endpoint data publik |

### Aturan teknis yang tidak boleh dilanggar

1. Uang selalu **integer Rupiah**, tidak pernah floating point.
2. `localStorage` tidak dipakai untuk data transaksi utama.
3. Transaksi, item, pembayaran, diskon, dan pengurangan stok ditulis **sebelum** menunggu server.
4. Retry tidak boleh menggandakan transaksi, item, pembayaran, diskon, atau upload foto.
5. Snapshot nama/harga/diskon disimpan di transaksi agar perubahan katalog tidak mengubah riwayat.
6. Barang yang pernah dijual tidak dihapus permanen — diarsipkan.
7. Data pembeli seminimal mungkin; nama, nomor telepon, nomor rekening, isi transaksi tidak masuk log.

## 4. Layar dan fungsi MVP

1. **Pengaturan usaha** — nama butik, kontak, logo resi, daftar rekening tujuan (bank, nomor,
   nama pemilik, rekening aktif), teks kaki resi, pratinjau resi.
2. **Admin & katalog barang** — tambah/ubah/arsipkan, nama, harga, stok siap jual, maksimal 3 foto,
   kode & catatan opsional. Foto dikompres di perangkat (±1600 px, 250–400 KB, WebP lalu JPEG).
3. **Penjualan barang siap jual** — pilih lewat grid foto/pencarian → detail → jumlah → keranjang →
   simpan → resi. Stok tidak boleh negatif; transaksi ganda dicegah.
4. **Diskon Rupiah** — diskon per unit × kuantitas, lalu diskon total setelah diskon item.
   Tidak ada diskon persentase.
5. **Pre-order & pembayaran** — nama pemesan, kontak opsional, perkiraan tanggal siap; status
   pembayaran (Belum dibayar / DP / Lunas) terpisah dari status pesanan (Diproses / Siap / Selesai /
   Dibatalkan); beberapa pembayaran lanjutan; pembatalan tidak menghapus riwayat pembayaran.
6. **Ongkos kirim** — ambil sendiri (Rp0) / ditagihkan butik / dibayar pemesan langsung ke kurir.
7. **Resi PDF, logo, rekening, berbagi** — PDF dibuat di perangkat (bisa offline), pratinjau sebelum
   dibagikan, share sheet Android, fallback unduh. Thermal Bluetooth hanya bila model & protokol cocok.
8. **Ringkasan sederhana** — transaksi hari ini, nilai penjualan setelah diskon, uang diterima,
   sisa pembayaran PO, status sinkron berbahasa sehari-hari, ekspor cadangan.

### Rumus uang (satu sumber kebenaran untuk kode & tes)

```
subtotal_awal      = Σ (harga_satuan × kuantitas)
diskon_item        = Σ (diskon_per_unit × kuantitas)
subtotal_setelah   = subtotal_awal − diskon_item
diskon_total       ≤ subtotal_setelah
total_ditagihkan   = subtotal_awal − diskon_item − diskon_total + ongkir_ditagihkan_butik
sudah_dibayar      = Σ pembayaran yang tercatat
sisa_tagihan       = total_ditagihkan − sudah_dibayar
```

Aturan validasi: `diskon_per_unit ≤ harga_satuan`; `diskon_total ≤ subtotal_setelah`;
pembayaran tidak boleh melebihi `sisa_tagihan` kecuali lewat alur koreksi/refund yang tercatat;
ongkir yang dibayar langsung ke kurir **tidak** masuk `total_ditagihkan`.

## 5. Keputusan awal (Phase 0)

| # | Keputusan | Alasan |
| --- | --- | --- |
| D-01 | Nama aplikasi: **Kasir Kayasha** | Sesuai nama repo dan permintaan pemilik. Nama butik di resi tetap dapat diubah di Pengaturan. |
| D-02 | Folder kerja lokal: `D:\Documents\AI-GPT\Kasir-Butik-Kayasha` | Ditunjuk pemilik sebagai ruang artifact & history. |
| D-03 | Kode aplikasi di `Kasir-Butik-Kayasha/git/` (clone repo), artefak fase di `Kasir-Butik-Kayasha/artifacts/` | Satu workspace berisi kode, brief, catatan historis, artefak, dan salinan Drive sekaligus. |
| D-04 | Dokumentasi historis wajib di repo (`docs/project-history/`), disalin ke Drive | Aturan perintah utama. |
| D-05 | Belum ada deployment Cloudflare di Phase 0 | Persetujuan & kredensial cloud harus dipastikan dulu (lihat pertanyaan terbuka Q-02). |
| D-06 | R2 belum bisa diaktifkan tanpa menautkan kartu | Cloudflare mewajibkan checkout/subscription untuk R2 — lihat bagian 7. |
| D-07 | Sinkronisasi katalog dikerjakan pada Phase 6, bukan lebih awal | Ubah katalog offline di Phase 3 tetap berjalan lokal; tidak memblokir kasir pameran. |
| D-08 | Resi menyimpan salinan rekening & logo yang dipakai saat transaksi | Agar resi historis tetap akurat walau rekening/logo diubah kemudian. |

## 6. Batas layanan resmi (dicek 10 November 2026)

Sumber: dokumentasi resmi Cloudflare.

| Layanan | Kuota gratis | Sumber |
| --- | --- | --- |
| Workers (termasuk Pages Functions) | 100.000 request/hari, CPU 10 ms/request, 128 MB memori, 50 subrequest | <https://developers.cloudflare.com/workers/platform/limits/> |
| D1 | 5 juta row read/hari, 100.000 row written/hari, 5 GB total, maks. 10 database | <https://developers.cloudflare.com/d1/platform/pricing/> |
| R2 Standard | 10 GB-bulan, 1 juta Class A/bulan, 10 juta Class B/bulan, egress gratis | <https://developers.cloudflare.com/r2/pricing/> |
| Pages | 500 build/bulan, 20.000 file, 25 MiB per file; request Functions memakai kuota Workers | <https://developers.cloudflare.com/pages/platform/limits/> |

### Perkiraan pemakaian untuk satu butik

Asumsi: 1 hari pameran = ±200 transaksi × ±6 baris tulis = ±1.200 row written. Batas
100.000 row written/hari memberi ruang sangat lega. Foto: 1 produk × 3 foto × ±350 KB = ±1 MB,
10 GB R2 ≈ ±10.000 produk. Kesimpulan: pemakaian butik kecil jauh di bawah kuota gratis.

### Catatan penting: R2 dan kartu pembayaran

R2 adalah langganan (subscription) akun. Dokumentasi resmi menyebut langkah
"Complete the checkout flow to add an R2 subscription"
(<https://developers.cloudflare.com/r2/get-started/>), dan dokumentasi billing hanya menerima
metode pembayaran kartu/PayPal/Apple Pay/Google Pay dkk.
(<https://developers.cloudflare.com/billing/understand/faq/>). Artinya biaya tetap **Rp0** selama
usage dalam kuota gratis, tetapi R2 umumnya **tidak bisa diaktifkan tanpa menautkan kartu**.
Keputusan ada di tangan pemilik (lihat Q-02). Opsi cadangan tanpa kartu: simpan foto produk di
IndexedDB di perangkat, foto hanya dikirim ke cloud bila R2 diaktifkan kelak.

## 7. Pertanyaan terbuka

| # | Pertanyaan | Dampak pada fase |
| --- | --- | --- |
| Q-01 | Nama lengkap butik yang tercetak di resi (mis. "Kayasha Clothing"). | Phase 5 (resi) — bisa diisi nanti lewat Pengaturan. |
| Q-02 | Boleh menautkan kartu ke Cloudflare untuk mengaktifkan R2 (tetap Rp0 dalam kuota)? | Phase 2/6 — menentukan tempat penyimpanan foto. |
| Q-03 | Siapa yang masuk ke akun Cloudflare Pages? Hanya pemilik atau dibantu? | Phase 7 (deployment) — perlu akses token saat deploy. |
| Q-04 | Apakah pameran memerlukan ongkir (pengiriman) atau hanya ambil sendiri? | Phase 4 — memengaruhi desain layar. |
| Q-05 | Metode pembayaran yang sering dipakai pembeli: cash, transfer, QR statis? | Phase 5/6 — memengaruhi label di pembayaran. |
| Q-06 | Printer thermal yang mungkin dipakai: merek & model. | Phase 5 — tanpa model, hanya PDF yang dijanjikan. |
| Q-07 | Logo butik (berkas gambar) untuk resi. | Phase 5 — tanpa logo, resi memakai nama butik. |
| Q-08 | PIN/sandi admin sederhana untuk masuk menu Pengaturan & Admin? | Phase 2 — melindungi data di perangkat. |
| Q-09 | Nomor rekening tujuan DP/pelunasan (diisi pemilik di aplikasi, tidak ditulis di repo). | Phase 5 — cukup dimasukkan lewat Pengaturan. |
| Q-10 | Kapan pameran berikutnya? (Deadline realistis versi uji coba.) | Mengatur urutan prioritas fase. |

Pertanyaan di atas tidak menghalangi Phase 1 dan Phase 2.

## 8. Rencana fase

| Fase | Isi | Status |
| --- | --- | --- |
| Phase 0 | Baca repo & perintah utama, tetapkan workspace lokal + repo + Drive, catat ruang lingkup, keputusan, pertanyaan terbuka, rencana fase, kuota resmi | **Selesai — 10 Nov 2026** |
| Phase 1 | Alur sederhana & wireframe layar utama (5 alur, 14 layar, spesifikasi visual) | **Selesai — 10 Nov 2026** |
| Phase 2 | Fondasi proyek (Vite + React + TS), PWA, skema IndexedDB, persiapan Cloudflare/GitHub | **Selesai — 10 Nov 2026** |
| Phase 3 | Katalog + foto + penjualan langsung (lokal/offline) | **Selesai — 10 Nov 2026** |
| Phase 3B | Bazar (alokasi & tutup), parkir transaksi (maks 3 bernama) | **Selesai — 10 Nov 2026** |
| **Phase 3C** | **Role admin/kasir (PIN), biaya bazar, hitung ulang sisa, ringkasan laba** | **Selesai — 10 Nov 2026** |
| Phase 4 | Pre-order, DP/pelunasan, status pesanan, ongkir menyusul | **Selesai — 10 Nov 2026** |
| Phase 5 | Profil usaha, logo, rekening, resi PDF, berbagi | **Selesai — 10 Nov 2026** |
| Phase 6 | Sinkronisasi D1 + unggah foto R2 | Berikutnya |
| Phase 7 | QA, backup, deployment, panduan pemilik | Belum |
| **To be develop** | Cetak **printer thermal 58/80 mm** via Web Bluetooth — belum masuk MVP | Ditunda |

### Hasil Phase 1 (titik lanjut)

- `docs/design/FLOW.md` — lima alur pengguna dengan keputusan tiap langkah.
- `docs/design/UI-SPEC.md` — **kontrak visual**: palet (sudah dihitung kontrasnya), ukuran,
  tipografi, komponen, mikrokopi, aksesibilitas.
- `docs/design/screens/01-…14-….md` — 14 layar: isi, perilaku, aturan, keadaan.
- `artifacts/PHASE-01/wireframe.html` — wireframe interaktif untuk dilihat pemilik.

Implementasi Phase 2 ke atas **mengikuti** dokumen di atas.

### Tambahan Phase 1 lanjutan (10 Nov 2026, keputusan pemilik)

`docs/design/BAZAR-PARKIR-RESI.md` menambahkan, dan mengalahkan isi sebelumnya untuk topik ini:

| # | Keputusan pemilik |
| --- | --- |
| B-01 | **Stok gudang acuan utama; tiap bazar menetapkan alokasi.** Gudang berkurang saat dialokasikan, penjualan mengurangi saldo bazar |
| B-02 | Printer **thermal 58/80 mm Bluetooth**; PDF sebagai cadangan |
| B-03 | Resi "DAPUR OPA" = **contoh format** saja; data diganti Kayasha Clothing |
| B-04 | **Seluruh larangan perintah utama tetap berlaku** (tanpa diskon persen, tanpa hapus permanen, satu perangkat) |
| B-05 | **Parkir maksimal 3**, tiap parkir **bernama pembeli** |
| B-06 | Jenis transaksi: **Tunai / Transfer Bank / QRIS** |
| B-07 | Status transaksi: **Lunas / DP / Belum dibayar** — berlaku juga untuk penjualan biasa |
| B-08 | **Bazar** dengan stok berbeda dari stok gudang |
| B-09 | Sapaan resi **otomatis mengikuti jam** (bukan pilihan manual) |
| B-10 | **Ongkir selalu tampil** di resi, termasuk Rp0; ongkir **boleh dihitung kemudian** (`Belum ditentukan`) |

### Revisi perintah utama — Phase 3C (10 Nov 2026)

Pemilik menyetujui revisi: **dua peran (admin & kasir)** dengan PIN lokal, serta **biaya bazar**
dan **ringkasan laba**. Ini mengganti larangan "akun banyak pegawai / role bertingkat" pada
perintah utama. Larangan lain (diskon persen, hapus permanen, billing, analitik) **tetap**.
Rincian: [`docs/design/ROLE-BIAYA-RINGKASAN.md`](design/ROLE-BIAYA-RINGKASAN.md).

### Perubahan keputusan lama

| Keputusan | Sebelumnya | Sekarang | Alasan |
| --- | --- | --- | --- |
| B-02 | Printer thermal 58/80 mm sebagai fitur | **PDF dulu; cetak thermal masuk *to be develop*** | Pemilik memutuskan printer dikembangkan kemudian |
| Resi | Thermal 58 mm format utama | **PDF A5 format utama**; susunan baris tetap sama | Sama |
| Pengecualian total terkunci | Tidak ada | **Satu pengecualian**: tambah ongkir setelah pembayaran pertama boleh mengubah total, dicatat sebagai riwayat | B-10: ongkir bisa dihitung kemudian setelah bazar |

Layar bertambah: **15 Bazar**, **16 Alokasi Bazar**, **17 Tutup Bazar**.
Phase baru: **3B** (bazar + parkir).
Phase 5 kini hanya PDF; **Phase 5B (to be develop)** untuk printer thermal.

## 9. Kriteria penerimaan MVP (13 butir)

Ringkasan dari perintah utama; detail penuh ada di berkas perintah:

1. Profil butik, logo, rekening, preview resi terbaca.
2. PDF resi memuat logo/nama, rekening, DP/pelunasan, sudah dibayar, sisa, diskon item & total.
3. Maksimal 3 foto terkompresi per barang; kasir mengenali barang lewat grid & multi-sudut.
4. Transaksi langsung mengurangi stok; PO tidak mengurangi stok.
5. Diskon per unit × kuantitas benar; diskon total setelah diskon item; validasi mencegah negatif.
6. DP & pelunasan dihitung dari total setelah diskon; status bayar dan status pesanan terpisah.
7. Ongkir ke kurir tidak masuk tagihan butik; ongkir butik masuk total.
8. Offline: katalog, transaksi, pembayaran, PDF tetap jalan.
9. Sync ulang tidak menggandakan data; antrean lokal utuh saat server gagal.
10. Snapshot transaksi lama tidak berubah saat katalog diedit.
11. Share sheet Android dengan fallback unduh PDF; fitur printer tidak diklaim tanpa uji.
12. UI mudah di HP/tablet, teks terbaca, tombol berlabel.
13. Setiap fase meninggalkan catatan historis baru yang cukup untuk agent lain.

## 10. Cara agent berikutnya melanjutkan

1. Baca `README.md` di root repo.
2. Baca catatan historis **terbaru** di `docs/project-history/`.
3. Baca berkas ini.
4. Kerjakan **hanya** fase berikutnya yang belum selesai, lalu buat catatan historis baru
   mengikuti aturan di `docs/project-history/README.md`, salin ke Google Drive, dan berhenti.
