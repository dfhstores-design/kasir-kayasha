/**
 * Pembuat PDF resi di perangkat (tanpa server) — bisa dipakai saat offline.
 *
 * Memakai `baris` dari `susunResi` sehingga pratinjau layar dan PDF pasti sama.
 * PDF dibuat dengan pdf-lib; logonya gambar apa pun yang bisa dibaca
 * `createImageBitmap` (WebP/JPEG/PNG).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BarisResi } from "./resi.ts";
import { formatRupiahResi } from "./money.ts";

export const LEBAR_A5 = 420; // pt
export const TINGGI_A5 = 595;
export const MARGIN = 28;

interface Opsi {
  logo?: Blob | null;
  /** Judul dokumen di metadata. */
  judul: string;
}

const HITAM = rgb(0, 0, 0);
const COKELAT = rgb(0.48, 0.35, 0.23);
const COKELAT_GELAP = rgb(0.42, 0.29, 0.18);
const ABU = rgb(0.33, 0.32, 0.3);
const TAN_BG = rgb(0.97, 0.94, 0.89);
const TAN_GARIS = rgb(0.79, 0.65, 0.48);

/** Membuat PDF dari baris resi. Mengembalikan Blob application/pdf. */
export async function buatPdfResi(baris: readonly BarisResi[], opsi: Opsi): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.setTitle(opsi.judul);
  doc.setCreator("Kasir Kayesa");
  doc.setProducer("Kasir Kayesa");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontTebal = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([LEBAR_A5, TINGGI_A5]);
  let y = TINGGI_A5 - MARGIN;

  const lebarIsi = LEBAR_A5 - MARGIN * 2;

  const ukuran = (kecil?: boolean) => (kecil ? 8 : 10);
  const garisBaru = () => {
    page = doc.addPage([LEBAR_A5, TINGGI_A5]);
    y = TINGGI_A5 - MARGIN;
  };
  const pastikanRuang = (butuh: number) => {
    if (y - butuh < MARGIN) garisBaru();
  };
  /** Potong teks agar tidak melewati lebar halaman. */
  const potong = (teks: string, ukuranFont: number, maks: number, tebal: boolean) => {
    const f = tebal ? fontTebal : font;
    if (f.widthOfTextAtSize(teks, ukuranFont) <= maks) return teks;
    let t = teks;
    while (t.length > 1 && f.widthOfTextAtSize(t + "…", ukuranFont) > maks) t = t.slice(0, -1);
    return t + "…";
  };
  /** Satu baris: teks kiri dan teks kanan pada garis dasar yang sama. */
  const barisKanan = (kiri: string, kanan: string, ukuranFont: number, tebal: boolean) => {
    const f = tebal ? fontTebal : font;
    pastikanRuang(ukuranFont + 4);
    const dasar = y - ukuranFont;
    const k = potong(kiri, ukuranFont, lebarIsi * 0.62, tebal);
    page.drawText(k, { x: MARGIN, y: dasar, size: ukuranFont, font: f, color: HITAM });
    if (kanan) {
      const n = potong(kanan, ukuranFont, lebarIsi * 0.36, tebal);
      const w = f.widthOfTextAtSize(n, ukuranFont);
      page.drawText(n, { x: LEBAR_A5 - MARGIN - w, y: dasar, size: ukuranFont, font: f, color: HITAM });
    }
    y -= ukuranFont + 4;
  };
  const tulis = (
    teks: string,
    x: number,
    ukuranFont: number,
    tebal: boolean,
    rataKanan?: number,
  ) => {
    const f = tebal ? fontTebal : font;
    const t = potong(teks, ukuranFont, rataKanan !== undefined ? rataKanan - x : lebarIsi, tebal);
    const lebar = f.widthOfTextAtSize(t, ukuranFont);
    const px = rataKanan !== undefined ? rataKanan - lebar : x;
    pastikanRuang(ukuranFont + 4);
    page.drawText(t, { x: px, y: y - ukuranFont, size: ukuranFont, font: f, color: HITAM });
    y -= ukuranFont + 4;
  };

  // Kop: logo di kiri, nama butik + nama lengkap di kanannya (contoh v8/v9/v4).
  // `kepala` menandai pita kop yang sedang digambar: logo sudah digambar dan
  // judul/subjudul mengisi sisi kanannya sebelum y maju melewati pita itu.
  let kepala: { bawah: number } | null = null;
  const teksKanan = (teks: string, ukuranFont: number, tebal: boolean, warna = HITAM) => {
    const f = tebal ? fontTebal : font;
    const t = potong(teks, ukuranFont, lebarIsi, tebal);
    const w = f.widthOfTextAtSize(t, ukuranFont);
    pastikanRuang(ukuranFont + 4);
    page.drawText(t, { x: LEBAR_A5 - MARGIN - w, y: y - ukuranFont, size: ukuranFont, font: f, color: warna });
    y -= ukuranFont + 4;
  };

  for (let idx = 0; idx < baris.length; idx++) {
    const r = baris[idx];
    if (!r) continue;
    switch (r.jenis) {
      case "logo": {
        if (!opsi.logo) break;
        try {
          const bytes = new Uint8Array(await opsi.logo.arrayBuffer());
          const gambar = await doc.embedPng(bytes).catch(async () => doc.embedJpg(bytes));
          const skala = Math.min(72 / gambar.width, 72 / gambar.height);
          const w = gambar.width * skala;
          const h = gambar.height * skala;
          pastikanRuang(h + 8);
          page.drawImage(gambar, { x: MARGIN, y: y - h, width: w, height: h });
          kepala = { bawah: y - h };
        } catch {
          // Logo tidak terbaca: lewati, judul butik tetap tampil.
          kepala = null;
        }
        break;
      }
      case "judul": {
        const berikutnyaSubjudul = baris[idx + 1]?.jenis === "subjudul";
        if (kepala) {
          const t = potong(r.teks, 18, lebarIsi - 84, true);
          page.drawText(t, { x: MARGIN + 84, y: y - 18, size: 18, font: fontTebal, color: HITAM });
          if (!berikutnyaSubjudul) {
            y = kepala.bawah - 8;
            kepala = null;
          }
        } else {
          pastikanRuang(18);
          tulis(r.teks, MARGIN, 18, true);
        }
        break;
      }
      case "subjudul": {
        if (kepala) {
          const t = potong(r.teks, 10, lebarIsi - 84, false);
          page.drawText(t, { x: MARGIN + 84, y: y - 32, size: 10, font, color: ABU });
          y = kepala.bawah - 8;
          kepala = null;
        } else {
          tulis(r.teks, MARGIN, 10, false);
        }
        break;
      }
      case "lencana": {
        const ukuranFont = 9;
        const f = fontTebal;
        const t = r.teks;
        const wTeks = f.widthOfTextAtSize(t, ukuranFont);
        const lebar = wTeks + 16;
        const tinggi = 16;
        pastikanRuang(tinggi + 6);
        const x0 = (LEBAR_A5 - lebar) / 2;
        const y0 = y - tinggi;
        if (r.varian === "status") {
          page.drawRectangle({ x: x0, y: y0, width: lebar, height: tinggi, color: COKELAT_GELAP });
          page.drawText(t, { x: x0 + 8, y: y0 + 4, size: ukuranFont, font: f, color: rgb(1, 1, 1) });
        } else {
          page.drawRectangle({ x: x0, y: y0, width: lebar, height: tinggi, borderColor: TAN_GARIS, borderWidth: 0.7, color: TAN_BG });
          page.drawText(t, { x: x0 + 8, y: y0 + 4, size: ukuranFont, font: f, color: COKELAT });
        }
        y -= tinggi + 6;
        break;
      }
      case "dokumen": {
        pastikanRuang(20);
        tulis(r.judul, MARGIN, 20, true);
        tulis(r.subjudul, MARGIN, 10, false);
        y -= 2;
        break;
      }
      case "kotak": {
        const sorot = r.sorot ?? false;
        const ukuranJudul = sorot ? 8 : 8;
        const ukuranIsi = sorot ? 13 : 10;
        const tinggi =
          8 + ukuranJudul + 4 + r.isi.length * (ukuranIsi + 4) + 8;
        pastikanRuang(tinggi);
        const y0 = y - tinggi;
        if (sorot) {
          page.drawRectangle({ x: MARGIN, y: y0, width: lebarIsi, height: tinggi, color: TAN_BG });
          page.drawRectangle({ x: MARGIN, y: y0, width: 4, height: tinggi, color: COKELAT_GELAP });
        }
        page.drawRectangle({
          x: MARGIN,
          y: y0,
          width: lebarIsi,
          height: tinggi,
          borderColor: TAN_GARIS,
          borderWidth: 0.7,
        });
        let yy = y - 8;
        const judulKotak = potong(r.judul, ukuranJudul, lebarIsi - 16, true);
        page.drawText(judulKotak, { x: MARGIN + 8, y: yy - ukuranJudul, size: ukuranJudul, font: fontTebal, color: COKELAT });
        yy -= ukuranJudul + 4;
        for (const isi of r.isi) {
          const t = potong(isi, ukuranIsi, lebarIsi - 16, sorot);
          page.drawText(t, { x: MARGIN + 8, y: yy - ukuranIsi, size: ukuranIsi, font: sorot ? fontTebal : font, color: HITAM });
          yy -= ukuranIsi + 4;
        }
        y = y0 - 6;
        break;
      }
      case "metaPasangan": {
        const tinggi = 26;
        pastikanRuang(tinggi + 4);
        const gambarPasangan = (x: number, label: string, nilai: string) => {
          const l = potong(label, 7, lebarIsi / 2 - 8, false);
          page.drawText(l, { x, y: y - 7, size: 7, font, color: ABU });
          const n = potong(nilai, 10, lebarIsi / 2 - 8, true);
          page.drawText(n, { x, y: y - 19, size: 10, font: fontTebal, color: HITAM });
        };
        gambarPasangan(MARGIN, r.kiri.label, r.kiri.nilai);
        if (r.kanan) gambarPasangan(MARGIN + lebarIsi / 2, r.kanan.label, r.kanan.nilai);
        y -= tinggi + 4;
        break;
      }
      case "tandatangan": {
        pastikanRuang(56);
        teksKanan("Hormat Kami,", 10, false, ABU);
        y -= 24;
        page.drawLine({
          start: { x: LEBAR_A5 - MARGIN - 140, y },
          end: { x: LEBAR_A5 - MARGIN, y },
          thickness: 0.5,
          color: ABU,
        });
        y -= 6;
        teksKanan(r.nama, 11, true);
        break;
      }
      case "teks": {
        const f = r.tebal ? fontTebal : font;
        const s = ukuran(r.kecil);
        if (r.tengah) {
          const t = potong(r.teks, s, lebarIsi, r.tebal ?? false);
          const w = f.widthOfTextAtSize(t, s);
          pastikanRuang(s + 4);
          page.drawText(t, { x: (LEBAR_A5 - w) / 2, y: y - s, size: s, font: f, color: HITAM });
          y -= s + 4;
        } else {
          tulis(r.teks, MARGIN, s, r.tebal ?? false);
        }
        break;
      }
      case "garis":
        pastikanRuang(8);
        page.drawLine({
          start: { x: MARGIN, y: y - 3 },
          end: { x: LEBAR_A5 - MARGIN, y: y - 3 },
          thickness: 0.5,
          color: HITAM,
        });
        y -= 8;
        break;
      case "kiriKanan":
        barisKanan(r.kiri, r.kanan, ukuran(r.kecil), r.tebal ?? false);
        break;
      case "total":
        if (y - 22 < MARGIN) garisBaru();
        barisKanan(r.kiri, r.kanan, 13, true);
        y -= 4; // beri jarak ekstra setelah total
        break;
      case "barang": {
        pastikanRuang(26);
        tulis(r.nama, MARGIN, 10, true);
        if (r.keterangan) {
          tulis(`  ${r.keterangan}`, MARGIN, 8, false);
        }
        // baris "jumlah x harga" dan subtotal rata kanan
        barisKanan(`  ${r.jumlah}x ${r.hargaSatuan.toLocaleString("id-ID")}`, r.subtotal.toLocaleString("id-ID"), 9, false);
        if (r.diskonPerUnit && r.diskonPerUnit > 0) {
          tulis(
            `  Diskon @ ${r.diskonPerUnit.toLocaleString("id-ID")} x ${r.jumlah}`,
            MARGIN,
            8,
            false,
          );
        }
        break;
      }
      case "rincian": {
        pastikanRuang(26);
        barisKanan(r.label, formatRupiahResi(r.nominal), 10, true);
        if (r.keterangan) {
          tulis(`  ${r.keterangan}`, MARGIN, 8, false);
        }
        break;
      }
      case "kosong":
        y -= 6;
        break;
    }
  }

  const bytes = await doc.save();
  // BufferSource -> Blob; bungkus ulang agar tidak berbagi memori wasm.
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

/** Membagikan berkas PDF lewat share sheet; jatuh ke unduh bila tidak didukung. */
export async function bagikanAtauUnduh(blob: Blob, namaFile: string): Promise<"dibagikan" | "diunduh"> {
  const file = new File([blob], namaFile, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: namaFile });
      return "dibagikan";
    } catch {
      // Pengguna membatalkan atau gagal: lanjut ke unduh.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "diunduh";
}
