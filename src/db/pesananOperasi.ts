/**
 * Operasi pada pesanan yang sudah ada: pembayaran, status, ongkir, pembatalan.
 * Semua membaca transaksi + item + pembayaran sebelum menulis, dan memvalidasi
 * sebelum mengubah data apa pun.
 */
import { getDB } from "./schema.ts";
import type { JournalRecord, PembayaranRecord, TransaksiRecord, ItemTransaksiRecord, UUID } from "./schema.ts";
import { buatId, ambilTransaksi, simpanTransaksi } from "./repositori.ts";
import { sumberStokUntuk } from "../lib/sumberStok.ts";
import { hitungPembayaranBaru, hitungIsiOngkir, transisiSah, type StatusPesanan } from "../lib/pesanan.ts";
import type { Ongkir } from "../lib/ongkir.ts";

export type HasilOperasi = { ok: true } | { ok: false; pesan: string };

export interface PesananLengkap {
  transaksi: TransaksiRecord;
  item: ItemTransaksiRecord[];
  pembayaran: PembayaranRecord[];
}

export async function ambilPesanan(id: UUID): Promise<PesananLengkap | undefined> {
  return ambilTransaksi(id);
}

/* -------------------------------------------------------- pembayaran */

/**
 * Mencatat pembayaran baru. Nominal melebihi sisa DITOLAK.
 * Status pembayaran dihitung ulang dari seluruh pembayaran.
 */
export async function catatPembayaran(
  transaksiId: UUID,
  nilai: { nominal: number; waktu: string; metode: string | null; catatan: string | null },
): Promise<HasilOperasi> {
  const lengkap = await ambilTransaksi(transaksiId);
  if (!lengkap) return { ok: false, pesan: "Pesanan tidak ditemukan." };
  if (lengkap.transaksi.statusPesanan === "dibatalkan") {
    return { ok: false, pesan: "Pesanan sudah dibatalkan." };
  }

  const hasil = hitungPembayaranBaru(
    lengkap.transaksi.total,
    lengkap.pembayaran.map((p) => p.nominal),
    nilai.nominal,
  );
  if (!hasil.ok) return { ok: false, pesan: hasil.pesan };

  const db = await getDB();
  const tx = db.transaction(["payments", "transactions"], "readwrite");
  await tx.objectStore("payments").put({
    id: buatId(),
    transaksiId,
    nominal: nilai.nominal,
    waktu: nilai.waktu,
    metode: nilai.metode,
    catatan: nilai.catatan,
  });
  await tx.objectStore("transactions").put({
    ...lengkap.transaksi,
    statusBayar: hasil.status,
    updatedAt: new Date().toISOString(),
  });
  await tx.done;
  return { ok: true };
}

/* ------------------------------------------------------------ status */

/**
 * Mengubah status pesanan. Saat berpindah ke **selesai**, stok dikurangi
 * (PO tidak mengurangi stok saat dibuat).
 */
