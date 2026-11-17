/**
 * Susunan resi sebagai data murni — sumber kebenaran tampilan & PDF.
 *
 * Mengikuti contoh resi yang dibahas Andri (mockup nota v8 / resi v9 / resi
 * bazar v4, 15 Nov 2026) dan docs/design/screens/06-resi.md:
 *   kop (logo + nama butik + nama lengkap + alamat + WA) → lencana contoh →
 *   judul dokumen (RESI / INVOICE) + subjudul → lencana status →
 *   kotak kode transaksi → info (2 kolom) → rincian → total →
 *   pembayaran per baris → kotak sorot (kembalian / total diterima / sisa) →
 *   kotak rekening → kotak peringatan → Hormat Kami → kalimat penutup
 *
 * Karena berupa baris terstruktur (bukan sekadar HTML), susunan yang SAMA dipakai
 * untuk pratinjau di layar dan untuk halaman PDF. Tidak ada dua kebenaran.
 *
 * CATATAN EJAAN: kop contoh memakai "KAYESYA" (ejaan lama di logo dan kop
 * mockup). Nama resmi yang dikunci Andri adalah KAYESA / KAYESA'S CLOTHING,
 * jadi teks di sini memakai nama dari Pengaturan (KAYESA), bukan KAYESYA.
 * Pertanyaan ejaan kop vs logo masih menunggu Andri/Tante.
 *
 * CATATAN PENUTUP: kalimat penutup di sini mengikuti jenis dokumen contoh
 * ("Terima kasih telah berbelanja di ..." / "... mempercayakan pesanan jahit
 * kepada ..."), bukan field `teksPenutup` di Pengaturan. Field itu masih
 * tersimpan, tapi tidak lagi dicetak di resi — perlu diputuskan Andri apakah
 * field Pengaturan itu dihapus atau dipakai menimpa kalimat ini.
 */
import type { Rupiah } from "./money.ts";
import { formatRupiah, formatRupiahResi, formatRupiahTanpaRp } from "./money.ts";
import { labelOngkirResi, type Ongkir } from "./ongkir.ts";
import type { Sapaan } from "./sapaan.ts";
import { labelStatusBayar, type StatusBayar } from "./keranjang.ts";
import { formatTanggal } from "./tanggal.ts";
import { sapaanDariWaktu } from "./sapaan.ts";
import type { Rekening } from "../db/schema.ts";

/** Baris resi. `align` mengatur posisi: kiri, kanan, atau tengah. */
/** Dipakai HANYA bila pemilik belum mengisi nama butik di Pengaturan. */
export const NAMA_BUTIK_BAWAAN = "KAYESA";

export type BarisResi =
  | { jenis: "logo" }
  | { jenis: "judul"; teks: string }
  | { jenis: "subjudul"; teks: string }
  | { jenis: "teks"; teks: string; tengah?: boolean; kecil?: boolean; tebal?: boolean }
  | { jenis: "garis" }
  | { jenis: "kiriKanan"; kiri: string; kanan: string; tebal?: boolean; kecil?: boolean }
  | { jenis: "total"; kiri: string; kanan: string }
  | {
      jenis: "barang";
      nama: string;
      jumlah: number;
      hargaSatuan: Rupiah;
      subtotal: Rupiah;
      diskonPerUnit?: Rupiah;
      /** Baris kecil di bawah nama, mis. "Barang stok bazar · ukuran M". */
      keterangan?: string;
    }
  | {
      jenis: "rincian";
      label: string;
      keterangan?: string;
      nominal: Rupiah;
    }
  | { jenis: "lencana"; teks: string; varian: "contoh" | "status" }
  | { jenis: "dokumen"; judul: string; subjudul: string }
  | { jenis: "kotak"; judul: string; isi: string[]; sorot?: boolean }
  | {
      jenis: "metaPasangan";
      kiri: { label: string; nilai: string };
      kanan?: { label: string; nilai: string };
    }
  | { jenis: "tandatangan"; nama: string }
  | { jenis: "kosong" };

