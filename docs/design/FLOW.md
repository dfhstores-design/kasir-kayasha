# Kasir Kayesha — Alur Pengguna (Phase 1)

Dokumen ini menjawab satu pertanyaan: **"orang tua yang baru pertama kali pegang aplikasi ini
akan menekan apa, lalu apa yang terjadi?"** Alur ditulis dulu, desain menyusul.

Aturan yang dipakai di semua alur:

- Satu layar = satu tugas utama. Tidak ada dua keputusan besar di satu layar.
- Tombol yang salah tekan tidak merusak data: pembatalan selalu bertanya sekali.
- Tindakan rutin (pilih barang, tambah jumlah) **tidak** diberi konfirmasi.
- Kalau sepanjang alur sesuatu tidak wajib, kolomnya tidak ditampilkan.
- Setiap ujung alur memberi tahu **apa yang terjadi selanjutnya**, bukan hanya "berhasil".

---

## Alur 1 — Menjual barang di pameran (alur terpenting)

Ini alur yang dipakai puluhan kali sehari. Wajib paling pendek.

```
[1] BERANDA
    │  ketuk "Jual Barang"  (tombol oranye besar)
    ▼
[2] PILIH BARANG
    │  grid foto + kolom cari nama
    │  ketuk foto ──→ [2a] DETAIL BARANG (lihat 3 sisi, harga, stok + tombol "Pilih ini")
    │  ketuk tombol "+ Tambah" pada kartu ──→ langsung ke [3] tanpa lewat detail
    ▼
[3] KERANJANG
    │  jumlah, hapus item, diskon per item, diskon total, metode bayar
    │  ketuk "Simpan Transaksi" (tombol besar di bawah)
    ▼
[4] TRANSAKSI TERSIMPAN
    │  pesan jelas "Transaksi #KYS-0012 tersimpan" + ringkasan total
    │  tombol: "Buat Resi" / "Transaksi Baru"
    ▼
[5] RESI (pratinjau PDF)
       tombol "Bagikan" atau "Simpan PDF"
       → kembali ke BERANDA
```

Keputusan alur:

| Hal | Keputusan | Alasan |
| --- | --- | --- |
| Langkah tambah ke keranjang | Tombol **+ Tambah** ada langsung di kartu grid | Hindari satu ketukan ekstra di setiap penjualan; detail hanya bila ingin melihat foto lain |
| Kembali ke katalog setelah simpan | Tidak otomatis; penutup diberi pilihan **Transaksi Baru** | Kalau otomatis kembali, kasir bisa menekan lagi secara refleks dan bingung apakah tadi tersimpan |
| Nomor transaksi | `KYS-0001` berurutan per perangkat | Mudah dibaca dan disebut ke pembeli, berbeda dari UUID internal untuk sync |
| Pembayaran | Metode bayar opsional: **Tunai / Transfer / QRIS** atau dikosongkan | Tidak memaksa data yang tidak selalu ada |
| Transaksi tunai | Kolom "Uang diterima" opsional dengan hitung kembalian | Bantuan nyata untuk uang fisik; dilewati bila tidak diisi |

**Batas stok:** jika stok barang 1 dan kasir menambah 2 → kartu kartu keranjang menampilkan pesan
"Stok tersisa 1" dan tombol tambah dinonaktifkan (tidak ada popup).

---

## Alur 2 — Menambahkan barang baru (dilakukan pemilik di rumah, sebelum pameran)

```
[1] BERANDA ─ ketuk "Barang"
    ▼
[2] DAFTAR BARANG (tabel ringkas: foto, nama, harga, stok)
    │  tombol "Tambah Barang"
    ▼
[3] FORM BARANG
    │  Nama  ·  Harga jual  ·  Stok siap jual
    │  Foto (0–3)  ·  Catatan (opsional)  ·  Kode barang (opsional)
    │  "Simpan Barang"
    ▼
[4] KEMBALI KE DAFTAR BARANG
       barang baru tampil paling atas + pesan "Barang tersimpan"
```

