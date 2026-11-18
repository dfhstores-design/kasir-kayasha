/**
 * Dokumen pesanan jahit - satu sumber konten untuk PNG (utama) dan PDF (cadangan).
 *
 * Mengikuti docs/CATATAN-DISKUSI.md (K-01, K-02, BU-16, BU-17, BU-25, BU-26) dan
 * docs/SPESIFIKASI-DESAIN-TAHAP-1.md par 5:
 * - PNG keluaran utama, PDF cadangan (K-01). Satu struct `DataDokumen` dipakai oleh
 *   kedua renderer, jadi TIDAK ada dua kebenaran.
 * - Satu dokumen dua wajah (K-02): `sisa > 0` -> INVOICE/NOTA PESANAN (total, terbayar,
 *   SISA); `sisa = 0` -> RESI/BUKTI PEMBAYARAN (tanpa baris sisa).
 * - Nama resmi TERKUNCI: besar **KAYESA**, logo **KAYESA'S CLOTHING** (K-04).
 * - Rekening SELALU tampil: BCA - 676 017 885 a.n. NARSHITA DEWI (BU-16).
 * - Kop/kaki ikut faktur lama (BU-25, sementara). Ukuran font & layout dokumen FIX.
 * - Penomoran `NO:` PENDING (BU-19/21): pakai placeholder `KC.[001-0xx]-YYYYMMDD`
 *   (usulan Andri 18 Nov 2026; format final menunggu konfirmasi Tante).
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Rupiah } from "./money.ts";
import { formatRupiahTanpaRp } from "./money.ts";
import { formatTanggal } from "./tanggal.ts";

/** Kop tetap, mengikuti faktur lama (BU-25 sementara). */
export const KOP_DOKUMEN = {
  namaBesar: "KAYESA",
  namaLogo: "KAYESA'S CLOTHING",
  alamat: ["Jl. Tarumanegara No. 41 (Sebelah Pempak Nyai)", "Ploso Ciptum 15419"],
  telepon: ["WA 0812 1141 4017 / 0821 1376 5892"],
} as const;

/** Rekening resmi yang SELALU tampil (BU-16). */
export const REKENING_BAWAAN = {
  namaBank: "BCA",
  nomor: "676 017 885",
  namaPemilik: "NARSHITA DEWI",
} as const;

/** Kotak PERHATIAN pada kaki dokumen (ikut faktur lama - BU-25 sementara). */
export const TEKS_PERHATIAN =
  "PERHATIAN!!! Barang yang sudah dibeli/dipesan tidak dapat ditukar atau dikembalikan.";

export interface BiayaLain {
  nama: string;
  nominal: Rupiah;
}

/** Satu sumber konten dokumen pesanan jahit - dipakai PNG & PDF (K-01). */
export interface DataDokumen {
  nomor: string;
  tanggal: string | Date;
  namaPemesan: string;
  model: string;
  ukuran: string | null;
  perkiraanSelesai: string | null;
  biayaJasa: Rupiah;
  biayaLain: readonly BiayaLain[];
  total: Rupiah;
  terbayar: Rupiah;
}

export type JenisJudul = "invoice" | "resi";

/** Judul otomatis mengikuti sisa (K-02 / BU-17.A). Fungsi murni. */
export function judulDokumen(sisa: Rupiah): JenisJudul {
  return sisa > 0 ? "invoice" : "resi";
}

export function labelJudul(jenis: JenisJudul): string {
  return jenis === "invoice" ? "INVOICE / NOTA PESANAN" : "RESI / BUKTI PEMBAYARAN";
}

export function sisaDokumen(d: Pick<DataDokumen, "total" | "terbayar">): Rupiah {
  return d.total - d.terbayar;
}

export function nomorPlaceholder(tanggal: string | Date = new Date(), urutan = 1): string {
  const d = typeof tanggal === "string" ? new Date(tanggal) : tanggal;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getDate()).padStart(2, "0");
  const urut = String(urutan).padStart(3, "0");
  // BELUM FINAL - menunggu keputusan BU-19/21 (konfirmasi Tante).
  // Format usulan Andri 18 Nov 2026: KC.[no urut pesanan 001-0xx]-yyyymmdd.
  return `KC.${urut}-${y}${m}${hh}`;
}

