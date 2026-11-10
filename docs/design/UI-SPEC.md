# Kasir Kayasha — Spesifikasi Layar & Aturan Visual (Phase 1)

Dokumen ini adalah kontrak desain untuk Phase 2 ke atas: **nama layar, isi, tata letak, teks, dan
aturan visual**. Implementasi harus mengikuti dokumen ini; bila perlu menyimpang, catat alasannya
di catatan historis fase terkait.

Daftar layar dan gambaran wireframe ada di:

- [`docs/design/screens/`](screens/01-beranda.md) — 14 gambaran layar (teks)
- `artifacts/PHASE-01/wireframe.html` — wireframe interaktif (buka di browser)
- `artifacts/PHASE-01/wireframe-*.png` — tangkapan layar 360×800 (HP) dan tablet

---

## 1. Prinsip

1. **Satu layar, satu tugas.** Bila satu layar punya dua tugas besar, pecah.
2. **Semua tombol penting punya tulisan.** Tidak ada ikon tanpa label untuk tindakan utama.
3. **Ukuran tidak kecil.** Target sentuh minimal 48 px, teks isi minimal 18 px.
4. **Tenang.** Tanpa animasi masuk, tanpa popup yang hilang sendiri, tanpa notifikasi bergerak.
5. **Bicara seperti orang.** "Barang", "Simpan", "Sisa tagihan" — bukan "SKU", "commit", "sync".
6. **Tidak menyalahkan pengguna.** Pesan kesalahan menyebut solusinya.

## 2. Skala & tata letak

| Hal | Nilai | Catatan |
| --- | --- | --- |
| Lebar acuan | 360 px (HP kecil) s.d. 1024 px (tablet) | Tata letak vertikal, satu kolom di HP |
| Lebar isi maksimum | 720 px, rata tengah | Agar tablet tidak melebar aneh |
| Padding tepi | 16 px HP, 24 px tablet | |
| Tinggi target sentuh | ≥ 48 px, tombol utama 60 px | |
| Jarak antar tanpa unsur | kelipatan 8 px | 8, 16, 24, 32 |
| Sudut kotak | 16 px | Tidak bulat penuh (menghindari terasa mainan) |
| Bayangan | 1 bayangan lembut saja, tanpa efek berlapis | |
| Angka uang | Rata kanan pada daftar, format `Rp 1.250.000` | |

## 3. Warna

| Nama | Kode | Dipakai untuk |
| --- | --- | --- |
| `--bg` | `#F7F4EE` | Latar (putih gading hangat, tidak menyilaukan) |
| `--surface` | `#FFFFFF` | Kartu & panel |
| `--ink` | `#1F2328` | Teks utama |
| `--ink-soft` | `#5A6068` | Teks pendamping |
| `--line` | `#DED8CE` | Garis pemisah dekoratif antar-isi (**bukan** batas kontrol) |
| `--field-line` | `#8A8378` | Batas kolom isian & tombol sekunder (batas kontrol wajib ≥ 3:1) |
| `--ph` | `#E9E4DA` | Kotak foto kosong / tanpa foto |
| `--ph-ink` | `#6F695E` | Teks di kotak foto kosong |
| `--primary` | `#8C3F2C` | Tombol utama & tautan (terakota tua) |
| `--primary-ink` | `#FFFFFF` | Teks di atas tombol utama |
| `--accent` | `#2F6F5E` | Tanda berhasil / titik status |
| `--warn-bg` | `#FBF0DC` | Panel peringatan ringan (antrean, sisa tagihan) |
| `--warn-ink` | `#7A4A00` | Teks di panel peringatan |
| `--danger` | `#962718` | Hanya untuk pembatalan/penghapusan |

### Kontras terukur (dihitung, bukan diperkirakan)

Dihitung dengan rumus WCAG 2.x (`contrast-check.py`, skill antislop-human). Nilai dicek ulang
bila warna diubah pada fase berikutnya.

