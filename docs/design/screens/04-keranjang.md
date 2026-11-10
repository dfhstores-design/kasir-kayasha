# Layar 4 — Keranjang

**Tugas utama:** memeriksa barang dan uang **sebelum** menyimpan transaksi, atau menahannya dulu.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Keranjang             │
│  Nama pembeli  [ Bu Sari          ]  │  ← dipakai bila diparkir
├──────────────────────────────────────┤
│  Blus Linen                          │
│  2 × Rp 180.000          Rp 360.000  │
│  ┌────┐ ┌────┐ ┌────┐                │
│  │ −  │ │ 2  │ │ +  │   Hapus        │  ← minus/plus & hapus
│  └────┘ └────┘ └────┘                │
│  Diskon  [ Rp   10.000 ] per buah    │  ← diskon per unit
│  − Rp 20.000                         │
├──────────────────────────────────────┤
│  Rok Plisket                         │
│  1 × Rp 220.000          Rp 220.000  │
│  ┌────┐ ┌────┐ ┌────┐                │
│  │ −  │ │ 1  │ │ +  │   Hapus        │
│  └────┘ └────┘ └────┘                │
│  Diskon  [ Rp        0 ] per buah    │
├──────────────────────────────────────┤
│  Subtotal              Rp 580.000    │
│  Diskon barang        − Rp  20.000   │
│  ──────────────────────────────────  │
│  Setelah diskon        Rp 560.000    │
│  Diskon total  [ Rp       0 ]        │
│  ──────────────────────────────────  │
│                                      │
│  Jenis transaksi                     │
│  [ Tunai ] [ Transfer ] [ QRIS ]     │  ← pilih satu
│                                      │
│  Status bayar                        │
│  [ Lunas ] [ DP ] [ Belum dibayar ]  │  ← pilih satu
│  Dibayar sekarang  [ Rp 560.000 ]    │  ← hanya bila DP/Belum dibayar
│                                      │
├──────────────────────────────────────┤
│  Tertahan (2 dari 3)                 │  ← hanya bila ada parkir
│  ┌────────────────────────────────┐  │
│  │ Bu Dewi · 2 barang · Rp 400.000│  │
│  │ 14:02                    [X]   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Bu Rina · 1 barang · Rp 180.000│  │
│  │ 13:40                    [X]   │  │
│  └────────────────────────────────┘  │
├──────────────────────────────────────┤
│  TOTAL                 Rp 560.000    │  ← selalu terlihat
│  ┌──────────────┐ ┌───────────────┐  │
│  │   Parkir     │ │ Simpan        │  │
│  └──────────────┘ └───────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Nama pembeli | Opsional di keranjang; **wajib saat menekan Parkir** |
| Blok barang | Nama, "jumlah × harga", subtotal baris, tombol − / + dan **Hapus** |
| − / + | Mengubah jumlah; batas atas = saldo bazar (atau stok gudang bila tanpa bazar) |
| Diskon per buah | Nominal Rupiah per unit; batas = harga satuan |
| Diskon total | Nominal untuk seluruh transaksi; batas = setelah diskon barang |
| **Jenis transaksi** | Tunai / Transfer / QRIS — wajib dipilih sebelum simpan |
| **Status bayar** | Lunas / DP / Belum dibayar |
| Dibayar sekarang | Muncul hanya bila DP/Belum dibayar. Batas = total |
| **Tertahan** | Daftar parkir (maks 3), tiap baris: nama · jumlah barang · total · jam · hapus |
| **Parkir** | Menyimpan keranjang sebagai parkir dan mengosongkan keranjang |
| **Simpan** | Menyimpan transaksi; tombol jadi "Menyimpan…" dan nonaktif |

## Aturan parkir

- Maksimal **3** parkir. Saat sudah 3, tombol Parkir nonaktif:
  "Sudah ada 3 transaksi tertahan. Selesaikan salah satu dulu."
- Parkir butuh nama pembeli, maks 20 huruf. Kosong → "Isi nama pembeli dulu supaya tidak tertukar."
- **Parkir tidak mengurangi stok.** Stok berkurang saat transaksi disimpan.
- Mengetuk parkir saat keranjang berisi → bertanya sekali:
  "Keranjang sekarang akan diparkir juga. Lanjutkan ke keranjang Bu Dewi?"
- Mengetuk [X] pada parkir → konfirmasi hapus.
- Parkir tetap ada setelah aplikasi ditutup.

## Aturan validasi uang

- Diskon per buah lebih besar dari harga → **"Maksimal Rp 180.000"**; simpan nonaktif.
- Diskon total lebih besar dari setelah diskon barang → **"Maksimal Rp 560.000"**.
- Total tidak boleh negatif.
- Status **Belum dibayar** → dibayar sekarang 0. Status **Lunas** → dibayar = total.
- Status **DP** → dibayar 1..total−1. Di luar itu: **"Nominal melebihi total Rp 560.000"**.
- Uang integer Rupiah; pemisah ribuan otomatis (`10000` → `10.000`).

## Aturan tampilan

- **Bilah bawah menempel (sticky)**: TOTAL + tombol Parkir / Simpan selalu terlihat.
- Rincian angka tetap di area gulir; angka **TOTAL** 28 px tebal ada di bilah bawah.
- Ongkir **tidak ada** di keranjang (ongkir hanya untuk pesanan yang dikirim).

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | seperti gambar |
| Keranjang kosong | "Keranjang belum ada barang." + tombol "Pilih Barang" |
| Diskon melebihi batas | pesan merah marun di bawah kolom, simpan nonaktif |
| Ada parkir | daftar Tertahan tampil di atas bilah bawah |
| Sudah 3 parkir | tombol Parkir nonaktif + alasan |
| Stok turun saat menahan | pesan "Stok Blus Linen tinggal 1, keranjang ini berisi 2. Ubah jumlah dulu." |

## Ukuran terukur saat wireframe dibuat (360 × 740 px)

| Layar | Tinggi isi | Muat di 740 px? |
| --- | --- | --- |
| Keranjang (2 barang) | 1082 px | Tidak — perlu gulir |
| Pilih Barang (4 kartu) | 862 px | Tidak — perlu gulir |
| Detail Barang | 784 px | Tidak — perlu gulir 44 px |

Gulir itu **wajar** untuk daftar dan keranjang berisi banyak barang. Yang **tidak wajar** adalah
tombol simpan ikut tergulir. Aturan bilah bawah menempel di atas memperbaiki itu dan **wajib diuji
dengan pengukuran nyata pada Phase 2–3**, bukan hanya diasumsikan dari wireframe.

> Catatan: daftar parkir menambah tinggi. Tombol Parkir & Simpan tetap di bilah bawah menempel,
> jadi tetap terjangkau walau daftar parkir panjang (maksimal 3 baris ≈ 78 px).
