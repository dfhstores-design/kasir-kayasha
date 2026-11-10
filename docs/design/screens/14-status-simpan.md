# Layar 14 — Status Simpan & Backup

**Tugas utama:** membuat pemilik yakin datanya aman, dan bisa menyimpan cadangan sendiri.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Simpan & Cadangan     │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │  ● Tersimpan di perangkat      │  │
│  │  Ada 3 perubahan menunggu      │  │
│  │  dikirim ke internet.          │  │
│  │  Terakhir tersinkron:          │  │
│  │  10 Nov 2026, 13:58            │  │
│  │      [ Coba Lagi ]             │  │
│  └────────────────────────────────┘  │
│                                      │
│  Cadangan di HP ini                  │
│  ┌────────────────────────────────┐  │
│  │   Simpan cadangan (JSON)       │  │
│  ├────────────────────────────────┤  │
│  │   Simpan daftar transaksi (CSV)│  │
│  ├────────────────────────────────┤  │
│  │   Pulihkan dari cadangan       │  │
│  └────────────────────────────────┘  │
│                                      │
│  Data tersimpan seperti apa?         │
│  Aplikasi ini bekerja tanpa internet.│
│  Semua transaksi disimpan di HP ini  │
│  lebih dulu. Bila internet tersedia, │
│  salinan dikirim ke cloud secara     │
│  otomatis.                           │
└──────────────────────────────────────┘
```

## Kata status (empat, tidak lebih)

| Kalimat | Kapan |
| --- | --- |
| **Tersimpan di perangkat** | Tidak ada antrean; ada/tidak ada internet |
| **Menunggu internet** | Ada antrean dan perangkat sedang offline |
| **Tersinkron** | Antrean kosong dan terakhir sinkron kurang dari 5 menit lalu |
| **Belum tersinkron — coba lagi** | Ada antrean, internet ada, tetapi pengiriman gagal |

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Panel status | Kalimat sederhana + jumlah antrean + waktu terakhir tersinkron + **Coba Lagi** |
| Simpan cadangan (JSON) | Menyimpan berkas berisi katalog, transaksi, pembayaran, pengaturan |
| Simpan daftar transaksi (CSV) | Untuk dibuka di spreadsheet |
| Pulihkan dari cadangan | Memilih berkas → ringkasan isi ("12 barang, 64 transaksi") → konfirmasi → pulihkan |
| Penjelasan | Satu paragraf bahasa sehari-hari, tanpa istilah teknis |

## Aturan

- Tombol **Coba Lagi** selalu ada, walau antrean kosong (dinonaktifkan dengan alasan jelas).
- Pemulihan tidak menghapus data yang ada kecuali diminta dan dikonfirmasi.
- Tidak ada istilah "sync", "queue", "cache" di layar.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Semua terkirim | "Tersinkron · Terakhir 13:58" |
| Offline dengan antrean | "Menunggu internet · 3 perubahan" |
| Gagal kirim | "Belum tersinkron — coba lagi" + tombol aktif |
| Belum pernah sinkron | "Tersimpan di perangkat · belum pernah dikirim" |
