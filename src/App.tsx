import { useCallback, useEffect, useState } from "react";
import Beranda from "./screens/Beranda.tsx";
import Placeholder from "./screens/Placeholder.tsx";
import PilihBarang from "./screens/PilihBarang.tsx";
import DetailBarang from "./screens/DetailBarang.tsx";
import Keranjang from "./screens/Keranjang.tsx";
import { bikinIsiKeranjang, type IsiKeranjang } from "./lib/isiKeranjang.ts";
import DaftarBarang from "./screens/DaftarBarang.tsx";
import FormBarang from "./screens/FormBarang.tsx";
import TransaksiTersimpanLayar from "./screens/TransaksiTersimpan.tsx";
import {
  ambilSettings,
  bazarAktif,
  simpanProduk,
  type ProdukRecord,
  type SettingsRecord,
} from "./db/repositori.ts";
import { buatId } from "./db/repositori.ts";
import { mintaPenyimpananPermanen } from "./pwa/register.ts";
import type { OngkirMode } from "./lib/ongkir.ts";
import type { StatusBayar } from "./lib/keranjang.ts";
import { simpanPenjualan, type JenisBayar, type TransaksiTersimpan } from "./lib/penjualan.ts";

export type Layar =
  | { nama: "beranda" }
  | { nama: "pilih-barang" }
  | { nama: "detail-barang"; produk: ProdukRecord }
  | { nama: "keranjang" }
  | { nama: "tersimpan"; transaksi: TransaksiTersimpan }
  | { nama: "pesanan" }
  | { nama: "barang" }
  | { nama: "form-barang"; produk: ProdukRecord | null }
  | { nama: "bazar" }
  | { nama: "ringkasan" }
  | { nama: "pengaturan" };

interface NilaiKeranjang {
  diskonTotal: number;
  jenisBayar: JenisBayar | null;
  statusBayar: StatusBayar;
  dibayarSekarang: number;
  ongkirMode: OngkirMode;
  ongkirNominal: number | null;
}

const KERANJANG_AWAL: NilaiKeranjang = {
  diskonTotal: 0,
  jenisBayar: "tunai",
  statusBayar: "lunas",
  dibayarSekarang: 0,
  ongkirMode: "ambil_sendiri",
  ongkirNominal: 0,
};

/**
 * Kerangka aplikasi. Navigasi memakai state (bukan router) — MVP punya sedikit layar
 * dan satu perangkat.
 */
