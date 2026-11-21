/**
 * Operasi uang-masuk & pembatalan khusus antar-muka kasir (BU-18, BU-23, BU-17.B/C).
 *
 * Dibedakan dari `pesananOperasi.catatPembayaran` yang MENOLAK bayar melebihi sisa:
 * kasir WAJIB boleh menerima LEBIH dari total dan menampilkan KEMBALIAN (BU-17.B).
 * Alur terima pembayaran memakai `terimaPembayaran` (lib/pembayaran.ts); jurnal
 * ditulis via `recomputeJurnalDariDokumen` (lib/jurnal.ts) sebagai recompute penuh,
 * supaya "satu rupiah diterima = satu baris jurnal, tidak pernah dua" (BU-08).
 *
 * Pembatalan (void) mencatat alasan & membalik uang masuk yang sudah diterima (BU-17.C).
 * Daftar/detail pesanan & log pengiriman DIPAKAI ulang dari `lib/jahitan.ts`
 * (milik agent ui-tante) — jangan diduplikasi di sini.
 *
 * Semua nominal integer Rupiah. Tidak ada floating point.
 */
import { getDB } from "./schema.ts";
import type { JournalRecord, PembayaranRecord, TransaksiRecord, UUID } from "./schema.ts";
import { ambilTransaksi, buatId } from "./repositori.ts";
import { terimaPembayaran } from "../lib/pembayaran.ts";
import { recomputeJurnalDariDokumen } from "../lib/jurnal.ts";
import type { Rupiah } from "../lib/money.ts";

export type HasilKasir = { ok: true } | { ok: false; pesan: string };

export interface HasilTerimaKasir {
  ok: true;
  kembalian: Rupiah;
  sisa: Rupiah;
  statusDokumen: "terbuka" | "lunas";
}

/**
 * Menerima satu pembayaran pesanan (BU-23).
 * Boleh bayar lebih; nominal diterima dicatat UTUH, kelebihan jadi KEMBALIAN (BU-17.B).
 * Menulis satu baris `payments`, memperbarui status bayar, dan menulis ulang jurnal.
 */
export async function terimaPembayaranKasir(
  dokumenId: UUID,
  nominal: Rupiah,
  metode: string | null,
): Promise<HasilTerimaKasir | { ok: false; pesan: string }> {
  const lengkap = await ambilTransaksi(dokumenId);
  if (!lengkap) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  const t = lengkap.transaksi;
  if (t.statusPesanan === "dibatalkan") return { ok: false, pesan: "Pesanan sudah dibatalkan." };

  const terbayarSebelumnya = lengkap.pembayaran.reduce((n, p) => n + p.nominal, 0);
  if (terbayarSebelumnya >= t.total) return { ok: false, pesan: "Pesanan sudah lunas." };

  const hasil = terimaPembayaran(t.total, terbayarSebelumnya, nominal);
  if (!hasil.ok) return { ok: false, pesan: hasil.pesan };

  const waktu = new Date().toISOString();
  const pembayaranBaru: PembayaranRecord = {
    id: buatId(),
    transaksiId: dokumenId,
    nominal,
    waktu,
    metode,
    catatan: null,
  };

  const jurnal = recomputeJurnalDariDokumen(
    { id: t.id, total: t.total },
    [...lengkap.pembayaran, pembayaranBaru],
  );
  const statusBayar: TransaksiRecord["statusBayar"] =
    hasil.ringkasan.statusBaru === "lunas"
      ? "lunas"
      : hasil.ringkasan.terbayarBaru > 0
        ? "dp"
        : "belum_dibayar";

  const db = await getDB();
  const tx = db.transaction(["payments", "transactions", "journal"], "readwrite");
  await tx.objectStore("payments").put(pembayaranBaru);
  await tx.objectStore("transactions").put({ ...t, statusBayar, updatedAt: waktu });

  const lama = await tx.objectStore("journal").index("by-dokumen").getAll(dokumenId);
  for (const baris of lama) await tx.objectStore("journal").delete(baris.id);
  for (const baris of jurnal) {
    const utuh: JournalRecord = { ...baris, id: buatId() };
    await tx.objectStore("journal").put(utuh);
  }
  await tx.done;

  // Antrean sinkronisasi (Fase 2B): pembayaran baru harus sampai ke perangkat
  // lain — sebelumnya pembayaran tidak pernah masuk outbox.
  try {
    const { tandaiUntukSync } = await import("../sync/mesin.ts");
    await tandaiUntukSync("transaksi", dokumenId);
  } catch {
    // Sengaja diam: pembayaran lokal sudah sah.
  }

  return {
    ok: true,
    kembalian: hasil.ringkasan.kembalian,
    sisa: hasil.ringkasan.sisaBaru,
    statusDokumen: hasil.ringkasan.statusBaru,
  };
}

/**
 * Membatalkan (void) pesanan dengan alasan tercatat (BU-17.C).
 * Riwayat pembayaran TIDAK dihapus; status jadi batal. Alasan dicatat di catatan
 * pesanan, dan bila ada uang diterima ditulis jurnal balik (arah keluar) sebagai audit.
 */
export async function batalkanPesananKasir(id: UUID, alasan: string): Promise<HasilKasir> {
  const alasanBersih = alasan.trim();
  if (alasanBersih.length < 3) return { ok: false, pesan: "Isi alasan pembatalan (minimal 3 huruf)." };

  const lengkap = await ambilTransaksi(id);
  if (!lengkap) return { ok: false, pesan: "Pesanan tidak ditemukan." };
  const t = lengkap.transaksi;
  if (t.statusPesanan === "dibatalkan") return { ok: false, pesan: "Pesanan sudah dibatalkan." };

  const waktu = new Date().toISOString();
  const terbayar = lengkap.pembayaran.reduce((n, p) => n + p.nominal, 0);
  const catatanBaru = t.catatanPesanan
    ? `${t.catatanPesanan}\nDibatalkan: ${alasanBersih}`
    : `Dibatalkan: ${alasanBersih}`;

  const db = await getDB();
  const tx = db.transaction(["transactions", "journal"], "readwrite");
  await tx.objectStore("transactions").put({
    ...t,
    statusPesanan: "dibatalkan",
    dibatalkanPada: waktu,
    catatanPesanan: catatanBaru,
    updatedAt: waktu,
  });

  if (terbayar > 0) {
    const balik: JournalRecord = {
      id: buatId(),
      arah: "keluar",
      kategori: "pembatalan",
      nominal: terbayar,
      waktu,
      dokumenId: id,
      pemilik: "usaha",
      sumber: "usaha",
      catatan: alasanBersih,
    };
    await tx.objectStore("journal").put(balik);
  }
  await tx.done;

  // Antrean sinkronisasi (Fase 2B): pembatalan harus sampai ke perangkat lain.
  try {
    const { tandaiUntukSync } = await import("../sync/mesin.ts");
    await tandaiUntukSync("transaksi", id);
  } catch {
    // Sengaja diam: pembatalan lokal sudah sah.
  }
  return { ok: true };
}