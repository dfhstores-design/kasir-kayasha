import { useEffect, useMemo } from "react";
import type { SettingsRecord } from "../db/repositori.ts";
import { dataContoh, susunResi } from "../lib/resi.ts";
import PratinjauResi from "../components/PratinjauResi.tsx";

/**
 * Pratinjau "contoh resi" dari Pengaturan — memakai susunan yang SAMA dengan resi asli,
 * sehingga pemilik melihat hasil akhir sebelum bertransaksi.
 */
export default function ContohResi({ settings }: { settings: SettingsRecord }) {
  const data = useMemo(() => dataContoh(settings), [settings]);
  const baris = useMemo(() => susunResi(data), [data]);

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
        Contoh resi — data barang di bawah hanya contoh.
      </p>
      <PratinjauResi baris={baris} logoUrl={logoUrl} />
    </div>
  );
}
