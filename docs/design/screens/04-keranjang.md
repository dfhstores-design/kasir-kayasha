# Layar 4 — Keranjang

**Tugas utama:** memeriksa barang dan uang **sebelum** menyimpan transaksi.

```
┌──────────────────────────────────────┐
│  ‹ Kembali     Keranjang             │
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
│  Metode bayar                        │
│  [ Tunai ] [ Transfer ] [ QRIS ]     │  ← pilih satu, opsional
│                                      │
│  TOTAL                 Rp 560.000    │  ← 34 px tebal
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │       Simpan Transaksi         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Isi & perilaku

| Bagian | Perilaku |
| --- | --- |
| Blok barang | Nama, "jumlah × harga", subtotal baris, tombol − / + dan **Hapus** |
| − / + | Mengubah jumlah; batas atas = stok. Bisa dihapus sampai 0 = hapus baris (konfirmasi) |
| Diskon per buah | Nominal Rupiah per unit; batas = harga satuan |
| Subtotal | `Σ harga × jumlah` |
| Diskon barang | `Σ diskon per unit × jumlah` |
| Diskon total | Nominal untuk seluruh transaksi; batas = setelah diskon barang |
| Metode bayar | Tunai / Transfer / QRIS — opsional, boleh kosong |
| **TOTAL** | Angka terbesar di layar |
| Simpan Transaksi | Nonaktif bila keranjang kosong atau ada isian tidak valid |

## Aturan

- **Bilah bawah menempel (sticky)**: TOTAL + tombol "Simpan Transaksi" selalu terlihat, tidak ikut
  tergulir. Kasir tidak boleh mencari tombol simpan.
- **Total dipindah ke bilah bawah.** Rincian angka (Subtotal · Diskon barang · Setelah diskon ·
  Diskon total) tetap di area gulir; angka **TOTAL** 28 px tebal ada di bilah bawah.
  Dengan begitu layar tetap masuk akal walau berisi 5 barang.
- Urutan gulir: barang 1…n → rincian angka → metode bayar → *(bilah bawah: TOTAL + Simpan)*.
- Diskon per buah lebih besar dari harga → pesan di bawah kolom:
  **"Maksimal Rp 180.000"**; tombol simpan dinonaktifkan.
- Diskon total lebih besar dari setelah diskon barang → **"Maksimal Rp 560.000"**.
- Total tidak boleh negatif: dikunci oleh dua aturan di atas.
- Uang ditampilkan integer Rupiah; tidak ada pecahan.
- Kolom uang memakai pemisah ribuan otomatis saat diketik (`10000` → `10.000`).
- Ketika tombol Simpan ditekan: tombol berubah menjadi **"Menyimpan…"** dan dinonaktifkan,
  mencegah transaksi ganda.
- Ongkir **tidak ada** di keranjang barang siap jual (ambil di butik). Ongkir hanya di alur PO.

## Keadaan

| Keadaan | Tampilan |
| --- | --- |
| Normal | seperti gambar |
| Keranjang kosong | "Keranjang belum ada barang." + tombol "Pilih Barang" |
| Diskon melebihi batas | pesan merah marun di bawah kolom, tombol simpan nonaktif |
| Barang dihapus | baris hilang, total langsung dihitung ulang |

## Ukuran terukur saat wireframe dibuat (360 × 740 px)

| Layar | Tinggi isi | Muat di 740 px? |
| --- | --- | --- |
| Keranjang (2 barang) | 1082 px | Tidak — perlu gulir |
| Pilih Barang (4 kartu) | 862 px | Tidak — perlu gulir |
| Detail Barang | 784 px | Tidak — perlu gulir 44 px |

Gulir itu **wajar** untuk daftar dan keranjang berisi banyak barang. Yang **tidak wajar** adalah
tombol simpan ikut tergulir. Aturan bilah bawah menempel di atas memperbaiki itu dan **wajib diuji
dengan pengukuran nyata pada Phase 2–3**, bukan hanya diasumsikan dari wireframe.
