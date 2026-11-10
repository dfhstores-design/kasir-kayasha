# Layar 16 — Alokasi Barang ke Bazar

Spesifikasi latar: [`BAZAR-PARKIR-RESI.md`](../BAZAR-PARKIR-RESI.md) bagian 2.

**Tugas utama:** memindahkan sejumlah barang dari gudang ke meja bazar.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Atur Barang Bazar     │
├──────────────────────────────────────┤
│  Pameran Mall Kelapa Gading          │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🔍  Cari nama barang           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Blus Linen                     │  │
│  │ Gudang 40 · Bazar 12           │  │
│  │ Bawa ke bazar  [   10   ]      │  │
│  ├────────────────────────────────┤  │
│  │ Rok Plisket                    │  │
│  │ Gudang 3 · Bazar 0             │  │
│  │ Bawa ke bazar  [    3   ]      │  │
│  ├────────────────────────────────┤  │
│  │ Gamis Abu                      │  │
│  │ Gudang 0 · Bazar 4             │  │
│  │ Bawa ke bazar  [    0   ]      │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  18 barang · 240 pcs                 │
│  ┌────────────────────────────────┐  │
│  │          Simpan                │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Baris barang | Nama, **stok gudang**, **saldo bazar sekarang**, kolom "Bawa ke bazar" |
| Kolom "Bawa ke bazar" | Angka bulat ≥ 0. Maksimal = stok gudang |
| Simpan | Menambah saldo bazar dan mengurangi stok gudang sejumlah isian |

## Aturan

- Maksimal isian = stok gudang. Bila lebih: **"Gudang hanya 40."**; tombol simpan nonaktif.
- Mengosongkan isian = 0 (tidak mengubah apa pun).
- Angka yang disimpan dicatat sebagai **alokasi** (bukan mengubah angka diam-diam), sehingga
  saat Tutup Bazar sisa bisa dihitung.
- Menarik barang kembali dilakukan pada layar Tutup Bazar, bukan di sini.
- Setelah simpan: daftar ter-refresh, stok gudang dan saldo bazar berubah, pesan
  "Barang bazar disimpan."
- Barang berstatus **diarsipkan** tidak muncul di sini.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | daftar barang + kolom isian |
| Stok gudang 0 | kolom dinonaktifkan, "Gudang kosong" |
| Isian melebihi gudang | pesan merah marun di bawah kolom, simpan nonaktif |
| Semua isian 0 | tombol simpan tetap aktif tetapi menampilkan "Belum ada perubahan" |