export interface DataResi {
  nomorResi: string;
  nomorUrutHari: number;
  waktu: string;
  jenis: "langsung" | "po";
  sapaan: Sapaan;
  namaButik: string;
  /** Baris kedua kop, mis. "KAYESA'S CLOTHING". Kosong bila tidak ada. */
  subjudulButik?: string | null;
  alamat: string[];
  telepon: string[];
  logoAda: boolean;
  /** Tampilkan lencana "CONTOH DATA FIKTIF" (hanya untuk pratinjau/contoh). */
  contohFiktif?: boolean;
  /** Nama bazar untuk penjualan langsung, mis. "Bazar Contoh". */
  lokasi?: string | null;
  /** Nama pembeli untuk penjualan langsung; kosong → "Pembeli Umum". */
  pembeli?: string | null;
  /** Label metode bayar terakhir, mis. "Tunai" / "Transfer BCA". */
  metodeBayar?: string | null;
  /** Jenis jahitan pesanan (model Tahap 1 — belum ada di skema transaksi). */
  jenisJahitan?: string | null;
  /** Catatan pesanan dari transaksi (dipakai kotak PERHATIAN). */
  catatanPesanan?: string | null;
  /** Baris rincian di luar barang, mis. jasa jahit + biaya lainnya (pratinjau). */
  rincianTambahan?: Array<{ label: string; keterangan?: string; nominal: Rupiah }>;
  items: Array<{
    nama: string;
    kuantitas: number;
    hargaSatuan: Rupiah;
    diskonPerUnit: Rupiah;
    keterangan?: string;
  }>;
  subtotalAwal: Rupiah;
  diskonItem: Rupiah;
  diskonTotal: Rupiah;
  ongkir: Ongkir;
  total: Rupiah;
  pembayaran: Array<{ waktu: string; nominal: Rupiah; metode: string | null; catatan: string | null }>;
  statusBayar: StatusBayar;
  dibatalkan: boolean;
  perkiraanSiap: string | null;
  namaPemesan: string | null;
  rekening: Rekening[];
  teksPenutup: string;
  /** Sakelar dari Pengaturan. */
  tampilkanSapaan: boolean;
  tampilkanNomorResi: boolean;
  tampilkanRincianDiskon: boolean;
  tampilkanPembayaranSisa: boolean;
}

/**
 * Menyusun baris resi. Aturan:
 * - Logo/judul butik SELALU ada (nama butik menjadi judul bila logo tidak ada).
 * - Dokumen lunas berjudul RESI; pesanan yang belum lunas berjudul INVOICE.
 * - Ongkos kirim hanya tampil bila ada nominalnya atau belum ditentukan.
 * - Rekening SELALU dicetak (kotak), bukan hanya bila ada sisa — contoh
 *   resi lunas pun menampilkan rekening.
 * - Resi dibatalkan diberi penanda jelas.
 * - Baris sapaan "- Sore -" tidak lagi dicetak (tidak ada di contoh).
 */
