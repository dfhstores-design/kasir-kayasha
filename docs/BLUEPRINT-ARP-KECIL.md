# Blueprint — Pondasi Menuju ERP Kecil (Kasir KAYESA)

**Untuk:** Andri
**Tanggal:** 14 November 2026
**Status:** rancangan arsitektur. **Belum ada kode yang diubah.** Ini peta, bukan perintah eksekusi.
**Acuan:** `PROJECT-BRIEF.md` (PRD awal), `src/db/schema.ts`, `db/schema.sql`, `src/lib/*`,
`src/sync/*`, `SPESIFIKASI-TAHAP-1.md`, `CATATAN-DISKUSI.md`.

---

## 0. Baca dulu — satu paragraf posisi

Tujuan Anda: aplikasi kasir yang sekarang berjalan (offline-first, satu perangkat) harus bisa
tumbuh menjadi **ERP kecil** — kasir, produksi, stok, keuangan, pelanggan — tanpa merombak
ulang. Jawaban pendeknya: **pondasi sudah benar arahnya**, dan yang harus dijaga bukan
menambah tabel, melainkan **menjaga satu asas** yang sudah tertanam di kode: *"setiap catatan
keuangan adalah transaksi; barang dan jasa hanyalah jenis barisnya."* Blueprint ini mengunci
asas itu, supaya tiap tahap baru menambah modul tanpa mengubah yang sudah jalan.

---

## 1. Apa yang sudah kuat (jangan dirombak)

| Aset | Lokasi | Kenapa jadi pondasi |
| --- | --- | --- |
| **Satu sumber kebenaran uang** | `src/lib/money.ts`, `keranjang.ts` | Integer Rupiah, rumus `subtotal → diskon → total → sisa` sudah murni & teruji |
| **Snapshot di transaksi** | `src/lib/penjualan.ts`, `schema.ts` | Nama/harga/rekening/sapaan disalin saat transaksi — riwayat tidak berubah saat katalog diedit |
| **Idempotensi & offline-first** | `src/sync/`, `db/repositori.ts` | UUID dibuat di perangkat, antrean outbox, retry tidak menggandakan |
| **Pemisahan logika murni vs DB** | `src/lib/*` vs `src/db/*` | Fungsi hitung tidak menyentuh IndexedDB; mudah dipindah ke modul baru |
| **Skema IndexedDB terstruktur** | `src/db/schema.ts` | 11 store jelas, semua data bisnis di IndexedDB (bukan localStorage) |
| **Salinan cloud D1** | `db/schema.sql` | D1 = salinan, bukan sumber kebenaran — asas yang benar untuk offline-first |

**Kesimpulan:** tidak perlu rewrite. Yang perlu adalah **satu keputusan penataan** (bagian 3)
dan beberapa "sayatan" kecil yang membuka ruang bagi modul masa depan (bagian 4).

---

## 2. Titik rapuh yang wajib dibereskan SEBELUM menambah modul

| # | Rapuh | Lokasi | Risiko jika dibiarkan |
| --- | --- | --- | --- |
| R-1 | `jenis` transaksi cuma dua: `"langsung" \| "po"` | `schema.ts:158`, `schema.sql:20` | Tahap 1 (jasa jahit) butuh jenis ketiga. Kalau ditambah secara ad-hoc, tiap modul baru (produksi, penerimaan) akan menambah enum lagi → `jenis` jadi kode spaghetti |
| R-2 | Tidak ada konsep **"kontrak/order yang berumur panjang"** terpisah dari transaksi | `schema.ts` | DP/pelunasan jahit bisa berjarak 2–3 bulan (dari transkrip). Menyatu di `transactions` membuat riwayat pembayaran bercampur status pesanan |
| R-3 | `payments` menempel ke transaksi, tapi **tidak ada buku besar (ledger)** | `schema.ts:197` | Tahap 4 (buku kas) butuh melihat *semua* uang masuk/keluar. Tanpa ledger, tiap laporan keuangan harus gabung 3 sumber berbeda |
| R-4 | Snapshoot `jenis` di kiriman sync masih `"langsung" \| "po"` | `sync/logika.ts:20` | Begitu jenis baru ditambahkan, validasi sync ikut berubah — mudah lupa sinkron |
| R-5 | `outbox` hanya mencatat `jenisRecord` 4 macam, tanpa versi skema | `schema.ts:226` | Migrasi skema di kemudian hari tidak punya penanda versi — retry kiriman lama bisa bentrok dengan skema baru |
| R-6 | Nama DB internal masih `"kasir-KAYESA"` | `schema.ts:33` | Sudah didokumentasikan alasannya (aman). Jangan diganti tanpa migrasi — sebut di sini sebagai *jangan lupa*, bukan *harus ganti sekarang* |

