# Layar 6 — Resi (PDF)

Spesifikasi latar: [`BAZAR-PARKIR-RESI.md`](../BAZAR-PARKIR-RESI.md) bagian 4a–5.

**Tugas utama:** melihat resi persis seperti yang akan diterima pembeli, lalu membagikannya.

> **Output MVP: PDF.** Tombol **Cetak** (thermal 58/80 mm) **tidak ditampilkan** — masuk daftar
> *to be develop* sesuai keputusan B-02. Susunan baris di bawah tetap dipakai bila printer
> diaktifkan kelak.

> Susunan di bawah mengikuti contoh resi yang dibahas Andri (mockup nota v8 /
> resi v9 / resi bazar v4, 15 Nov 2026). Perbedaan utama dari versi sebelumnya:
> ada judul dokumen (RESI / INVOICE) + lencana status, info dua kolom,
> pembayaran per baris, kotak rekening yang selalu tampil, kotak peringatan,
> dan tanda tangan "Hormat Kami". Baris sapaan dan baris "TERIMA KASIH"
> tidak lagi dicetak.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Resi KYS-0012         │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │  [LOGO]  KAYESA                │  │  ← logo kiri, nama di kanan
│  │          KAYESA'S CLOTHING     │  │
│  │  Jl. Tarumanegara No. 41       │  │
│  │  (Sebelah Pempak Nyai)         │  │
│  │  Ploso Ciptum 15419            │  │
│  │  WA 0812 1141 4017 · 0821 ...  │  │
│  │  ────────────────────────────  │  │
│  │  [CONTOH DATA FIKTIF]          │  │  ← hanya pratinjau/contoh
│  │  RESI                          │  │
│  │  BUKTI PEMBAYARAN PENJUALAN    │  │
│  │  BARANG                        │  │
│  │  [ LUNAS ]                     │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ KODE TRANSAKSI (USULAN)  │  │  │
│  │  │ KYS-0012                 │  │  │
│  │  └──────────────────────────┘  │  │
│  │  TANGGAL RESI    LOKASI        │  │
│  │  15 Nov 2026     Bazar Contoh  │  │
│  │  PEMBELI         METODE BAYAR  │  │
│  │  Pembeli Umum    Tunai         │  │
│  │  ────────────────────────────  │  │
│  │  RINCIAN PENJUALAN             │  │
│  │  BLUS BATIK MOTIF BUNGA        │  │
│  │  Barang stok bazar · ukuran M  │  │
│  │  1x 180.000           180.000  │  │
│  │  ────────────────────────────  │  │
│  │  Total penjualan    Rp180.000  │  │
│  │  ────────────────────────────  │  │
│  │  PEMBAYARAN DITERIMA           │  │
│  │  Tunai diterima     Rp200.000  │  │
│  │  15 Nov 2026 · Lunas           │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ Kembalian    Rp20.000    │  │  │  ← kotak sorot
│  │  └──────────────────────────┘  │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ REKENING KAYESA          │  │  │  ← selalu tampil
│  │  │ BCA · 676 017 885        │  │  │
│  │  │ a.n. NARSHITA DEWI       │  │  │
│  │  └──────────────────────────┘  │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ PENGINGAT                │  │  │
│  │  │ Simpan resi ini sebagai  │  │  │
│  │  │ bukti pembayaran.        │  │  │
│  │  └──────────────────────────┘  │  │
│  │                   Hormat Kami, │  │
│  │                   ──────────   │  │
│  │                       KAYESA   │  │
│  │  Terima kasih telah berbelanja │  │
│  │  di KAYESA.                    │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │         Bagikan PDF            │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │          Simpan PDF            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Urutan isi resi (mengikuti contoh)

1. **Kop** — **logo** hitam-putih di kiri (proporsional, tidak diregangkan),
   **nama butik** besar di kanannya + **nama lengkap** (`KAYESA'S CLOTHING`)
   di bawahnya. Tanpa logo → nama butik besar saja.
2. **Alamat**: baris 1 + patokan dalam kurung, lalu **kota + kode pos**.
3. **Telepon** satu baris: `WA 0812 ... · 0821 ...`.
4. Garis pemisah.
5. **Lencana `CONTOH DATA FIKTIF`** — hanya untuk pratinjau / data contoh.
6. **Judul dokumen**: `RESI` bila lunas, `INVOICE` bila pesanan belum lunas.
   Subjudul: `BUKTI PEMBAYARAN PENJUALAN BARANG` (penjualan),
   `BUKTI PEMBAYARAN PESANAN` (pesanan lunas), `NOTA PESANAN JAHIT` (invoice).
7. **Lencana status**: `LUNAS` / `BELUM LUNAS`.
8. **Kotak kode transaksi**: `KODE TRANSAKSI (USULAN)` + nomor resi
   (boleh dimatikan di Pengaturan). Penomoran masih usulan — BU-19 menunggu Tante.
9. **Info dua kolom** (label kecil di atas nilai tebal):
   penjualan: `TANGGAL RESI` / `LOKASI`, `PEMBELI` / `METODE BAYAR`;
   pesanan: `PEMESAN` / `TANGGAL PESANAN`, `JENIS JAHITAN` / `PERKIRAAN SELESAI`.
   Tanggal saja (`15 Nov 2026`), tanpa jam. Nomor urut hari (`#7`) tidak lagi dicetak.
