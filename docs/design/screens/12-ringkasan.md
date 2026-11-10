# Layar 12 — Ringkasan Hari Ini

**Tugas utama:** menjawab "hari ini sudah berapa?" dalam sekali lihat, tanpa grafik.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Ringkasan             │
├──────────────────────────────────────┤
│  Hari ini, 10 November 2026          │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Transaksi                     │  │
│  │         12                     │  │  ← 34 px
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Penjualan (setelah diskon)    │  │
│  │  Rp 3.240.000                  │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Uang yang diterima            │  │
│  │  Rp 3.050.000                  │  │
│  │  Termasuk DP pesanan           │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Sisa pembayaran pesanan       │  │
│  │  Rp 950.000                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ──────────────────────────────────  │
│  Transaksi hari ini               ›  │  ← → Riwayat
│  Status simpan & cadangan         ›  │  ← → layar 14
└──────────────────────────────────────┘
```

## Isi & perilaku

| Angka | Arti (harus presisi) |
| --- | --- |
| Transaksi | Jumlah transaksi hari ini yang **tidak dibatalkan** (barang siap jual + PO) |
| Penjualan (setelah diskon) | Σ total akhir transaksi hari ini; **nilai pesanan**, bukan uang masuk |
| Uang yang diterima | Σ pembayaran tercatat hari ini (termasuk DP) |
| Sisa pembayaran pesanan | Σ sisa tagihan seluruh PO yang belum lunas (tidak dibatasi hari ini) |

## Aturan

- **Nilai pesanan dan uang masuk dibedakan jelas** — dua kartu berbeda, dengan keterangan kecil.
- Tanpa grafik, tanpa persentase, tanpa perbandingan dengan hari lain.
- Tombol "Bagikan ringkasan" **tidak** ada di MVP.
- Angka dihitung ulang setiap layar dibuka.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Belum ada transaksi | Semua kartu menampilkan "Rp 0" dan "0", plus satu baris "Belum ada transaksi hari ini." |
