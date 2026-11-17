# Spesifikasi Tahap 1 — Pesanan Jahit & Dokumen

**Untuk:** Andri (dasar penawaran ke Tante Shita)
**Tanggal:** 12 November 2026
**Status:** rancangan spesifikasi. **Belum ada kode yang diubah, belum ada harga disepakati.**

Dokumen ini adalah **dasar penawaran**, bukan kontrak. Yang disepakati harus ditulis ulang
dan diteken sebelum pengerjaan dimulai.

---

## 1. Tujuan Tahap 1

Tante bisa **menerima pesanan jahit, menagih DP & pelunasan, lalu mengirim bukti ke pembeli
dari iPhone — tanpa aplikasi lain dan tanpa perlu screenshot.**

Keberhasilan diukur dari satu hal: **Tante berhenti memakai screenshot.**

---

## 2. In scope — apa yang Tante dapat

### 2.1 Pesanan Jahit sebagai jenis transaksi baru

Jenis baru, terpisah dari penjualan barang stok dan pre-order yang sudah ada.

| Field | Wajib | Keterangan |
| --- | --- | --- |
| Nama pemesan | ya | contoh: Bu Rina |
| Nomor WA / telepon | tidak | untuk menghubungi |
| Keterangan pesanan | ya | contoh: Kebaya payet, model KC1 |
| Biaya jasa | ya | nominal Rupiah |
| Biaya bahan (opsional) | tidak | bila bahan dari butik |
| Diskon (nominal) | tidak | **tanpa diskon persen** |
| Perkiraan selesai | tidak | tanggal |
| Catatan | tidak | |
| DP diterima sekarang | tidak | 0 = belum dibayar |

**Aturan penting:** pesanan jahit **tidak mengurangi stok** apa pun. Ini jasa, bukan barang.
Pesanan jahit juga **tidak memakai** alokasi bazar.

### 2.2 Pembayaran bertahap

- DP saat pesanan dibuat, dan pelunasan berkali-kali bila perlu
- Setiap pembayaran tercatat: tanggal, nominal, metode (tunai/transfer/QRIS)
- Status otomatis: **Belum dibayar → DP → Lunas**
- Nominal melebihi sisa tagihan **ditolak** dengan pesan jelas

Fondasi ini **sudah ada dan teruji** — Tahap 1 hanya memakainya untuk jenis jahit.

### 2.3 Dokumen dua wajah (satu tombol)

Satu pesanan, satu nomor, satu tombol **Bagikan**. Judul dokumen menyesuaikan sendiri:

| Kondisi | Judul dokumen | Isi |
| --- | --- | --- |
| Masih ada sisa | **INVOICE** (nota pesanan) | total, DP, **sisa tagihan**, rekening |
| Sudah lunas | **RESI / BUKTI PEMBAYARAN** | total, riwayat bayar, tanpa sisa |

Tante tidak perlu memilih apa pun. Inilah bagian yang paling menolong Tante.

### 2.4 Kop dokumen mengikuti faktur lama Tante

| Bagian faktur lama | Status |
| --- | --- |
| Logo + nama **KAYESA** / KAYESA'S CLOTHING | dua-duanya sudah bisa diisi di Pengaturan |
| Alamat: Jl. Tarumanegara No. 41 (Sebelah Pempak Nyai), Ploso Ciptum 15419 | sudah bisa diisi (2 baris + kota) |
| WA 0812 1141 4017 dan 0821 1376 5892 | sudah bisa diisi (2 nomor) |
| **NO.** dan **TANGGAL** | sudah ada |
| **KEPADA YTH.** | sudah ada (nama pemesan) |
| BANYAKNYA · NAMA BARANG · HARGA · JUMLAH | sudah ada |
| **TOTAL RP.** | sudah ada |
| **REK BCA 676 017 885 (NARSHITA DEWI)** | sudah ada, tampil bila ada sisa |
| **Hormat Kami,** | **perlu ditambah** |
| Kotak **PERHATIAN!!** | **perlu ditambah** (teks bisa diubah Tante) |
| Teks penutup | sudah ada |

