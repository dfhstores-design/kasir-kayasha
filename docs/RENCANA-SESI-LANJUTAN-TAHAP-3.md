# Rencana Sesi — Pembahasan Lanjutan s/d Tahap 3

**Status:** prompt acuan untuk agent penerus (bukan kode, bukan keputusan baru).
**Dibuat:** 16 November 2026 (Asia/Jakarta)

Prompt ini untuk **sesi pembahasan (diskusi)**, BUKAN sesi coding. Lanjutan dari sesi perancangan
yang sudah menuntaskan BU-01 … BU-31. Tujuan: membahas desain sampai **Tahap 3** (stok multi-lokasi
+ transfer + opname), tetap satu per satu, tanpa ngoding.

---

## Instruksi untuk agent penerus (salin sebagai prompt)

> Kamu melanjutkan **diskusi perancangan** aplikasi Kasir KAYESA'S CLOTHING (ERP kecil), khusus
> membahas sampai **Tahap 3** (stok multi-lokasi + transfer + opname).
>
> Baca dulu, urut, dan penuh:
> 1. `git/docs/BLUEPRINT-ARP-KECIL.md`
> 2. `git/docs/CATATAN-DISKUSI.md`
> 3. `git/docs/SPESIFIKASI-DESAIN-TAHAP-1.md`
>
> **Aturan (wajib):**
> - JANGAN ngoding; murni diskusi/perancangan.
> - JANGAN tanya ulang keputusan yang sudah ada (K-01…K-22, BU-01…BU-31). Baca tabelnya dulu.
> - Bahas SATU keputusan per giliran, jangan menumpuk.
> - Setiap keputusan Andri dicatat sebagai **BU-xx baru** (lanjut dari BU-31) di `CATATAN-DISKUSI.md`,
>   dan statusnya diisi di tabel blueprint bagian 8.
> - PRINSIP WAJIB: **simplicity UI/UX** (uji: "apakah Tante >62 th cukup melihat & mengetuk tanpa bingung?").
> - NAMA WAJIB: hanya **KAYESA** dan **KAYESA'S CLOTHING**. Ejaan lain dilarang.
> - Jangan sentuh file `project-history/*` (immutable).
>
> **Titik lanjut:** sesi sebelumnya selesai di akhir desain Tahap 1. Yang masih pending (JANGAN dipaksa
> putus tanpa input): BU-19 (penomoran), BU-21 (kode KC), BU-22 (alur input) — semua menunggu balasan Tante.
>
> **Fokus sesi ini:** rancang **Tahap 2** (role kasir/admin/owner + sync dua arah) dan **Tahap 3**
> (stok multi-lokasi + transfer + opname) di atas fondasi yang sudah ada. Mulai dari Tahap 2.

---

## Hal-hal yang menjadi pegangan (jangan diulang)

- Asas fondasi: BU-01 (satu dokumen banyak jenis), BU-02 (jurnal turunan), BU-03 (M0 terpisah), BU-04 (bahasa Indonesia).
- Keuangan: BU-05/BU-07 (`pemilik`+`sumber`), BU-06 (kategori), BU-08 (jurnal hanya uang bergerak).
- Peran & sync: BU-10 (dua peran beda perangkat), BU-11 (sync tersembunyi + unlock per tahap), BU-31 (offline-first; Sheet hanya impor stok awal).
- Tahap 3 menyentuh: `arahStok` (masuk/keluar/tidak_ada) dari BU-01, jenis dokumen `produksi_masuk`, `transfer`, `penyesuaian` (lihat blueprint §3.1).