---

## 3. Keputusan penataan inti — "satu model transaksi, banyak jenis"

Ini jantung blueprint. Alih-alih menambah tabel baru per modul, **pakailah satu model transaksi
yang diperluas ke arah yang benar**.

### 3.1 Asas satu baris

> **Setiap aliran uang dan setiap pergerakan barang adalah satu "dokumen".**
> Dokumen punya **jenis** (`jenisDokumen`) dan **arah** (barang masuk / keluar / tak mengubah stok).
> Barang jadi, jasa, dan uang hanyalah **baris dokumen** dengan sifat beda.

Contoh konkret yang sudah ada dan yang akan datang:

| Dokumen | Jenis | Arah stok | Sudah/target |
| --- | --- | --- | --- |
| Penjualan barang jadi | `penjualan` | keluar | sudah (jenis `langsung`) |
| Pre-order / pesanan jahit | `pesanan` | jasa → tidak mengurangi stok | sebagian (`po`) |
| **Pesanan jasa jahit** (Tahap 1) | `jasa` | tidak mengurangi stok | **target Tahap 1** |
| Penerimaan produksi (KC1 selesai) | `produksi_masuk` | masuk | Tahap produksi |
| Transfer gudang → bazar | `transfer` | keluar gudang + masuk bazar | sudah (alokasi bazar) |
| Stock opname selisih | `penyesuaian` | selisih | Tahap 3 |
| Pengeluaran (beli bahan) | `pengeluaran` | tidak (biaya) | Tahap 4 |

### 3.2 Yang saya sarankan untuk diubah sekarang (murah, membuka jalan)

1. **Ganti `jenis` menjadi `jenisDokumen`** dengan daftar yang bisa tumbuh, tapi pakai
   **string union tertutup + versi**, bukan enum terbuka. Tambah `"jasa"` sekarang.
2. **Tambahkan kolom `arahStok`** pada dokumen: `"keluar" | "masuk" | "tidak_ada"`.
   Ini menggantikan aturan "jasa tidak mengurangi stok" yang sekarang cuma jadi komentar.
3. **Pisahkan `klien` dari dokumen** — sudah ada `namaPemesan` + `kontak` di transaksi,
   tapi untuk CRM nanti perlu `pelanggan` sebagai entitas. Jangan buat tabel sekarang;
   cukup **cadangkan nama kolom** `pelangganId` supaya migrasi nanti mulus.

### 3.3 Yang TIDAK saya sarankan sekarang

- **Jangan membuat mikroservice / refactor besar-besaran.** Ini aplikasi satu perangkat +
  satu salinan cloud. Arsitektur berlapis (lib→db→ui) sudah cukup.
- **Jangan memakai ORM atau framework state management baru.** `idb` + fungsi murni sudah
  tepat untuk skala ini. Menambah boilerplate justru menambah risiko tanpa manfaat ERP kecil.
- **Jangan memindahkan sumber kebenaran ke server.** Offline-first adalah nilai jual utama
  dan sudah teruji PASS di iPhone. ERP kecil di sini artinya *banyak modul lokal*, bukan
  *sistem client-server multi-user*. Role/multi-user itu Tahap 2 — dan itu sendiri nanti
  masih bernuansa "perangkat tetap otoritatif, sync dua arah".

---

## 4. Roadmap modul — urutan yang disarankan (dengan alasan teknis)

Urutan di bawah **bukan** menambah fase baru seenaknya; ini memetakan kembali fase yang sudah
ada di `PROJECT-BRIEF` ke tujuan "ERP kecil", plus satu-dua penyisipan yang diperlukan.

