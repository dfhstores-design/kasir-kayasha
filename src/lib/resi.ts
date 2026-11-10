/**
 * Susunan resi sebagai data murni — sumber kebenaran tampilan & PDF.
 *
 * Mengikuti docs/design/BAZAR-PARKIR-RESI.md bagian 5 (contoh resi pemilik):
 *   logo → nama butik → alamat → tanggal & #urut → sapaan → barang → diskon →
 *   ongkir → total → status bayar → TERIMA KASIH → rekening → teks penutup
 *
 * Karena berupa baris terstruktur (bukan sekadar HTML), susunan yang SAMA dipakai
 * untuk pratinjau di layar dan untuk halaman PDF. Tidak ada dua kebenaran.
 */
import type { Rupiah } from "./money.ts";
import { formatRupiah, formatRupiahResi, formatRupiahTanpaRp } from "./money.ts";
import { labelOngkirResi, type Ongkir } from "./ongkir.ts";
import type { Sapaan } from "./sapaan.ts";
import { labelStatusBayar, type StatusBayar } from "./keranjang.ts";
import { formatTanggalJam } from "./tanggal.ts";
import { sapaanDariWaktu } from "./sapaan.ts";
import type { Rekening } from "../db/schema.ts";

/** Baris resi. `align` mengatur posisi: kiri, kanan, atau tengah. */
export type BarisResi =
  | { jenis: "logo" }
  | { jenis: "judul"; teks: string }
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
    }
  | { jenis: "kosong" };