| Pasangan | Rasio | Ambang | Hasil |
| --- | --- | --- | --- |
| `--ink` di `--bg` | 14.39:1 | 4.5 | ✅ |
| `--ink` di `--surface` | 15.80:1 | 4.5 | ✅ |
| `--ink-soft` di `--bg` | 5.78:1 | 4.5 | ✅ |
| putih di `--primary` | 7.34:1 | 4.5 | ✅ |
| `--primary` di `--bg` (tautan "Kembali") | 6.68:1 | 4.5 | ✅ |
| `--accent` di `--surface` | 5.91:1 | 4.5 | ✅ |
| `--warn-ink` di `--warn-bg` | 6.63:1 | 4.5 | ✅ |
| `--danger` di `--surface` | 8.08:1 | 4.5 | ✅ |
| `--field-line` di `--surface` (batas kontrol) | 3.75:1 | 3.0 | ✅ |
| `--field-line` di `--bg` (batas kontrol) | 3.42:1 | 3.0 | ✅ |
| `--ph-ink` di `--ph` (teks kotak foto) | 4.96:1 | 4.5 | ✅ |
| teks chip aktif `#1F5748` di `#E7F1EC` | 7.23:1 | 4.5 | ✅ |
| teks chip nonaktif `#5A6068` di `#EFECE6` | 5.38:1 | 4.5 | ✅ |

**Temuan & perubahan dari pemeriksaan:** `--line` (`#DED8CE`) hanya mencapai 1.42:1 — cukup untuk
garis pemisah dekoratif, tetapi **gagal** sebagai batas kolom isian/tombol (WCAG 1.4.11, wajib 3:1).
Karena itu ditambahkan `--field-line` `#8A8378` khusus batas kontrol.

Aturan: warna tidak pernah satu-satunya penanda. Status selalu disertai tulisan
(mis. "Lunas" tertulis, bukan hanya hijau).

## 4. Tipografi

| Peran | Ukuran | Berat |
| --- | --- | --- |
| Judul layar | 26 px | 700 |
| Judul bagian | 20 px | 700 |
| Teks isi | 18 px | 400 |
| Teks pendamping | 16 px | 400 |
| Angka total besar | 34 px | 700 |
| Tombol | 20 px | 700 |

- Font: `system-ui` (Roboto di Android) — tanpa unduhan font, terasa seperti aplikasi bawaan.
- Tinggi baris 1.45 untuk isi, 1.2 untuk judul.
- **Ukuran teks dapat diperbesar**: semua ukuran memakai `rem`, mengikuti pengaturan font HP.
  Tata letak harus tetap rapi pada 125% (uji di Phase 2).

## 5. Pola komponen

| Komponen | Aturan |
| --- | --- |
| Tombol utama | Penuh lebar, tinggi 60 px, warna `--primary`, di bawah layar (zona jempol) |
| Tombol sekunder | Penuh lebar, garis tepi, latar putih |
| Tombol teks | Untuk "Kembali", "Batal" — tetap ≥ 48 px |
| Kartu barang | Foto persegi, nama 2 baris maks, harga tebal, stok, tombol **+ Tambah** |
| Panel status | Muncul menggantikan konten (bukan toast), berisi judul, keterangan, satu tombol "Mengerti" |
| Kolom isian | Label **di atas** kolom, teks bantu di bawah, tinggi 56 px, tipe `number` untuk uang |
| Pesan kesalahan isian | Tepat di bawah kolom, dengan tulisan "Perbaiki: …" |
| Daftar riwayat | Baris tinggi ≥ 64 px: nomor, waktu, total, status; ketuk untuk detail |
| Navigasi bawah | Tidak ada di MVP — terlalu banyak tujuan sekaligus; gunakan tombol besar di beranda |

## 6. Teks (mikrokopi)

| Situasi | Teks yang dipakai |
| --- | --- |
| Tombol simpan transaksi | Simpan Transaksi |
| Berhasil menyimpan | Transaksi tersimpan. Nomor KYS-0012. |
| Stok habis | Stok habis |
| Stok kurang | Stok tersisa 1 |
| Batas diskon | Diskon tidak boleh lebih dari Rp 250.000 |
| Bayar lebih | Nominal melebihi sisa tagihan Rp 550.000 |
| Offline | Tersimpan di perangkat |
| Menunggu kirim | Menunggu internet |
| Selesai kirim | Tersinkron |
| Gagal kirim | Belum tersinkron — coba lagi |
| Konfirmasi batal transaksi | Batalkan transaksi KYS-0012? Stok akan kembali seperti semula. |
| Kosongkan keranjang | Keranjang belum ada barang. |

Larangan teks: "error", "failed", "invalid", "sync", "cache", "token", singkatan Inggris.

