import { useEffect, useState } from "react";
import { daftarFoto } from "../db/repositori.ts";
import type { UUID } from "../db/schema.ts";

/**
 * URL objek untuk thumbnail barang (foto urutan 1).
 * URL dilepas saat komponen dilepas agar memori tidak bocor — penting di HP lama.
 */
export function useThumbnail(produkId: UUID): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    let dibuat: string | null = null;

    daftarFoto(produkId)
      .then((foto) => {
        if (!hidup || foto.length === 0) return;
        const pertama = foto[0];
        if (!pertama) return;
        dibuat = URL.createObjectURL(pertama.blob);
        setUrl(dibuat);
      })
      .catch(() => setUrl(null));

    return () => {
      hidup = false;
      if (dibuat) URL.revokeObjectURL(dibuat);
    };
  }, [produkId]);

  return url;
}

/** Semua foto barang berurutan (dipakai layar Detail). */
export function useFotoBarang(produkId: UUID): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let hidup = true;
    const dibuat: string[] = [];

    daftarFoto(produkId)
      .then((foto) => {
        if (!hidup) return;
        const daftar = foto.map((f) => {
          const u = URL.createObjectURL(f.blob);
          dibuat.push(u);
          return u;
        });
        setUrls(daftar);
      })
      .catch(() => setUrls([]));

    return () => {
      hidup = false;
      dibuat.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [produkId]);

  return urls;
}
