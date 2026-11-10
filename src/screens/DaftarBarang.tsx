import { useEffect, useState } from "react";
import { daftarProduk, type ProdukRecord } from "../db/repositori.ts";
import { formatRupiah } from "../lib/money.ts";
import { useThumbnail } from "./useFoto.ts";

interface Props {
  onTambah: () => void;
  onUbah: (p: ProdukRecord) => void;
}

/**
 * Layar 9 — Daftar Barang (docs/design/screens/09-daftar-barang.md).
 * Stok tidak diedit di sini; hanya dari Form Barang.
 */
export default function DaftarBarang({ onTambah, onUbah }: Props) {
  const [produk, setProduk] = useState<ProdukRecord[] | null>(null);
  const [cari, setCari] = useState("");
  const [tampilArsip, setTampilArsip] = useState(false);

  useEffect(() => {
    daftarProduk(tampilArsip)
      .then(setProduk)
      .catch(() => setProduk([]));
  }, [tampilArsip]);

  const hasil = (produk ?? []).filter((p) => {
    const q = cari.trim().toLowerCase();
    if (!q) return true;
    return p.nama.toLowerCase().includes(q) || (p.kode ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <div className="content">
        <button type="button" className="btn btn--primary btn--small" onClick={onTambah}>
          + Tambah Barang
        </button>

        <label htmlFor="cari-barang" className="sr-only">
          Cari nama barang
        </label>
        <input
          id="cari-barang"
          type="search"
          placeholder="Cari nama barang"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />

        {produk === null && <p className="soft">Memuat barang…</p>}

        {produk !== null && produk.length === 0 && (
          <div className="panel panel--ok">
            <strong>Belum ada barang.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>Tambahkan barang pertama lewat tombol di atas.</p>
          </div>
        )}

        {hasil.map((p) => (
          <BarisBarang key={p.id} produk={p} onUbah={() => onUbah(p)} />
        ))}

        {produk !== null && hasil.length === 0 && produk.length > 0 && (
          <p className="soft">Tidak ada barang dengan nama itu.</p>
        )}

        <label className="tampil-arsip">
          <input type="checkbox" checked={tampilArsip} onChange={(e) => setTampilArsip(e.target.checked)} />
          Tampilkan barang diarsipkan
        </label>
      </div>
    </>
  );
}

function BarisBarang({ produk, onUbah }: { produk: ProdukRecord; onUbah: () => void }) {
  const thumb = useThumbnail(produk.id);
  const stok = produk.stokGudang <= 0 ? "Stok habis" : `Stok ${produk.stokGudang}`;
  const status = produk.arsip ? "Diarsipkan" : "Aktif";

  return (
    <button type="button" className="listrow" onClick={onUbah} style={{ textAlign: "left", font: "inherit", cursor: "pointer" }}>
      <div className="thumb thumblist">
        {thumb ? <img src={thumb} alt="" /> : ""}
      </div>
      <div style={{ flex: 1 }}>
        <strong>{produk.nama}</strong>
        <div className="soft" style={{ fontSize: "0.95rem" }}>
          {formatRupiah(produk.hargaJual)} · {stok} · {status}
        </div>
      </div>
      <span className="chev" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
