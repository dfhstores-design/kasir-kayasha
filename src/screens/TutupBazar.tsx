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
import { hitungUlangSisa, pesanSelisih } from "../lib/bazar.ts";
import { formatRupiah } from "../lib/money.ts";
import type { UUID } from "../db/schema.ts";

interface Props {
  bazar: BazarRecord;
  onSelesai: () => void;
}

interface BarisSisa {
  produkId: UUID;
  nama: string;
  /** Sisa menurut catatan sistem. */
  sisa: number;
  /** Angka FISIK yang diketik admin (bawaan = sisa tercatat). */
  teks: string;
}

/**
 * Layar 17 — Tutup Bazar (docs/design/screens/17-tutup-bazar.md).
 *
 * Hitung ulang fisik (ROLE-BIAYA-RINGKASAN.md bagian 4):
 *   selisih = fisik − tercatat
 * Yang dikembalikan ke gudang = angka FISIK. Selisih ditampilkan, tidak disembunyikan.
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

  const rekap = hitungUlangSisa(
    (baris ?? []).map((b) => ({
      produkId: b.produkId,
      nama: b.nama,
      tercatat: b.sisa,
      fisik: Number(b.teks) || 0,
    })),
  );
  const adaBeda = rekap.ok && rekap.adaSelisih;

  async function tutup() {
    if (!rekap.ok) {
      setGalat(rekap.pesan);
      return;
    }
    const pesanKonfirmasi = adaBeda
      ? "Ada selisih hitung. Tetap tutup bazar ini? Setelah ditutup tidak bisa dibuka lagi."
      : "Tutup bazar ini? Setelah ditutup tidak bisa dibuka lagi.";
    if (!window.confirm(pesanKonfirmasi)) return;

    setGalat(null);
    setSibuk(true);
    // Yang dikembalikan = angka FISIK.
    const peta = new Map<UUID, number>();
    for (const b of rekap.baris) peta.set(b.produkId, b.dikembalikan);

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
            <span className="label">Hitung ulang barang, lalu simpan ke gudang</span>
            {baris.map((b) => {
              const hitung = rekap.ok ? rekap.baris.find((x) => x.produkId === b.produkId) : undefined;
              const selisih = hitung?.selisih ?? 0;
              return (
                <div key={b.produkId} className="card">
                  <strong>{b.nama}</strong>
                  <div className="soft" style={{ fontSize: "0.95rem" }}>
                    Tercatat di bazar: {b.sisa}
                  </div>
                  <div className="grid2" style={{ marginTop: "0.5rem", alignItems: "center" }}>
                    <label htmlFor={`fisik-${b.produkId}`} style={{ margin: 0 }}>
                      Hitungan fisik
                    </label>
                    <input
                      id={`fisik-${b.produkId}`}
                      inputMode="numeric"
                      value={b.teks}
                      aria-invalid={selisih !== 0}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        setBaris((list) => (list ?? []).map((x) => (x.produkId === b.produkId ? { ...x, teks: v } : x)));
                      }}
                    />
                  </div>
                  {selisih !== 0 && (
                    <p className="hint" style={{ color: "var(--warn-ink)" }} role="status">
                      Selisih {selisih > 0 ? `+${selisih} (lebih)` : `${selisih} (kurang)`} · kembalikan{" "}
                      {hitung?.dikembalikan ?? 0} pcs
                    </p>
                  )}
                </div>
              );
            })}
            {adaBeda && rekap.ok && (
              <div className="panel panel--warn" role="alert">
                {pesanSelisih(rekap.baris)}
              </div>
            )}
            <div className="hint">
              Yang dikembalikan ke gudang adalah angka <strong>fisik</strong>. Selisih dicatat untuk
              ditinjau admin.
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