### 2.5 Keluaran PNG utama + PDF cadangan

- Tombol utama: **Bagikan Gambar** → share sheet iOS → WhatsApp
- Tombol kedua: **Simpan PDF** (untuk arsip & cetak rapi)
- Gambar dan PDF dibuat dari **satu sumber susunan yang sama**, jadi isinya identik
- Gambar juga bisa **disimpan ke aplikasi Foto**

### 2.6 Perbaikan khusus iPhone/iPad

- Pesan "disimpan di folder Unduhan" **dihapus** (iOS tidak punya folder itu)
- Tombol unduh yang tidak berfungsi di iOS **disembunyikan** di iOS
- Panduan langkah pasang di **iPhone/iPad** (Safari → Bagikan → Tambah ke Layar Utama)

### 2.7 Pengujian bersama Tante

- Uji di **iPhone Tante sendiri**, bukan hanya di perangkat Anda
- Skenario uji disiapkan: buat 1 pesanan jahit, terima DP, kirim gambar, lunasi, kirim resi

---

## 3. Out of scope — tegas TIDAK termasuk Tahap 1

Ditulis jelas supaya tidak jadi sumber selisih paham nanti.

| Tidak termasuk | Masuk tahap |
| --- | --- |
| Sinkronisasi antar-perangkat (iPhone ↔ iPad) | Tahap 2 |
| Role **owner**; hanya kasir & admin (PIN lokal) | Tahap 2 |
| Beberapa bazar aktif bersamaan | Tahap 2 |
| Stok multi-lokasi & transfer gudang → lokasi | Tahap 3 |
| Stok opname | Tahap 3 |
| Buku kas, uang usaha vs pribadi | Tahap 4 |
| HPP / batch produksi | Tahap 5 |
| CRM, data pelanggan, pengingat otomatis | Tahap 6 |
| Cetak printer thermal Bluetooth | belum dipastikan (model belum diketahui) |
| WhatsApp Business API / kirim otomatis | **tidak direncanakan** (berbayar) |
| Domain khusus | tidak termasuk |

**Catatan tentang foto produk:** penyimpanan foto lintas perangkat **belum ada solusinya
tanpa layanan berbayar**. Di Tahap 1 foto tetap di perangkat masing-masing. Ini dijelaskan
di bagian risiko.

---

## 4. Batas revisi

Agar Anda tidak menanggung revisi tanpa batas.

| Hal | Batas |
| --- | --- |
| Revisi selama pengerjaan | **2 putaran** revisi per fitur pada daftar Tahap 1 |
| Revisi setelah uji Tante | **1 putaran** penyempurnaan (wajar, tidak mengubah scope) |
| Perubahan tata letak dokumen | termasuk, selama tidak menambah field baru |
| Permintaan **field baru** di luar daftar 2.1 | dihitung pekerjaan tambahan |
| Permintaan **jenis transaksi baru** lain | dihitung pekerjaan tambahan |
| Ganti logo, alamat, nomor WA, rekening | **Tante isi sendiri**, bukan revisi |

Revisi "selera" yang berulang-ulang (mis. ganti warna 5 kali) di luar batas ini.

---

## 5. Pembagian kerja — Anda sebagai admin & pelatih

Ini bagian yang membuat Tahap 1 layak. Aplikasi tanpa data tidak berguna bagi Tante.

**Anda yang mengerjakan (termasuk dalam paket aplikasi + pendampingan awal):**
- Daftar model/barang awal yang akan dijual Tante
- Memasukkan foto produk (dari katalog/WhatsApp Tante)
- Mengisi kop faktur: logo, alamat, 2 nomor WA, rekening BCA
- Menyiapkan 3–5 produk contoh sebagai bahan latihan
- Pendampingan Tante: **3–4 kali pertemuan** hingga Tante terbiasa mengisi sendiri (disepakati dengan Tante)
- Pendampingan WhatsApp selama **masa uji** yang disepakati