export function susunResi(d: DataResi): BarisResi[] {
  const b: BarisResi[] = [];
  const nama = (d.namaButik.trim() || NAMA_BUTIK_BAWAAN).toUpperCase();
  const lunas = d.statusBayar === "lunas";
  const invoice = d.jenis === "po" && !lunas && !d.dibatalkan;
  const sudah = d.pembayaran.reduce((n, p) => n + p.nominal, 0);
  const sisa = d.total - sudah;
  const rekening = d.rekening.filter((r) => r.namaBank.trim() && r.nomor.trim());
  const bankUtama = rekening.find((r) => r.utama) ?? rekening[0];

  // --- Kop: logo + nama + nama lengkap + alamat + WA ---
  b.push({ jenis: "logo" });
  b.push({ jenis: "judul", teks: nama });
  if (d.subjudulButik?.trim()) {
    b.push({ jenis: "subjudul", teks: d.subjudulButik.trim().toUpperCase() });
  }
  // Alamat: baris 1 + baris 2 (patokan) digabung satu baris seperti contoh,
  // lalu kota + kode pos di baris berikutnya.
  const alamat = d.alamat.filter((x) => x.trim());
  if (alamat.length >= 2) {
    b.push({ jenis: "teks", teks: `${alamat[0]} (${alamat[1]})`, kecil: true });
    for (const a of alamat.slice(2)) {
      b.push({ jenis: "teks", teks: a, kecil: true });
    }
  } else {
    for (const a of alamat) {
      b.push({ jenis: "teks", teks: a, kecil: true });
    }
  }
  const telepon = d.telepon.filter((x) => x.trim());
  if (telepon.length > 0) {
    b.push({ jenis: "teks", teks: `WA ${telepon.join(" · ")}`, kecil: true });
  }
  b.push({ jenis: "garis" });

  // --- Lencana contoh + judul dokumen + lencana status ---
  if (d.contohFiktif) {
    b.push({ jenis: "lencana", teks: "CONTOH DATA FIKTIF", varian: "contoh" });
  }
  b.push({
    jenis: "dokumen",
    judul: invoice ? "INVOICE" : "RESI",
    subjudul:
      d.jenis === "langsung"
        ? "BUKTI PEMBAYARAN PENJUALAN BARANG"
        : invoice
          ? "NOTA PESANAN JAHIT"
          : "BUKTI PEMBAYARAN PESANAN",
  });
  if (d.dibatalkan) {
    b.push({ jenis: "teks", teks: "*** DIBATALKAN ***", tebal: true, tengah: true });
  } else {
    b.push({ jenis: "lencana", teks: lunas ? "LUNAS" : "BELUM LUNAS", varian: "status" });
  }

  // --- Kotak kode transaksi (nomor masih usulan — BU-19 menunggu Tante) ---
  if (d.tampilkanNomorResi) {
    b.push({ jenis: "kotak", judul: "KODE TRANSAKSI (USULAN)", isi: [d.nomorResi] });
  }

  // --- Info: dua kolom label + nilai ---
  if (d.jenis === "langsung") {
    b.push({
      jenis: "metaPasangan",
      kiri: { label: "TANGGAL RESI", nilai: formatTanggal(d.waktu) },
      kanan: { label: "LOKASI", nilai: d.lokasi?.trim() || "-" },
    });
    b.push({
      jenis: "metaPasangan",
      kiri: { label: "PEMBELI", nilai: d.pembeli?.trim() || "Pembeli Umum" },
      kanan: { label: "METODE BAYAR", nilai: d.metodeBayar?.trim() || "-" },
    });
  } else {
    b.push({
      jenis: "metaPasangan",
      kiri: { label: "PEMESAN", nilai: d.namaPemesan?.trim() || "-" },
      kanan: { label: "TANGGAL PESANAN", nilai: formatTanggal(d.waktu) },
    });
    const siap = d.perkiraanSiap ? formatTanggal(d.perkiraanSiap) : "-";
    if (d.jenisJahitan?.trim()) {
      b.push({
        jenis: "metaPasangan",
        kiri: { label: "JENIS JAHITAN", nilai: d.jenisJahitan.trim() },
        kanan: { label: "PERKIRAAN SELESAI", nilai: siap },
      });
    } else {
      b.push({
        jenis: "metaPasangan",
        kiri: { label: "PERKIRAAN SELESAI", nilai: siap },
      });
    }
  }

  b.push({ jenis: "garis" });

  // --- Rincian ---
  b.push({ jenis: "teks", teks: d.jenis === "langsung" ? "RINCIAN PENJUALAN" : "RINCIAN PESANAN", tebal: true });
  for (const i of d.items) {
    b.push({
      jenis: "barang",
      nama: i.nama,
      jumlah: i.kuantitas,
      hargaSatuan: i.hargaSatuan,
      subtotal: i.hargaSatuan * i.kuantitas,
      ...(d.tampilkanRincianDiskon && i.diskonPerUnit > 0 ? { diskonPerUnit: i.diskonPerUnit } : {}),
      ...(i.keterangan?.trim() ? { keterangan: i.keterangan.trim() } : {}),
    });
  }
  for (const r of d.rincianTambahan ?? []) {
    b.push({
      jenis: "rincian",
      label: r.label,
      ...(r.keterangan?.trim() ? { keterangan: r.keterangan.trim() } : {}),
      nominal: r.nominal,
    });
  }

  const adaDiskonItem = d.tampilkanRincianDiskon && d.diskonItem > 0;
  const adaDiskonTotal = d.tampilkanRincianDiskon && d.diskonTotal > 0;
  if (adaDiskonItem || adaDiskonTotal) {
    if (adaDiskonItem) {
      b.push({ jenis: "kiriKanan", kiri: "Diskon barang", kanan: `-${formatRupiahTanpaRp(d.diskonItem)}`, kecil: true });
    }
    if (adaDiskonTotal) {
      b.push({ jenis: "kiriKanan", kiri: "Diskon total", kanan: `-${formatRupiahTanpaRp(d.diskonTotal)}`, kecil: true });
    }
  }

  // Ongkir hanya bila ada nominalnya atau belum ditentukan (contoh tidak
  // menampilkan baris ongkir bila tidak ada ongkir).
  const ongkirAdaNominal = d.ongkir.nominal !== null && d.ongkir.nominal > 0;
  const ongkirBelumDitentukan = d.ongkir.mode === "belum_ditentukan";
  // Mode kurir tetap ditampilkan walau nominalnya 0: baris itu menjelaskan
  // siapa yang membayar ongkir.
  if (ongkirAdaNominal || ongkirBelumDitentukan || d.ongkir.mode === "kurir") {
    b.push({ jenis: "kiriKanan", kiri: "Ongkos kirim", kanan: labelOngkirResi(d.ongkir) });
  }

  b.push({ jenis: "garis" });
  b.push({
    jenis: "total",
    kiri: d.jenis === "langsung" ? "Total penjualan" : "Total tagihan",
    kanan: formatRupiahResi(d.total),
  });
  if (ongkirBelumDitentukan) {
    b.push({ jenis: "teks", teks: "Total belum termasuk ongkir", kecil: true });
  }
  b.push({ jenis: "garis" });

  // --- Pembayaran per baris + kotak sorot ---
  if (d.tampilkanPembayaranSisa && d.pembayaran.length > 0) {
    b.push({ jenis: "teks", teks: invoice ? "PEMBAYARAN" : "PEMBAYARAN DITERIMA", tebal: true });
    d.pembayaran.forEach((p, i) => {
      const metode = p.metode ? labelMetode(p.metode) : null;
      if (d.jenis === "langsung") {
        b.push({
          jenis: "kiriKanan",
          kiri: metode ? `${metode} diterima` : "Pembayaran diterima",
          kanan: formatRupiahResi(p.nominal),
          kecil: true,
        });
        b.push({
          jenis: "teks",
          teks: `${formatTanggal(p.waktu)} · ${lunas ? "Lunas" : labelStatusBayar(d.statusBayar)}`,
          kecil: true,
        });
      } else if (i === 0) {
        b.push({ jenis: "kiriKanan", kiri: "DP", kanan: formatRupiahResi(p.nominal), kecil: true });
        // Contoh: "12 Nov 2026 · Transfer BCA" — transfer dilengkapi bank utama.
        const metodeLengkap =
          metode === "Transfer" && bankUtama ? `Transfer ${bankUtama.namaBank}` : (metode ?? "-");
        b.push({
          jenis: "teks",
          teks: `${formatTanggal(p.waktu)} · ${metodeLengkap}`,
          kecil: true,
        });
      } else {
        b.push({
          jenis: "kiriKanan",
          kiri: metode ? `Pelunasan · ${metode}` : "Pelunasan",
          kanan: formatRupiahResi(p.nominal),
          kecil: true,
        });
        b.push({ jenis: "teks", teks: `Tanggal Pelunasan — ${formatTanggal(p.waktu)}`, kecil: true });
      }
    });
    if (lunas && d.jenis === "langsung" && sudah > d.total) {
      b.push({ jenis: "kotak", judul: "Kembalian", isi: [formatRupiahResi(sudah - d.total)], sorot: true });
    } else if (lunas && d.jenis === "po") {
      b.push({ jenis: "kotak", judul: "TOTAL PEMBAYARAN DITERIMA", isi: [formatRupiahResi(sudah)], sorot: true });
    } else if (!lunas && sisa > 0) {
      b.push({ jenis: "kotak", judul: "Sisa pembayaran", isi: [formatRupiahResi(sisa)], sorot: true });
    }
  } else if (d.tampilkanPembayaranSisa && !lunas && sisa > 0) {
    b.push({ jenis: "kotak", judul: "Sisa pembayaran", isi: [formatRupiahResi(sisa)], sorot: true });
  }

  // --- Kotak rekening: SELALU tampil (contoh resi lunas pun menampilkannya) ---
  if (rekening.length > 0) {
    const utama = bankUtama;
    if (utama) {
      const isi = [`${utama.namaBank} · ${utama.nomor}`];
      if (utama.namaPemilik.trim()) isi.push(`a.n. ${utama.namaPemilik}`);
      b.push({
        jenis: "kotak",
        judul: invoice ? "PEMBAYARAN MELALUI" : `REKENING ${nama}`,
        isi,
      });
    }
  }

  // --- Kotak peringatan ---
  if (d.jenis === "langsung") {
    b.push({ jenis: "kotak", judul: "PENGINGAT", isi: ["Simpan resi ini sebagai bukti pembayaran."] });
  } else if (d.catatanPesanan?.trim()) {
    b.push({ jenis: "kotak", judul: "PERHATIAN!!!", isi: [`Catatan pesanan: ${d.catatanPesanan.trim()}`] });
  }

  // --- Hormat Kami + kalimat penutup sesuai jenis dokumen ---
  b.push({ jenis: "tandatangan", nama });
  b.push({
    jenis: "teks",
    teks:
      d.jenis === "langsung"
        ? `Terima kasih telah berbelanja di ${nama}.`
        : `Terima kasih telah mempercayakan pesanan jahit kepada ${nama}.`,
    tengah: true,
    kecil: true,
  });

  return b;
}