export type BarisDokumen =
  | { jenis: "judul"; teks: string }
  | { jenis: "kiriKanan"; kiri: string; kanan: string; tebal?: boolean }
  | { jenis: "teks"; teks: string; tebal?: boolean }
  | { jenis: "garis" }
  | { jenis: "total"; kiri: string; kanan: string };

export function susunDokumen(d: DataDokumen): BarisDokumen[] {
  const sisa = sisaDokumen(d);
  const jenis = judulDokumen(sisa);
  const b: BarisDokumen[] = [];

  b.push({ jenis: "judul", teks: "KAYESA" });
  for (const a of KOP_DOKUMEN.alamat) b.push({ jenis: "teks", teks: a });
  for (const t of KOP_DOKUMEN.telepon) b.push({ jenis: "teks", teks: t });
  b.push({ jenis: "garis" });

  b.push({ jenis: "kiriKanan", kiri: "NO:", kanan: d.nomor });
  b.push({ jenis: "kiriKanan", kiri: "TANGGAL", kanan: formatTanggal(d.tanggal) });
  b.push({ jenis: "kiriKanan", kiri: "KEPADA YTH.", kanan: d.namaPemesan });
  b.push({ jenis: "garis" });

  b.push({ jenis: "judul", teks: labelJudul(jenis) });

  b.push({ jenis: "kiriKanan", kiri: "Model / Jenis", kanan: d.model });
  if (d.ukuran && d.ukuran.trim()) b.push({ jenis: "kiriKanan", kiri: "Ukuran", kanan: d.ukuran.trim() });
  if (d.perkiraanSelesai && d.perkiraanSelesai.trim())
    b.push({ jenis: "kiriKanan", kiri: "Perkiraan Selesai", kanan: d.perkiraanSelesai.trim() });
  b.push({ jenis: "garis" });

  b.push({ jenis: "kiriKanan", kiri: "Biaya Jasa", kanan: formatRupiahResi(d.biayaJasa) });
  for (const lain of d.biayaLain) {
    if (lain.nominal <= 0) continue;
    b.push({ jenis: "kiriKanan", kiri: lain.nama.trim() || "Biaya lain", kanan: formatRupiahResi(lain.nominal) });
  }
  b.push({ jenis: "total", kiri: "TOTAL", kanan: formatRupiahResi(d.total) });

  b.push({ jenis: "kiriKanan", kiri: "Terbayar", kanan: formatRupiahResi(d.terbayar) });
  if (jenis === "invoice") b.push({ jenis: "kiriKanan", kiri: "SISA", kanan: formatRupiahResi(sisa), tebal: true });

  b.push({ jenis: "garis" });
  b.push({ jenis: "teks", teks: `REK ${REKENING_BAWAAN.namaBank} ${REKENING_BAWAAN.nomor}` });
  b.push({ jenis: "teks", teks: `a.n. ${REKENING_BAWAAN.namaPemilik}` });

  b.push({ jenis: "garis" });
  b.push({ jenis: "teks", teks: TEKS_PERHATIAN, tebal: true });
  b.push({ jenis: "teks", teks: "Hormat Kami," });

  return b;
}

function formatRupiahResi(v: Rupiah): string {
  return `Rp${formatRupiahTanpaRp(v)}`;
}

/** Ringkasan teks untuk pengujian & aksesibilitas pratinjau. */
export function teksDokumen(baris: readonly BarisDokumen[]): string {
  return baris
    .map((r) => {
      switch (r.jenis) {
        case "judul":
          return r.teks;
        case "kiriKanan":
          return `${r.kiri}${r.kanan ? " " + r.kanan : ""}`;
        case "teks":
          return r.teks;
        case "garis":
          return "----";
        case "total":
          return `${r.kiri} ${r.kanan}`;
      }
    })
    .join("\n");
}

export const LEBAR_PNG = 620;
const PAD = 28;
const FONT_BESAR = 22;
const FONT_SEDANG = 15;
const FONT_KECIL = 13;

