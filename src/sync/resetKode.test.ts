/**
 * Tes kode reset PIN sekali pakai (BU-65).
 *
 * Yang dikunci:
 *  1. Kode benar → PIN peran itu terhapus di hub + kode tidak bisa dipakai lagi.
 *  2. Kode salah → ditolak, percobaan dihitung; 5 kali salah = kode mati.
 *  3. Kode kedaluwarsa / peran salah / format salah → ditolak.
 *  4. Kode untuk bazar menghapus PIN kasir bazar itu.
 *  5. PIN asli dan kode polos TIDAK PERNAH tersimpan di database.
 */
import { describe, expect, it } from "vitest";
import {
  buatKodeReset,
  hashKodeReset,
  pakaiKodeReset,
  type DBCloud,
} from "./resetKode.ts";

/** D1 tiruan minimal: hanya pernyataan SQL yang dipakai resetKode. */
class DBResetTiruan implements DBCloud {
  kode: Array<Record<string, unknown>> = [];
  pin: Array<Record<string, unknown>> = [];
  bazar: Array<Record<string, unknown>> = [];
  log: Array<Record<string, unknown>> = [];

  prepare(sql: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const db: DBResetTiruan = this;
    const bersih = sql.replace(/\s+/g, " ").trim();
    return {
      bind(...nilai: unknown[]) {
        return {
          async run() {
            db.jalankan(bersih, nilai);
            return {};
          },
          async first<T>() {
            return db.cari(bersih, nilai) as T | null;
          },
          async all<T>() {
            return { results: db.cariSemua(bersih, nilai) as T[] };
          },
        };
      },
    };
  }

  private jalankan(sql: string, nilai: unknown[]) {
    if (sql.startsWith("INSERT INTO kode_reset_pin")) {
      const [id, peran, hashKode, dibuatPada, kedaluwarsaPada, dipakaiPada, percobaanGagal, perangkat] = nilai;
      this.kode.push({
        id,
        peran,
        hash_kode: hashKode,
        dibuat_pada: dibuatPada,
        kedaluwarsa_pada: kedaluwarsaPada,
        dipakai_pada: dipakaiPada,
        percobaan_gagal: percobaanGagal,
        perangkat,
      });
      return;
    }
    if (sql.startsWith("INSERT INTO pin_sync")) {
      const [peran, hash, diubahPada, perangkat] = nilai as [string, string | null, string, string | null];
      const i = this.pin.findIndex((r) => r.peran === peran);
      if (i >= 0) {
        if (String(diubahPada) > String(this.pin[i]!.diubah_pada ?? "")) {
          this.pin[i] = { peran, hash, diubah_pada: diubahPada, perangkat };
        }
      } else {
        this.pin.push({ peran, hash, diubah_pada: diubahPada, perangkat });
      }
      return;
    }
    if (sql.startsWith("INSERT OR REPLACE INTO sync_log")) {
      const [kunci, jenis, idRecord, diterimaPada] = nilai;
      const i = this.log.findIndex((r) => r.kunci === kunci);
      const baris = { kunci, jenis, id_record: idRecord, diterima_pada: diterimaPada };
      if (i >= 0) this.log[i] = baris;
      else this.log.push(baris);
      return;
    }
    if (sql.startsWith("UPDATE kode_reset_pin SET dipakai_pada")) {
      const [dipakaiPada, id] = nilai as [string, string];
      const b = this.kode.find((r) => r.id === id);
      if (b && b.dipakai_pada == null) b.dipakai_pada = dipakaiPada;
      return;
    }
    if (sql.startsWith("UPDATE kode_reset_pin SET percobaan_gagal = percobaan_gagal + 1")) {
      const [id] = nilai as [string];
      const b = this.kode.find((r) => r.id === id);
      if (b) b.percobaan_gagal = Number(b.percobaan_gagal ?? 0) + 1;
      return;
    }
    if (sql.startsWith("UPDATE kode_reset_pin SET percobaan_gagal = ?")) {
      const [jumlah, id] = nilai as [number, string];
      const b = this.kode.find((r) => r.id === id);
      if (b) b.percobaan_gagal = jumlah;
      return;
    }
    if (sql.startsWith("UPDATE bazars SET pin_kasir_hash")) {
      const [diubahPada, id] = nilai as [string, string];
      const b = this.bazar.find((r) => r.id === id);
      if (b) {
        b.pin_kasir_hash = null;
        b.diubah_pada = diubahPada;
      }
      return;
    }
    throw new Error("SQL tak dikenal: " + sql.slice(0, 40));
  }

  private cari(sql: string, nilai: unknown[]) {
    if (sql.includes("FROM kode_reset_pin WHERE id = ?")) {
      return this.kode.find((r) => r.id === nilai[0]) ?? null;
    }
    throw new Error("SELECT tak dikenal: " + sql.slice(0, 40));
  }

  private cariSemua(sql: string, nilai: unknown[]) {
    if (sql.includes("FROM kode_reset_pin WHERE peran = ?")) {
      const [peran, sekarang] = nilai as [string, string];
      return this.kode
        .filter((r) => r.peran === peran && r.dipakai_pada == null && String(r.kedaluwarsa_pada ?? "") > sekarang)
        .sort((a, b) => String(b.dibuat_pada ?? "").localeCompare(String(a.dibuat_pada ?? "")));
    }
    throw new Error("SELECT tak dikenal: " + sql.slice(0, 40));
  }
}

