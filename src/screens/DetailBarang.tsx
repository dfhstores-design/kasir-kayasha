import { useState } from "react";
import { formatRupiah } from "../lib/money.ts";
import type { ProdukRecord } from "../db/repositori.ts";
import { useFotoBarang } from "./useFoto.ts";

interface Props {
  produk: ProdukRecord;
  onTambah: (kuantitas: number) => void;
}

/**
 * Layar 3 — Detail Barang (docs/design/screens/03-detail-barang.md).
 * Foto besar bisa diketuk untuk melihat sisi lain (maksimal 3 foto).
 */
export default function DetailBarang({ produk, onTambah }: Props) {
  const foto = useFotoBarang(produk.id);
  const [indeks, setIndeks] = useState(0);
  const [jumlah, setJumlah] = useState(1);

  const habis = produk.stokGudang <= 0;
  const batas = produk.stokGudang;
  const urlSekarang = foto[indeks];

  return (
    <>
      <div className="content">
        <button
          type="button"
          onClick={() => setIndeks((i) => (foto.length > 0 ? (i + 1) % foto.length : 0))}
          aria-label={foto.length > 1 ? "Lihat foto berikutnya" : "Foto barang"}
          className="thumb"
          style={{ border: 0, padding: 0, width: "100%", cursor: foto.length > 1 ? "pointer" : "default" }}
        >
          {urlSekarang ? <img src={urlSekarang} alt={produk.nama} /> : <span>{produk.nama}</span>}
        </button>

        {foto.length > 1 && (
          <p className="soft" style={{ textAlign: "center", margin: 0 }} aria-hidden="true">
            {foto.map((_, i) => (i === indeks ? "● " : "○ ")).join("")}
          </p>
        )}

        <div>
          <p className="h2" style={{ margin: 0 }}>
            {produk.nama}
          </p>
          <p className="h1" style={{ margin: "0.25rem 0" }}>
            {formatRupiah(produk.hargaJual)}
          </p>
          <p className="soft" style={{ margin: 0 }}>
            {habis ? "Stok habis" : `Stok ${produk.stokGudang}`}
          </p>
          {produk.catatan && (
            <p className="soft" style={{ margin: "0.25rem 0 0" }}>
              {produk.catatan}
            </p>
          )}
        </div>

        {!habis && (
          <div>
            <span className="label">Jumlah</span>
            <div className="stepper">
              <button
                type="button"
                className="stepper__tombol"
                aria-label="Kurangi jumlah"
                onClick={() => setJumlah((j) => Math.max(1, j - 1))}
              >
                −
              </button>
              <span className="stepper__nilai">{jumlah}</span>
              <button
                type="button"
                className="stepper__tombol"
                aria-label="Tambah jumlah"
                disabled={jumlah >= batas}
                onClick={() => setJumlah((j) => Math.min(batas, j + 1))}
              >
                +
              </button>
            </div>
            {jumlah >= batas && <p className="hint">Stok tersisa {batas}.</p>}
          </div>
        )}
      </div>

      <div className="bottombar">
        {habis ? (
          <div className="panel panel--warn">Stok habis. Tambah stok di menu Barang.</div>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => onTambah(jumlah)}>
            Tambah ke Keranjang
          </button>
        )}
      </div>
    </>
  );
}
