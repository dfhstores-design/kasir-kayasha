# Layar 3 — Detail Barang

**Tugas utama:** memastikan barang yang benar sebelum menambahkannya. Dipakai bila kasir ingin
melihat foto dari sisi lain (motif, bahan, label ukuran).

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Detail Barang         │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │          [foto besar]          │  │  ← foto utama, rasio 1:1
│  │                                │  │
│  └────────────────────────────────┘  │
│   ●   ○   ○                          │  ← titik penunjuk 1–3 foto
│                                      │
│  Blus Linen Lengan Panjang           │  ← nama, 20 px tebal
│  Rp 180.000                          │  ← harga, 26 px tebal
│  Stok 4                              │
│  Bahan linen, warna krem             │  ← catatan (bila ada)
│                                      │
│  Jumlah                              │
│  ┌────┐  ┌────────┐  ┌────┐          │
│  │ −  │  │   1    │  │ +  │          │  ← 56 px tiap tombol
│  └────┘  └────────┘  └────┘          │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │         Tambah ke Keranjang    │  │  ← tombol utama 60 px
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Foto besar | Mengetuk foto pindah ke foto berikutnya; bila hanya 1 foto, tidak ada titik |
| Titik | Menandai posisi foto; tidak untuk diketik, hanya penanda + aria |
| Jumlah − / + | Minimal 1, maksimal = stok. Tombol + dinonaktifkan bila sudah di batas |
| Pesan batas | "Stok tersisa 4." muncul di bawah baris jumlah |
| Tambah ke Keranjang | Kembali ke Pilih Barang dengan jumlah tersebut; tombol bar untuk barang itu jadi "Ditambahkan ✓" |

## Aturan

- Bila barang tanpa foto: kotak abu-abu berisi nama barang.
- Catatan dan kode barang hanya tampil bila diisi.
- Barang habis: tombol utama diganti panel "Stok habis. Tambah stok di menu Barang." tanpa tombol tambah.
- Tidak ada tombol "Edit" di sini; edit barang hanya lewat Barang (admin).

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | foto, nama, harga, stok, jumlah, tombol tambah |
| Satu foto | tanpa titik penunjuk |
| Tanpa foto | kotak abu-abu |
| Habis | panel "Stok habis", tombol tambah tidak ada |
