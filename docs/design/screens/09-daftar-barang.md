# Layar 9 — Daftar Barang (Admin)

**Tugas utama:** melihat seluruh barang dan stoknya, lalu memilih yang perlu diubah.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Barang                │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │       + Tambah Barang          │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 🔍  Cari nama barang           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ [foto] Blus Linen              │  │
│  │        Rp 180.000 · Stok 4     │  │
│  │        Aktif             ›     │  │
│  ├────────────────────────────────┤  │
│  │ [foto] Rok Plisket             │  │
│  │        Rp 220.000 · Stok habis │  │
│  │        Aktif             ›     │  │
│  ├────────────────────────────────┤  │
│  │ [foto] Gamis Lama              │  │
│  │        Rp 300.000 · Stok 1     │  │
│  │        Diarsipkan        ›     │  │
│  └────────────────────────────────┘  │
│                                      │
│  Tampilkan barang diarsipkan  [  ]   │  ← kotak centang
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| **Tambah Barang** | → Form Barang (kosong) |
| Cari | Menyaring nama/kode |
| Baris | Thumbnail, nama, harga, stok, status ("Aktif"/"Diarsipkan"/"Stok habis") |
| Ketuk baris | → Form Barang (terisi) |
| Kotak arsip | Bila dicentang, barang diarsipkan ikut tampil |

## Aturan

- Stok ditampilkan apa adanya; **stok tidak diedit di daftar** (hindari salah ketuk).
- Barang yang sudah pernah dijual tidak punya tombol hapus di mana pun — hanya **Arsipkan**.
- Urutan: nama A–Z (pemilik mencari dengan mata).
- Bila katalog kosong: "Belum ada barang." + tombol Tambah Barang.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | tombol tambah, cari, daftar aktif |
| Kosong | kalimat kosong + tombol tambah |
| Stok habis | tulisan "Stok habis" menggantikan angka |
| Diarsipkan | hanya tampil bila kotak arsip dicentang |
