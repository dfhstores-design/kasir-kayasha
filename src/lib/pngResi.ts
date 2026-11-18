/**
 * Pembuat PNG resi di perangkat — gambar yang dibagikan ke WhatsApp (K-01: PNG utama).
 *
 * Memakai `baris` dari `susunResi` yang SAMA dengan pratinjau layar dan PDF,
 * sehingga isi yang dilihat, yang dibagikan, dan PDF cadangannya selalu sama.
 * PDF tetap ada sebagai cadangan arsip/cetak (lihat pdfResi.ts).
 * Tata letak mengikuti PDF (lebar A5 420pt diskalakan ke lebar PNG 620px) dan
 * pola renderPng dokumen jahit (src/lib/dokumen.ts): satu kanvas, tinggi
 * dihitung dulu lewat hitungTinggiPngResi, lalu digambar.
 */
import type { BarisResi } from "./resi.ts";
import { formatRupiahResi } from "./money.ts";

export const LEBAR_PNG_RESI = 620;
const PAD = 28;
const ISI = LEBAR_PNG_RESI - PAD * 2;
/** Skala pt (layout PDF A5 420pt) ke px (lebar PNG 620px). */
const SKALA = LEBAR_PNG_RESI / 420;
/** pt -> px (dibulatkan; dipakai di gambar DAN hitung tinggi supaya sama). */
const P = (pt: number) => Math.round(pt * SKALA);

const HITAM = "#000000";
const COKELAT = "#7a593b";
const COKELAT_GELAP = "#6b4a2e";
const ABU = "#54524d";
const TAN_BG = "#f7f0e3";
const TAN_GARIS = "#c9a67a";
const PUTIH = "#ffffff";

const FONT = "system-ui, -apple-system, sans-serif";

export interface OpsiPngResi {
  logo?: ImageBitmap | null;
}

/** Ukuran logo di PNG (px), diskalakan ke maks 72pt seperti di PDF. */
export function ukuranLogoPng(logo: ImageBitmap | null | undefined): { lebar: number; tinggi: number } {
  if (!logo) return { lebar: 0, tinggi: 0 };
  const skala = Math.min(72 / logo.width, 72 / logo.height);
  return { lebar: P(logo.width * skala), tinggi: P(logo.height * skala) };
}

/** Potong teks + "…" agar muat di lebar maks; `ukur` mengukur lebar teks (px). */
export function potongTeks(teks: string, maks: number, ukur: (t: string) => number): string {
  if (ukur(teks) <= maks) return teks;
  let t = teks;
  while (t.length > 1 && ukur(t + "…") > maks) t = t.slice(0, -1);
  return t + "…";
}

type Kotak = Extract<BarisResi, { jenis: "kotak" }>;

/** Tinggi kotak (px) — dipakai gambar dan hitung tinggi supaya sama. */
function tinggiKotak(r: Kotak): number {
  const isiPt = r.sorot ? 13 : 10;
  return P(8) + P(8) + P(4) + r.isi.length * (P(isiPt) + P(4)) + P(8);
}

/** Tinggi kanvas (px) untuk baris-baris ini — cerminan alur gambar di buatPngResi. */
export function hitungTinggiPngResi(baris: readonly BarisResi[], opsi: OpsiPngResi = {}): number {
  const logo = ukuranLogoPng(opsi.logo);
  let y = PAD;
  let bandBawah: number | null = null;

  for (let idx = 0; idx < baris.length; idx++) {
    const r = baris[idx];
    if (!r) continue;
    switch (r.jenis) {
      case "logo":
        bandBawah = logo.tinggi > 0 ? y + logo.tinggi : null;
        break;
      case "judul":
        if (bandBawah !== null) {
          y += P(18) + P(4);
          if (baris[idx + 1]?.jenis !== "subjudul") {
            y = Math.max(y, bandBawah + P(8));
            bandBawah = null;
          }
        } else {
          y += P(18) + P(4);
        }
        break;
      case "subjudul":
        if (bandBawah !== null) {
          y += P(10) + P(4);
          y = Math.max(y, bandBawah + P(8));
          bandBawah = null;
        } else {
          y += P(10) + P(4);
        }
        break;
      case "lencana":
        y += P(16) + P(6);
        break;
      case "dokumen":
        y += P(20) + P(4) + P(10) + P(4) + P(2);
        break;
      case "kotak":
        y += tinggiKotak(r) + P(6);
        break;
      case "metaPasangan":
        y += P(26) + P(4);
        break;
      case "tandatangan":
        y += P(10) + P(4) + P(24) + P(6) + P(11) + P(4);
        break;
      case "teks":
        y += P(r.kecil ? 8 : 10) + P(4);
        break;
      case "garis":
        y += P(8);
        break;
      case "kiriKanan":
        y += P(r.kecil ? 8 : 10) + P(4);
        break;
      case "total":
        y += P(13) + P(4) + P(4);
        break;
      case "barang": {
        y += P(10) + P(4);
        if (r.keterangan) y += P(8) + P(4);
        y += P(9) + P(4);
        if (r.diskonPerUnit && r.diskonPerUnit > 0) y += P(8) + P(4);
        break;
      }
      case "rincian": {
        y += P(10) + P(4);
        if (r.keterangan) y += P(8) + P(4);
        break;
      }
      case "kosong":
        y += P(6);
        break;
    }
  }
  return Math.ceil(y + PAD);
}