**Tante yang mengerjakan (dibimbing):**
- Mencoba sendiri membuat pesanan jahit
- Mengirim gambar ke satu pelanggan sungguhan

**Ditawarkan TERPISAH (bukan bagian paket ini):**

- Peran **admin**: mengisi data produk satu per satu secara rutin — ditawarkan ketika Tante terlihat kewalahan
- **Digital marketing** (Sismed, materi promosi/video AI)

**Ditolak/di luar cakupan:**
- Memasukkan katalog lengkap ratusan foto tanpa batas
- Menjadi admin harian selamanya — Tahap 1 mengajarkan Tante mandiri

---

## 6. Cara pengujian & kriteria diterima

Tahap 1 **belum dianggap selesai** sebelum semua lulus di perangkat Tante.

| # | Uji | Kriteria lulus |
| --- | --- | --- |
| U1 | Buat pesanan jahit | Tersimpan, nomor muncul, stok **tidak berubah** |
| U2 | Pesanan tanpa DP | Dokumen berjudul **INVOICE**, sisa = total |
| U3 | Terima DP | Status **DP**, sisa benar, riwayat tercatat |
| U4 | Bagikan gambar | Masuk ke WhatsApp sebagai **gambar**, bukan file |
| U5 | Pelunasan penuh | Status **Lunas**, dokumen berubah jadi **RESI** |
| U6 | Kop dokumen | Logo, alamat, 2 WA, rekening, Hormat Kami tampil benar |
| U7 | Uji di iPhone Tante | Semua di atas berjalan tanpa error |
| U8 | Matikan internet | Pesanan tetap bisa dibuat (offline) |
| U9 | Tante sendiri | Tante bisa membuat 1 pesanan tanpa dibantu |

U9 adalah ujian sesungguhnya. Kalau Tante masih butuh Anda di setiap langkah, Tahap 1 gagal
walaupun semua fungsi teknis bekerja.

---

## 7. Risiko yang harus Anda sadari sebelum menyebut harga

| # | Risiko | Dampak | Sikap |
| --- | --- | --- | --- |
| R1 | ~~Belum pernah diuji di iOS~~ **SUDAH PASS (12 Nov 2026)** | Aplikasi sudah diuji di iPhone Tante dan berfungsi baik | Tetap uji ulang setelah fitur jahit & PNG ditambahkan |
| R2 | Foto tidak tersinkron antar-perangkat | Tante di iPad tidak lihat foto dari iPhone | Jelaskan di Tahap 1; solusi di Tahap 2 |
| R3 | Data masih lokal | Ganti/rusak HP = data hilang bila tanpa cadangan | Ajarkan cadangan berkala; ini sudah ada |
| R4 | Aplikasi nama lama "KAYESA" di URL | Tante melihat alamat berbeda dari nama butik | Diganti setelah DP |

---

## 8. Yang perlu diputuskan Tante sebelum mulai

1. Field pesanan jahit — setuju dengan daftar di 2.1, atau ada tambahan?
2. Biaya bahan naik sebagai baris terpisah, atau cukup satu "biaya jasa"?
3. Rekening tampil di **semua** dokumen (seperti faktur lama) atau hanya saat ada sisa?
4. Ejaan dokumen: **KAYESA** saja, atau **KAYESA'S CLOTHING**?
5. Kotak PERHATIAN dipertahankan?
6. Perkiraan selesai perlu dicetak di dokumen?

---

## 9. Yang belum saya isi

**Harga sudah diusulkan Andri (12 Nov 2026): Rp 7.000.000**, DP Rp 2.000.000,
pelunasan Rp 5.000.000 saat aplikasi siap dipakai (K-14, K-15 di `CATATAN-DISKUSI.md`).
Statusnya **usulan**, belum disepakati Tante — karena itu tidak ditulis sebagai angka final
di sini. Rincian angkanya ada di `PENAWARAN-TAHAP-1.md`.