Catatan:

- Kolom opsional berada di bawah tombol **"Isian tidak wajib"** yang bisa dibuka — form awal
  hanya menampilkan tiga kolom penting.
- Foto: maksimal 3. Tombol "Ambil Foto" (kamera) dan "Pilih dari Galeri". Foto pertama otomatis
  menjadi thumbnail. Ganti foto = ketuk foto yang ada → **Ganti** / **Hapus** (dengan konfirmasi).
- Harga dan stok diisi dengan angka; stok boleh 0 (barang bisa tampil dengan label "Habis").

---

## Alur 3 — Mencatat pre-order (PO) dengan DP

```
[1] BERANDA ─ ketuk "Pesanan"
    ▼
[2] DAFTAR PESANAN
    │  tombol "Pesanan Baru"
    ▼
[3] PILIH BARANG (sama seperti Alur 1, langkah 2)
    ▼
[4] FORM PESANAN
    │  Nama pemesan (wajib)
    │  Nomor WhatsApp/telepon (opsional)
    │  Perkiraan tanggal siap (opsional)
    │  Pengiriman: Ambil sendiri / Ongkir ditagih butik / Ongkir ke kurir
    │           → bila dikirim: isi alamat
    │  Catatan (opsional)
    │  DP diterima sekarang: Rp ______ (boleh 0)
    ▼
[5] PESANAN TERSIMPAN
       "Pesanan #KYS-PO-0003 untuk Ibu Sari tersimpan"
       tombol: "Buat Resi PO" / "Kembali ke Daftar Pesanan"
```

Pelunasan kemudian dilakukan dari **detail pesanan**:

```
Daftar Pesanan ─ ketuk pesanan ─ Pesanan #KYS-PO-0003 (detail)
    │  Total Rp 850.000 · Sudah dibayar Rp 300.000 · Sisa Rp 550.000
    │  tombol "Catat Pembayaran"
    ▼
Kotak Pembayaran: Nominal · Tanggal · Metode · Catatan
    │  bila nominal > sisa → pesan "Melebihi sisa tagihan Rp 550.000" (simpan ditahan)
    ▼
Simpan → status berubah menjadi Lunas / DP, riwayat pembayaran bertambah
    → tombol "Ubah Status Pesanan": Diproses / Siap / Selesai / Batalkan
```

---

## Alur 4 — Mengatur usaha (dilakukan sekali di awal)

```
[1] BERANDA ─ ketuk "Pengaturan"
    ▼
[2] PENGATURAN (daftar pilihan besar, bukan tab kecil)
    │  Nama & kontak butik
    │  Logo resi
    │  Rekening tujuan
    │  Teks penutup resi
    │  Kunci menu (PIN) dan cadangan
    ▼
[3] FORM yang dipilih → Simpan → kembali ke Pengaturan
    │  "Lihat contoh resi" menampilkan pratinjau resi dengan data yang sedang dipakai
```

---

## Alur 5 — Pembatalan transaksi
```
Riwayat ─ ketuk transaksi ─ Detail transaksi
    │  tombol "Batalkan Transaksi" (warna netral, bukan merah menyala)
    ▼
Konfirmasi: "Batalkan transaksi #KYS-0012? Stok akan kembali seperti semula."
    │  "Ya, batalkan"  /  "Tidak"
    ▼
Transaksi diberi garis miring + label "Dibatalkan"; stok pulih; riwayat pembayaran tetap tampil
```

Aturan: pembatalan **tidak menghapus** transaksi maupun pembayaran. PO yang dibatalkan juga
menyimpan riwayat DP-nya.

---

## Aturan navigasi bersama

