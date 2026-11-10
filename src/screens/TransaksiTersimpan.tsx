import { formatRupiah, formatRupiahResi } from "../lib/money.ts";
import { labelStatusBayar } from "../lib/keranjang.ts";
import type { TransaksiTersimpan } from "../lib/penjualan.ts";

interface Props {
  transaksi: TransaksiTersimpan;
  onBuatResi: () => void;
  onTransaksiBaru: () => void;
}

/**
 * Layar 5 — Transaksi Tersimpan (docs/design/screens/05-transaksi-tersimpan.md).
 *
 * Sengaja TANPA tombol kembali: kasir memilih "Buat Resi" atau "Transaksi Baru",
 * supaya tidak kembali ke keranjang yang sudah tersimpan.
 */
export default function TransaksiTersimpanLayar({ transaksi, onBuatResi, onTransaksiBaru }: Props) {
  const namaRingkas =
    transaksi.namaBarang.length > 2
      ? `${transaksi.namaBarang.slice(0, 2).join(", ")} dan ${transaksi.namaBarang.length - 2} barang lain`
      : transaksi.namaBarang.join(", ");

  return (
    <>
      <div className="content tersimpan">
        <div className="tersimpan__cek" aria-hidden="true">
          ✓
        </div>
        <p className="h1" role="status">
          Transaksi tersimpan
        </p>
        <p className="soft" style={{ margin: 0 }}>
          Nomor <strong>{transaksi.nomorResi}</strong>
        </p>
        <p className="soft" style={{ margin: 0 }}>
          {namaRingkas}
        </p>
        <p className="total" style={{ margin: "1rem 0 0" }}>
          {formatRupiah(transaksi.total)}
        </p>

        {transaksi.status !== "lunas" && (
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            {labelStatusBayar(transaksi.status)} · sisa {formatRupiahResi(transaksi.sisa)}
          </p>
        )}

        <div className="status" style={{ justifyContent: "center", marginTop: "0.75rem" }}>
          <span className="dot" aria-hidden="true" />
          <span>Tersimpan di perangkat</span>
        </div>
      </div>

      <div className="bottombar">
        <button type="button" className="btn btn--primary" onClick={onBuatResi}>
          Buat Resi
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onTransaksiBaru}>
          Transaksi Baru
        </button>
      </div>
    </>
  );
}