export function labelMetode(m: string): string {
  switch (m) {
    case "tunai":
      return "Tunai";
    case "transfer":
      return "Transfer";
    case "qris":
      return "QRIS";
    default:
      return m;
  }
}

/** Ringkasan teks untuk pengujian & aksesibilitas pratinjau. */
export function teksResi(baris: readonly BarisResi[]): string {
  return baris
    .map((r) => {
      switch (r.jenis) {
        case "logo":
          return "[logo]";
        case "judul":
          return r.teks;
        case "subjudul":
          return r.teks;
        case "teks":
          return r.teks;
        case "garis":
          return "----";
        case "kiriKanan":
          return `${r.kiri}${r.kanan ? " " + r.kanan : ""}`;
        case "total":
          return `${r.kiri} ${r.kanan}`;
        case "barang":
          return `${r.nama} ${r.jumlah}x ${formatRupiah(r.hargaSatuan)} = ${formatRupiah(r.subtotal)}${r.keterangan ? ` (${r.keterangan})` : ""}`;
        case "rincian":
          return `${r.label} ${formatRupiahResi(r.nominal)}${r.keterangan ? ` (${r.keterangan})` : ""}`;
        case "lencana":
          return r.teks;
        case "dokumen":
          return `${r.judul}\n${r.subjudul}`;
        case "kotak":
          return `${r.judul}\n${r.isi.join("\n")}`;
        case "metaPasangan":
          return `${r.kiri.label} ${r.kiri.nilai}${r.kanan ? ` | ${r.kanan.label} ${r.kanan.nilai}` : ""}`;
        case "tandatangan":
          return `Hormat Kami,\n${r.nama}`;
        case "kosong":
          return "";
      }
    })
    .join("\n");
}