| Urutan | Modul | Mengapa urutan ini | Titik sentuh kode |
| --- | --- | --- | --- |
| **M0** | Pemantapan fondasi akuntansi: `jenisDokumen` + `arahStok` + `ledger` minimal | Paling murah, membuka semua modul berikut | `schema.ts`, `schema.sql`, `sync/logika.ts`, `penjualan.ts` |
| **Tahap 1** | Jasa jahit + dokumen (PNG/PDF) | Sesuai kesepakatan K-19/K-21 | jenis `"jasa"`, `pdfResi.ts` → `dokumen.ts` |
| **Tahap 2** | Role kasir/admin/owner + sync dua arah | Butuh M0 dulu supaya role bisa lihat ledger yang benar | `peran.ts`, `sync/mesin.ts` |
| **Tahap 3** | Stok multi-lokasi + transfer + opname | `arangStok` M0 sudah menyiapkan | `stok.ts`, `sumberStok.ts`, `bazar.ts` |
| **Tahap 4** | Buku kas (pemasukan/pengeluaran, uang usaha vs pribadi) | `ledger` M0 di sini dipakai penuh | `lib/bukuKas.ts` baru |
| **Tahap 5** | HPP global bulanan (metode dari transkrip Tante) | Butuh ledger + penerimaan produksi | `lib/hpp.ts` baru |
| **Tahap 6** | CRM (pelanggan, pengingat manual) | Butuh `pelangganId` yang dicadangkan di M0 | `lib/pelanggan.ts` baru |

**Catatan nilai jual:** susunan ini membuat tiap tahap yang Anda jual ke Tante *sungguh-sungguh
menumpuk di atas yang lalu*, bukan menambal. Itu persis janji "satu sistem terintegrasi" di
K-07/K-18.

---

## 5. Ledger (buku besar) — inti ERP kecil, dijabarkan

Ini modul yang paling menentukan apakah aplikasi jadi "ERP kecil" atau sekadar "kasir plus".

### 5.1 Kenapa harus ada ledger

Sekarang: pemasukan tersebar di `payments` (menempel ke transaksi), pengeluaran cuma ada di
`bazar_biaya` (khusus bazar). Untuk laporan "uang masuk vs keluar" Anda harus menggabungkan
minimal 2 sumber, dan itu rawan salah hitung.

### 5.2 Bentuk minimal (tidak over-engineer)

Satu tabel `journal` (jurnal):

```
journal {
  id          UUID
  arah        "masuk" | "keluar"
  kategori    "penjualan" | "dp" | "pelunasan" | "biaya_bahan" | "upah" | "listrik" | ...
  nominal     integer Rupiah   (selalu > 0)
  waktu       ISO
  dokumenId   UUID | null      (penunjuk ke transaksi/jasa, agar bisa ditelusuri balik)
  bukti       "aset" | "kas"   (pemisahan uang usaha vs pribadi datang dari kategori, bukan kolom ini)
  catatan     string | null
}
```

**Asas penting:** jurnal adalah **turunan** yang dieurokan dari dokumen. Sumber kebenaran tetap
dokumen (transaksi/jasa). Jurnal dihitung (recompute), bukan ditulis manual dua kali — ini
mencegah "dua kebenaran" yang sudah Anda tekankan sejak K-01.

### 5.3 Pemisahan uang usaha vs pribadi (Tahap 4, dari transkrip Tante)

Tante bilang *"uang pribadi uang ini belum bisa menyusun"*. Solusi paling sederhana dan jujur:
**label kategori**, bukan dua database. Tiap catatan keuangan diberi `pemilik: "usaha" | "pribadi"`.
Laporan tinggal filter. Ini sederhana untuk Tante (>62 th) dan tidak butuh akuntansi ganda.

---

## 6. Risiko yang harus Anda ketahui sebelum mengubah apa pun

| # | Risiko | Dampak | Sikap |
| --- | --- | --- | --- |
| B-1 | **Mengubah `schema.ts` tanpa migrasi** | Data pemilik (sudah ada di iPhone) hilang/duplikat | Wajib `DB_VERSION` naik + `upgrade()` memindahkan data; `DB_NAME` lampau jangan diganti |
| B-2 | **Menambah enum `jenis` tanpa memperbarui `sync/logika.ts`** | Kiriman lama/baru saling menolak | Jadikan `jenisDokumen` satu sumber union, validasi sync memakainya |
| B-3 | **Ledger dihitung manual dua kali** | Saldo laporan beda dari total transaksi | Ledger selalu hasil recompute dari dokumen, tidak pernah input bebas |
| B-4 | **Terlalu cepat membangun multi-user** | Melanggar "satu perangkat" yang masih berlaku & teruji | Role tersinkron = Tahap 2, dan tetap offline-authoritative |
| B-5 | **HPP rinci per potong** | Tante sendiri bilang "rumit… nggak kebayang" | Ikuti metode Tante: HPP global bulanan → dibagi per batch |

---

## 7. Rekomendasi langkah pertama (setelah Anda setuju arah ini)