export interface DataResi {
  nomorResi: string;
  nomorUrutHari: number;
  waktu: string;
  jenis: "langsung" | "po";
  sapaan: Sapaan;
  namaButik: string;
  alamat: string[];
  telepon: string[];
  logoAda: boolean;
  items: Array<{
    nama: string;
    kuantitas: number;
    hargaSatuan: Rupiah;
    diskonPerUnit: Rupiah;
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
 * - Ongkos kirim SELALU tampil (keputusan B-10).
 * - Rekening hanya dicetak bila masih ada sisa tagihan.
 * - Resi dibatalkan diberi penanda jelas.
 */
export function susunResi(d: DataResi): BarisResi[] {
  const b: BarisResi[] = [];

  b.push({ jenis: "logo" });
  b.push({ jenis: "judul", teks: d.namaButik.toUpperCase() || "KASIR KAYASHA" });
  for (const a of d.alamat.filter((x) => x.trim())) {
    b.push({ jenis: "teks", teks: a, tengah: true, kecil: true });
  }
  for (const t of d.telepon.filter((x) => x.trim())) {
    b.push({ jenis: "teks", teks: t, tengah: true, kecil: true });
  }
  b.push({ jenis: "garis" });

  // Tanggal & nomor urut hari (#7)
  b.push({
    jenis: "kiriKanan",
    kiri: formatTanggalJam(d.waktu),
    kanan: `#${d.nomorUrutHari}`,
    kecil: true,
  });

  if (d.tampilkanNomorResi) {
    b.push({ jenis: "kiriKanan", kiri: d.nomorResi, kanan: "", kecil: true });
  }

  if (d.jenis === "po") {
    const siap = d.perkiraanSiap ? ` · siap ± ${d.perkiraanSiap}` : "";
    b.push({ jenis: "teks", teks: `PRE-ORDER${siap}`, tebal: true, tengah: true });
    if (d.namaPemesan) b.push({ jenis: "kiriKanan", kiri: `Pemesan: ${d.namaPemesan}`, kanan: "", kecil: true });
  }

  if (d.dibatalkan) {
    b.push({ jenis: "teks", teks: "*** DIBATALKAN ***", tebal: true, tengah: true });
  }

  if (d.tampilkanSapaan) {
    b.push({ jenis: "teks", teks: `- ${d.sapaan} -`, tengah: true, kecil: true });
  }

  b.push({ jenis: "garis" });

  // Barang
  for (const i of d.items) {
    b.push({
      jenis: "barang",
      nama: i.nama,
      jumlah: i.kuantitas,
      hargaSatuan: i.hargaSatuan,
      subtotal: i.hargaSatuan * i.kuantitas,
      ...(d.tampilkanRincianDiskon && i.diskonPerUnit > 0 ? { diskonPerUnit: i.diskonPerUnit } : {}),
    });
  }

  const adaDiskonItem = d.tampilkanRincianDiskon && d.diskonItem > 0;
  const adaDiskonTotal = d.tampilkanRincianDiskon && d.diskonTotal > 0;

  if (adaDiskonItem || adaDiskonTotal) {
    b.push({ jenis: "garis" });
    if (adaDiskonItem) {
      b.push({ jenis: "kiriKanan", kiri: "Diskon barang", kanan: `-${formatRupiahTanpaRp(d.diskonItem)}`, kecil: true });
    }
    if (adaDiskonTotal) {
      b.push({ jenis: "kiriKanan", kiri: "Diskon total", kanan: `-${formatRupiahTanpaRp(d.diskonTotal)}`, kecil: true });
    }
  }

  b.push({ jenis: "garis" });

  // Ongkir SELALU tampil (B-10)
  b.push({ jenis: "kiriKanan", kiri: "Ongkos kirim", kanan: labelOngkirResi(d.ongkir) });

  b.push({ jenis: "garis" });
  b.push({ jenis: "total", kiri: "Total", kanan: formatRupiahResi(d.total) });

  if (d.statusBayar !== "lunas") {
    b.push({ jenis: "teks", teks: labelStatusBayar(d.statusBayar), tengah: true, kecil: true });
  }

  if (d.tampilkanPembayaranSisa) {
    const sudah = d.pembayaran.reduce((n, p) => n + p.nominal, 0);
    if (sudah > 0) {
      const metode = d.pembayaran[d.pembayaran.length - 1]?.metode;
      b.push({
        jenis: "kiriKanan",
        kiri: `Bayar${metode ? ` (${labelMetode(metode)})` : ""}`,
        kanan: formatRupiahResi(sudah),
        kecil: true,
      });
    }
    if (sudah < d.total) {
      b.push({ jenis: "kiriKanan", kiri: "Sisa", kanan: formatRupiahResi(d.total - sudah), tebal: true, kecil: true });
    }
  }

  b.push({ jenis: "teks", teks: "**TERIMA KASIH**", tengah: true, tebal: true });

  // Rekening hanya bila masih ada sisa tagihan.
  const sisa = d.total - d.pembayaran.reduce((n, p) => n + p.nominal, 0);
  const rekening = d.rekening.filter((r) => r.namaBank.trim() && r.nomor.trim());
  if (sisa > 0 && rekening.length > 0) {
    const utama = rekening.find((r) => r.utama) ?? rekening[0];
    if (utama) {
      if (utama.namaPemilik.trim()) {
        b.push({ jenis: "teks", teks: utama.namaPemilik, tengah: true, kecil: true });
      }
      const tampil = rekening.slice(0, 2);
      for (const r of tampil) {
        b.push({ jenis: "teks", teks: `${r.namaBank} ${r.nomor}`, tengah: true, kecil: true });
      }
    }
  }

  if (d.teksPenutup.trim()) {
    b.push({ jenis: "teks", teks: d.teksPenutup.trim(), tengah: true, kecil: true });
  }

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
        case "teks":
          return r.teks;
        case "garis":
          return "----";
        case "kiriKanan":
          return `${r.kiri}${r.kanan ? " " + r.kanan : ""}`;
        case "total":
          return `${r.kiri} ${r.kanan}`;
        case "barang":
          return `${r.nama} ${r.jumlah}x ${formatRupiah(r.hargaSatuan)} = ${formatRupiah(r.subtotal)}`;
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
    namaButik: s.namaButik || "Kasir Kayasha",
    alamat: [s.alamatBaris1, s.alamatBaris2, s.kotaKodePos].filter((x) => x.trim()),
    telepon: [s.telepon1, s.telepon2].filter((x) => x.trim()),
    logoAda: !!s.logo,
    items: [
      { nama: "Blus Linen", kuantitas: 2, hargaSatuan: 180000, diskonPerUnit: 10000 },
      { nama: "Rok Plisket", kuantitas: 1, hargaSatuan: 220000, diskonPerUnit: 0 },
    ],
    subtotalAwal: 580000,
    diskonItem: 20000,
    diskonTotal: 0,
    ongkir: { mode: "butik", nominal: 25000 },
    total: 585000,
    pembayaran: [{ waktu: sekarang.toISOString(), nominal: 300000, metode: "transfer", catatan: null }],
    statusBayar: "dp",
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

export const NAMA_FILE_RESI = (nomor: string) => {
  const bersih = nomor
    .split("")
    .map((c) => (/[A-Za-z0-9]/.test(c) || c === "-" ? c : "-"))
    .join("")
    .replace(/-+/g, "-");
  return `Resi-${bersih}.pdf`;
};
