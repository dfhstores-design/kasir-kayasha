import { useEffect, useMemo } from "react";
import type { SettingsRecord } from "../db/repositori.ts";
import { dataContoh, dataContohPO, susunResi } from "../lib/resi.ts";
import PratinjauResi from "../components/PratinjauResi.tsx";

/**
 * Pratinjau "contoh resi" dari Pengaturan — memakai susunan yang SAMA dengan resi asli,
 * sehingga pemilik melihat hasil akhir sebelum bertransaksi.
 *
 * Dua pratinjau, mengikuti contoh yang dibahas Andri (mockup v8/v9/v4):
 * penjualan barang (lunas) dan pesanan jahit (lunas). Keduanya berlabel
 * CONTOH DATA FIKTIF di dalam resinya sendiri; data barang di bawah hanya contoh.
 * Pratinjau pesanan memakai data contoh Nadia Putri / Kebaya brokat — itu HANYA
 * data pratinjau; model pesanan jahit belum ada di skema transaksi.
 */
export default function ContohResi({ settings }: { settings: SettingsRecord }) {
  const barisJual = useMemo(() => susunResi(dataContoh(settings)), [settings]);
  const barisPO = useMemo(() => susunResi(dataContohPO(settings)), [settings]);

  const logoUrl = useMemo(() => (settings.logo ? URL.createObjectURL(settings.logo) : null), [settings.logo]);
  useEffect(() => {
    const u = logoUrl;
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [logoUrl]);

  return (
    <div className="content">
      <p className="soft" style={{ margin: 0 }}>
        Contoh resi penjualan — data barang di bawah hanya contoh.
      </p>
      <PratinjauResi baris={barisJual} logoUrl={logoUrl} />
      <p className="soft" style={{ margin: "1rem 0 0" }}>
        Contoh resi pesanan (lunas) — data pemesan di bawah hanya contoh.
      </p>
      <PratinjauResi baris={barisPO} logoUrl={logoUrl} />
    </div>
  );
}
