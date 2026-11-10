import { useEffect, useMemo, useState } from "react";
import { daftarProduk, type ProdukRecord } from "../db/repositori.ts";
import { formatRupiah } from "../lib/money.ts";
import { useThumbnail } from "./useFoto.ts";

interface Props {
  onPilih: (p: ProdukRecord) => void;
  onTambah: (p: ProdukRecord) => void;
  onBukaDetail: (p: ProdukRecord) => void;
  /** Stok yang berlaku: saldo bazar bila bazar aktif, selain itu stok gudang. */
  stokUntuk: (p: ProdukRecord) => number;
  /** Jumlah di keranjang untuk badge, opsional. */
  diKeranjang?: Record<string, number>;
}

function KartuBarang({
  produk,
  jumlah,
  stok,
  onTambah,
  onBukaDetail,
}: {
  produk: ProdukRecord;
  jumlah: number;
  stok: number;
  onTambah: () => void;
  onBukaDetail: () => void;
}) {
  const thumb = useThumbnail(produk.id);
  const habis = stok <= 0;

  return (
    <div className="card" style={{ padding: "0.5rem", display: "flex", flexDirection: "column" }}>
      <button
        type="button"
        onClick={onBukaDetail}
        aria-label={`Detail ${produk.nama}`}
        style={{ border: 0, padding: 0, background: "none", cursor: "pointer" }}
      >
        <div className="thumb">
          {thumb ? <img src={thumb} alt={produk.nama} /> : <span>{produk.nama}</span>}
        </div>
        <div className="prodname">{produk.nama}</div>
        <div className="money">{formatRupiah(produk.hargaJual)}</div>
        <div className="soft" style={{ fontSize: "0.9rem" }}>
          {habis ? "Stok habis" : `Stok ${stok}`}
        </div>
      </button>
      <button
        type="button"
        className="btn btn--primary btn--small"
        style={{ marginTop: "0.5rem" }}
        disabled={habis}
        onClick={onTambah}
        aria-label={`Tambah ${produk.nama} ke keranjang`}
      >
        {jumlah > 0 ? `✓ ${jumlah} di keranjang` : "+ Tambah"}
      </button>
    </div>
  );
}

/**
 * Layar 2 — Pilih Barang (docs/design/screens/02-pilih-barang.md).
 * Grid 2 kolom, kolom cari, tombol + Tambah langsung di kartu.
 */
export default function PilihBarang({ onTambah, onBukaDetail, stokUntuk, diKeranjang = {} }: Props) {
  const [produk, setProduk] = useState<ProdukRecord[] | null>(null);
  const [cari, setCari] = useState("");
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    daftarProduk()
      .then(setProduk)
      .catch(() => setGalat("Daftar barang tidak dapat dibuka."));
  }, []);

  const hasil = useMemo(() => {
    if (!produk) return [];
    const q = cari.trim().toLowerCase();
    if (!q) return produk;
    return produk.filter(
      (p) => p.nama.toLowerCase().includes(q) || (p.kode ?? "").toLowerCase().includes(q),
    );
  }, [produk, cari]);

  if (galat) return <div className="content"><div className="panel panel--warn">{galat}</div></div>;

  return (
    <div className="content">
      <label htmlFor="cari" className="sr-only">
        Cari nama barang
      </label>
      <input
        id="cari"
        type="search"
        placeholder="Cari nama barang"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        autoComplete="off"
      />

      {produk === null && <p className="soft">Memuat barang…</p>}

      {produk !== null && produk.length === 0 && (
        <div className="panel panel--ok">
          <strong>Belum ada barang.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Tambahkan barang dulu di menu Barang.</p>
        </div>
      )}

      {produk !== null && produk.length > 0 && hasil.length === 0 && (
        <>
          <p className="soft">Tidak ada barang dengan nama itu.</p>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setCari("")}>
            Hapus pencarian
          </button>
        </>
      )}

      {hasil.length > 0 && (
        <div className="grid-barang">
          {hasil.map((p) => (
            <KartuBarang
              key={p.id}
              produk={p}
              jumlah={diKeranjang[p.id] ?? 0}
              stok={stokUntuk(p)}
              onTambah={() => onTambah(p)}
              onBukaDetail={() => onBukaDetail(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
