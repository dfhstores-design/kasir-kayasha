import { useEffect, useState } from "react";
import {
  daftarProduk,
  itemBazar,
  ringkasanBazar,
  tutupBazar,
  type BazarRecord,
  type RingkasanBazar,
} from "../db/repositori.ts";
import { hitungSaldoBazar } from "../lib/stok.ts";
import { formatRupiah } from "../lib/money.ts";
import type { UUID } from "../db/schema.ts";

interface Props {
  bazar: BazarRecord;
  onSelesai: () => void;
}

interface BarisSisa {
  produkId: UUID;
  nama: string;
  sisa: number;
  teks: string;
}

/**
 * Layar 17 — Tutup Bazar (docs/design/screens/17-tutup-bazar.md).
 *
 * Bawaan: semua sisa dikembalikan ke gudang. Sisa yang tidak dikembalikan
 * dianggap habis di lokasi bazar — tidak pernah negatif.
 */
export default function TutupBazar({ bazar, onSelesai }: Props) {
  const [ringkas, setRingkas] = useState<RingkasanBazar | null>(null);
  const [baris, setBaris] = useState<BarisSisa[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, items, produk] = await Promise.all([
        ringkasanBazar(bazar.id),
        itemBazar(bazar.id),
        daftarProduk(true),
      ]);
      setRingkas(r);
      setBaris(
        items
          .map((i) => {
            const p = produk.find((x) => x.id === i.produkId);
            const sisa = hitungSaldoBazar(i);
            return { produkId: i.produkId, nama: p?.nama ?? "Barang", sisa, teks: String(sisa) };
          })
          .filter((b) => b.sisa > 0),
      );
    })().catch(() => setBaris([]));
  }, [bazar.id]);

  async function tutup() {
    if (!window.confirm("Tutup bazar ini? Setelah ditutup tidak bisa dibuka lagi.")) return;
    setGalat(null);
    setSibuk(true);
    const peta = new Map<UUID, number>();
    for (const b of baris ?? []) {
      const n = Number(b.teks);
      if (!Number.isInteger(n) || n < 0 || n > b.sisa) {
        setGalat(`Perbaiki: ${b.nama} hanya sisa ${b.sisa}.`);
        setSibuk(false);
        return;
      }
      peta.set(b.produkId, n);
    }
    try {
      const h = await tutupBazar(bazar.id, peta);
      if (!h.ok) {
        setGalat(h.pesan);
        return;
      }
      onSelesai();
    } finally {
      setSibuk(false);
    }
  }

  if (ringkas === null || baris === null) {
    return (
      <div className="content">
        <p className="soft">Menghitung sisa…</p>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        <div>
          <p className="h2" style={{ margin: 0 }}>
            {bazar.nama}
          </p>
        </div>

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}

        <div className="card">
          <div className="ringkas">
            <span>Terjual</span>
            <span className="money">{ringkas.terjualPcs} pcs</span>
          </div>
          <div className="ringkas">
            <span>Uang masuk</span>
            <span className="money">{formatRupiah(ringkas.uangMasuk)}</span>
          </div>
          <div className="ringkas">
            <span>Dibawa</span>
            <span className="money">{ringkas.dibawa} pcs</span>
          </div>
          <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
          <div className="ringkas">
            <strong>Sisa</strong>
            <strong className="money">{ringkas.sisaPcs} pcs</strong>
          </div>
        </div>

        {baris.length > 0 ? (
          <>
            <span className="label">Sisa dibawa kembali ke gudang</span>
            {baris.map((b) => {
              const n = Number(b.teks);
              const lebih = n > b.sisa || n < 0;
              return (
                <div key={b.produkId} className="card">
                  <strong>{b.nama}</strong>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    Sisa bazar: {b.sisa}
                  </div>
                  <div className="grid2" style={{ marginTop: "0.5rem", alignItems: "center" }}>
                    <label htmlFor={`kembali-${b.produkId}`} style={{ margin: 0 }}>
                      Kembalikan
                    </label>
                    <input
                      id={`kembali-${b.produkId}`}
                      inputMode="numeric"
                      value={b.teks}
                      aria-invalid={lebih}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setBaris((list) => (list ?? []).map((x) => (x.produkId === b.produkId ? { ...x, teks: v } : x)));
                      }}
                    />
                  </div>
                  {lebih && (
                    <p className="hint" style={{ color: "var(--danger)" }} role="alert">
                      Maksimal {b.sisa}.
                    </p>
                  )}
                </div>
              );
            })}
            <div className="panel panel--warn">
              Barang yang tidak dikembalikan dianggap habis di bazar.
            </div>
          </>
        ) : (
          <div className="panel panel--ok">Tidak ada sisa barang.</div>
        )}
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={tutup} disabled={sibuk}>
          {sibuk ? "Menutup…" : "Tutup Bazar"}
        </button>
      </div>
    </>
  );
}
