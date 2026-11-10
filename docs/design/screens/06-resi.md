# Layar 6 — Resi (Thermal & PDF)

Spesifikasi latar: [`BAZAR-PARKIR-RESI.md`](../BAZAR-PARKIR-RESI.md) bagian 5.

**Tugas utama:** melihat resi persis seperti yang akan dicetak, lalu mencetak atau membagikannya.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Resi KYS-0012         │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │        [ LOGO ]                │  │  ← hitam-putih, proporsional
│  │      KAYASHA CLOTHING          │  │
│  │      Jl. Melati No. 12         │  │
│  │      Kebayoran Baru            │  │
│  │      JAKARTA 12130             │  │
│  │      0812-1111-2222            │  │
│  │  ────────────────────────────  │  │
│  │  11 Nov 2026 14:20         #7  │  │
│  │  - Sore -                      │  │
│  │  ────────────────────────────  │  │
│  │  BLUS LINEN                    │  │
│  │  25x 10.000           250.000  │  │
│  │  ROK PLISKET                   │  │
│  │  2x 42.000             84.000  │  │
│  │  ────────────────────────────  │  │
│  │  Ongkos kirim        Rp25.000  │  │
│  │  ────────────────────────────  │  │
│  │  Total              Rp359.000  │  │
│  │                Belum Dibayar   │  │
│  │      **TERIMA KASIH**          │  │
│  │      Siti Aminah               │  │
│  │      BNI 0971092588            │  │
│  │      BCA 8810295431            │  │
│  │      Sore, sampai jumpa!       │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │          Cetak                 │  │  ← hanya bila printer teruji
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │         Bagikan PDF            │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │          Simpan PDF            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Urutan isi resi (mengikuti contoh)

1. **Logo** hitam-putih, dipotong proporsional (tidak diregangkan). Tanpa logo → nama butik besar.
2. **Nama butik**, huruf kapital.
3. **Alamat** (sampai 3 baris), **kota + kode pos**, **telepon** (sampai 2 nomor).
4. Garis pemisah.
5. **Tanggal & jam** `11 Nov 2026 14:20`, **nomor urut hari itu** `#7` di kanan.
6. **Nomor resi** `KYS-0012` (boleh dimatikan di Pengaturan).
7. **Sapaan** `- Sore -` (opsional, diisi di Pengaturan).
8. Garis pemisah.
9. **Blok barang** — nama **tebal**, baris di bawahnya `jumlah x harga` (angka tanpa `Rp`) rata
   kiri dan subtotal rata kanan.
10. **Baris diskon** bila ada: `Diskon @ Rp 2.000 x 25` dan/atau `Diskon total`.
11. Garis pemisah.
12. **Ongkos kirim** bila ada, `Rp25.000`.
13. **Total** — `Rp359.000` 2 px lebih besar.
14. **Status** di kanan bawah: `Belum Dibayar` / `DP` / *(kosong bila Lunas)*.
15. Bila DP/Belum dibayar: **`Bayar (Transfer)`** dan **`Sisa`**.
16. **`**TERIMA KASIH**`**.
17. **Nama pemilik rekening** + **rekening** (maks 2), bila masih ada sisa tagihan.
18. **Teks penutup** (opsional).
19. Bila PO: label **`PRE-ORDER`** + tanggal siap, tepat di bawah nomor resi.

## Format kertas

| Format | Lebar cetak | Ketersediaan |
| --- | --- | --- |
| Thermal **58 mm** | ±32 karakter | **Utama** |
| Thermal **80 mm** | ±48 karakter | Pilihan |
| PDF **A5** | — | Selalu ada |

Tata letak dihitung dari **jumlah karakter**, bukan piksel. Nama barang terlalu panjang dipotong
dengan `…`; nama lengkap tetap terlihat di detail transaksi aplikasi.

## Perilaku tombol

| Tombol | Perilaku |
| --- | --- |
| **Cetak** | Hanya muncul bila printer sudah diuji pada Phase 5. Bila printer putus: "Printer belum tersambung. Nyalakan printer lalu coba lagi." |
| **Bagikan PDF** | Membuka menu berbagi Android dengan berkas PDF |
| **Simpan PDF** | Menyimpan PDF ke HP: "PDF disimpan di folder Unduhan." |

## Aturan

- PDF dibuat **di perangkat**, tanpa server, agar bisa saat offline.
- Nomor rekening tampil penuh di resi (agar bisa ditransfer) tetapi **tidak pernah** masuk log.
- Resi menyimpan salinan logo, rekening, dan sapaan yang dipakai saat transaksi.
- **Tidak ada tombol cetak palsu**: tanpa model printer teruji, tombol Cetak tidak ditampilkan dan
  PDF menjadi satu-satunya janji.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | resi + Bagikan PDF |
| Tanpa logo | nama butik besar sebagai pengganti |
| Lunas | tanpa tulisan status di bawah Total |
| DP | `DP` + `Bayar` + `Sisa` |
| Printer belum teruji | tanpa tombol Cetak |
| Tanpa menu berbagi | tombol Bagikan hilang, hanya Simpan PDF |
