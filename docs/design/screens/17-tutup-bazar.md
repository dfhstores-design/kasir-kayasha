# Layar 17 — Tutup Bazar

Spesifikasi latar: [`BAZAR-PARKIR-RESI.md`](../BAZAR-PARKIR-RESI.md) bagian 2.

**Tugas utama:** menghitung sisa barang di meja bazar dan mengembalikannya ke gudang.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Tutup Bazar           │
├──────────────────────────────────────┤
│  Pameran Mall Kelapa Gading          │
│  15–20 Nov 2026                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Terjual   96 pcs · Rp 12.400.000│ │
│  │ Dibawa   240 pcs               │  │
│  │ Sisa     144 pcs               │  │
│  └────────────────────────────────┘  │
│                                      │
│  Sisa dibawa kembali ke gudang       │
│  ┌────────────────────────────────┐  │
│  │ Blus Linen                     │  │
│  │ Sisa bazar: 8                  │  │
│  │ Kembalikan ke gudang [   8  ]  │  │
│  ├────────────────────────────────┤  │
│  │ Rok Plisket                    │  │
│  │ Sisa bazar: 1                  │  │
│  │ Kembalikan ke gudang [   1  ]  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ⚠ Barang yang tidak dikembalikan    │
│    dianggap habis di bazar.          │
│                                      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │         Tutup Bazar            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Ringkasan | Terjual (pcs & rupiah), dibawa, sisa — dari catatan alokasi & penjualan |
| Kolom "Kembalikan" | Angka bulat 0 s/d sisa bazar. Bawaan = sisa bazar (dianggap semua kembali) |
| Tutup Bazar | Konfirmasi: "Tutup bazar ini? Setelah ditutup tidak bisa dibuka lagi." |

## Aturan

- Mengembalikan barang **menambah stok gudang** sejumlah isian.
- Sisa yang tidak dikembalikan **hilang dari saldo bazar** (dianggap terjual/hilang). Tidak
  ada angka negatif.
- Bazar yang masih memiliki **transaksi tertahan (parkir)** tidak bisa ditutup: pesan
  "Selesaikan atau hapus 1 transaksi tertahan dulu."
- Setelah tutup, bazar pindah ke daftar "Bazar yang sudah selesai" dan tidak bisa dibuka lagi.
- Ringkasan disimpan permanen, tidak dihitung ulang.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | ringkasan + kolom kembalikan |
| Tanpa penjualan | Terjual 0 pcs; sisa = dibawa |
| Ada parkir | tombol Tutup Bazar nonaktif + alasan |
| Belum ada barang dibawa | pesan "Bazar ini belum pernah dibawa barang." |