export async function renderPng(d: DataDokumen, opsi: { logo?: ImageBitmap | null } = {}): Promise<Blob> {
  const baris = susunDokumen(d);
  const tinggi = hitungTinggiPng(baris);

  const canvas = document.createElement("canvas");
  canvas.width = LEBAR_PNG;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LEBAR_PNG, tinggi);
  ctx.fillStyle = "#000000";

  let y = PAD;

  const tulis = (teks: string, size: number, tebal: boolean, tengah = false, rataKanan?: number) => {
    ctx.font = `${tebal ? "700 " : ""}${size}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = "alphabetic";
    const w = ctx.measureText(teks).width;
    const x = rataKanan !== undefined ? rataKanan - w : tengah ? (LEBAR_PNG - w) / 2 : PAD;
    ctx.fillText(teks, x, y + size * 0.8);
    y += size + 6;
  };

  if (opsi.logo) {
    const g = opsi.logo;
    const skala = Math.min(72 / g.width, 72 / g.height);
    const w = g.width * skala;
    const h = g.height * skala;
    ctx.drawImage(g, (LEBAR_PNG - w) / 2, y, w, h);
    y += h + 10;
  }

  for (const r of baris) {
    switch (r.jenis) {
      case "judul":
        tulis(r.teks, FONT_BESAR, true, true);
        break;
      case "kiriKanan":
        tulis(r.kiri, FONT_KECIL, false);
        y -= FONT_KECIL + 6;
        tulis(r.kanan, FONT_KECIL, r.tebal ?? false, false, LEBAR_PNG - PAD);
        break;
      case "teks":
        tulis(r.teks, FONT_KECIL, r.tebal ?? false, true);
        break;
      case "garis":
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(LEBAR_PNG - PAD, y);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
        y += 8;
        break;
      case "total":
        tulis(r.kiri, FONT_SEDANG, true);
        y -= FONT_SEDANG + 6;
        tulis(r.kanan, FONT_SEDANG, true, false, LEBAR_PNG - PAD);
        y += 4;
        break;
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Gagal membuat PNG.");
  return blob;
}

function hitungTinggiPng(baris: readonly BarisDokumen[]): number {
  let tinggi = PAD * 2;
  for (const r of baris) {
    switch (r.jenis) {
      case "judul":
        tinggi += FONT_BESAR + 6;
        break;
      case "kiriKanan":
      case "total":
        tinggi += (r.jenis === "total" ? FONT_SEDANG : FONT_KECIL) + 6;
        break;
      case "teks":
        tinggi += FONT_KECIL + 6;
        break;
      case "garis":
        tinggi += 8;
        break;
    }
  }
  return Math.ceil(tinggi);
}

export const LEBAR_A5_DOKUMEN = 420;
export const TINGGI_A5_DOKUMEN = 595;
const MARGIN_PDF = 28;

export async function renderPdf(d: DataDokumen, opsi: { logo?: Blob | null } = {}): Promise<Blob> {
  const baris = susunDokumen(d);
  const jenis = judulDokumen(sisaDokumen(d));

  const doc = await PDFDocument.create();
  doc.setTitle(labelJudul(jenis));
  doc.setCreator("Kasir KAYESA");
  doc.setProducer("Kasir KAYESA");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontTebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const HITAM = rgb(0, 0, 0);

  let page = doc.addPage([LEBAR_A5_DOKUMEN, TINGGI_A5_DOKUMEN]);
  let y = TINGGI_A5_DOKUMEN - MARGIN_PDF;
  const lebarIsi = LEBAR_A5_DOKUMEN - MARGIN_PDF * 2;

  const garisBaru = () => {
    page = doc.addPage([LEBAR_A5_DOKUMEN, TINGGI_A5_DOKUMEN]);
    y = TINGGI_A5_DOKUMEN - MARGIN_PDF;
  };
  const pastikanRuang = (butuh: number) => {
    if (y - butuh < MARGIN_PDF) garisBaru();
  };
  const potong = (teks: string, size: number, maks: number, tebal: boolean) => {
    const f = tebal ? fontTebal : font;
    if (f.widthOfTextAtSize(teks, size) <= maks) return teks;
    let t = teks;
    while (t.length > 1 && f.widthOfTextAtSize(t + "...", size) > maks) t = t.slice(0, -1);
    return t + "...";
  };
  const barisKanan = (kiri: string, kanan: string, size: number, tebal: boolean) => {
    const f = tebal ? fontTebal : font;
    pastikanRuang(size + 4);
    const dasar = y - size;
    page.drawText(potong(kiri, size, lebarIsi * 0.62, tebal), {
      x: MARGIN_PDF,
      y: dasar,
      size,
      font: f,
      color: HITAM,
    });
    if (kanan) {
      const n = potong(kanan, size, lebarIsi * 0.36, tebal);
      page.drawText(n, {
        x: LEBAR_A5_DOKUMEN - MARGIN_PDF - f.widthOfTextAtSize(n, size),
        y: dasar,
        size,
        font: f,
        color: HITAM,
      });
    }
    y -= size + 4;
  };
  const tulis = (teks: string, size: number, tebal: boolean, tengah: boolean) => {
    const f = tebal ? fontTebal : font;
    const t = potong(teks, size, lebarIsi, tebal);
    pastikanRuang(size + 4);
    const x = tengah ? (LEBAR_A5_DOKUMEN - f.widthOfTextAtSize(t, size)) / 2 : MARGIN_PDF;
    page.drawText(t, { x, y: y - size, size, font: f, color: HITAM });
    y -= size + 4;
  };

  if (opsi.logo) {
    try {
      const bytes = new Uint8Array(await opsi.logo.arrayBuffer());
      const gambar = await doc.embedPng(bytes).catch(async () => doc.embedJpg(bytes));
      const skala = Math.min(72 / gambar.width, 72 / gambar.height);
      const w = gambar.width * skala;
      const h = gambar.height * skala;
      pastikanRuang(h + 8);
      page.drawImage(gambar, { x: (LEBAR_A5_DOKUMEN - w) / 2, y: y - h, width: w, height: h });
      y -= h + 8;
    } catch {
      // Logo tidak terbaca: lewati, nama besar KAYESA tetap tampil.
    }
  }

  for (const r of baris) {
    switch (r.jenis) {
      case "judul":
        pastikanRuang(18);
        tulis(r.teks, 14, true, true);
        break;
      case "kiriKanan":
        barisKanan(r.kiri, r.kanan, 9, r.tebal ?? false);
        break;
      case "teks":
        tulis(r.teks, 9, r.tebal ?? false, true);
        break;
      case "garis":
        pastikanRuang(8);
        page.drawLine({
          start: { x: MARGIN_PDF, y: y - 3 },
          end: { x: LEBAR_A5_DOKUMEN - MARGIN_PDF, y: y - 3 },
          thickness: 0.5,
          color: HITAM,
        });
        y -= 8;
        break;
      case "total":
        pastikanRuang(22);
        barisKanan(r.kiri, r.kanan, 12, true);
        y -= 4;
        break;
    }
  }

  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export async function bagikanDokumen(pngBlob: Blob, namaFile: string): Promise<"dibagikan" | "diunduh"> {
  const file = new File([pngBlob], namaFile, { type: "image/png" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: namaFile });
      return "dibagikan";
    } catch {
      // Pengguna membatalkan share sheet atau gagal: lanjut ke unduh (fallback).
    }
  }

  unduhBlob(pngBlob, namaFile);
  return "diunduh";
}

export async function simpanKeFoto(pngBlob: Blob, namaFile: string): Promise<void> {
  unduhBlob(pngBlob, namaFile);
}

function unduhBlob(blob: Blob, namaFile: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const NAMA_FILE_DOKUMEN = (nomor: string) => `Nota-${bersihkanNomor(nomor)}.png`;

export const NAMA_FILE_PDF = (nomor: string) => `Nota-${bersihkanNomor(nomor)}.pdf`;

function bersihkanNomor(nomor: string): string {
  return nomor
    .split("")
    .map((c) => (/[A-Za-z0-9]/.test(c) || c === "-" ? c : "-"))
    .join("")
    .replace(/-+/g, "-");
}

/** Data contoh untuk pratinjau (bukan transaksi nyata). */
export function dataContohDokumen(sekarang: Date = new Date()): DataDokumen {
  const total = 350000;
  const terbayar = 150000;
  return {
    nomor: nomorPlaceholder(sekarang),
    tanggal: sekarang,
    namaPemesan: "Ibu Sari",
    model: "Gaun Pesta",
    ukuran: "M",
    perkiraanSelesai: formatTanggal(new Date(sekarang.getTime() + 7 * 24 * 60 * 60 * 1000)),
    biayaJasa: 300000,
    biayaLain: [{ nama: "Bahan payet", nominal: 50000 }],
    total,
    terbayar,
  };
}