/**
 * Pembuat PDF panduan pemilik.
 *
 * Mengubah `docs/PANDUAN-PEMILIK.md` menjadi PDF yang nyaman dibaca orang tua:
 * huruf besar, spasi lega, nomor bagian jelas, dan tabel "bila ada masalah".
 *
 * Memakai pdf-lib (sudah menjadi dependensi aplikasi) — tanpa layanan tambahan.
 *
 * Jalankan: node scripts/buat-panduan-pdf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const AKAR = process.cwd();
const SUMBER = join(AKAR, "docs", "PANDUAN-PEMILIK.md");
const TUJUAN = join(AKAR, "docs", "PANDUAN-PEMILIK.pdf");

const A4 = { lebar: 595, tinggi: 842 };
const MARGIN = 56;
const LEBAR_ISI = A4.lebar - MARGIN * 2;

const HITAM = rgb(0.1, 0.1, 0.1);
const ABU = rgb(0.42, 0.42, 0.42);
const Aksen = rgb(0.549, 0.247, 0.173); // #8C3F2C — warna aplikasi
const GARIS = rgb(0.85, 0.83, 0.79);

/* ------------------------------------------------------------ pembaca MD */

/**
 * Mengurai Markdown sederhana menjadi blok yang bisa digambar.
 * Hanya bentuk yang benar-benar dipakai panduan ini.
 */