export default function App() {
  const [layar, setLayar] = useState<Layar>({ nama: "beranda" });
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [storagePermanen, setStoragePermanen] = useState<boolean | null>(null);

  const [keranjang, setKeranjang] = useState<IsiKeranjang[]>([]);
  const [nilaiKeranjang, setNilaiKeranjang] = useState<NilaiKeranjang>(KERANJANG_AWAL);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState<string | null>(null);
  const [bazarId, setBazarId] = useState<string | null>(null);

  const muat = useCallback(() => {
    ambilSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
    bazarAktif()
      .then((b) => setBazarId(b?.id ?? null))
      .catch(() => setBazarId(null));
  }, []);

  useEffect(() => {
    muat();
    mintaPenyimpananPermanen()
      .then(setStoragePermanen)
      .catch(() => setStoragePermanen(false));
  }, [muat]);

  const kembali = useCallback(() => {
    if (layar.nama === "detail-barang") return setLayar({ nama: "pilih-barang" });
    if (layar.nama === "keranjang") {
      if (keranjang.length > 0 && !window.confirm("Barang di keranjang belum disimpan. Mau kembali?")) return;
      return setLayar({ nama: "pilih-barang" });
    }
    if (layar.nama === "form-barang") return setLayar({ nama: "barang" });
    setLayar({ nama: "beranda" });
  }, [layar, keranjang.length]);

  const tambahKeKeranjang = useCallback((p: ProdukRecord, kuantitas = 1) => {
    setKeranjang((daftar) => {
      const ada = daftar.find((k) => k.produkId === p.id);
      if (ada) {
        const baru = Math.min(ada.kuantitas + kuantitas, ada.stokTersedia);
        return daftar.map((k) => (k.produkId === p.id ? { ...k, kuantitas: baru } : k));
      }
      return [...daftar, bikinIsiKeranjang(p, Math.min(kuantitas, p.stokGudang))];
    });
  }, []);

  const simpanTransaksiSekarang = useCallback(async () => {
    setPesanSimpan(null);
    setSedangMenyimpan(true);
    const hasil = await simpanPenjualan(
      {
        items: keranjang.map((k) => ({
          produkId: k.produkId,
          nama: k.nama,
          hargaSatuan: k.hargaSatuan,
          kuantitas: k.kuantitas,
          diskonPerUnit: k.diskonPerUnit,
        })),
        diskonTotal: nilaiKeranjang.diskonTotal,
        ongkir: {
          mode: nilaiKeranjang.ongkirMode,
          nominal: nilaiKeranjang.ongkirMode === "belum_ditentukan" ? null : nilaiKeranjang.ongkirNominal ?? 0,
        },
        jenisBayar: nilaiKeranjang.jenisBayar,
        statusBayar: nilaiKeranjang.statusBayar,
        dibayarSekarang: nilaiKeranjang.dibayarSekarang,
        bazarId,
      },
      { rekening: settings?.rekening ?? [] },
    );
    setSedangMenyimpan(false);

    if (!hasil.ok) {
      setPesanSimpan(hasil.pesan);
      return;
    }

    setKeranjang([]);
    setNilaiKeranjang(KERANJANG_AWAL);
    setLayar({ nama: "tersimpan", transaksi: hasil.transaksi });
  }, [keranjang, nilaiKeranjang, settings, bazarId]);

  const simpanBarang = useCallback(
    async (nilai: { nama: string; hargaJual: number; stokGudang: number; kode: string; catatan: string }) => {
      const sekarang = new Date().toISOString();
      const lama = layar.nama === "form-barang" ? layar.produk : null;
      const p: ProdukRecord = lama
        ? {
            ...lama,
            nama: nilai.nama,
            hargaJual: nilai.hargaJual,
            stokGudang: nilai.stokGudang,
            kode: nilai.kode || null,
            catatan: nilai.catatan || null,
            updatedAt: sekarang,
          }
        : {
            id: buatId(),
            nama: nilai.nama,
            kode: nilai.kode || null,
            hargaJual: nilai.hargaJual,
            stokGudang: nilai.stokGudang,
            catatan: nilai.catatan || null,
            arsip: false,
            createdAt: sekarang,
            updatedAt: sekarang,
          };
      await simpanProduk(p);
      setLayar({ nama: "barang" });
    },
    [layar],
  );

  const judul: Record<string, string> = {
    "pilih-barang": "Pilih Barang",
    "detail-barang": "Detail Barang",
    keranjang: "Keranjang",
    pesanan: "Pesanan",
    barang: "Barang",
    "form-barang": layar.nama === "form-barang" && layar.produk ? "Ubah Barang" : "Barang Baru",
    bazar: "Bazar",
    ringkasan: "Ringkasan",
    pengaturan: "Pengaturan",
  };

  const tampilAppbar = layar.nama !== "beranda" && layar.nama !== "tersimpan";

  return (
    <div className="app">
      {tampilAppbar && (
        <header className="appbar">
          <button type="button" className="appbar__back" onClick={kembali}>
            ‹ Kembali
          </button>
          <span className="appbar__title">{judul[layar.nama]}</span>
        </header>
      )}

      {pesanSimpan && (
        <div className="content" style={{ paddingBottom: 0 }}>
          <div className="panel panel--warn" role="alert">
            {pesanSimpan}
          </div>
        </div>
      )}

      {layar.nama === "beranda" && (
        <Beranda
          settings={settings}
          storagePermanen={storagePermanen}
          buka={(nama) => setLayar({ nama } as Layar)}
        />
      )}

      {layar.nama === "pilih-barang" && (
        <>
          <PilihBarang
            onPilih={() => {}}
            onTambah={(p) => tambahKeKeranjang(p, 1)}
            onBukaDetail={(p) => setLayar({ nama: "detail-barang", produk: p })}
            diKeranjang={Object.fromEntries(keranjang.map((k) => [k.produkId, k.kuantitas]))}
          />
          {keranjang.length > 0 && (
            <div className="bottombar">
              <button type="button" className="btn btn--primary" onClick={() => setLayar({ nama: "keranjang" })}>
                Keranjang ({keranjang.reduce((n, k) => n + k.kuantitas, 0)} barang)
              </button>
            </div>
          )}
        </>
      )}

      {layar.nama === "detail-barang" && (
        <DetailBarang
          produk={layar.produk}
          onTambah={(jumlah) => {
            tambahKeKeranjang(layar.produk, jumlah);
            setLayar({ nama: "pilih-barang" });
          }}
        />
      )}

      {layar.nama === "keranjang" && (
        <Keranjang
          keranjang={keranjang}
          nilai={nilaiKeranjang}
          onUbah={(v) => setNilaiKeranjang((n) => ({ ...n, ...v }))}
          onUbahJumlah={(id, kuantitas) => {
            if (kuantitas < 1) {
              setKeranjang((d) => d.filter((k) => k.produkId !== id));
              return;
            }
            setKeranjang((d) =>
              d.map((k) => (k.produkId === id ? { ...k, kuantitas: Math.min(kuantitas, k.stokTersedia) } : k)),
            );
          }}
          onHapus={(id) => setKeranjang((d) => d.filter((k) => k.produkId !== id))}
          onUbahDiskon={(id, diskon) =>
            setKeranjang((d) => d.map((k) => (k.produkId === id ? { ...k, diskonPerUnit: diskon } : k)))
          }
          onSimpan={simpanTransaksiSekarang}
          sedangMenyimpan={sedangMenyimpan}
        />
      )}

      {layar.nama === "tersimpan" && (
        <TransaksiTersimpanLayar
          transaksi={layar.transaksi}
          onBuatResi={() => setLayar({ nama: "pengaturan" })}
          onTransaksiBaru={() => setLayar({ nama: "pilih-barang" })}
        />
      )}

      {layar.nama === "barang" && (
        <DaftarBarang
          onTambah={() => setLayar({ nama: "form-barang", produk: null })}
          onUbah={(p) => setLayar({ nama: "form-barang", produk: p })}
        />
      )}

      {layar.nama === "form-barang" && (
        <FormBarang
          produk={layar.produk}
          onSimpan={simpanBarang}
          onBatal={() => setLayar({ nama: "barang" })}
          {...(layar.produk
            ? {
                onArsip: async () => {
                  if (!window.confirm("Arsipkan barang ini? Barang tidak akan muncul di katalog.")) return;
                  await simpanProduk({ ...layar.produk!, arsip: true, updatedAt: new Date().toISOString() });
                  setLayar({ nama: "barang" });
                },
              }
            : {})}
        />
      )}

      {(layar.nama === "pesanan" ||
        layar.nama === "bazar" ||
        layar.nama === "ringkasan" ||
        layar.nama === "pengaturan") && (
        <Placeholder nama={layar.nama} settings={settings} storagePermanen={storagePermanen} />
      )}
    </div>
  );
}