10. Garis pemisah.
11. **Rincian** — judul `RINCIAN PENJUALAN` / `RINCIAN PESANAN`, lalu tiap barang:
    nama **tebal**, baris kecil keterangan (`Barang stok bazar · ukuran M`),
    `jumlah x harga` (angka tanpa `Rp`) rata kiri dan subtotal rata kanan.
    Pesanan jahit: baris `Jasa jahit` + `Biaya lainnya` (hanya pratinjau —
    model jahitan belum ada di skema transaksi, lihat bawah).
12. **Baris diskon** bila ada: `Diskon @ Rp 2.000 x 25` dan/atau `Diskon total`.
13. **Ongkos kirim — hanya bila ada nominalnya atau belum ditentukan**
    (contoh tidak menampilkan baris ongkir bila tidak ada ongkir):
    `Rp25.000` (ditagihkan butik) · `Belum ditentukan` (menyusul) ·
    `Dibayar langsung ke kurir`. Bila ongkir `Belum ditentukan`, tambahkan
    baris kecil `Total belum termasuk ongkir`.
14. **Total** — `Total penjualan` / `Total tagihan`, `Rp180.000` 2 px lebih besar.
15. **Pembayaran, per baris** (bukan agregat): penjualan —
    `Tunai diterima Rp200.000` + `15 Nov 2026 · Lunas`; pesanan —
    `DP Rp300.000` + `12 Nov 2026 · Transfer BCA`, lalu
    `Pelunasan · Tunai Rp675.000` + `Tanggal Pelunasan — 15 Nov 2026`.
16. **Kotak sorot** (latar krem, garis kiri cokelat): `Kembalian`,
    `TOTAL PEMBAYARAN DITERIMA`, atau `Sisa pembayaran` — sesuai keadaan.
17. **Kotak rekening — SELALU tampil**, judul `REKENING KAYESA` (resi) atau
    `PEMBAYARAN MELALUI` (invoice), isi rekening utama saja:
    `BCA · 676 017 885` + `a.n. NARSHITA DEWI`.
18. **Kotak peringatan**: penjualan → `PENGINGAT` ("Simpan resi ini sebagai
    bukti pembayaran."); pesanan dengan catatan → `PERHATIAN!!!`
    ("Catatan pesanan: ...").
19. **Tanda tangan**: `Hormat Kami,` + garis + nama butik, rata kanan.
20. **Kalimat penutup** sesuai jenis dokumen: penjualan —
    `Terima kasih telah berbelanja di KAYESA.`; pesanan —
    `Terima kasih telah mempercayakan pesanan jahit kepada KAYESA.`
    (Bukan field `teksPenutup` di Pengaturan — lihat catatan bawah.)

## Yang belum bisa mengikuti contoh (model belum ada)

- **Pesanan jahit di kode masih PO barang katalog** (`jenis: "po"` dengan
  item barang). Field `model/jenis`, `ukuran`, `biayaJasa`, dan `biaya
  lainnya` ada di dokumen Tahap 1 (SPESIFIKASI-DESAIN-TAHAP-1.md §3,
  BU-14/BU-15) tapi **belum ada di skema transaksi** (`schema.ts`) —
  BLUEPRINT R-1/R-2 mencatat kekurangan ini. Di resi, `JENIS JAHITAN` dan
  baris `Jasa jahit` / `Biaya lainnya` hanya tampil di **pratinjau contoh**
  (`dataContohPO`); transaksi PO asli menampilkan item barangnya.
- **Penomoran dokumen** masih usulan (`KODE TRANSAKSI (USULAN)`) — BU-19
  menunggu Tante.
- **Ejaan kop** (keputusan Andri, 17 Nov 2026): semua teks memakai `KAYESA` /
  `KAYESA'S CLOTHING`. Kop contoh mockup memakai `KAYESYA` (ejaan lama),
  begitu juga teks di dalam artwork logo — teks di dalam gambar tidak bisa
  diubah dengan edit teks; perlu file logo baru bila mau diperbaiki total.
- **Field `teksPenutup` di Pengaturan** adalah penutup pengganti (keputusan
  Andri, 17 Nov 2026): bila terisi, kalimat itu yang dicetak di resi; bila
  kosong, resi memakai kalimat penutup bawaan sesuai jenis dokumen.

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
| **Bagikan PDF** | Membuka menu berbagi Android dengan berkas PDF |
| **Simpan PDF** | Menyimpan PDF ke HP: "PDF disimpan di folder Unduhan." |
| ~~Cetak~~ | **Tidak ada di MVP** — masuk *to be develop* (B-02) |

## Aturan

- PDF dibuat **di perangkat**, tanpa server, agar bisa saat offline.
- Nomor rekening tampil penuh di resi (agar bisa ditransfer) tetapi **tidak pernah** masuk log.
- Resi menyimpan salinan logo, rekening, sapaan, dan status ongkir yang dipakai saat transaksi.
- **Tidak ada tombol nonaktif di layar.** Fitur yang belum siap tidak ditampilkan sama sekali.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | resi + Bagikan PDF |
| Tanpa logo | nama butik besar sebagai pengganti |
| Lunas | tanpa tulisan status di bawah Total |
| DP | `DP` + `Bayar` + `Sisa` |
| Ongkir ambil sendiri | `Ongkos kirim  Rp0` |
| Ongkir menyusul | `Ongkos kirim  Belum ditentukan` + `Total belum termasuk ongkir` |
| Ongkir ke kurir | `Ongkos kirim  Dibayar langsung ke kurir` |
| Tanpa menu berbagi | tombol Bagikan hilang, hanya Simpan PDF |