const SEKARANG = "2026-11-22T00:00:00.000Z";

describe("buatKodeReset", () => {
  it("membuat kode 6 angka dan hanya menyimpan hash-nya", async () => {
    const db = new DBResetTiruan();
    const hasil = await buatKodeReset(db, "admin", SEKARANG);
    expect(hasil.kode).toMatch(/^\d{6}$/);
    expect(hasil.kedaluwarsaPada).toBe("2026-11-22T01:00:00.000Z");
    expect(db.kode).toHaveLength(1);
    const baris = db.kode[0]!;
    expect(baris.peran).toBe("admin");
    expect(baris.hash_kode).toBe(await hashKodeReset(hasil.kode));
    // Kode polos tidak tersimpan di mana pun di baris itu.
    expect(Object.values(baris).some((v) => v === hasil.kode)).toBe(false);
    expect(baris.dipakai_pada).toBeNull();
    expect(baris.percobaan_gagal).toBe(0);
  });
});

describe("pakaiKodeReset", () => {
  it("kode benar menghapus PIN peran di hub dan tidak bisa dipakai lagi", async () => {
    const db = new DBResetTiruan();
    db.pin.push({ peran: "admin", hash: "sha256$salt$lama", diubah_pada: "2026-11-21T00:00:00.000Z", perangkat: "hp-1" });
    const { kode } = await buatKodeReset(db, "admin", SEKARANG);
    const hasil = await pakaiKodeReset(db, "admin", kode, SEKARANG);
    expect(hasil).toEqual({ ok: true, peran: "admin" });
    expect(db.pin[0]!.hash).toBeNull();
    expect(db.kode[0]!.dipakai_pada).toBe(SEKARANG);
    expect(db.log.some((r) => r.jenis === "reset-pin" && r.id_record === "admin")).toBe(true);

    const ulang = await pakaiKodeReset(db, "admin", kode, SEKARANG);
    expect(ulang.ok).toBe(false);
  });

  it("kode salah ditolak dan percobaan dihitung; 5 kali salah = kode mati", async () => {
    const db = new DBResetTiruan();
    const { kode } = await buatKodeReset(db, "owner", SEKARANG);
    for (let n = 1; n <= 4; n++) {
      const salah = await pakaiKodeReset(db, "owner", "000000", SEKARANG);
      expect(salah).toEqual({ ok: false, pesan: `Kode salah. Sisa percobaan: ${5 - n}.` });
    }
    const kelima = await pakaiKodeReset(db, "owner", "000000", SEKARANG);
    expect(kelima).toEqual({ ok: false, pesan: "Kode ini sudah terlalu banyak dicoba. Minta kode baru ke Andri." });
    // Kode yang benar pun sudah mati sesudah 5 kali salah.
    const benar = await pakaiKodeReset(db, "owner", kode, SEKARANG);
    expect(benar.ok).toBe(false);
    expect(db.pin).toHaveLength(0);
  });

  it("kode kedaluwarsa ditolak", async () => {
    const db = new DBResetTiruan();
    const { kode } = await buatKodeReset(db, "admin", SEKARANG);
    const lewat = await pakaiKodeReset(db, "admin", kode, "2026-11-22T01:00:01.000Z");
    expect(lewat.ok).toBe(false);
    expect(db.pin).toHaveLength(0);
  });

  it("kode untuk peran lain ditolak", async () => {
    const db = new DBResetTiruan();
    const { kode } = await buatKodeReset(db, "admin", SEKARANG);
    const hasil = await pakaiKodeReset(db, "owner", kode, SEKARANG);
    expect(hasil.ok).toBe(false);
    expect(db.pin).toHaveLength(0);
  });

  it("format kode dan peran yang tidak sah ditolak tanpa menyentuh database", async () => {
    const db = new DBResetTiruan();
    await buatKodeReset(db, "admin", SEKARANG);
    expect((await pakaiKodeReset(db, "admin", "12345", SEKARANG)).ok).toBe(false);
    expect((await pakaiKodeReset(db, "admin", "abcdef", SEKARANG)).ok).toBe(false);
    expect((await pakaiKodeReset(db, "tante" as never, "123456", SEKARANG)).ok).toBe(false);
    expect(db.kode[0]!.percobaan_gagal).toBe(0);
  });

  it("kode bazar menghapus PIN kasir bazar itu saja", async () => {
    const db = new DBResetTiruan();
    db.bazar.push({ id: "bazar-1", pin_kasir_hash: "sha256$salt$lama", diubah_pada: "2026-11-21T00:00:00.000Z" });
    db.bazar.push({ id: "bazar-2", pin_kasir_hash: "sha256$salt$lain", diubah_pada: "2026-11-21T00:00:00.000Z" });
    const { kode } = await buatKodeReset(db, "bazar:bazar-1", SEKARANG);
    const hasil = await pakaiKodeReset(db, "bazar:bazar-1", kode, SEKARANG);
    expect(hasil).toEqual({ ok: true, peran: "bazar:bazar-1" });
    expect(db.bazar[0]!.pin_kasir_hash).toBeNull();
    expect(db.bazar[1]!.pin_kasir_hash).toBe("sha256$salt$lain");
  });
});
