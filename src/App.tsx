import { useCallback, useEffect, useRef, useState } from "react";
import Beranda from "./screens/Beranda.tsx";

import PilihBarang from "./screens/PilihBarang.tsx";import DetailBarang from "./screens/DetailBarang.tsx";
import Keranjang, { MAKS_PARKIR_TAMPIL, type ParkirRingkas } from "./screens/Keranjang.tsx";
import DaftarBarang from "./screens/DaftarBarang.tsx";
import FormBarang from "./screens/FormBarang.tsx";
import TransaksiTersimpanLayar from "./screens/TransaksiTersimpan.tsx";
import Bazar from "./screens/Bazar.tsx";
import AlokasiBazar from "./screens/AlokasiBazar.tsx";
import TutupBazar from "./screens/TutupBazar.tsx";
import MasukAdmin from "./screens/MasukAdmin.tsx";
import BiayaBazar from "./screens/BiayaBazar.tsx";
import Ringkasan from "./screens/Ringkasan.tsx";
import { AksesAdminSaja } from "./screens/AksesAdmin.tsx";
import AturPin from "./screens/AturPin.tsx";
import WizardPesananJahit from "./screens/WizardPesananJahit.tsx";
import DaftarPesananJahit from "./screens/DaftarPesananJahit.tsx";
import DetailPesananJahit from "./screens/DetailPesananJahit.tsx";
import KasirDetail from "./screens/KasirDetail.tsx";
import Pengaturan from "./screens/Pengaturan.tsx";
import Resi from "./screens/Resi.tsx";
import MenuPengaturan from "./screens/MenuPengaturan.tsx";
import ContohResi from "./screens/ContohResi.tsx";
import Cadangan from "./screens/Cadangan.tsx";
import Kasir from "./screens/Kasir.tsx";
import {
  ambilParkir,
  ambilSettings,
  bazarAktif,
  buatId,
  daftarBazarAktif,
  daftarBiaya,
  daftarParkir,
  hapusParkir,
  saldoSemuaBazar,
  simpanParkir,
  simpanProduk,
  simpanSettings,
  type BazarRecord,
  type BiayaBazarRecord,
  type ProdukRecord,
  type SettingsRecord,
} from "./db/repositori.ts";
import { mintaPenyimpananPermanen } from "./pwa/register.ts";
import { terapkanTampilan } from "./lib/tampilan.ts";
import { jalankanSeedDemo, migrasiAlamatLama } from "./db/seedDemo.ts";
import type { OngkirMode } from "./lib/ongkir.ts";
import type { StatusBayar } from "./lib/keranjang.ts";
import { khususAdmin, type Peran } from "./lib/peran.ts";
import { simpanPenjualan, type JenisBayar, type TransaksiTersimpan } from "./lib/penjualan.ts";
import { bikinIsiKeranjang, type IsiKeranjang } from "./lib/isiKeranjang.ts";
import { formatJam } from "./lib/tanggal.ts";
import { simpanPesananJahit } from "./lib/jahitan.ts";
import { layarAwalDariUrl } from "./lib/modeInput.ts";

export type Layar =
  | { nama: "beranda" }
  | { nama: "pilih-barang" }
  | { nama: "detail-barang"; produk: ProdukRecord }
  | { nama: "keranjang" }
  | { nama: "tersimpan"; transaksi: TransaksiTersimpan }
  | { nama: "barang" }
  | { nama: "form-barang"; produk: ProdukRecord | null }
  | { nama: "bazar" }
  | { nama: "alokasi-bazar"; bazar: BazarRecord }
  | { nama: "tutup-bazar"; bazar: BazarRecord }
  | { nama: "ringkasan" }
  | { nama: "pengaturan" }
  | { nama: "masuk-admin" }
  | { nama: "biaya-bazar"; bazar: BazarRecord }
  | { nama: "atur-pin" }
  | { nama: "daftar-jahit" }
  | { nama: "wizard-jahit" }
  | { nama: "detail-jahit"; id: string }
  | { nama: "kasir-detail"; id: string }
  | { nama: "pengaturan-isi"; bagian: "profil" | "rekening" | "logo" | "tampilan" }
  | { nama: "resi"; transaksiId: string }
  | { nama: "contoh-resi" }
  | { nama: "kasir" }
  | { nama: "cadangan" };

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

