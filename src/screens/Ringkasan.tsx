import { useEffect, useState } from "react";
import {
  daftarBiaya as ambilBiaya,
  daftarBazar,
  daftarTransaksi,
  itemBazar,
  type BazarRecord,
  type BiayaBazarRecord,
} from "../db/repositori.ts";
import type { TransaksiRecord } from "../db/schema.ts";
import { formatRupiah } from "../lib/money.ts";
import { formatTanggal } from "../lib/tanggal.ts";
import {
  biayaPadaHari,
  hitungRingkasanKeuangan,
  labelKategori,
  transaksiPadaHari,
} from "../lib/bazar.ts";

interface Props {
  bazar: BazarRecord | null;
}

/**
 * Ringkasan harian & akhir bazar (ROLE-BIAYA-RINGKASAN.md bagian 5).
 * Admin saja (dijaga di App).
 */
export default function Ringkasan({ bazar }: Props) {
  const [trx, setTrx] = useState<TransaksiRecord[]>([]);
  const [biaya, setBiaya] = useState<BiayaBazarRecord[]>([]);
  const [selisih, setSelisih] = useState(0);
  const [hari, setHari] = useState(new Date().toISOString().slice(0, 10));
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const semuaTrx = await daftarTransaksi();
      const bz = bazar ?? (await daftarBazar()).find((b) => b.status === "selesai") ?? null;
      const biayaBazar = bz ? await ambilBiaya(bz.id) : [];
      const items = bz ? await itemBazar(bz.id) : [];
      if (!hidup) return;
      setTrx(bz ? semuaTrx.filter((t) => t.bazarId === bz.id) : []);
      setBiaya(biayaBazar);
      setSelisih(items.reduce((n, i) => n + Math.abs(i.selisih ?? 0), 0));
      setMemuat(false);
    })().catch(() => setMemuat(false));
    return () => {
      hidup = false;
    };
  }, [bazar]);

  if (memuat) {
    return (
      <div className="content">
        <p className="soft">Menghitung ringkasan…</p>
      </div>
    );
  }

  if (!bazar && trx.length === 0 && biaya.length === 0) {
    return (
      <div className="content">
        <div className="panel panel--ok">
          <strong>Belum ada data ringkasan.</strong>
          <p style={{ margin: "0.25rem 0 0" }}>Buka bazar dan catat transaksi untuk melihat ringkasan.</p>
        </div>
      </div>
    );
  }

  const keRingkas = (list: TransaksiRecord[]) =>
    list.map((t) => ({
      total: t.total,
      jenisBayar: t.jenisBayar,
      dibatalkan: t.dibatalkanPada !== null,
      waktu: t.waktu,
    }));

  const daftarTrx = keRingkas(trx);
  const daftarBiaya = biaya.map((b) => ({ kategori: b.kategori, judul: b.judul, nominal: b.nominal, tanggal: b.tanggal }));

  const harian = hitungRingkasanKeuangan(transaksiPadaHari(daftarTrx, hari), biayaPadaHari(daftarBiaya, hari));
  const total = hitungRingkasanKeuangan(daftarTrx, daftarBiaya);

  return (
    <div className="content">
      <div>
        <p className="h2" style={{ margin: 0 }}>
          {bazar ? bazar.nama : "Ringkasan"}
        </p>
        {bazar && (
          <p className="soft" style={{ margin: 0 }}>
            {bazar.status === "selesai" && bazar.ditutupPada
              ? `Ditutup ${formatTanggal(bazar.ditutupPada)}`
              : "Bazar aktif"}
          </p>
        )}
      </div>

      {/* ---------------- harian ---------------- */}
      <div>
        <label htmlFor="tanggal-ringkasan">Ringkasan harian</label>
        <input
          id="tanggal-ringkasan"
          type="date"
          value={hari}
          onChange={(e) => setHari(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="ringkas">
          <span>Transaksi</span>
          <span className="money">{harian.jumlahTransaksi}</span>
        </div>
        <div className="ringkas">
          <span>Omzet hari itu</span>
          <span className="money">{formatRupiah(harian.omzet)}</span>
        </div>
        <div className="ringkas soft">
          <span>Tunai</span>
          <span>{formatRupiah(harian.tunai)}</span>
        </div>
        <div className="ringkas soft">
          <span>Transfer</span>
          <span>{formatRupiah(harian.transfer)}</span>
        </div>
        <div className="ringkas soft">
          <span>QRIS</span>
          <span>{formatRupiah(harian.qris)}</span>
        </div>
        <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
        <div className="ringkas soft">
          <span>Biaya hari itu</span>
          <span>− {formatRupiah(harian.totalBiaya)}</span>
        </div>
        <div className="ringkas">
          <strong>Laba hari itu</strong>
          <strong className="money">{formatRupiah(harian.laba)}</strong>
        </div>
      </div>

      {/* ---------------- total ---------------- */}
      <span className="label">
        Ringkasan total {bazar?.status === "selesai" ? "setelah bazar ditutup" : "sejauh ini"}
      </span>
      <div className="card">
        <div className="ringkas">
          <span>Transaksi</span>
          <span className="money">{total.jumlahTransaksi}</span>
        </div>
        <div className="ringkas">
          <span>Omzet bazar</span>
          <span className="money">{formatRupiah(total.omzet)}</span>
        </div>
        <div className="ringkas">
          <span>Biaya bazar</span>
          <span className="money">− {formatRupiah(total.totalBiaya)}</span>
        </div>
        <div className="hr" style={{ height: 1, background: "var(--line)", margin: "0.5rem 0" }} />
        <div className="ringkas">
          <strong>LABA BAZAR</strong>
          <strong
            className="total"
            style={{ fontSize: "1.5rem", color: total.laba < 0 ? "var(--danger)" : "var(--ink)" }}
          >
            {formatRupiah(total.laba)}
          </strong>
        </div>
        {total.laba < 0 && (
          <p className="hint" style={{ color: "var(--danger)", margin: "0.25rem 0 0" }}>
            Biaya lebih besar dari omzet.
          </p>
        )}
      </div>

      {total.biayaPerKategori.length > 0 && (
        <div className="card">
          <span className="label">Rincian biaya</span>
          {total.biayaPerKategori.map((r) => (
            <div key={r.kategori} className="ringkas soft">
              <span>{labelKategori(r.kategori)}</span>
              <span>{formatRupiah(r.total)}</span>
            </div>
          ))}
        </div>
      )}

      {bazar?.status === "selesai" && (
        <div className="card">
          <div className="ringkas">
            <span>Dibawa</span>
            <span className="money">{bazar.ringkasanDibawa ?? 0} pcs</span>
          </div>
          <div className="ringkas">
            <span>Terjual</span>
            <span className="money">{bazar.ringkasanTerjual ?? 0} pcs</span>
          </div>
          <div className="ringkas">
            <span>Dikembalikan</span>
            <span className="money">{bazar.ringkasanSisa ?? 0} pcs</span>
          </div>
          {selisih > 0 && (
            <p className="hint" style={{ color: "var(--warn-ink)", margin: "0.25rem 0 0" }}>
              Ada selisih hitung {selisih} pcs pada penutupan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
