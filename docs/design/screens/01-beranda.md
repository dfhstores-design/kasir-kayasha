# Layar 1 — Beranda

**Tugas utama:** membuka jalan ke pekerjaan hari itu dengan satu ketukan.

```
┌──────────────────────────────────────┐
│  Kasir Kayasha                       │  ← judul aplikasi, 26 px
│  Kayasha Clothing                    │  ← nama butik dari Pengaturan, 16 px abu
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │         JUAL BARANG            │  │  ← tombol utama, 96 px, terakota
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │  ← dua tombol besar, 88 px
│  │   PESANAN    │  │    BARANG    │  │
│  └──────────────┘  └──────────────┘  │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │  RINGKASAN   │  │  PENGATURAN  │  │
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
| Judul | "Kasir Kayasha" | Tetap di semua layar beranda |
| Nama butik | dari Pengaturan | Mengikuti isian pemilik |
| **Jual Barang** | tombol terbesar | → Pilih Barang (Alur 1) |
| **Pesanan** | tombol besar | → Daftar Pesanan |
| **Barang** | tombol besar | → Daftar Barang (admin) |
| **Ringkasan** | tombol besar | → Ringkasan Hari Ini |
| **Pengaturan** | tombol besar | → Pengaturan (minta PIN bila diatur) |
| Status simpan | satu kalimat + jumlah transaksi hari ini | Mengetuk status → Status Simpan & Backup |

## Aturan

- Hanya **lima** tujuan. Tidak ada menu tambahan, tidak ada ikon di pojok kanan atas.
- Tombol "Jual Barang" dan dua tombol di bawahnya dipisah jarak 16 px; seluruh tombol ≥ 88 px.
- Status simpan bukan tombol terpisah di tengah layar; cukup satu baris di bawah.
- Bila aplikasi pertama kali dibuka (belum ada pengaturan), tampilkan huruf besar dulu:
  panel **"Ayo isi nama butik"** dengan tombol "Isi Pengaturan". Setelah terisi, panel hilang selamanya.
- Bila belum ada barang sama sekali, di bawah tombol Jual Barang ada satu baris:
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