export default function App() {
  const [layar, setLayar] = useState<Layar>(() => {
    // Link pembanding (?layar=pesanan-jahit) langsung membuka form input
    // pesanan jahit; di luar itu mulai dari beranda (BU-22).
    const awal = layarAwalDariUrl(window.location.search);
    return awal ? { nama: awal } : { nama: "beranda" };
  });
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [storagePermanen, setStoragePermanen] = useState<boolean | null>(null);

  const [keranjang, setKeranjang] = useState<IsiKeranjang[]>([]);
  const [nilaiKeranjang, setNilaiKeranjang] = useState<NilaiKeranjang>(KERANJANG_AWAL);
  const [namaPembeli, setNamaPembeli] = useState("");
  const [parkir, setParkir] = useState<ParkirRingkas[]>([]);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  /** Peran aktif. Bawaan kasir; naik ke admin setelah PIN benar. */
  const [peran, setPeran] = useState<Peran>("kasir");
  const [biaya, setBiaya] = useState<BiayaBazarRecord[]>([]);
  /** Alur pesanan jahit (Tante): refresh daftar + id detail yang dibuka. */
  const [segarkanJahitan, setSegarkanJahitan] = useState(0);
  const [jahitanDibuka, setJahitanDibuka] = useState<string | null>(null);
  const [sibukPesanan, setSibukPesanan] = useState(false);
  const [pesanPesanan, setPesanPesanan] = useState<string | null>(null);
  const [pesanSimpan, setPesanSimpan] = useState<string | null>(null);

  /** Bazar aktif + saldo per barang. Saat null, penjualan memakai stok gudang. */
  const [bazar, setBazar] = useState<BazarRecord | null>(null);
  /** Jumlah bazar aktif (boleh lebih dari satu). */
  const [jumlahBazarAktif, setJumlahBazarAktif] = useState(0);
  /**
   * True sampai pemuatan awal selesai (seed demo + settings + bazar).
   * Beranda memakai ini supaya render pertama tidak menyimpulkan
   * "belum ada bazar" padahal seed/bazar belum selesai dimuat (quirk
   * first-load 17 Nov 2026).
   */
  const [memuatAwal, setMemuatAwal] = useState(true);
  /** True setelah pemuatan awal pertama selesai (untuk muat-ulang Beranda). */
  const sudahMuatAwal = useRef(false);
  const [saldoBazar, setSaldoBazar] = useState<Map<string, number>>(new Map());
  /** Barang yang baru disimpan saat bazar aktif — pemicu ajakan alokasi di DaftarBarang. */
  const [barangBaruDisimpan, setBarangBaruDisimpan] = useState<ProdukRecord | null>(null);

  const muatParkir = useCallback(async () => {
    const daftar = await daftarParkir();
    setParkir(
      daftar.map((p) => ({
        id: p.id,
        namaPembeli: p.namaPembeli,
        jumlahBarang: p.isi.reduce((n, i) => n + i.kuantitas, 0),
        total: p.isi.reduce((n, i) => n + i.hargaSatuan * i.kuantitas - i.diskonPerUnit * i.kuantitas, 0),
        jam: formatJam(p.dibuatPada),
      })),
    );
  }, []);

  const muat = useCallback(async () => {
    ambilSettings()
      .then(setSettings)
      .catch(() => setSettings(null));
    const b = await bazarAktif();
    setBazar(b ?? null);
    setSaldoBazar(b ? await saldoSemuaBazar(b.id) : new Map());
    setJumlahBazarAktif((await daftarBazarAktif().catch(() => [] as BazarRecord[])).length);
    await muatParkir();
  }, [muatParkir]);

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        await jalankanSeedDemo().catch(() => false);
        await migrasiAlamatLama().catch(() => false);
        const s = await ambilSettings().catch(() => null);
        const b = await bazarAktif().catch(() => undefined);
        const saldo = b ? await saldoSemuaBazar(b.id).catch(() => new Map<string, number>()) : new Map<string, number>();
        const daftar = await daftarParkir().catch(() => []);
        const daftarBiayaBazar = b ? await daftarBiaya(b.id).catch(() => []) : [];
        const jumlahAktif = await daftarBazarAktif().catch(() => [] as BazarRecord[]);
        if (!hidup) return;
        setSettings(s);
        setBazar(b ?? null);
        setSaldoBazar(saldo);
        setBiaya(daftarBiayaBazar);
        setJumlahBazarAktif(jumlahAktif.length);
        setParkir(
          daftar.map((p) => ({
            id: p.id,
            namaPembeli: p.namaPembeli,
            jumlahBarang: p.isi.reduce((n, i) => n + i.kuantitas, 0),
            total: p.isi.reduce((n, i) => n + i.hargaSatuan * i.kuantitas - i.diskonPerUnit * i.kuantitas, 0),
            jam: formatJam(p.dibuatPada),
          })),
        );
      } finally {
        // Pemuatan awal selesai (atau gagal): Beranda kini boleh
        // menyimpulkan status bazar. Tanpa ini, render pertama selalu
        // menampilkan "Belum ada bazar aktif" selama seed masih jalan.
        if (hidup) {
          sudahMuatAwal.current = true;
          setMemuatAwal(false);
        }
      }
    })();
    mintaPenyimpananPermanen()
      .then((v) => {
        if (hidup) setStoragePermanen(v);
      })
      .catch(() => {
        if (hidup) setStoragePermanen(false);
      });
    return () => {
      hidup = false;
    };
  }, []);

  // Terapkan ulang skala huruf & tema setiap kali pengaturan dimuat/diubah.
  useEffect(() => {
    if (settings) terapkanTampilan(settings.skalaFont, settings.tema);
  }, [settings]);

  // Setiap kembali ke Beranda, muat ulang status bazar (bazar aktif + saldo
  // + jumlah) supaya banner & tombol Penjualan selalu mencerminkan kondisi
  // terbaru — termasuk bila bazar baru saja dibuka/ditutup di layar Bazar.
  // Dilewati pada render pertama: pemuatan awal di atas sudah menanganinya.
  useEffect(() => {
    if (layar.nama === "beranda" && sudahMuatAwal.current) void muat();
  }, [layar, muat]);

  const kembali = useCallback(() => {
    const n = layar.nama;
    if (n === "detail-barang") return setLayar({ nama: "pilih-barang" });
    if (n === "keranjang") {
      if (keranjang.length > 0 && !window.confirm("Barang di keranjang belum disimpan. Mau kembali?")) return;
      return setLayar({ nama: "pilih-barang" });
    }
    if (n === "form-barang") return setLayar({ nama: "barang" });
    if (n === "alokasi-bazar" || n === "tutup-bazar") return setLayar({ nama: "bazar" });
    if (n === "daftar-jahit" || n === "wizard-jahit") return setLayar({ nama: "beranda" });
    if (n === "detail-jahit") {
      setJahitanDibuka(null);
      return setLayar({ nama: "daftar-jahit" });
    }
    if (n === "kasir-detail") return setLayar({ nama: "detail-jahit", id: layar.id });
    setBarangBaruDisimpan(null);
    setLayar({ nama: "beranda" });
  }, [layar, keranjang.length]);

  /** Stok tersedia untuk satu barang: saldo bazar bila bazar aktif, selain itu gudang. */
  const stokTersedia = useCallback(
    (p: ProdukRecord) => (bazar ? (saldoBazar.get(p.id) ?? 0) : p.stokGudang),
    [bazar, saldoBazar],
  );

  const tambahKeKeranjang = useCallback(
    (p: ProdukRecord, kuantitas = 1) => {
      const batas = bazar ? (saldoBazar.get(p.id) ?? 0) : p.stokGudang;
      setKeranjang((daftar) => {
        const ada = daftar.find((k) => k.produkId === p.id);
        if (ada) {
          const baru = Math.min(ada.kuantitas + kuantitas, batas);
          return daftar.map((k) => (k.produkId === p.id ? { ...k, kuantitas: baru, stokTersedia: batas } : k));
        }
        const baris = bikinIsiKeranjang(p, Math.min(kuantitas, batas));
        return [...daftar, { ...baris, stokTersedia: batas }];
      });
    },
    [bazar, saldoBazar],
  );

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
        bazarId: bazar?.id ?? null,
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
    setNamaPembeli("");
    await muat();
    setLayar({ nama: "tersimpan", transaksi: hasil.transaksi });
  }, [keranjang, nilaiKeranjang, settings, bazar, muat]);

  /** Memarkir keranjang sekarang; butuh nama pembeli (maks 3 parkir). */
  const parkirSekarang = useCallback(async () => {
    if (namaPembeli.trim().length < 2) {
      setPesanSimpan("Isi nama pembeli dulu supaya tidak tertukar.");
      return;
    }
    setPesanSimpan(null);
    const h = await simpanParkir({
      namaPembeli: namaPembeli.trim().slice(0, 20),
      isi: keranjang.map((k) => ({
        produkId: k.produkId,
        nama: k.nama,
        hargaSatuan: k.hargaSatuan,
        kuantitas: k.kuantitas,
        diskonPerUnit: k.diskonPerUnit,
      })),
      diskonTotal: nilaiKeranjang.diskonTotal,
      ongkirMode: nilaiKeranjang.ongkirMode,
      ongkirNominal: nilaiKeranjang.ongkirNominal,
      jenisBayar: nilaiKeranjang.jenisBayar,
      bazarId: bazar?.id ?? null,
    });
    if (!h.ok) {
      setPesanSimpan(`Sudah ada ${MAKS_PARKIR_TAMPIL} transaksi tertahan. Selesaikan salah satu dulu.`);
      return;
    }
    setKeranjang([]);
    setNilaiKeranjang(KERANJANG_AWAL);
    setNamaPembeli("");
    await muatParkir();
    setLayar({ nama: "pilih-barang" });
  }, [namaPembeli, keranjang, nilaiKeranjang, bazar, muatParkir]);

  const lanjutkanParkir = useCallback(
    async (id: string) => {
      if (keranjang.length > 0) {
        const lanjut = window.confirm(
          `Keranjang sekarang akan diparkir juga. Lanjutkan ke keranjang ${parkir.find((p) => p.id === id)?.namaPembeli ?? ""}?`,
        );
        if (!lanjut) return;
      }
      const p = await ambilParkir(id);
      if (!p) return;
      setKeranjang(
        p.isi.map((i) => ({
          produkId: i.produkId,
          nama: i.nama,
          hargaSatuan: i.hargaSatuan,
          kuantitas: i.kuantitas,
          diskonPerUnit: i.diskonPerUnit,
          stokTersedia: 9999,
        })),
      );
      setNilaiKeranjang({
        diskonTotal: p.diskonTotal,
        jenisBayar: p.jenisBayar,
        statusBayar: "lunas",
        dibayarSekarang: 0,
        ongkirMode: p.ongkirMode,
        ongkirNominal: p.ongkirNominal,
      });
      setNamaPembeli(p.namaPembeli);
      await hapusParkir(id);
      await muatParkir();
      setLayar({ nama: "keranjang" });
    },
    [keranjang.length, parkir, muatParkir],
  );

  const hapusParkirId = useCallback(
    async (id: string) => {
      if (!window.confirm("Hapus transaksi tertahan ini?")) return;
      await hapusParkir(id);
      await muatParkir();
    },
    [muatParkir],
  );

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
      // Hanya saat bazar aktif ajakan alokasi ditampilkan: tanpa bazar,
      // stok gudang langsung yang dijual, jadi tidak ada yang perlu diatur.
      setBarangBaruDisimpan(bazar ? p : null);
      setLayar({ nama: "barang" });
    },
    [layar, bazar],
  );

  const judul: Record<string, string> = {
    "pilih-barang": "Pilih Barang",
    "detail-barang": "Detail Barang",
    keranjang: "Keranjang",
    barang: "Barang",
    "form-barang": layar.nama === "form-barang" && layar.produk ? "Ubah Barang" : "Barang Baru",
    bazar: "Bazar",
    "alokasi-bazar": "Atur Barang Bazar",
    "tutup-bazar": "Tutup Bazar",
    ringkasan: "Ringkasan",
    pengaturan: "Pengaturan",
    "pengaturan-isi": "Pengaturan",
    resi: "Resi",
    "contoh-resi": "Contoh Resi",
    cadangan: "Cadangan",
    kasir: "Kasir",
    "daftar-jahit": "Pesanan Jahit",
    "wizard-jahit": "Pesanan Jahit Baru",
    "detail-jahit": "Detail Pesanan Jahit",
    "kasir-detail": "Terima Pembayaran",
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

      {bazar && layar.nama === "pilih-barang" && (
        <div className="content" style={{ paddingBottom: 0 }}>
          <div className="panel panel--ok">Bazar aktif: {bazar.nama}</div>
        </div>
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
          bazar={bazar}
          jumlahBazarAktif={jumlahBazarAktif}
          memuatAwal={memuatAwal}
          peran={peran}
          onMintaAdmin={() => setLayar({ nama: "masuk-admin" })}
          onBiayaBazar={() => {
            if (bazar) setLayar({ nama: "biaya-bazar", bazar });
          }}
          onKeluarAdmin={() => {
            setPeran("kasir");
            setLayar({ nama: "beranda" });
          }}
          buka={(nama) => {
            // Kasir tidak boleh membuka layar admin.
            if (peran !== "admin" && khususAdmin(nama)) {
              setLayar({ nama: "masuk-admin" });
              return;
            }
            // Kasir hanya menjual bila ada bazar aktif.
            if (peran !== "admin" && nama === "pilih-barang" && !bazar) {
              setLayar({ nama: "beranda" });
              return;
            }
            setLayar({ nama } as Layar);
          }}
        />
      )}

      {layar.nama === "pilih-barang" && (
        <>
          <PilihBarang
            onPilih={() => {}}
            stokUntuk={(p) => stokTersedia(p)}
            onTambah={(p) => tambahKeKeranjang(p, 1)}
            onBukaDetail={(p) => setLayar({ nama: "detail-barang", produk: p })}
            diKeranjang={Object.fromEntries(keranjang.map((k) => [k.produkId, k.kuantitas]))}
          />
          {keranjang.length > 0 && (
            <div className="bottombar">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setLayar({ nama: "keranjang" })}
              >
                {`Keranjang (${keranjang.reduce((n, k) => n + k.kuantitas, 0)} barang)`}
              </button>
            </div>
          )}
        </>
      )}

      {layar.nama === "detail-barang" && (
        <DetailBarang
          produk={layar.produk}
          stokTersedia={stokTersedia(layar.produk)}
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
          namaPembeli={namaPembeli}
          onUbahNamaPembeli={setNamaPembeli}
          parkir={parkir}
          onParkir={parkirSekarang}
          onLanjutkanParkir={lanjutkanParkir}
          onHapusParkir={hapusParkirId}
        />
      )}

      {layar.nama === "tersimpan" && (
        <TransaksiTersimpanLayar
          transaksi={layar.transaksi}
          onBuatResi={() => setLayar({ nama: "resi", transaksiId: layar.transaksi.id })}
          onTransaksiBaru={() => setLayar({ nama: "pilih-barang" })}
        />
      )}

      {layar.nama === "barang" && (
        <DaftarBarang
          bazarAktif={bazar}
          barangBaruDisimpan={barangBaruDisimpan}
          onAturBarangBazar={() => {
            if (!bazar) return;
            setBarangBaruDisimpan(null);
            setLayar({ nama: "alokasi-bazar", bazar });
          }}
          onTutupPemberitahuan={() => setBarangBaruDisimpan(null)}
          onTambah={() => {
            setBarangBaruDisimpan(null);
            setLayar({ nama: "form-barang", produk: null });
          }}
          onUbah={(p) => {
            setBarangBaruDisimpan(null);
            setLayar({ nama: "form-barang", produk: p });
          }}
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

      {layar.nama === "bazar" && (
        <Bazar
          onAturBarang={(b) => setLayar({ nama: "alokasi-bazar", bazar: b })}
          onTutupBazar={(b) => setLayar({ nama: "tutup-bazar", bazar: b })}
          onUbah={() => void muat()}
        />
      )}

      {layar.nama === "alokasi-bazar" && (
        <AlokasiBazar
          bazar={layar.bazar}
          onSelesai={() => {
            void muat();
          }}
        />
      )}

      {layar.nama === "tutup-bazar" && (
        <TutupBazar
          bazar={layar.bazar}
          onSelesai={async () => {
            await muat();
            setLayar({ nama: "bazar" });
          }}
        />
      )}

      {layar.nama === "pengaturan" && (
        <MenuPengaturan
          namaButik={settings?.namaButik ?? ""}
          jumlahRekening={settings?.rekening.length ?? 0}
          adaLogo={!!settings?.logo}
          onBuka={(bagian) => setLayar({ nama: "pengaturan-isi", bagian })}
          onContohResi={() => setLayar({ nama: "contoh-resi" })}
          onPin={() => setLayar({ nama: "atur-pin" })}
          onCadangan={() => setLayar({ nama: "cadangan" })}
        />
      )}

      {layar.nama === "pengaturan-isi" && (
        <Pengaturan
          bagian={layar.bagian}
          onSimpan={() => void muat()}
          onLihatContohResi={() => setLayar({ nama: "contoh-resi" })}
        />
      )}

      {layar.nama === "resi" && <Resi transaksiId={layar.transaksiId} onSelesai={() => setLayar({ nama: "beranda" })} />}

      {layar.nama === "contoh-resi" && settings && <ContohResi settings={settings} />}

      {layar.nama === "cadangan" && (
        <Cadangan
          onDipulihkan={() => {
            void muat();
          }}
        />
      )}

      {layar.nama === "atur-pin" &&
        (peran === "admin" ? (
          <AturPin
            pinAda={!!settings?.pinHash}
            onSimpan={async (hash) => {
              if (!settings) return;
              await simpanSettings({ ...settings, pinHash: hash });
              const s = await ambilSettings();
              setSettings(s);
            }}
          />
        ) : (
          <AksesAdminSaja bazarAktifAda={!!bazar} onMintaAdmin={() => setLayar({ nama: "masuk-admin" })} />
        ))}

      {layar.nama === "daftar-jahit" && (
        <DaftarPesananJahit
          segarkan={segarkanJahitan}
          onBaru={() => setLayar({ nama: "wizard-jahit" })}
          onBuka={(id) => {
            setJahitanDibuka(id);
            setLayar({ nama: "detail-jahit", id });
          }}
        />
      )}

      {layar.nama === "wizard-jahit" && (
        <WizardPesananJahit
          sibuk={sibukPesanan}
          pesanGalat={pesanPesanan}
          onBatal={() => setLayar({ nama: "daftar-jahit" })}
          onSimpan={(rencana) => {
            setPesanPesanan(null);
            setSibukPesanan(true);
            void simpanPesananJahit(rencana, { rekening: settings?.rekening ?? [] }).then((h) => {
              setSibukPesanan(false);
              if (!h.ok) {
                setPesanPesanan(h.pesan);
                return;
              }
              setSegarkanJahitan((n) => n + 1);
              setJahitanDibuka(h.pesanan.id);
              setLayar({ nama: "detail-jahit", id: h.pesanan.id });
            });
          }}
        />
      )}

      {layar.nama === "detail-jahit" && jahitanDibuka && (
        <DetailPesananJahit
          id={jahitanDibuka}
          segarkan={segarkanJahitan}
          onTerimaPembayaran={() => setLayar({ nama: "kasir-detail", id: jahitanDibuka })}
          onKembali={() => {
            setJahitanDibuka(null);
            setLayar({ nama: "daftar-jahit" });
          }}
        />
      )}

      {layar.nama === "kasir-detail" && (
        <KasirDetail
          id={layar.id}
          onKembali={() => {
            setSegarkanJahitan((n) => n + 1);
            setLayar({ nama: "detail-jahit", id: layar.id });
          }}
        />
      )}

      {layar.nama === "kasir" && (
        <Kasir
          segarkan={segarkanJahitan}
          onPesananBaru={() => setLayar({ nama: "wizard-jahit" })}
          onPenjualan={
            // Penjaga yang sama dengan buka("pilih-barang") di Beranda: kasir hanya
            // menjual bila ada bazar aktif. Null = tombol Penjualan nonaktif.
            peran === "admin" || bazar
              ? () => {
                  setLayar({ nama: "pilih-barang" });
                }
              : null
          }
        />
      )}

      {layar.nama === "masuk-admin" && (
        <MasukAdmin
          pinHash={settings?.pinHash ?? null}
          onMasukAdmin={() => {
            setPeran("admin");
            setLayar({ nama: "beranda" });
          }}
          onBatal={() => setLayar({ nama: "beranda" })}
        />
      )}

      {layar.nama === "ringkasan" &&
        (peran === "admin" ? (
          <Ringkasan bazar={bazar} />
        ) : (
          <AksesAdminSaja bazarAktifAda={!!bazar} onMintaAdmin={() => setLayar({ nama: "masuk-admin" })} />
        ))}

      {layar.nama === "biaya-bazar" && (
        <BiayaBazar
          bazar={layar.bazar}
          biaya={biaya}
          peran={peran}
          onUbah={() => {
            // Muat ulang HANYA daftar biaya agar layar langsung menampilkan hasil simpan.
            daftarBiaya(layar.bazar.id)
              .then(setBiaya)
              .catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}

