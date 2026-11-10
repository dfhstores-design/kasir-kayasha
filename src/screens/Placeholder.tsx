import type { SettingsRecord } from "../db/schema.ts";

/** Layar yang masih berupa penanda fase (bukan salinan lengkap Layar App). */
export type LayarPenanda = "pesanan" | "bazar" | "ringkasan" | "pengaturan";

const KETERANGAN: Record<LayarPenanda, string> = {
  pesanan: "Pre-order dan pembayaran akan tersedia di Phase 4.",
  bazar: "Bazar dan alokasi stok akan tersedia di Phase 3B.",
  ringkasan: "Ringkasan penjualan akan tersedia di Phase 4.",
  pengaturan: "Pengaturan butik dan logo akan tersedia di Phase 5.",
};

interface Props {
  nama: LayarPenanda;
  settings: SettingsRecord | null;
  storagePermanen: boolean | null;
}

/**
 * Layar sementara Phase 2.
 *
 * Sengaja TIDAK menyediakan tombol palsu: setiap layar menyebut fase kapan fiturnya
 * datang, sehingga tidak ada kesan "sudah jadi tapi rusak".
 */
export default function Placeholder({ nama, settings, storagePermanen }: Props) {
  return (
    <div className="content">
      <div className="panel panel--ok">
        <strong>Belum tersedia.</strong>
        <p style={{ margin: "0.25rem 0 0" }}>{KETERANGAN[nama]}</p>
      </div>

      {nama === "pengaturan" && (
        <div className="card">
          <p className="h2">Data tersimpan di perangkat</p>
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            Nama butik: {settings?.namaButik?.trim() ? settings.namaButik : "belum diisi"}
          </p>
          <p className="soft" style={{ margin: "0.25rem 0 0" }}>
            Penyimpanan permanen: {storagePermanen === null ? "memeriksa…" : storagePermanen ? "aktif" : "belum dijamin browser"}
          </p>
        </div>
      )}
    </div>
  );
}
