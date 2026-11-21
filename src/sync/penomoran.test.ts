/**
 * Tes alokasi nomor urut dari hub (F4, BU-19/21).
 *
 * Yang dikunci:
 *  1. Tanpa URL sync / offline → null (penjualan memakai nomor lokal).
 *  2. Hub menjawab nomor → nomor itu yang dipakai.
 *  3. Hub gagal / tidak menjawab → null (penjualan tidak pernah menunggu).
 *  4. URL endpoint dihitung dari URL sync (…/api/sync → …/api/nomor-urut).
 */
import { describe, expect, it } from "vitest";
import { mintaNomorUrutBulan, urlNomorUrut } from "./penomoran.ts";

describe("urlNomorUrut", () => {
  it("mengganti /api/sync dengan /api/nomor-urut", () => {
    expect(urlNomorUrut("https://t2-kayesa.pages.dev/api/sync")).toBe(
      "https://t2-kayesa.pages.dev/api/nomor-urut",
    );
  });

  it("menambah /api/nomor-urut bila URL sync tanpa akhiran", () => {
    expect(urlNomorUrut("https://t2-kayesa.pages.dev")).toBe(
      "https://t2-kayesa.pages.dev/api/nomor-urut",
    );
  });
});

describe("mintaNomorUrutBulan", () => {
  const json = (isi: unknown, ok = true) =>
    new Response(JSON.stringify(isi), { status: ok ? 200 : 500, headers: { "content-type": "application/json" } });

  it("tanpa URL sync → null (tidak ada yang dihubungi)", async () => {
    let dipanggil = 0;
    const f = (async () => {
      dipanggil += 1;
      return json({ ok: true, nomor: 1 });
    }) as unknown as typeof fetch;
    expect(await mintaNomorUrutBulan({ urlSync: "", bulan: "2026-11", fetchImpl: f })).toBeNull();
    expect(dipanggil).toBe(0);
  });

  it("hub menjawab nomor → nomor dipakai", async () => {
    const f = (async () => json({ ok: true, nomor: 7 })) as unknown as typeof fetch;
    expect(
      await mintaNomorUrutBulan({ urlSync: "https://t2-kayesa.pages.dev/api/sync", bulan: "2026-11", fetchImpl: f }),
    ).toBe(7);
  });

  it("hub menjawab bukan nomor → null", async () => {
    const f = (async () => json({ ok: false, pesan: "gagal" })) as unknown as typeof fetch;
    expect(
      await mintaNomorUrutBulan({ urlSync: "https://t2-kayesa.pages.dev/api/sync", bulan: "2026-11", fetchImpl: f }),
    ).toBeNull();
  });

  it("fetch melempar (offline) → null, penjualan tidak menunggu", async () => {
    const f = (async () => {
      throw new Error("jaringan mati");
    }) as unknown as typeof fetch;
    expect(
      await mintaNomorUrutBulan({ urlSync: "https://t2-kayesa.pages.dev/api/sync", bulan: "2026-11", fetchImpl: f }),
    ).toBeNull();
  });

  it("mengirim bulan yang diminta di badan POST", async () => {
    let badan: unknown = null;
    const f = (async (_url: string, init?: RequestInit) => {
      badan = JSON.parse(String(init?.body ?? "{}"));
      return json({ ok: true, nomor: 3 });
    }) as unknown as typeof fetch;
    await mintaNomorUrutBulan({ urlSync: "https://t2-kayesa.pages.dev/api/sync", bulan: "2026-12", fetchImpl: f });
    expect(badan).toEqual({ bulan: "2026-12" });
  });
});
