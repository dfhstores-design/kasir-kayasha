/**
 * Pembuat PDF resi di perangkat (tanpa server) — bisa dipakai saat offline.
 *
 * Memakai `baris` dari `susunResi` sehingga pratinjau layar dan PDF pasti sama.
 * PDF dibuat dengan pdf-lib; logonya gambar apa pun yang bisa dibaca
 * `createImageBitmap` (WebP/JPEG/PNG).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BarisResi } from "./resi.ts";

export const LEBAR_A5 = 420; // pt
export const TINGGI_A5 = 595;
export const MARGIN = 28;

interface Opsi {
  logo?: Blob | null;
  /** Judul dokumen di metadata. */
  judul: string;
}

const HITAM = rgb(0, 0, 0);

/** Membuat PDF dari baris resi. Mengembalikan Blob application/pdf. */
export async function buatPdfResi(baris: readonly BarisResi[], opsi: Opsi): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.setTitle(opsi.judul);
  doc.setCreator("Kasir Kayasha");
  doc.setProducer("Kasir Kayasha");

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

  for (const r of baris) {
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
          page.drawImage(gambar, { x: (LEBAR_A5 - w) / 2, y: y - h, width: w, height: h });
          y -= h + 8;
        } catch {
          // Logo tidak terbaca: lewati, judul butik tetap tampil.
        }
        break;
      }
      case "judul":
        pastikanRuang(18);
        tulis(r.teks, MARGIN, 14, true);
        break;
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