function urai(md) {
  const baris = md.split(/\r?\n/);
  const blok = [];
  let paragraf = [];
  let daftar = null;
  let tabel = null;

  const tutupParagraf = () => {
    if (paragraf.length) {
      blok.push({ jenis: "paragraf", isi: paragraf.join(" ") });
      paragraf = [];
    }
  };
  const tutupDaftar = () => {
    if (daftar) {
      blok.push(daftar);
      daftar = null;
    }
  };
  const tutupTabel = () => {
    if (tabel) {
      blok.push(tabel);
      tabel = null;
    }
  };

  for (const mentah of baris) {
    const b = mentah.replace(/\s+$/, "");

    if (!b.trim()) {
      tutupParagraf();
      tutupDaftar();
      tutupTabel();
      continue;
    }

    if (/^---+$/.test(b.trim())) {
      tutupParagraf();
      tutupDaftar();
      tutupTabel();
      blok.push({ jenis: "pemisah" });
      continue;
    }

    const h1 = b.match(/^# (.+)$/);
    if (h1) {
      tutupParagraf();
      tutupDaftar();
      tutupTabel();
      blok.push({ jenis: "judul1", isi: h1[1] });
      continue;
    }

    const h2 = b.match(/^## (.+)$/);
    if (h2) {
      tutupParagraf();
      tutupDaftar();
      tutupTabel();
      blok.push({ jenis: "judul2", isi: h2[1] });
      continue;
    }

    const kutip = b.match(/^>\s?(.*)$/);
    if (kutip) {
      tutupParagraf();
      tutupDaftar();
      tutupTabel();
      blok.push({ jenis: "kutip", isi: kutip[1] });
      continue;
    }

    // tabel
    if (b.trim().startsWith("|")) {
      const sel = b
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((s) => s.trim());
      if (/^:?-{2,}/.test(sel[0] ?? "")) continue; // baris pemisah
      tutupParagraf();
      tutupDaftar();
      tabel ??= { jenis: "tabel", kepala: [], baris: [] };
      if (tabel.kepala.length === 0 && tabel.baris.length === 0) tabel.kepala = sel;
      else tabel.baris.push(sel);
      continue;
    } else if (tabel) {
      tutupTabel();
    }

    // daftar berurutan / bernomor
    const li = b.match(/^(\s*)(\d+\.|[-*])\s+(.*)$/);
    if (li) {
      tutupParagraf();
      const menjorok = li[1].length >= 3;
      const nomor = /\d/.test(li[2]);
      daftar ??= { jenis: "daftar", butir: [] };
      daftar.butir.push({ teks: li[3], nomor, menjorok, angka: nomor ? li[2].replace(".", "") : null });
      continue;
    }

    // Lanjutan butir daftar: baris menjorok TANPA penanda, tepat setelah butir.
    if (daftar && /^\s{2,}/.test(b) && daftar.butir.length > 0) {
      const terakhir = daftar.butir[daftar.butir.length - 1];
      terakhir.teks = `${terakhir.teks} ${b.trim()}`;
      continue;
    }

    paragraf.push(b.trim());
  }

  tutupParagraf();
  tutupDaftar();
  tutupTabel();
  return blok;
}

/**
 * Font standar PDF (Helvetica) hanya mendukung WinAnsi, bukan Unicode penuh.
 * Karakter di bawah diganti padanan yang aman agar tidak ada teks hilang.
 */
const PENGGANTI = new Map([
  ["\u2192", "->"],      // →
  ["\u2212", "-"],       // − (minus)
  ["\u2013", "-"],       // –
  ["\u2014", "--"],      // —
  ["\u2018", "'"],       // '
  ["\u2019", "'"],       // '
  ["\u201c", '"'],       // "
  ["\u201d", '"'],       // "
  ["\u2022", "-"],       // •
  ["\u2026", "..."],     // …
  ["\u00b7", "-"],       // ·
]);

function aman(teks) {
  let hasil = "";
  for (const c of teks) hasil += PENGGANTI.get(c) ?? c;
  return hasil;
}

/** Membuang penanda **tebal** dan *miring* menjadi teks biasa. */
function bersihkan(teks) {
  return aman(teks.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1"));
}

/** Mengambil potongan tebal sebagai segmen terpisah agar tetap ditebalkan di PDF. */
function segmen(teks) {
  const hasil = [];
  const pola = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let akhir = 0;
  let m;
  while ((m = pola.exec(teks))) {
    if (m.index > akhir) hasil.push({ teks: teks.slice(akhir, m.index), tebal: false });
    if (m[1]) hasil.push({ teks: m[1], tebal: true });
    else if (m[2]) hasil.push({ teks: m[2], tebal: false });
    else hasil.push({ teks: m[3], tebal: false });
    akhir = m.index + m[0].length;
  }
  if (akhir < teks.length) hasil.push({ teks: teks.slice(akhir), tebal: false });
  return hasil.map((s) => ({ teks: aman(s.teks), tebal: s.tebal })).filter((s) => s.teks.length > 0);
}

/* --------------------------------------------------------------- penggambar */

async function buat() {
  const md = readFileSync(SUMBER, "utf8");
  const blok = urai(md);

  const doc = await PDFDocument.create();
  doc.setTitle("Panduan Pemilik — Kasir Kayesha");
  doc.setAuthor("Kasir Kayesha");
  doc.setSubject("Panduan memakai aplikasi kasir untuk pemilik butik");
  doc.setCreator("scripts/buat-panduan-pdf.mjs");

  const biasa = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4.lebar, A4.tinggi]);
  let y = A4.tinggi - MARGIN;
  let nomorHalaman = 0;

  const footer = () => {
    nomorHalaman++;
    const teks = `Panduan Pemilik Kasir Kayesha  ·  halaman ${nomorHalaman}`;
    const w = biasa.widthOfTextAtSize(teks, 8);
    page.drawText(teks, { x: (A4.lebar - w) / 2, y: 28, size: 8, font: biasa, color: ABU });
  };
  footer();

  const halamanBaru = () => {
    page = doc.addPage([A4.lebar, A4.tinggi]);
    y = A4.tinggi - MARGIN;
    footer();
  };
  const perlu = (tinggi) => {
    if (y - tinggi < MARGIN) halamanBaru();
  };

  /** Memecah teks menjadi baris sesuai lebar; mendukung kata panjang. */
  const pecah = (teks, ukuran, f, lebarMaks) => {
    const kata = teks.split(/\s+/);
    const hasil = [];
    let kini = "";
    for (const k of kata) {
      const coba = kini ? `${kini} ${k}` : k;
      if (f.widthOfTextAtSize(coba, ukuran) <= lebarMaks) {
        kini = coba;
      } else {
        if (kini) hasil.push(kini);
        // kata tunggal lebih lebar dari kolom: potong paksa
        if (f.widthOfTextAtSize(k, ukuran) > lebarMaks) {
          let sisa = k;
          while (f.widthOfTextAtSize(sisa, ukuran) > lebarMaks) {
            let potong = sisa.length;
            while (potong > 1 && f.widthOfTextAtSize(sisa.slice(0, potong), ukuran) > lebarMaks) potong--;
            hasil.push(sisa.slice(0, potong));
            sisa = sisa.slice(potong);
          }
          kini = sisa;
        } else {
          kini = k;
        }
      }
    }
    if (kini) hasil.push(kini);
    return hasil;
  };

  /** Menulis paragraf dengan pemenggalan tebal. */
  const tulisParagraf = (teks, { ukuran = 11, jarak = 16, kiri = MARGIN, lebar = LEBAR_ISI, warna = HITAM } = {}) => {
    const bagian = segmen(teks);
    // Susun kata beserta status tebalnya
    const kata = [];
    for (const s of bagian) {
      for (const k of s.teks.split(/(\s+)/)) {
        if (k === "") continue;
        kata.push({ teks: k, tebal: s.tebal });
      }
    }

    let x = kiri;
    perlu(jarak);
    let yBaris = y - ukuran;

    for (const k of kata) {
      const f = k.tebal ? tebal : biasa;
      const w = f.widthOfTextAtSize(k.teks, ukuran);
      const spasi = k.teks.trim() === "" ? 0 : w;

      if (x + spasi > kiri + lebar && k.teks.trim() !== "") {
        y -= jarak;
        perlu(jarak);
        yBaris = y - ukuran;
        x = kiri;
      }
      if (k.teks.trim() === "") {
        x += f.widthOfTextAtSize(" ", ukuran);
        continue;
      }
      page.drawText(k.teks, { x, y: yBaris, size: ukuran, font: f, color: warna });
      x += w;
    }
    y -= jarak;
  };

  /* ------------------------------------------------------------- halaman cover */

  // Judul besar + subjudul
  page.drawRectangle({ x: 0, y: A4.tinggi - 148, width: A4.lebar, height: 148, color: Aksen });
  page.drawText("PANDUAN PEMILIK", {
    x: MARGIN,
    y: A4.tinggi - 74,
    size: 26,
    font: tebal,
    color: rgb(1, 1, 1),
  });
  page.drawText("Kasir Kayesha", {
    x: MARGIN,
    y: A4.tinggi - 106,
    size: 18,
    font: biasa,
    color: rgb(0.98, 0.93, 0.91),
  });
  page.drawText("Aplikasi kasir butik untuk pameran", {
    x: MARGIN,
    y: A4.tinggi - 128,
    size: 11,
    font: biasa,
    color: rgb(0.95, 0.88, 0.85),
  });
  y = A4.tinggi - 176;

  for (const b of blok) {
    switch (b.jenis) {
      case "judul1":
        // sudah digambar di cover
        break;

      case "judul2": {
        y -= 10;
        perlu(46);
        page.drawRectangle({ x: MARGIN - 12, y: y - 6, width: 4, height: 22, color: Aksen });
        page.drawText(bersihkan(b.isi), {
          x: MARGIN,
          y: y + 2,
          size: 15,
          font: tebal,
          color: Aksen,
        });
        y -= 26;
        break;
      }

      case "paragraf":
        tulisParagraf(b.isi, { ukuran: 11, jarak: 16 });
        break;

      case "kutip": {
        const teks = bersihkan(b.isi);
        const barisKutip = pecah(teks, 10, biasa, LEBAR_ISI - 26);
        const tinggiBox = barisKutip.length * 14 + 14;
        perlu(tinggiBox + 6);
        page.drawRectangle({
          x: MARGIN,
          y: y - tinggiBox + 4,
          width: LEBAR_ISI,
          height: tinggiBox,
          color: rgb(0.98, 0.96, 0.94),
          borderColor: GARIS,
          borderWidth: 0.7,
        });
        page.drawRectangle({ x: MARGIN, y: y - tinggiBox + 4, width: 3, height: tinggiBox, color: Aksen });
        let yy = y - 8;
        for (const r of barisKutip) {
          page.drawText(r, { x: MARGIN + 14, y: yy - 10, size: 10, font: biasa, color: HITAM });
          yy -= 14;
        }
        y -= tinggiBox + 8;
        break;
      }

      case "daftar": {
        for (const butir of b.butir) {
          const indent = butir.menjorok ? 22 : 0;
          const penanda = butir.nomor ? `${butir.angka}.` : "•";
          const xTeks = MARGIN + 20 + indent;
          const lebarTeks = LEBAR_ISI - 20 - indent;

          // Gambar penanda + teks dengan pemenggalan tebal per baris
          const bagian = segmen(butir.teks);
          const kata = [];
          for (const s of bagian) {
            for (const k of s.teks.split(/(\s+)/)) {
              if (k === "") continue;
              kata.push({ teks: k, tebal: s.tebal });
            }
          }

          perlu(16);
          let x = xTeks;
          let yBaris = y - 11;
          let barisPertama = true;

          page.drawText(penanda, {
            x: MARGIN + indent + (butir.nomor ? 0 : 4),
            y: y - 11,
            size: 11,
            font: butir.nomor ? tebal : biasa,
            color: Aksen,
          });

          for (const k of kata) {
            const f = k.tebal ? tebal : biasa;
            const w = f.widthOfTextAtSize(k.teks, 11);
            if (x + w > MARGIN + LEBAR_ISI && k.teks.trim() !== "") {
              y -= 15;
              perlu(15);
              yBaris = y - 11;
              x = xTeks;
              barisPertama = false;
            }
            if (k.teks.trim() === "") {
              x += biasa.widthOfTextAtSize(" ", 11);
              continue;
            }
            page.drawText(k.teks, { x, y: yBaris, size: 11, font: f, color: HITAM });
            x += w;
          }
          void barisPertama;
          void lebarTeks;
          y -= 15;
        }
        y -= 4;
        break;
      }

      case "tabel": {
        const kolom = b.kepala.length;
        const lebarKolom = kolom === 2 ? [LEBAR_ISI * 0.42, LEBAR_ISI * 0.58] : new Array(kolom).fill(LEBAR_ISI / kolom);
        const ukuran = 10;

        const barisTinggi = (sel) => {
          const maks = Math.max(
            ...sel.map((s, i) => pecah(bersihkan(s), ukuran, biasa, lebarKolom[i] - 14).length),
          );
          return Math.max(1, maks) * 13 + 8;
        };

        // kepala
        const tinggiKepala = barisTinggi(b.kepala);
        perlu(tinggiKepala + 4);
        page.drawRectangle({
          x: MARGIN,
          y: y - tinggiKepala,
          width: LEBAR_ISI,
          height: tinggiKepala,
          color: Aksen,
        });
        let xk = MARGIN + 7;
        for (let i = 0; i < kolom; i++) {
          page.drawText(bersihkan(b.kepala[i] ?? ""), {
            x: xk,
            y: y - tinggiKepala + 8,
            size: ukuran,
            font: tebal,
            color: rgb(1, 1, 1),
          });
          xk += lebarKolom[i];
        }
        y -= tinggiKepala;

        for (const br of b.baris) {
          const tinggi = barisTinggi(br);
          perlu(tinggi);
          page.drawRectangle({
            x: MARGIN,
            y: y - tinggi,
            width: LEBAR_ISI,
            height: tinggi,
            color: rgb(0.995, 0.99, 0.985),
            borderColor: GARIS,
            borderWidth: 0.5,
          });
          let xb = MARGIN + 7;
          for (let i = 0; i < kolom; i++) {
            const barisSel = pecah(bersihkan(br[i] ?? ""), ukuran, biasa, lebarKolom[i] - 14);
            let ys = y - 14;
            for (const r of barisSel) {
              page.drawText(r, { x: xb, y: ys, size: ukuran, font: biasa, color: HITAM });
              ys -= 13;
            }
            xb += lebarKolom[i];
          }
          y -= tinggi;
        }
        y -= 6;
        break;
      }

      case "pemisah":
        // pemisah diganti jarak; garis tipis agar tetap rapi
        y -= 6;
        break;

      default:
        break;
    }
  }

  // Garis penutup (kalimatnya sendiri sudah bagian dari dokumen sumber).
  y -= 10;
  perlu(16);
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: A4.lebar - MARGIN, y: y + 6 },
    thickness: 0.7,
    color: GARIS,
  });

  const bytes = await doc.save();
  mkdirSync(dirname(TUJUAN), { recursive: true });
  writeFileSync(TUJUAN, bytes);

  const muatUlang = await PDFDocument.load(bytes);
  console.log(
    `PDF dibuat: ${TUJUAN}\n  halaman: ${muatUlang.getPageCount()}  ·  ukuran: ${(bytes.length / 1024).toFixed(1)} KB`,
  );
}

buat().catch((e) => {
  console.error("Gagal membuat PDF:", e);
  process.exitCode = 1;
});
