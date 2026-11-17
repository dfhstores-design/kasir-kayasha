# Layar 1 — Beranda

**Tugas utama:** membuka jalan ke pekerjaan hari itu dengan satu ketukan.

```
┌──────────────────────────────────────┐
│  Kasir Kayesa                       │  ← judul aplikasi, 26 px
│  Kayesa Clothing                    │  ← nama butik dari Pengaturan, 16 px abu
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │         PENJUALAN              │  │  ← tombol utama, 96 px, terakota
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │  ← dua tombol besar, 88 px
│  │ PESANAN JAHIT│  │ MASUK ADMIN  │  │
│  └──────────────┘  └──────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  ● Tersimpan di perangkat            │  ← status simpan, 16 px
│    12 transaksi hari ini             │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Isi | Perilaku |
| --- | --- | --- |
| Judul | "Kasir Kayesa" | Tetap di semua layar beranda |
| Nama butik | dari Pengaturan | Mengikuti isian pemilik |
| **Penjualan** | tombol terbesar | → Pilih Barang (Alur 1) |
| **Pesanan Jahit** | tombol besar | → Daftar Pesanan Jahit |
| **Masuk Admin** | tombol besar | → Masuk Admin (minta PIN bila diatur) |
| **Barang** | tombol besar | → Daftar Barang (admin) |
| **Ringkasan** | tombol besar | → Ringkasan Hari Ini |
| **Pengaturan** | tombol besar | → Pengaturan (minta PIN bila diatur) |
| Status simpan | satu kalimat + jumlah transaksi hari ini | Mengetuk status → Status Simpan & Backup |

## Aturan

- Hanya **lima** tujuan. Tidak ada menu tambahan, tidak ada ikon di pojok kanan atas.
- Tombol "Penjualan" dan dua tombol di bawahnya dipisah jarak 16 px; seluruh tombol ≥ 88 px.
- Status simpan bukan tombol terpisah di tengah layar; cukup satu baris di bawah.
- Bila aplikasi pertama kali dibuka (belum ada pengaturan), tampilkan huruf besar dulu:
  panel **"Ayo isi nama butik"** dengan tombol "Isi Pengaturan". Setelah terisi, panel hilang selamanya.
- Bila belum ada barang sama sekali, di bawah tombol Penjualan ada satu baris:
  "Belum ada barang. Tambahkan barang dulu." dengan tautan teks "Tambah Barang".

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | seperti gambar |
| Belum ada pengaturan | panel "Ayo isi nama butik" di atas tombol |
| Belum ada barang | baris bantuan di bawah tombol Jual Barang |
| Offline | status "Tersimpan di perangkat · Menunggu internet"; semua tombol tetap aktif |

---

## Pembaruan Phase 1 lanjutan (bazar & parkir)

Panel tambahan di bawah judul butik:

| Keadaan | Tampilan |
| --- | --- |
| Ada bazar aktif | kartu: **Bazar aktif** · nama bazar · tanggal · `[Atur Barang]`. Mengetuk kartu → Bazar |
| Tidak ada bazar aktif | panel: **"Belum ada bazar aktif. Penjualan memakai stok gudang."** + tombol **Buka Bazar** |
| Ada transaksi tertahan | baris kecil di atas status simpan: **"2 transaksi tertahan"** → Keranjang |

Tombol tujuan **tidak** bertambah menjadi enam; bazar dan parkir masuk lewat panel, bukan tombol baru.

## Koreksi 17 Nov 2026 — bagian Mini ERP dikembalikan, admin-only

Koreksi Andri: bagian **"Mini ERP"** (5 tombol abu-abu `tile--segera` +
panel "sedang dalam pengembangan") seharusnya **hilang dari layar utama
saat link dibuka (peran kasir) dan dari kasir, tetapi muncul setelah login
admin**. P0+P1 kemarin sempat menghapusnya total — itu salah, dikembalikan
dengan syarat tampil **hanya bila `peran === "admin"`**. Kasir tidak melihat
bagian ini sama sekali. Biaya Bazar (tombol terpisah di bagian admin) tetap
ada — bukan bagian Mini ERP.

## Pembaruan 17 Nov 2026 — menu kasir P1-1 & Buka Bazar P1-3

- Beranda kasir menampilkan tepat: **Penjualan, Pesanan Jahit, Masuk Admin**.
  Label "Jual Barang" diganti menjadi "Penjualan" (alur sama: pilih barang stok).
  Tile "Kasir" dihapus dari Beranda untuk semua peran.
- Layar Kasir: tile "Penjualan" yang tadinya nonaktif ("Segera", kunci BU-24)
  diaktifkan dan mengarah ke alur jual barang yang sama; tile "Pesanan" diganti
  label menjadi "Pesanan Jahit". Dibuka atas keputusan Andri 17 Nov 2026 (P0+P1).
  Penjaga tetap: kasir hanya menjual bila ada bazar aktif.
- Kartu BAZAR AKTIF di Beranda (admin) menulis cara membuka bazar baru:
  tutup bazar ini dulu di layar Bazar (→ Tutup Bazar). Tombol "Buka Bazar"
  di layar Bazar tetap nonaktif selama ada bazar aktif, dengan petunjuk yang sama.

> **Alur terima DP/pelunasan — DIPERBAIKI 17 Nov 2026 (P0+P1):**
> setelah tile "Kasir" dihapus, layar Kasir memang tidak lagi bisa dicapai
> dari Beranda. Sebagai gantinya, Detail Pesanan Jahit kini punya tombol
> "Terima Pembayaran" (muncul bila masih ada sisa) yang membuka KasirDetail
> lewat layar baru "kasir-detail" di App.tsx; kembali dari sana ke Detail.
> Jadi terima DP/pelunasan tetap jalan tanpa tile "Kasir".

## Pembaruan 17 Nov 2026 — tombol "Pesanan" (PO barang) dihapus

Klarifikasi Andri: pesanan = barang custom = pesanan jahit. Tidak ada pesanan dari
barang stok. Tombol "Pesanan" yang membuka daftar PO barang (pilih item stok →
FormPesanan → simpanPO) adalah salah kaprah, jadi tile-nya dihapus dari Beranda.
Yang dipertahankan: "Penjualan" (penjualan langsung barang stok) dan "Pesanan Jahit"
(alur Tahap 1). Tile "Kasir" dihapus dari Beranda 17 Nov 2026 (P1-1) — lihat
peringatan alur terima pembayaran di atas. Kode layar Pesanan/FormPesanan/DetailPesanan dan
fungsi simpanPO masih ada di repo tapi tidak bisa dicapai dari Beranda — begitu
pula 3 PO CONTOH di seed demo. Perlu keputusan lanjutan apakah kode + seed PO
itu dihapus total.
