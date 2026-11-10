# Layar 7 — Pesanan (Daftar Pre-order)

**Tugas utama:** melihat pesanan yang belum selesai dan menemukan yang perlu ditindak.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Pesanan               │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │       + Pesanan Baru           │  │  ← tombol besar di atas
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 🔍  Cari nama pemesan          │  │
│  └────────────────────────────────┘  │
│                                      │
│  Siap diambil atau dikirim (1)       │  ← kelompok bisa dilipat
│  ┌────────────────────────────────┐  │
│  │ KYS-PO-0003   Ibu Sari         │  │
│  │ 10 Nov · Sisa Rp 550.000       │  │
│  │ [Siap]                         │  │  ← status
│  └────────────────────────────────┘  │
│                                      │
│  Diproses (2)                        │
│  ┌────────────────────────────────┐  │
│  │ KYS-PO-0002   Ibu Dewi         │  │
│  │ 9 Nov · Sisa Rp 200.000        │  │
│  │ [Diproses] [DP]                │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ KYS-PO-0001   Bu Rina          │  │
│  │ 8 Nov · Lunas, menunggu diambil│  │
│  │ [Diproses] [Lunas]             │  │
│  └────────────────────────────────┘  │
│                                      │
│  Selesai (12)                     ▾  │  ← dilipat
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| **Pesanan Baru** | → Pilih Barang → Form Pesanan |
| Cari | Menyaring berdasarkan nama pemesan atau nomor pesanan |
| Kelompok | Urutan tetap: **Siap diambil/dikirim → Diproses → Selesai → Dibatalkan** |
| Kelompok Selesai/Dibatalkan | Tertutup secara default (supaya daftar pendek), bisa dibuka |
| Baris pesanan | Nomor, nama pemesan, tanggal, **sisa tagihan**, label status |
| Ketuk baris | → Detail Pesanan |

## Aturan

- Status pemenuhan dan status bayar **selalu tampil terpisah** (dua label), tidak digabung.
- Sisa tagihan Rp 0 → tulisan "Lunas" (bukan "Sisa Rp 0").
- Kelompok kosong tidak ditampilkan sama sekali.
- Bila belum ada pesanan: "Belum ada pesanan." + tombol Pesanan Baru.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | tombol baru, cari, kelompok pesanan aktif |
| Kosong | kalimat kosong + tombol Pesanan Baru |
| Hasil cari kosong | "Tidak ada pesanan atas nama itu." |