Urutan eksekusi yang saya yakin benar, satu per satu:

1. **Setujui dulu** asas bagian 3 (satu model dokumen, banyak jenis) + bentuk ledger bagian 5.
   Ini dua keputusan arsitektur; sisanya tinggal eksekusi.
2. **Kerjakan M0** (pemantapan fondasi) sebagai fondasi Tahap 1 — bukan sebagai proyek terpisah.
   M0 kecil: `jenisDokumen` + `arahStok` + kerangka `journal` (bisa ditunda isi bila terlalu besar).
3. **Masuk Tahap 1** (jasa jahit + dokumen) di atas M0, persis sesuai `SPESIFIKASI-TAHAP-1.md`.
4. Setiap fase → catatan historis baru di `docs/project-history/`, salin ke Drive, berhenti.

**Yang TIDAK saya kerjakan tanpa perintah eksplisit:** apa pun yang menyentuh kode. Dokumen ini
murni saran arsitektur.

---

## 8. Ruang kosong yang menunggu keputusan Anda

| # | Keputusan | Kenapa penting | Status |
| --- | --- | --- | --- |
| BU-01 | Setujukah asas "satu model dokumen, banyak jenis" (bagian 3)? | Menentukan apakah seluruh blueprint ini dipakai | diputuskan (setuju) |
| BU-02 | Setujukah bentuk ledger minimal (bagian 5)? | Menentukan Tahap 4 bisa murni turunan, bukan bangun ulang | diputuskan (setuju, dgn catatan) |
| BU-03 | Apakah M0 dikerjakan menyatu dengan Tahap 1, atau terpisah dulu? | Menentukan urutan commit & migrasi `DB_VERSION` | diputuskan (terpisah dulu) |
| BU-04 | Nama `jenisDokumen`: bahasa Indonesia (`jenisDokumen`) atau Inggris (`docType`) dikonvensi kode? | Konsistensi dengan kode lama (`jenis`, `statusBayar`, `namaPemesan`) | diputuskan (bahasa Indonesia) |
| BU-05 | Pemisahan uang usaha/pribadi: label `pemilik` cukup, atau perlu kategori terpisah sejak awal? | Menentukan bentuk `journal` di M0 | diputuskan (dua kolom `pemilik` + `sumber`) |
| BU-06 | Kategori jurnal: daftar tertutup atau boleh isi sendiri? | Menentukan bentuk `kategori` pada `journal` | diputuskan (deklaratif + isi sendiri) |
| BU-07 | Skema sumber dana & pemakaian uang usaha:pribadi | Menentukan kolom `pemilik` vs `sumber` pada `journal` | diputuskan (dua kolom `pemilik` + `sumber`) |
| BU-08 | Apa yang dicatat di jurnal & batas jurnal manual | Menjamin akurasi kas (anti dobel-hit, piutang tak dihitung kas) | diputuskan (uang bergerak + batas manual) |
| BU-09 | Pengaman anti-dobel & pengingat akurasi (user manula) | Melindungi Tante dari dobel-input & salah ketik | diputuskan (tutup-kas → Tahap 4; deteksi dobel + peringatan wajar → sejak awal) |
| BU-10 | Pembagian peran & perangkat (kasir vs pencatatan) | Menentukan struktur UI & kebutuhan role/sync dua arah | diputuskan (dua peran, bisa beda orang & perangkat; Tante fokus pengeluaran/belanja) |
| BU-11 | Kapan role + sync dua arah hadir & bagaimana pembukaannya | Menentukan roadmap & mekanisme unlock fitur per tahap | diputuskan (ditarik maju, tersembunyi di balik layar; unlock per tahap setelah harga/termin disepakati) |
| BU-12 | Cakupan Tahap 1 yang dijanjikan (Rp 7jt) | Menetapkan fitur yang pertama dilihat & dipakai Tante | diputuskan (pesanan jahit + uang masuk + dokumen PNG; tanpa stok/kasir/laporan/buku kas/pencatatan pengeluaran) |
| BU-13 | Struktur pesanan jahit (satu dokumen vs banyak transaksi) | Menentukan model data Tahap 1 | diputuskan (satu dokumen + banyak baris pembayaran bertahap) |
| BU-14 | Field wajib/opsional pesanan jahit | Menentukan isi form & dokumen | diputuskan (namaPemesan/model/biayaJasa wajib; kontak, ukuran, perkiraanSelesai, catatan opsional) |
| BU-15 | Struktur biaya (satu baris vs multi-baris) | Menentukan cara hitung total dokumen | diputuskan (biaya jasa + opsi biaya lain manual yang tersimpan) |
| BU-16 | Rekening tampil di dokumen | Menentukan isi invoice & resi | diputuskan (selalu tampil) |
| BU-17 | Aturan sisa tagihan, kembalian, dan void | Menentukan logika hitung & integritas riwayat | diputuskan (judul otomatis + pilihan cetak; boleh bayar lebih + kembalian; void beralasan & riwayat terlihat di kasir) |
| BU-18 | Pintu pemasukan tunggal (antar-muka kasir) | Menyatukan alur jual-barang & terima-pembayaran-pesanan | diputuskan (satu pintu kasir; kembalian berlaku di kedua alur) |
| BU-19 | Penomoran dokumen (`NO:`) | Menentukan format nomor yang dicetak/ditampilkan | pending (menunggu konfirmasi Tante; kode `KC` wajib di invoice) |
| BU-20 | Status dokumen & pemisahan daftar | Menentukan daftar "belum lunas" vs "riwayat" | diputuskan (terbuka / lunas / batal) |
| BU-21 | Arti kode `KC` (invoice vs kode model) | Menentukan apakah `KC` nomor dokumen atau elemen lain | hipotesis (`KC` = skema nomor invoice, contoh `KC-YYYYMMDD`; menunggu contoh nota terisi) |
| BU-22 | Alur input pesanan (wizard, siapa yang input) | Menentukan pengalaman input Tante & peran kasir | sementara (A setuju wizard; B kasir boleh buat pesanan; C urutan konfirmasi ulang; draft WA disiapkan) |
| BU-23 | Alur pembayaran di kasir | Menentukan cara terima DP/pelunasan & kembalian | diputuskan (metode pembayaran + satu baris payment + alur 3 langkah) |
| BU-24 | Dua tombol/alur kasir (Pesanan vs Penjualan) | Menyatukan dua arah stok di kasir | diputuskan (Pesanan=jasa; Penjualan=stok, di-unlock di tahap stok) |
| BU-25 | Susunan dokumen PNG (ejaan, kotak, ukuran font) | Menentukan template PNG invoice/resi | diputuskan (nama "KAYESA"; kaki ikut faktur lama sementara; ukuran font dokumen FIX, bukan mengikuti setelan UI) |
| BU-26 | Tombol "Bagikan" & "Simpan ke Foto" | Menentukan cara kirim PNG & arsip | diputuskan (share sheet native + simpan ke foto + invoice untuk menagih; PDF cadangan tetap) |
| BU-27 | Riwayat pengiriman dokumen (ke siapa, kapan) | Menentukan pelacakan "siapa sudah dikirimi" | diputuskan (wajib ada log pengiriman per pelanggan) |
| BU-28 | Struktur log pengiriman & penanaman `pelangganId` | Menentukan bentuk data riwayat kirim | diputuskan (tanam `pelangganId` dini; log Opsi 2 ke `pelangganId`; tanda ✓ per baris) |
| BU-29 | Tampilan daftar pesanan | Memudahkan Tante melihat sisa pembayaran dan membuka detail pesanan | diputuskan (dua tab besar "Belum Lunas" dan "Riwayat"; Belum Lunas terbuka pertama; kartu besar berisi nama, jenis jahitan, sisa pembayaran, status dokumen yang pernah dibagikan; ketuk untuk detail; Riwayat menampilkan lunas/batal dengan label status) |
| BU-30 | Pengingat tagihan (daftar vs notifikasi) | Menolong Tante tidak lupa menagih | diputuskan (Opsi A: daftar "perlu ditagih" tanpa notifikasi otomatis dulu) |
| BU-31 | Penyimpanan data & sinkronisasi (Sheet vs lokal) | Menentukan penyimpanan transaksi & offline/online | diputuskan (offline-first IndexedDB + D1; Sheet hanya impor stok awal; online bila jaringan memadai; kasir kirim ke jurnal online) |
| BU-32 | Pengaturan ukuran font & tema UI (aktivasi sekarang) | Menentukan kemampuan personalisasi Tante | diputuskan (Tante atur sendiri; hanya UI, dokumen tetap fix) |

---

*Dokumen ini ditulis berdasar pembacaan penuh PRD awal + kode terkini pada commit `8095458`.
Tidak ada satu baris kode pun yang berubah.*