/** Membuat PNG resi dari baris resi. Mengembalikan Blob image/png. */
export async function buatPngResi(baris: readonly BarisResi[], opsi: OpsiPngResi = {}): Promise<Blob> {
  const tinggi = hitungTinggiPngResi(baris, opsi);
  const logo = ukuranLogoPng(opsi.logo);

  const canvas = document.createElement("canvas");
  canvas.width = LEBAR_PNG_RESI;
  canvas.height = tinggi;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia.");

  ctx.fillStyle = PUTIH;
  ctx.fillRect(0, 0, LEBAR_PNG_RESI, tinggi);
  ctx.fillStyle = HITAM;
  ctx.textBaseline = "alphabetic";

  let y = PAD;
  let bandBawah: number | null = null;

  const potong = (teks: string, sizePx: number, maksPx: number, tebal: boolean) => {
    ctx.font = `${tebal ? "700 " : ""}${sizePx}px ${FONT}`;
    return potongTeks(teks, maksPx, (t) => ctx.measureText(t).width);
  };
  /** Satu baris teks; maju sebesar ukuran + jarak. */
  const tulis = (teks: string, sizePt: number, tebal: boolean, x = PAD, rataKanan?: number, warna: string = HITAM) => {
    const s = P(sizePt);
    const maks = rataKanan !== undefined ? rataKanan - x : LEBAR_PNG_RESI - PAD - x;
    const t = potong(teks, s, maks, tebal);
    ctx.font = `${tebal ? "700 " : ""}${s}px ${FONT}`;
    const w = ctx.measureText(t).width;
    const px = rataKanan !== undefined ? rataKanan - w : x;
    ctx.fillStyle = warna;
    ctx.fillText(t, px, y + s * 0.8);
    y += s + P(4);
  };
  /** Satu baris: teks kiri dan teks kanan pada garis dasar yang sama. */
  const barisKanan = (kiri: string, kanan: string, sizePt: number, tebal: boolean) => {
    const s = P(sizePt);
    const k = potong(kiri, s, ISI * 0.62, tebal);
    const n = potong(kanan, s, ISI * 0.36, tebal);
    ctx.font = `${tebal ? "700 " : ""}${s}px ${FONT}`;
    ctx.fillStyle = HITAM;
    ctx.fillText(k, PAD, y + s * 0.8);
    if (n) {
      const w = ctx.measureText(n).width;
      ctx.fillText(n, LEBAR_PNG_RESI - PAD - w, y + s * 0.8);
    }
    y += s + P(4);
  };
  const teksKanan = (teks: string, sizePt: number, tebal: boolean, warna: string = HITAM) => {
    const s = P(sizePt);
    const t = potong(teks, s, ISI, tebal);
    ctx.font = `${tebal ? "700 " : ""}${s}px ${FONT}`;
    const w = ctx.measureText(t).width;
    ctx.fillStyle = warna;
    ctx.fillText(t, LEBAR_PNG_RESI - PAD - w, y + s * 0.8);
    y += s + P(4);
  };
  const garis = () => {
    ctx.beginPath();
    ctx.moveTo(PAD, y + P(4));
    ctx.lineTo(LEBAR_PNG_RESI - PAD, y + P(4));
    ctx.strokeStyle = HITAM;
    ctx.lineWidth = 1;
    ctx.stroke();
    y += P(8);
  };

  for (let idx = 0; idx < baris.length; idx++) {
    const r = baris[idx];
    if (!r) continue;
    switch (r.jenis) {
      case "logo": {
        if (opsi.logo && logo.tinggi > 0) {
          ctx.drawImage(opsi.logo, PAD, y, logo.lebar, logo.tinggi);
          bandBawah = y + logo.tinggi;
        } else {
          bandBawah = null;
        }
        break;
      }
      case "judul": {
        if (bandBawah !== null) {
          tulis(r.teks, 18, true, PAD + P(84));
          if (baris[idx + 1]?.jenis !== "subjudul") {
            y = Math.max(y, bandBawah + P(8));
            bandBawah = null;
          }
        } else {
          tulis(r.teks, 18, true);
        }
        break;
      }
      case "subjudul": {
        if (bandBawah !== null) {
          tulis(r.teks, 10, false, PAD + P(84));
          y = Math.max(y, bandBawah + P(8));
          bandBawah = null;
        } else {
          tulis(r.teks, 10, false);
        }
        break;
      }
      case "lencana": {
        const sizePx = P(9);
        ctx.font = `700 ${sizePx}px ${FONT}`;
        const wTeks = ctx.measureText(r.teks).width;
        const lebar = Math.ceil(wTeks) + P(16);
        const tinggi = P(16);
        const x0 = Math.round((LEBAR_PNG_RESI - lebar) / 2);
        const y0 = y;
        if (r.varian === "status") {
          ctx.fillStyle = COKELAT_GELAP;
          ctx.fillRect(x0, y0, lebar, tinggi);
          ctx.fillStyle = PUTIH;
        } else {
          ctx.fillStyle = TAN_BG;
          ctx.fillRect(x0, y0, lebar, tinggi);
          ctx.strokeStyle = TAN_GARIS;
          ctx.lineWidth = 1;
          ctx.strokeRect(x0, y0, lebar, tinggi);
          ctx.fillStyle = COKELAT;
        }
        ctx.textBaseline = "middle";
        ctx.fillText(r.teks, x0 + P(8), y0 + tinggi / 2);
        ctx.textBaseline = "alphabetic";
        y += tinggi + P(6);
        break;
      }
      case "dokumen": {
        tulis(r.judul, 20, true);
        tulis(r.subjudul, 10, false);
        y += P(2);
        break;
      }
      case "kotak": {
        const isiPt = r.sorot ? 13 : 10;
        const tinggi = tinggiKotak(r);
        const y0 = y;
        if (r.sorot) {
          ctx.fillStyle = TAN_BG;
          ctx.fillRect(PAD, y0, ISI, tinggi);
          ctx.fillStyle = COKELAT_GELAP;
          ctx.fillRect(PAD, y0, P(4), tinggi);
        }
        ctx.strokeStyle = TAN_GARIS;
        ctx.lineWidth = 1;
        ctx.strokeRect(PAD, y0, ISI, tinggi);
        y = y0 + P(8);
        tulis(r.judul, 8, true, PAD + P(8), undefined, COKELAT);
        for (const isi of r.isi) tulis(isi, isiPt, r.sorot ?? false, PAD + P(8));
        y = y0 + tinggi + P(6);
        break;
      }
      case "metaPasangan": {
        const gambar = (x: number, label: string, nilai: string) => {
          const l = potong(label, P(7), ISI / 2 - P(8), false);
          ctx.font = `${P(7)}px ${FONT}`;
          ctx.fillStyle = ABU;
          ctx.fillText(l, x, y + P(7) * 0.8);
          const n = potong(nilai, P(10), ISI / 2 - P(8), true);
          ctx.font = `700 ${P(10)}px ${FONT}`;
          ctx.fillStyle = HITAM;
          ctx.fillText(n, x, y + P(7) + P(4) + P(10) * 0.8);
        };
        gambar(PAD, r.kiri.label, r.kiri.nilai);
        if (r.kanan) gambar(PAD + ISI / 2, r.kanan.label, r.kanan.nilai);
        y += P(26) + P(4);
        break;
      }
      case "tandatangan": {
        teksKanan("Hormat Kami,", 10, false, ABU);
        y += P(24);
        ctx.beginPath();
        ctx.moveTo(LEBAR_PNG_RESI - PAD - P(140), y);
        ctx.lineTo(LEBAR_PNG_RESI - PAD, y);
        ctx.strokeStyle = ABU;
        ctx.lineWidth = 1;
        ctx.stroke();
        y += P(6);
        teksKanan(r.nama, 11, true);
        break;
      }
      case "teks": {
        const sizePt = r.kecil ? 8 : 10;
        if (r.tengah) {
          const s = P(sizePt);
          const t = potong(r.teks, s, ISI, r.tebal ?? false);
          ctx.font = `${r.tebal ? "700 " : ""}${s}px ${FONT}`;
          const w = ctx.measureText(t).width;
          tulis(t, sizePt, r.tebal ?? false, (LEBAR_PNG_RESI - w) / 2);
        } else {
          tulis(r.teks, sizePt, r.tebal ?? false);
        }
        break;
      }
      case "garis":
        garis();
        break;
      case "kiriKanan":
        barisKanan(r.kiri, r.kanan, r.kecil ? 8 : 10, r.tebal ?? false);
        break;
      case "total":
        barisKanan(r.kiri, r.kanan, 13, true);
        y += P(4);
        break;
      case "barang": {
        tulis(r.nama, 10, true);
        if (r.keterangan) tulis(`  ${r.keterangan}`, 8, false);
        barisKanan(`  ${r.jumlah}x ${r.hargaSatuan.toLocaleString("id-ID")}`, r.subtotal.toLocaleString("id-ID"), 9, false);
        if (r.diskonPerUnit && r.diskonPerUnit > 0) {
          tulis(`  Diskon @ ${r.diskonPerUnit.toLocaleString("id-ID")} x ${r.jumlah}`, 8, false);
        }
        break;
      }
      case "rincian": {
        barisKanan(r.label, formatRupiahResi(r.nominal), 10, true);
        if (r.keterangan) tulis(`  ${r.keterangan}`, 8, false);
        break;
      }
      case "kosong":
        y += P(6);
        break;
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Gagal membuat PNG.");
  return blob;
}