/** Nama berkas aman: hanya huruf, angka, dan tanda hubung. */
/** Data contoh untuk pratinjau di Pengaturan (bukan transaksi nyata). */
export function dataContoh(s: {
  namaButik: string;
  alamatBaris1: string;
  alamatBaris2: string;
  kotaKodePos: string;
  telepon1: string;
  telepon2: string;
  teksPenutup: string;
  logo: unknown;
  rekening: Rekening[];
  tampilkanSapaan: boolean;
  tampilkanNomorResi: boolean;
  tampilkanRincianDiskon: boolean;
  tampilkanPembayaranSisa: boolean;
}, sekarang: Date = new Date()): DataResi {
  const sapaan = sapaanDariWaktu(sekarang);
  return {
    nomorResi: "KYS-CONTOH",
    nomorUrutHari: 1,
    waktu: sekarang.toISOString(),
    jenis: "langsung",
    sapaan,
    namaButik: s.namaButik.trim() || NAMA_BUTIK_BAWAAN,
    subjudulButik: subjudulDariNama(s.namaButik.trim() || NAMA_BUTIK_BAWAAN),
    alamat: [s.alamatBaris1, s.alamatBaris2, s.kotaKodePos].filter((x) => x.trim()),
    telepon: [s.telepon1, s.telepon2].filter((x) => x.trim()),
    logoAda: !!s.logo,
    contohFiktif: true,
    lokasi: "Bazar Contoh",
    pembeli: "Pembeli Umum",
    metodeBayar: "Tunai",
    items: [
      { nama: "Blus Batik Motif Bunga", kuantitas: 1, hargaSatuan: 180000, diskonPerUnit: 0, keterangan: "Barang stok bazar · ukuran M" },
    ],
    subtotalAwal: 180000,
    diskonItem: 0,
    diskonTotal: 0,
    ongkir: { mode: "ambil_sendiri", nominal: 0 },
    total: 180000,
    pembayaran: [{ waktu: sekarang.toISOString(), nominal: 200000, metode: "tunai", catatan: null }],
    statusBayar: "lunas",
    dibatalkan: false,
    perkiraanSiap: null,
    namaPemesan: null,
    rekening: s.rekening,
    teksPenutup: s.teksPenutup,
    tampilkanSapaan: s.tampilkanSapaan,
    tampilkanNomorResi: s.tampilkanNomorResi,
    tampilkanRincianDiskon: s.tampilkanRincianDiskon,
    tampilkanPembayaranSisa: s.tampilkanPembayaranSisa,
  };
}