## 7. Aksesibilitas

- Semua tombol dapat dijangkau dengan Tab dan diaktifkan dengan Enter/Spasi.
- Fokus keyboard terlihat jelas (garis 3 px `--primary` dengan offset 2 px).
- Foto barang punya teks alternatif: nama + warna/ukuran bila ada di catatan.
- Urutan baca mengikuti urutan visual (atas ke bawah).
- Pesan "tersimpan" memakai `role="status"` (aria-live polite) sehingga dibacakan, tidak hanya terlihat.
- Tidak ada teks tersembunyi yang diwajibkan untuk memakai aplikasi.

## 7a. Uji teks diperbesar & keyboard layar

- Semua ukuran memakai `rem`; layout diuji pada zoom 200% di lebar 360 px — tidak boleh terpotong
  atau memaksa gulir horizontal, tetap satu kolom.
- Kolom isian di bagian bawah layar harus otomatis tergeser ke atas keyboard layar
  (sisakan padding bawah ±200 px saat kolom fokus).
- Tombol "Simpan Transaksi" berada di bawah (zona jempol) tetapi tidak pernah tertutup keyboard,
  karena tombol ini ditekan setelah isian ditutup.

## 8. Layar yang masuk MVP

| # | Layar | Berkas wireframe |
| --- | --- | --- |
| 1 | Beranda | [`screens/01-beranda.md`](screens/01-beranda.md) |
| 2 | Pilih Barang | [`screens/02-pilih-barang.md`](screens/02-pilih-barang.md) |
| 3 | Detail Barang | [`screens/03-detail-barang.md`](screens/03-detail-barang.md) |
| 4 | Keranjang | [`screens/04-keranjang.md`](screens/04-keranjang.md) |
| 5 | Transaksi Tersimpan | [`screens/05-transaksi-tersimpan.md`](screens/05-transaksi-tersimpan.md) |
| 6 | Resi / Pratinjau PDF | [`screens/06-resi.md`](screens/06-resi.md) |
| 7 | Pesanan (Pre-order) | [`screens/07-pesanan.md`](screens/07-pesanan.md) |
| 8 | Detail Pesanan & Pembayaran | [`screens/08-pesanan-detail.md`](screens/08-pesanan-detail.md) |
| 9 | Daftar Barang (Admin) | [`screens/09-daftar-barang.md`](screens/09-daftar-barang.md) |
| 10 | Form Barang | [`screens/10-form-barang.md`](screens/10-form-barang.md) |
| 11 | Pengaturan | [`screens/11-pengaturan.md`](screens/11-pengaturan.md) |
| 12 | Ringkasan Hari Ini | [`screens/12-ringkasan.md`](screens/12-ringkasan.md) |
| 13 | Riwayat Transaksi | [`screens/13-riwayat.md`](screens/13-riwayat.md) |
| 14 | Status Simpan & Backup | [`screens/14-status-simpan.md`](screens/14-status-simpan.md) |
| 15 | Bazar (buka, daftar, tutup) | [`screens/15-bazar.md`](screens/15-bazar.md) |
| 16 | Alokasi Barang ke Bazar | [`screens/16-alokasi-bazar.md`](screens/16-alokasi-bazar.md) |
| 17 | Tutup Bazar | [`screens/17-tutup-bazar.md`](screens/17-tutup-bazar.md) |

Layar **15–17** serta perubahan pada layar 1, 4, 5, 6, 9, 10, 11 berasal dari
[`BAZAR-PARKIR-RESI.md`](BAZAR-PARKIR-RESI.md) (Phase 1 lanjutan, 10 Nov 2026) dan mengikuti
keputusan pemilik: stok gudang sebagai acuan utama dengan alokasi per bazar, printer thermal
58/80 mm, parkir maksimal 3 transaksi bernama, jenis transaksi Tunai/Transfer/QRIS, dan status
Lunas/DP/Belum dibayar.

## 9. Yang sengaja TIDAK ada di MVP

- Menu samping (hamburger) — banyak tujuan tersembunyi membingungkan.
- Navigasi bawah berisi 5 ikon.
- Grafik penjualan, peringkat barang, laporan bulanan.
- Mode gelap (dapat ditambahkan nanti bila diminta; bukan prioritas).
- Cetak langsung ke printer pada Phase 2–5 (lihat batasan printer di `README.md`).
