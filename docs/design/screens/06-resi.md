# Layar 6 — Resi (Pratinjau PDF)

**Tugas utama:** melihat resi persis seperti yang akan diterima pembeli, lalu membagikannya.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Resi KYS-0012         │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │        [logo butik]            │  │  ← proporsional, tidak dipotong
│  │      KAYASHA CLOTHING          │  │
│  │      Pameran, Jakarta          │  │
│  │  ────────────────────────────  │  │
│  │  Nomor   KYS-0012              │  │
│  │  Tanggal 10 Nov 2026, 14:20    │  │
│  │  ────────────────────────────  │  │
│  │  Blus Linen                    │  │
│  │  2 × Rp 180.000    Rp 360.000  │  │
│  │  Diskon @ Rp 10.000  − 20.000  │  │
│  │                                │  │
│  │  Rok Plisket                   │  │
│  │  1 × Rp 220.000    Rp 220.000  │  │
│  │                                │  │
│  │  Subtotal          Rp 580.000  │  │
│  │  Diskon barang    − Rp  20.000 │  │
│  │  Diskon total     − Rp       0 │  │
│  │  ────────────────────────────  │  │
│  │  TOTAL             Rp 560.000  │  │
│  │  ────────────────────────────  │  │
│  │  Pembayaran: Tunai             │  │
│  │  Terima kasih, sampai jumpa!   │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │           Bagikan              │  │  ← share sheet Android
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │          Simpan PDF            │  │  ← fallback unduh
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi resi (urutan tetap)

1. Logo butik (bila ada) — dipotong proporsional, **tidak** diregangkan; tanpa logo → nama butik besar.
2. Nama butik + alamat/kontak (bila diisi).
3. Nomor dan tanggal transaksi.
4. Tiap barang: nama, "jumlah × harga", subtotal, dan diskon per unit bila ada.
5. Subtotal, diskon barang, diskon total.
6. Ongkir (hanya untuk PO yang dikirim) dengan keterangan siapa yang membayar.
7. **Total akhir yang dibayarkan ke butik**.
8. Pembayaran: untuk PO ada riwayat DP/pelunasan, sudah dibayar, sisa tagihan.
9. Label **PRE-ORDER** + perkiraan tanggal siap (khusus PO).
10. Rekening tujuan (bank, nomor, nama pemilik) — hanya bila masih ada sisa tagihan.
11. Teks penutup dari Pengaturan (bila diisi).

## Perilaku

| Tombol | Perilaku |
| --- | --- |
| Bagikan | Membuka menu berbagi Android dengan berkas PDF; bila tidak didukung → "Simpan PDF" |
| Simpan PDF | Menyimpan PDF ke HP dengan pesan "PDF disimpan di folder Unduhan." |
| Kembali | Kembali ke Transaksi Tersimpan / detail pesanan |

## Aturan

- PDF dibuat **di perangkat** (tanpa server) agar bisa saat offline.
- Ukuran kertas: A5 vertikal atau 80 mm (dipilih pada Phase 5 setelah uji printer).
- Nomor rekening tampil penuh di PDF (agar bisa ditransfer) tetapi **tidak pernah** masuk log.
- Resi menyimpan salinan logo dan rekening yang dipakai saat transaksi.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | pratinjau + Bagikan |
| Tanpa logo | nama butik besar sebagai pengganti |
| Menunggu sisa tagihan (PO) | bagian rekening tampil |
| Tanpa menu berbagi | tombol "Simpan PDF" jadi satu-satunya tombol |