/**
 * Data contoh pesanan jahit untuk pratinjau — mengikuti contoh resi v9 /
 * nota v8 (Nadia Putri, Kebaya brokat). BUKAN transaksi nyata dan BUKAN
 * bukti model jahitan sudah ada di skema: jenis jahitan, biaya jasa, dan
 * biaya lainnya di sini hanya data pratinjau; transaksi PO asli di kode
 * masih berbasis barang katalog (lihat `rincianTambahan`).
 */
export function dataContohPO(s: {
  namaButik: string;
  alamatBaris1: string;
  alamatBaris2: string;
  kotaKodePos: string;
  telepon1: string;
  telepon2: string;
  teksPenutup: string;
  logo: unknown;
  rekening: Rekening[];
  tampilkanSapaan: boolean;
  tampilkanNomorResi: boolean;
  tampilkanRincianDiskon: boolean;
  tampilkanPembayaranSisa: boolean;
}, sekarang: Date = new Date()): DataResi {
  const sapaan = sapaanDariWaktu(sekarang);
  return {
    nomorResi: "KYS-PO-CONTOH",
    nomorUrutHari: 1,
    waktu: "2026-11-12T09:00:00+07:00",
    jenis: "po",
    sapaan,
    namaButik: s.namaButik.trim() || NAMA_BUTIK_BAWAAN,
    subjudulButik: subjudulDariNama(s.namaButik.trim() || NAMA_BUTIK_BAWAAN),
    alamat: [s.alamatBaris1, s.alamatBaris2, s.kotaKodePos].filter((x) => x.trim()),
    telepon: [s.telepon1, s.telepon2].filter((x) => x.trim()),
    logoAda: !!s.logo,
    contohFiktif: true,
    jenisJahitan: "Kebaya brokat",
    catatanPesanan: "lengan panjang",
    rincianTambahan: [
      { label: "Jasa jahit", keterangan: "Kebaya brokat · ukuran M", nominal: 850000 },
      { label: "Biaya lainnya", keterangan: "Kancing & renda", nominal: 125000 },
    ],
    items: [],
    subtotalAwal: 975000,
    diskonItem: 0,
    diskonTotal: 0,
    ongkir: { mode: "ambil_sendiri", nominal: 0 },
    total: 975000,
    pembayaran: [
      { waktu: "2026-11-12T09:00:00+07:00", nominal: 300000, metode: "transfer", catatan: null },
      { waktu: "2026-11-15T10:00:00+07:00", nominal: 675000, metode: "tunai", catatan: null },
    ],
    statusBayar: "lunas",
    dibatalkan: false,
    perkiraanSiap: "2026-12-01",
    namaPemesan: "Nadia Putri",
    rekening: s.rekening,
    teksPenutup: s.teksPenutup,
    tampilkanSapaan: s.tampilkanSapaan,
    tampilkanNomorResi: s.tampilkanNomorResi,
    tampilkanRincianDiskon: s.tampilkanRincianDiskon,
    tampilkanPembayaranSisa: s.tampilkanPembayaranSisa,
  };
}

/** Baris kedua kop untuk nama butik KAYESA; kosong untuk nama lain. */
export function subjudulDariNama(namaButik: string): string | null {
  return namaButik.trim().toUpperCase() === "KAYESA" ? "KAYESA'S CLOTHING" : null;
}

export const NAMA_FILE_RESI = (nomor: string) => {
  const bersih = nomor
    .split("")
    .map((c) => (/[A-Za-z0-9]/.test(c) || c === "-" ? c : "-"))
    .join("")
    .replace(/-+/g, "-");
  return `Resi-${bersih}.pdf`;
};