| Situasi | Perilaku |
| --- | --- |
| Tombol kembali | Selalu ada di kiri atas, berlabel "Kembali" (bukan hanya ikon) |
| Keranjang belum kosong saat keluar | Bertanya sekali: "Barang di keranjang belum disimpan. Mau kembali?" |
| Data sedang disimpan | Tombol simpan dinonaktifkan dan berubah teks menjadi "Menyimpan…" — mencegah transaksi ganda |
| Pesan berhasil/gagal | Menggantikan posisi panel, tidak hilang sendiri, ditutup dengan tombol "Mengerti" |
| Status internet | Satu kalimat kecil di beranda: *Tersimpan di perangkat* / *Menunggu internet* / *Tersinkron* |
| Menu admin | Beranda hanya menampilkan 4 tombol tujuan utama; pengaturan di bawah, terpisah garis |

---

# Alur tambahan — Bazar, Parkir, Jenis & Status Transaksi

Ditambahkan 10 November 2026. Rincian teknis: [`BAZAR-PARKIR-RESI.md`](BAZAR-PARKIR-RESI.md).

## Alur 6 — Memarkir transaksi lalu melayani pembeli lain

```
[1] KERANJANG (pembeli A, barang sudah dipilih)
    │  isi "Nama pembeli: Bu Dewi"
    │  ketuk "Parkir"
    ▼
[2] Keranjang kosong; Bu Dewi muncul di daftar "Tertahan (1 dari 3)"
    │  kasir melayani pembeli B → Pilih Barang → Keranjang → Simpan
    ▼
[3] Selesai pembeli B, kembali ke Keranjang
    │  ketuk baris "Bu Dewi · 2 barang · Rp 400.000"
    ▼
[4] Keranjang Bu Dewi dimuat ulang
    │  sistem memeriksa ulang saldo bazar
    │  bila cukup → Simpan
    │  bila tidak → pesan, ubah jumlah, isi tidak hilang
    ▼
[5] Parkir Bu Dewi hilang dari daftar Tertahan
```

Keputusan:

| Hal | Keputusan | Alasan |
| --- | --- | --- |
| Nama pembeli | **Wajib** saat parkir | Pemilik memintanya agar yakin mana yang dilanjutkan |
| Batas parkir | **3** | Permintaan pemilik; lebih dari itu layar jadi penuh |
| Stok saat parkir | **Tidak** dikurangi | Stok hanya berkurang saat transaksi benar-benar disimpan |
| Parkir saat keranjang berisi | Bertanya sekali sebelum berpindah | Mencegah keranjang lain hilang tanpa sadar |
| Memberi nomor antrean | Tidak | Nama lebih mudah diingat daripada angka |

## Alur 7 — Menyiapkan bazar

```
Barang → Bazar → "+ Buka Bazar"
    │  nama bazar (wajib), tanggal mulai/selesai (opsional)
    ▼
Atur Barang Bazar
    │  tiap barang: "Bawa ke bazar" (maks = stok gudang)
    │  Simpan → saldo bazar bertambah, stok gudang berkurang
    ▼
Beranda menampilkan kartu "Bazar aktif: Pameran Mall Kelapa Gading"
```

## Alur 8 — Menutup bazar

```
Beranda → kartu bazar → "Tutup Bazar"
    │  ringkasan: terjual / dibawa / sisa
    │  tiap barang: "Kembalikan ke gudang" (bawaan = sisa)
    ▼
"Tutup Bazar" → konfirmasi
    ▼
Stok gudang bertambah sesuai yang dikembalikan;
bazar pindah ke daftar selesai dan tidak bisa dibuka lagi
```

## Alur 9 — Menyimpan dengan status Belum dibayar

```
Keranjang → Jenis transaksi: Tunai / Transfer / QRIS
         → Status bayar: Lunas / DP / Belum dibayar
         → bila DP/Belum dibayar: "Dibayar sekarang" (boleh 0)
         → Simpan
Keranjang tertahan hilang; transaksi muncul di Riwayat dengan label status.
Pelunasan dicatat dari detail transaksi (Alur 3 versi penjualan biasa).
```

Catatan: status **belum dibayar** berlaku untuk penjualan biasa, bukan hanya PO. Contoh resi
pemilik menunjukkan hal yang sama (`Belum Dibayar` pada penjualan barang).

