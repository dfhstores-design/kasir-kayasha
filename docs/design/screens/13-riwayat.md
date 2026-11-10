# Layar 13 — Riwayat Transaksi

**Tugas utama:** mencari transaksi lama saat pembeli kembali, dan membukanya kembali.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Transaksi             │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ 🔍  Cari nomor atau nama barang│  │
│  └────────────────────────────────┘  │
│  [ Hari ini ] [ 7 hari ] [ Semua ]   │  ← pilihan rentang
│                                      │
│  10 November 2026                    │
│  ┌────────────────────────────────┐  │
│  │ KYS-0012   14:20               │  │
│  │ Tunai · Rp 560.000             │  │
│  │ [Lunas]                        │  │
│  ├────────────────────────────────┤  │
│  │ KYS-0011   13:05               │  │
│  │ Tunai · Rp 180.000             │  │
│  │ [Lunas]                        │  │
│  ├────────────────────────────────┤  │
│  │ KYS-0010   11:40               │  │
│  │ Rp 0 · dibatalkan              │  │
│  │ [Dibatalkan]                   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Cari | Nomor transaksi atau nama barang di dalam transaksi |
| Rentang | Tiga tombol pilihan besar (bukan dropdown) |
| Baris | Nomor, jam, metode bayar, total, status |
| Ketuk | → Detail transaksi: daftar barang, diskon, pembayaran, tombol **Lihat Resi** dan **Batalkan Transaksi** |
| Dibatalkan | Nomor dicoret, tulisan "Dibatalkan" — tetap tampil |

## Aturan

- **Tidak ada tombol hapus** untuk transaksi. Hanya pembatalan (dengan konfirmasi).
- Transaksi yang dibatalkan tetap bisa dibuat ulang resinya dengan label "DIBATALKAN".
- Daftar dimuat bertahap (50 per gulir) agar ringan di HP lama.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | cari, rentang, daftar per tanggal |
| Kosong | "Belum ada transaksi pada rentang ini." |
| Transaksi dibatalkan | baris dicoret + label |
