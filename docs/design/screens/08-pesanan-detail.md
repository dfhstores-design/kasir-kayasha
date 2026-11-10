# Layar 8 — Detail Pesanan & Pembayaran

**Tugas utama:** menagih sisa tagihan atau memperbarui status pesanan.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Pesanan KYS-PO-0003   │
├──────────────────────────────────────┤
│  Ibu Sari                            │  ← nama pemesan, 26 px
│  0812-xxxx-xxxx · WhatsApp           │  ← kontak (bila diisi)
│  [Diproses]                          │  ← status pemesanan
│                                      │
│  PRE-ORDER · siap ± 20 Nov 2026      │  ← label PO + perkiraan siap
│                                      │
│  Barang                              │
│  Gamis Abu                           │
│  1 × Rp 450.000         Rp 450.000   │
│  Kebaya                             │
│  1 × Rp 400.000         Rp 400.000   │
│                                      │
│  Ongkir (dibayar pembeli ke kurir)   │  ← keterangan jelas
│  Tidak masuk tagihan butik           │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ Total pesanan     Rp 850.000   │  │
│  │ Sudah dibayar     Rp 300.000   │  │
│  │ SISA TAGIHAN      Rp 550.000   │  │  ← angka paling tebal
│  └────────────────────────────────┘  │
│                                      │
│  Riwayat pembayaran                  │
│  10 Nov · DP · Transfer  Rp 300.000  │
│                                      │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │      Catat Pembayaran          │  │  ← tombol utama
│  └────────────────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐  │
│  │ Lihat Resi   │ │ Ubah Status  │  │
│  └──────────────┘ └──────────────┘  │
└──────────────────────────────────────┘
```

## Catat Pembayaran (lembar bawah dari layar ini)

```
┌──────────────────────────────────────┐
│  Catat Pembayaran                    │
│  Sisa tagihan Rp 550.000             │
│                                      │
│  Nominal  [ Rp  300.000 ]            │
│  Tanggal  [ 10 Nov 2026 ]            │
│  Metode   [ Tunai ] [ Transfer ] [ QRIS ]  │
│  Catatan  [ opsional ]               │
│                                      │
│  ┌────────────────────────────────┐  │
│  │          Simpan                │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

| Aturan | Perilaku |
| --- | --- |
| Nominal > sisa | Pesan "Nominal melebihi sisa tagihan Rp 550.000"; tombol Simpan nonaktif |
| Nominal = sisa | Setelah simpan → status pembayaran menjadi **Lunas** |
| Nominal < sisa | Status pembayaran menjadi **DP/sebagian** |
| Nominal 0 | Tidak dapat disimpan |
| Kedua pembayaran | Riwayat bertambah baris, urut tanggal terbaru di atas |

## Ubah Status

Pilihan status dalam lembar bawah: **Diproses · Siap diambil atau dikirim · Selesai · Batalkan pesanan**.
Membatalkan pesanan menampilkan konfirmasi satu kali: "Batalkan pesanan KYS-PO-0003?
Riwayat pembayaran tetap disimpan." — pembayaran **tidak** dihapus.

## Aturan tampilan

- Nama pemesan dan kontak seminimal mungkin; tidak ada kolom alamat lengkap kecuali dikirim.
- Label "PRE-ORDER" selalu terlihat di atas daftar barang.
- Bila pesanan sudah Lunas dan Selesai, tombol "Catat Pembayaran" hilang.
- Bila pesanan dibatalkan, layar menampilkan garis "Pesanan dibatalkan pada <tanggal>" dan
  semua tombol tindakan hilang kecuali "Lihat Resi".
