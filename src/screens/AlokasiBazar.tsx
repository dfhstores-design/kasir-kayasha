import { useEffect, useState } from "react";
import { alokasikanKeBazar, daftarProduk, saldoSemuaBazar, type BazarRecord, type ProdukRecord } from "../db/repositori.ts";
import type { UUID } from "../db/schema.ts";

interface Props {
  bazar: BazarRecord;
  onSelesai: () => void;
}

/**
 * Layar 16 — Alokasi Barang ke Bazar (docs/design/screens/16-alokasi-bazar.md).
 *
 * Bawa barang ke bazar: gudang berkurang, saldo bazar bertambah.
 * Batas isian = stok gudang; tidak bisa melebihi.
 */
export default function AlokasiBazar({ bazar, onSelesai }: Props) {
  const [produk, setProduk] = useState<ProdukRecord[] | null>(null);
  const [saldo, setSaldo] = useState<Map<UUID, number>>(new Map());
  const [isian, setIsian] = useState<Record<UUID, string>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [cari, setCari] = useState("");

  const [muatUlang, setMuatUlang] = useState(0);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const [p, s] = await Promise.all([daftarProduk(), saldoSemuaBazar(bazar.id)]);
      if (!hidup) return;
      setProduk(p);
      setSaldo(s);
    })().catch(() => {
      if (hidup) setProduk([]);
    });
    return () => {
      hidup = false;
    };
  }, [bazar.id, muatUlang]);

  const daftar = (produk ?? []).filter((p) => {
    const q = cari.trim().toLowerCase();
    return !q || p.nama.toLowerCase().includes(q);
  });

  const totalBawa = Object.values(isian).reduce((n, v) => n + (Number(v) || 0), 0);
  const totalBarang = Object.values(isian).filter((v) => (Number(v) || 0) > 0).length;

  async function simpan() {
    setGalat(null);
    if (totalBarang === 0) {
      setGalat("Belum ada perubahan.");
      return;
    }
    setSibuk(true);
    try {
      for (const [produkId, teks] of Object.entries(isian)) {
        const jumlah = Number(teks);
        if (!teks || jumlah <= 0) continue;
        await alokasikanKeBazar(bazar.id, produkId, jumlah);
      }
      setIsian({});
      setMuatUlang((n) => n + 1);
      onSelesai();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Barang bazar belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  }

  if (produk === null) {
    return (
      <div className="content">
        <p className="soft">Memuat barang…</p>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        <p className="soft" style={{ margin: 0 }}>
          {bazar.nama}
        </p>

        {galat && (
          <div className="panel panel--warn" role="alert">
            {galat}
          </div>
        )}

        <label htmlFor="cari-alokasi" className="sr-only">
          Cari nama barang
        </label>
        <input
          id="cari-alokasi"
          type="search"
          placeholder="Cari nama barang"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />

        {produk.length === 0 && (
          <div className="panel panel--ok">
            <strong>Belum ada barang.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Tambahkan barang dulu di menu Barang.</p>
          </div>
        )}

        {daftar.map((p) => {
          const gudang = p.stokGudang;
          const bazarSekarang = saldo.get(p.id) ?? 0;
          const teks = isian[p.id] ?? "";
          const jumlah = Number(teks) || 0;
          const terlalu = jumlah > gudang;
          return (
            <div key={p.id} className="card">
              <strong>{p.nama}</strong>
              <div className="soft" style={{ fontSize: "0.95rem" }}>
                Gudang {gudang} · Bazar {bazarSekarang}
              </div>
              <div className="grid2" style={{ marginTop: "0.5rem", alignItems: "center" }}>
                <label htmlFor={`bawa-${p.id}`} style={{ margin: 0 }}>
                  Bawa ke bazar
                </label>
                <input
                  id={`bawa-${p.id}`}
                  inputMode="numeric"
                  placeholder="0"
                  disabled={gudang <= 0}
                  value={teks}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "");
                    setIsian((s) => ({ ...s, [p.id]: v }));
                  }}
                  aria-invalid={terlalu}
                />
              </div>
              {gudang <= 0 && <p className="hint">Gudang kosong.</p>}
              {terlalu && (
                <p className="hint" style={{ color: "var(--danger)" }} role="alert">
                  Gudang hanya {gudang}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="bottombar">
        <div className="ringkas">
          <span className="soft">
            {totalBarang} barang · {totalBawa} pcs
          </span>
        </div>
        <button type="button" className="btn btn--primary" onClick={simpan} disabled={sibuk}>
          {sibuk ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </>
  );
}
