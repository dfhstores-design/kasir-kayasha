/**
 * Tes reset PIN dari perangkat (BU-65).
 *
 * Yang dikunci:
 *  1. Verifikasi kode: POST ke /api/reset-pin/pakai dengan peran + kode;
 *     jawaban ok → hapus PIN lokal peran itu + catat di log sinkron.
 *  2. Gagal jaringan = pesan "tidak ada internet" (bukan "kode salah").
 *  3. Jawaban server yang menolak (kode salah/kedaluwarsa) diteruskan
 *     pesannya apa adanya; PIN lokal TIDAK dihapus.
 *  4. Reset oleh owner mencatat "direset oleh owner" di log.
 *  5. Reset PIN bazar menghapus pinKasirHash bazar itu saja.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { getDB, resetKoneksiDB } from "../db/schema.ts";
import { ambilSettings, simpanSettings, SETTINGS_KOSONG } from "../db/repositori.ts";
import { buatHashPin } from "../lib/pin.ts";
import { hapusPinLokalSetelahReset, verifikasiKodeReset } from "./resetPin.ts";

function resetDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  resetKoneksiDB();
}

const jawab = (isi: unknown, status = 200): typeof fetch =>
  (async () =>
    new Response(JSON.stringify(isi), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

describe("verifikasiKodeReset", () => {
  beforeEach(resetDB);

  it("mengirim peran + kode ke endpoint pakai dan mengembalikan ok", async () => {
    const tangkap: Array<{ url: string; init: RequestInit }> = [];
    const fetchTangkap = (async (url: string, init: RequestInit) => {
      tangkap.push({ url, init });
      return new Response(JSON.stringify({ ok: true, peran: "admin" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const hasil = await verifikasiKodeReset("admin", "123456", fetchTangkap);
    expect(hasil).toEqual({ ok: true });
    expect(tangkap).toHaveLength(1);
    expect(tangkap[0]!.url).toBe("/api/reset-pin/pakai");
    expect(JSON.parse(String(tangkap[0]!.init.body))).toEqual({ peran: "admin", kode: "123456" });
  });

  it("gagal jaringan dibedakan dari kode salah", async () => {
    const fetchMati = (async () => {
      throw new TypeError("jaringan mati");
    }) as unknown as typeof fetch;
    const hasil = await verifikasiKodeReset("admin", "123456", fetchMati);
    expect(hasil).toEqual({ ok: false, pesan: "Tidak ada internet. Sambungkan internet dulu, lalu coba lagi." });
  });

  it("penolakan server diteruskan pesannya", async () => {
    const hasil = await verifikasiKodeReset(
      "owner",
      "000000",
      jawab({ ok: false, pesan: "Kode salah. Sisa percobaan: 4." }, 400),
    );
    expect(hasil).toEqual({ ok: false, pesan: "Kode salah. Sisa percobaan: 4." });
  });
});

describe("hapusPinLokalSetelahReset", () => {
  beforeEach(resetDB);

  it("menghapus PIN admin lokal + mencatat di log sinkron", async () => {
    await simpanSettings({ ...SETTINGS_KOSONG, pinHash: await buatHashPin("1212") });
    await hapusPinLokalSetelahReset("admin");
    const s = await ambilSettings();
    expect(s.pinHash).toBeNull();
    const db = await getDB();
    const log = await db.getAll("logSinkron");
    expect(log.some((l) => l.judul.includes("PIN admin direset dengan kode dari Andri"))).toBe(true);
  });

  it("reset oleh owner mencatat pelakunya di log", async () => {
    await simpanSettings({ ...SETTINGS_KOSONG, pinKasirTokoHash: await buatHashPin("8888") });
    await hapusPinLokalSetelahReset("kasir_toko", true);
    const s = await ambilSettings();
    expect(s.pinKasirTokoHash).toBeNull();
    const db = await getDB();
    const log = await db.getAll("logSinkron");
    expect(log.some((l) => l.judul.includes("PIN kasir toko direset oleh owner"))).toBe(true);
  });

  it("reset PIN bazar hanya menghapus PIN bazar itu", async () => {
    const sekarang = new Date().toISOString();
    const db = await getDB();
    await db.put("bazars", {
      id: "bazar-1",
      nama: "Bazar Uji",
      status: "aktif",
      lokasi: "Plaza",
      mulai: "2026-11-22",
      selesai: "2026-11-24",
      catatan: null,
      pinKasirHash: await buatHashPin("9999"),
      ringkasanTerjual: null,
      ringkasanDibawa: null,
      ringkasanSisa: null,
      ditutupPada: null,
      createdAt: sekarang,
      updatedAt: sekarang,
    });
    await db.put("bazars", {
      id: "bazar-2",
      nama: "Bazar Lain",
      status: "aktif",
      lokasi: "Pasar",
      mulai: "2026-11-22",
      selesai: "2026-11-24",
      catatan: null,
      pinKasirHash: await buatHashPin("7777"),
      ringkasanTerjual: null,
      ringkasanDibawa: null,
      ringkasanSisa: null,
      ditutupPada: null,
      createdAt: sekarang,
      updatedAt: sekarang,
    });
    await hapusPinLokalSetelahReset("bazar:bazar-1", true);
    expect((await db.get("bazars", "bazar-1"))?.pinKasirHash).toBeNull();
    expect((await db.get("bazars", "bazar-2"))?.pinKasirHash).not.toBeNull();
  });
});
