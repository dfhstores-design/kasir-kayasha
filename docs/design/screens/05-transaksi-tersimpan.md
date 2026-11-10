# Layar 5 — Transaksi Tersimpan

**Tugas utama:** memberi tahu dengan sangat jelas bahwa uang dan barang sudah tercatat.

```
┌──────────────────────────────────────┐
│                                      │
│                  ✓                   │  ← tanda centang besar
│                                      │
│         Transaksi tersimpan          │  ← 26 px tebal
│                                      │
│         Nomor KYS-0012               │
│         Blus Linen, Rok Plisket      │
│                                      │
│            Rp 560.000                │  ← 34 px, total
│                                      │
│   ● Tersimpan di perangkat           │  ← status simpan
│                                      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │          Buat Resi             │  │  ← tombol utama
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │        Transaksi Baru          │  │  ← tombol sekunder
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Pesan | Tetap di layar sampai pengguna memilih; **tidak** hilang sendiri |
| Nomor | Nomor resi yang bisa disebut ke pembeli |
| Daftar barang | Maks 3 nama; bila lebih, "dan 2 barang lain" |
| Total | Total akhir setelah diskon |
| Status simpan | Sama dengan di Beranda |
| **Buat Resi** | → Resi (pratinjau PDF) |
| **Transaksi Baru** | → Pilih Barang dengan keranjang kosong |

## Aturan

- Tombol kembali di kiri atas **tidak ada** di layar ini; sengaja, agar kasir memilih
  "Buat Resi" atau "Transaksi Baru" dan tidak kembali ke keranjang yang sudah tersimpan.
- Stok sudah berkurang pada saat ini; tidak ada konfirmasi tambahan.
- Bila penyimpanan gagal (perangkat penuh), layar berubah menjadi panel gagal:
  "Transaksi belum tersimpan. Periksa ruang penyimpanan HP, lalu coba lagi."
  dengan tombol "Coba Lagi" — keranjang tetap utuh.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Berhasil | centang, nomor, total, dua tombol |
| Gagal simpan | panel gagal + "Coba Lagi", tanpa centang |
| Offline | normal; status "Tersimpan di perangkat · Menunggu internet" |
