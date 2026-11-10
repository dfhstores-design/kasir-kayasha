# Layar 8 — Detail Pesanan & Pembayaran

**Tugas utama:** menagih sisa tagihan atau memperbarui status pesanan.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Pesanan KYS-PO-0003   │
├──────────────────────────────────────┤
│  Ibu Sari                            │  ← nama pemesan, 26 px
│  0812-xxxx-xxxx · WhatsApp           │  ← kontak (bila diisi)
│  [Diproses]   [Ongkir menyusul]      │  ← status pesanan + label ongkir
│                                      │
│  PRE-ORDER · siap ± 20 Nov 2026      │  ← label PO + perkiraan siap
│                                      │
│  Barang                              │
│  Gamis Abu                           │
│  1 × Rp 450.000         Rp 450.000   │
│  Kebaya                             │
│  1 × Rp 400.000         Rp 400.000   │
│                                      │
│  Ongkos kirim      Belum ditentukan  │  ← selalu tampil (B-10)
│  [ Isi Ongkos Kirim ]                │  ← hanya bila belum ditentukan
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

## Ongkir (keputusan B-10)

| Keadaan | Yang tampil |
| --- | --- |
| Ambil sendiri | `Ongkos kirim  Rp 0` |
| Ditagihkan butik | `Ongkos kirim  Rp 25.000` + tombol `Ubah` |
| Dibayar ke kurir | `Ongkos kirim  Dibayar langsung ke kurir` |
| **Belum ditentukan** | `Ongkos kirim  Belum ditentukan` + tombol **`Isi Ongkos Kirim`** + label **`Ongkir menyusul`** |

### Isi Ongkos Kirim (lembar bawah)

```
┌──────────────────────────────────────┐
│  Isi Ongkos Kirim                    │
│  Nominal  [ Rp 25.000 ]              │
│  Dibayar  [ Butik ]  [ Kurir ]       │
│                                      │
│  Total berubah dari Rp 850.000       │  ← pratinjau WAJIB
│  menjadi Rp 875.000                  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │          Simpan                │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

| Aturan | Perilaku |
| --- | --- |
| Pratinjau total | **Wajib** tampil sebelum simpan — pemilik melihat efek uangnya lebih dulu |
| Lunas → DP | Bila sebelumnya **Lunas** dan ongkir ditagihkan, status berubah jadi **DP**, catatan "Total bertambah karena ongkir" |
| Riwayat | Setiap perubahan dicatat: `Total diubah 12 Nov: Rp 850.000 → Rp 875.000 (ongkir Rp 25.000)` |
| Ongkir ke kurir | Tidak mengubah total butik sama sekali; hanya catatan |


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
