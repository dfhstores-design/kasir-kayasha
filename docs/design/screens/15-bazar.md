# Layar 15 — Bazar (Buka, Daftar, Tutup)

Spesifikasi latar: [`BAZAR-PARKIR-RESI.md`](../BAZAR-PARKIR-RESI.md) bagian 2.

**Tugas utama:** membuka bazar baru untuk membawa barang keluar gudang, dan menutupnya saat selesai.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Bazar                 │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │  Bazar aktif:                  │  │
│  │  Pameran Mall Kelapa Gading    │  │
│  │  15–20 Nov 2026                │  │
│  │  18 barang · 240 pcs           │  │
│  │  [Atur Barang]  [Tutup Bazar]  │  │
│  └────────────────────────────────┘  │
│                                      │
│  Bazar yang sudah selesai            │
│  ┌────────────────────────────────┐  │
│  │ Pameran Senayan · 1–3 Nov 2026 │  │
│  │ 96 pcs terjual · Rp 12.400.000 │  │  ← ketuk → ringkasan
│  ├────────────────────────────────┤  │
│  │ Bazar Kantor · Okt 2026        │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │          + Buka Bazar          │  │  ← nonaktif bila sudah ada bazar aktif
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Kartu bazar aktif | Nama, tanggal, jumlah barang & pcs, dua tombol |
| **Atur Barang** | → Alokasi Bazar (layar 16) |
| **Tutup Bazar** | → Tutup Bazar (layar 17), dengan konfirmasi |
| Daftar selesai | Ketuk → ringkasan bazar (terjual, sisa dikembalikan, uang masuk) |
| **+ Buka Bazar** | Form: nama bazar (wajib), tanggal mulai/selesai (opsional) |

## Aturan

- **Satu bazar aktif** saja. Bila sudah ada, tombol Buka Bazar dinonaktifkan dengan tulisan
  "Tutup bazar yang sekarang dulu."
- Membuka bazar **tidak** otomatis membawa semua barang. Barang dipilih di layar Alokasi.
- Bazar yang sudah ditutup tidak bisa dibuka lagi; buat bazar baru.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Belum ada bazar | "Belum ada bazar." + tombol Buka Bazar |
| Bazar aktif, belum ada barang | kartu aktif + "Belum ada barang dibawa. Atur Barang."
| Ada bazar selesai | daftar selesai di bawah |
