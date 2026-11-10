# Layar 2 — Pilih Barang

**Tugas utama:** menemukan barang yang dibeli, lalu memasukkannya ke keranjang.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Pilih Barang          │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ 🔍  Cari nama barang           │  │  ← kolom cari, 56 px
│  └────────────────────────────────┘  │
│                                      │
│  ┌───────────┐   ┌───────────┐       │
│  │  [foto]   │   │  [foto]   │       │  ← kartu grid, 2 kolom di HP
│  │ Blus Linen│   │ Rok Plisket│      │
│  │ Rp 180.000│   │ Rp 220.000│       │
│  │ Stok 4    │   │ Stok habis│       │
│  │  + Tambah │   │  + Tambah │       │
│  └───────────┘   └───────────┘       │
│                                      │
│  ┌───────────┐   ┌───────────┐       │
│  │  [foto]   │   │  [foto]   │       │
│  │ Gamis Abu │   │ Tanpa foto│       │
│  │ Rp 450.000│   │ Kain Batik│       │
│  │ Stok 1    │   │ Rp 150.000│       │
│  │  + Tambah │   │  + Tambah │       │
│  └───────────┘   └───────────┘       │
├──────────────────────────────────────┤
│  Keranjang: 2 barang · Rp 400.000    │  ← bilah bawah, hanya bila ada isi
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Kembali | Kembali ke Beranda; bila keranjang berisi, bertanya sekali |
| Kolom cari | Menyaring saat mengetik; huruf besar/kecil sama; tanpa tombol cari |
| Kartu | Foto (thumbnail), nama maks 2 baris, harga tebal, stok |
| Ketuk foto/nama | → Detail Barang (lihat 3 sisi) |
| **+ Tambah** | Masuk ke keranjang; tombol berubah sesaat menjadi "Ditambahkan ✓" |
| Stok habis | Tombol "+ Tambah" dinonaktifkan, label "Stok habis" |
| Tanpa foto | Kotak abu-abu dengan nama barang — **bukan** gambar contoh |
| Bilah keranjang | Muncul hanya bila ada isi; mengetuknya → Keranjang |

## Aturan

- Grid **2 kolom** di HP dan **3 kolom** di tablet ≥ 720 px.
- Hanya barang aktif (tidak diarsipkan) yang tampil.
- Urutan: barang yang paling sering terjual di perangkat ini, lalu paling baru ditambahkan.
  (Paling sering terjual ditaruh pertama karena di pameran kasir mengulang barang yang sama.)
- Bila hasil pencarian kosong: "Tidak ada barang dengan nama itu." + tombol "Hapus pencarian".
- Bila katalog kosong: "Belum ada barang. Tambahkan barang dulu." + tombol "Tambah Barang".

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | grid + kolom cari |
| Hasil kosong | kalimat kosong + tombol hapus pencarian |
| Katalog kosong | kalimat kosong + tombol tambah barang |
| Kartu barang habis | tombol dinonaktifkan, tulisan "Stok habis" |