export async function ubahStatusPesanan(id: UUID, ke: StatusPesanan): Promise<HasilOperasi> {
  const lengkap = await ambilTransaksi(id);
  if (!lengkap) return { ok: false, pesan: "Pesanan tidak ditemukan." };

  const dari = lengkap.transaksi.statusPesanan;
  if (!transisiSah(dari, ke)) {
    return { ok: false, pesan: `Tidak bisa dari "${dari}" ke "${ke}".` };
  }

  // Menyelesaikan PO = barang keluar → stok berkurang.
  if (ke === "selesai" && lengkap.transaksi.jenis === "po") {
    const trx: TransaksiRecord = { ...lengkap.transaksi, statusPesanan: "selesai", updatedAt: new Date().toISOString() };
    try {
      await simpanTransaksi(
        trx,
        [],
        [],
        sumberStokUntuk(
          lengkap.item.map((i) => ({ produkId: i.produkId ?? "", kuantitas: i.kuantitas })).filter((i) => i.produkId),
          lengkap.transaksi.bazarId,
        ),
      );
    } catch (e) {
      return { ok: false, pesan: e instanceof Error ? e.message : "Status belum berubah." };
    }
    return { ok: true };
  }

  const db = await getDB();
  await db.put("transactions", {
    ...lengkap.transaksi,
    statusPesanan: ke,
    dibatalkanPada: ke === "dibatalkan" ? new Date().toISOString() : lengkap.transaksi.dibatalkanPada,
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

/* ------------------------------------------------ ongkir menyusul */

/**
 * Mengisi ongkir yang tadinya "belum ditentukan".
 * Total dihitung ulang dan perubahan dicatat di `riwayatTotal`.
 */
export async function isiOngkir(id: UUID, ongkirBaru: Ongkir): Promise<HasilOperasi> {
  const lengkap = await ambilTransaksi(id);
  if (!lengkap) return { ok: false, pesan: "Pesanan tidak ditemukan." };
  if (lengkap.transaksi.statusPesanan === "dibatalkan") {
    return { ok: false, pesan: "Pesanan sudah dibatalkan." };
  }

  const waktu = new Date().toISOString();
  const hasil = hitungIsiOngkir(
    {
      subtotalAwal: lengkap.transaksi.subtotalAwal,
      diskonItem: lengkap.transaksi.diskonItem,
      diskonTotal: lengkap.transaksi.diskonTotal,
      totalSekarang: lengkap.transaksi.total,
      ongkirBaru,
      pembayaran: lengkap.pembayaran.map((p) => p.nominal),
      statusSekarang: lengkap.transaksi.statusBayar,
    },
    waktu,
  );
  if (!hasil.ok) return { ok: false, pesan: hasil.pesan };

  const db = await getDB();
  await db.put("transactions", {
    ...lengkap.transaksi,
    ongkirMode: ongkirBaru.mode,
    ongkirNominal: ongkirBaru.nominal,
    total: hasil.totalBaru,
    statusBayar: hasil.status,
    riwayatTotal: [...lengkap.transaksi.riwayatTotal, hasil.catatan],
    updatedAt: waktu,
  });
  return { ok: true };
}

/* --------------------------------------------------------- pembatalan */

/**
 * Membatalkan transaksi — WAJIB pakai alasan tertulis (BU-63, sama seperti
 * batalkanPesananKasir/BU-17.C: tidak boleh batal tanpa alasan yang jelas).
 * - Penjualan langsung: stok dikembalikan.
 * - PO: stok tidak pernah dikurangi, jadi tidak ada yang dikembalikan
 *   kecuali PO sudah selesai (barang sudah keluar).
 * Pembayaran TIDAK dihapus. F8/BU-63: uang yang sudah diterima DIKEMBALIKAN
 * ke pelanggan — dicatat sebagai baris pembayaran negatif ("Pengembalian DP",
 * satu per pembayaran awal, metode sama) + jurnal balik, dan pembatalan
 * ditandai untuk sync supaya alasan + pengembalian sampai ke perangkat lain.
 */
export async function batalkanTransaksi(id: UUID, alasan: string): Promise<HasilOperasi> {
  const alasanBersih = alasan.trim();
  if (alasanBersih.length < 3) return { ok: false, pesan: "Isi alasan pembatalan (minimal 3 huruf)." };

  const lengkap = await ambilTransaksi(id);
  if (!lengkap) return { ok: false, pesan: "Transaksi tidak ditemukan." };
  const t = lengkap.transaksi;
  if (t.statusPesanan === "dibatalkan") return { ok: false, pesan: "Transaksi sudah dibatalkan." };

  const sudahKeluarStok = t.jenis === "po" ? t.statusPesanan === "selesai" : true;
  const waktu = new Date().toISOString();
  const terbayar = lengkap.pembayaran.reduce((n, p) => n + p.nominal, 0);
  const catatanBaru = t.catatanPesanan
    ? `${t.catatanPesanan}\nDibatalkan: ${alasanBersih}`
    : `Dibatalkan: ${alasanBersih}`;

  const db = await getDB();
  const tx = db.transaction(["transactions", "products", "bazar_items", "journal", "payments"], "readwrite");

  // Penjaga di DALAM transaksi tulis (F6, tes klik 22 Nov 2026): dua
  // panggilan batal bersamaan (mis. tombol ditekan dua kali) sama-sama
  // lolos pemeriksaan status di luar transaksi, lalu masing-masing
  // mengembalikan stok + menulis baris pengembalian — Blus 9→11. Periksa
  // ulang di sini: transaksi tulis kedua mengantre sesudah yang pertama
  // commit, jadi panggilan kedua melihat status "dibatalkan" dan gagal
  // tanpa menulis apa pun.
  const tDiDalamTx = await tx.objectStore("transactions").get(id);
  if (!tDiDalamTx || tDiDalamTx.statusPesanan === "dibatalkan" || tDiDalamTx.dibatalkanPada) {
    await tx.done;
    return { ok: false, pesan: "Transaksi sudah dibatalkan." };
  }

  if (sudahKeluarStok) {
    // Kembalikan stok ke sumber asalnya.
    const items = lengkap.item.filter((i) => i.produkId);
    if (t.bazarId) {
      const bazarItems = await tx.objectStore("bazar_items").index("by-bazar").getAll(t.bazarId);
      for (const it of items) {
        const b = bazarItems.find((x) => x.produkId === it.produkId);
        if (b) {
          // Batalkan penjualan: terjual dikurangi (minimal 0).
          await tx.objectStore("bazar_items").put({
            ...b,
            terjual: Math.max(0, b.terjual - it.kuantitas),
            updatedAt: waktu,
          });
        }
      }
    } else {
      for (const it of items) {
        const p = await tx.objectStore("products").get(it.produkId as string);
        if (p) {
          await tx.objectStore("products").put({
            ...p,
            stokGudang: p.stokGudang + it.kuantitas,
            updatedAt: waktu,
          });
        }
      }
    }
  }

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
    for (const p of lengkap.pembayaran) {
      if (p.nominal <= 0) continue;
      const kembali: PembayaranRecord = {
        id: buatId(),
        transaksiId: id,
        nominal: -p.nominal,
        waktu,
        metode: p.metode,
        catatan: "Pengembalian DP",
      };
      await tx.objectStore("payments").put(kembali);
    }
  }
  await tx.done;

  // Antrean sinkronisasi (Fase 2B): pembatalan + alasan + pengembalian harus
  // sampai ke perangkat lain — sebelumnya fungsi ini tidak menandai sync.
  try {
    const { tandaiUntukSync } = await import("../sync/mesin.ts");
    await tandaiUntukSync("transaksi", id);
    // F15/F6, tes klik putaran 4 (22 Nov 2026): pembatalan mengembalikan stok
    // gudang, jadi produknya HARUS ikut ditandai untuk sync (alasan sama
    // seperti simpanTransaksi: tanpa ini hub tetap menyimpan stok lama dan
    // pull berikutnya menulis ulang pengembalian stok lokal). Hanya bila
    // stok memang dikembalikan ke gudang — penjualan bazar mengembalikan
    // saldo bazar (tidak disinkronkan, Tahap 3) dan PO yang belum selesai
    // tidak pernah mengurangi stok.
    if (sudahKeluarStok && !t.bazarId) {
      for (const it of lengkap.item) {
        if (it.produkId) await tandaiUntukSync("produk", it.produkId);
      }
    }
  } catch {
    // Sengaja diam: pembatalan lokal sudah sah.
  }
  return { ok: true };
}
