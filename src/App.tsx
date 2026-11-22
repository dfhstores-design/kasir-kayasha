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
import TutupHarian from "./screens/TutupHarian.tsx";
import MasukAdmin from "./screens/MasukAdmin.tsx";
import MasukKasir from "./screens/MasukKasir.tsx";
import LupaPin from "./screens/LupaPin.tsx";
import ResetPinOwner from "./screens/ResetPinOwner.tsx";
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
import RiwayatSinkron from "./screens/RiwayatSinkron.tsx";
import RiwayatPenjualan from "./screens/RiwayatPenjualan.tsx";
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
  type BazarRecord,
  type BiayaBazarRecord,
  type ProdukRecord,
  type SettingsRecord,
} from "./db/repositori.ts";
import { mintaPenyimpananPermanen } from "./pwa/register.ts";
import { terapkanTampilan } from "./lib/tampilan.ts";
import { jalankanSeedDemo, migrasiAlamatLama, migrasiRekeningKedua } from "./db/seedDemo.ts";
import type { OngkirMode } from "./lib/ongkir.ts";
import type { StatusBayar } from "./lib/keranjang.ts";
import { bazarPenjualan, bolehAdmin, bolehJualBarang, khususAdmin, labelLokasiKasir, type LokasiKasir, type Peran } from "./lib/peran.ts";
import { simpanPenjualan, type JenisBayar, type TransaksiTersimpan } from "./lib/penjualan.ts";
import { bikinIsiKeranjang, type IsiKeranjang } from "./lib/isiKeranjang.ts";
import { formatJam, tanggalHariIni, waktuDariTanggal } from "./lib/tanggal.ts";
import { simpanPesananJahit, ubahPesananJahit } from "./lib/jahitan.ts";
import { simpanPin } from "./sync/mesin.ts";
import { hapusPinLokalSetelahReset, verifikasiKodeReset } from "./sync/resetPin.ts";
import type { PeranResetPin } from "./sync/resetKode.ts";
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
  | { nama: "tutup-harian" }
  | { nama: "ringkasan" }
  | { nama: "pengaturan" }
  | { nama: "masuk-admin" }
  | { nama: "masuk-owner" }
  | { nama: "masuk-kasir" }
  | { nama: "biaya-bazar"; bazar: BazarRecord }
  | { nama: "atur-pin" }
  | { nama: "atur-pin-owner" }
  | { nama: "atur-pin-kasir-toko" }
  | { nama: "lupa-pin"; peran: PeranResetPin; label: string; kembaliKe: "masuk-admin" | "masuk-owner" | "masuk-kasir" }
  | { nama: "reset-pin-owner" }
  | { nama: "daftar-jahit" }
  | { nama: "wizard-jahit"; editId?: string }
  | { nama: "detail-jahit"; id: string }
  | { nama: "kasir-detail"; id: string }
  | { nama: "pengaturan-isi"; bagian: "profil" | "rekening" | "logo" | "tampilan" }
  | { nama: "resi"; transaksiId: string }
  | { nama: "contoh-resi" }
  | { nama: "kasir" }
  | { nama: "cadangan" }
  | { nama: "sinkronisasi" }
  | { nama: "riwayat-penjualan" };

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
  /**
   * Pengaturan sudah berhasil dibaca sekali (F3/F4, tes klik 22 Nov 2026).
   * `settings === null` berarti "belum dimuat" — BUKAN "PIN belum diatur".
   * Layar login (MasukAdmin) menunggu flag ini sebelum menyimpulkan apa
   * pun soal PIN; bila false, ia menampilkan "Memuat…" + "Coba lagi".
   */
  const [settingsSiap, setSettingsSiap] = useState(false);
  const [storagePermanen, setStoragePermanen] = useState<boolean | null>(null);

  const [keranjang, setKeranjang] = useState<IsiKeranjang[]>([]);
  const [nilaiKeranjang, setNilaiKeranjang] = useState<NilaiKeranjang>(KERANJANG_AWAL);
  const [namaPembeli, setNamaPembeli] = useState("");
  /**
   * Tanggal transaksi di keranjang (Fase 2C, re-entry kertas, BU-34):
   * bawaan hari ini; tanggal lama berarti transaksi kertas yang dimasukkan
   * lagi dengan tanggal aslinya.
   */
  const [tanggalTransaksi, setTanggalTransaksi] = useState(tanggalHariIni());
  const [parkir, setParkir] = useState<ParkirRingkas[]>([]);
  const [sedangMenyimpan, setSedangMenyimpan] = useState(false);
  /** Peran aktif. Bawaan kasir; naik ke admin/owner setelah PIN benar. */
  const [peran, setPeran] = useState<Peran>("kasir");
  /**
   * Lokasi kasir yang sedang aktif di perangkat ini (Fase 2A, BU-34).
   * Hanya di memori (hilang saat aplikasi dimuat ulang); 1 lokasi = 1 kasir.
   */
  const [lokasiKasir, setLokasiKasir] = useState<LokasiKasir | null>(null);
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
    // F3/F4, tes klik 22 Nov 2026: baca ulang yang GAGAL tidak boleh
    // menolkan settings (dulu `.catch(() => setSettings(null))` membuat
    // seluruh aplikasi mengira PIN belum diatur — masuk gratis sekali,
    // lalu minta PIN yang tidak pernah diatur; dan AturPin menelan simpan
    // PIN diam-diam). Sekarang: gagal = pertahankan nilai terakhir yang
    // bagus; settingsSiap hanya true bila baca berhasil.
    ambilSettings()
      .then((s) => {
        setSettings(s);
        setSettingsSiap(true);
      })
      .catch(() => {
        // Sengaja diam: nilai lama tetap berlaku.
      });
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
        await migrasiRekeningKedua().catch(() => false);
        const s = await ambilSettings().catch(() => null);
        const b = await bazarAktif().catch(() => undefined);
        const saldo = b ? await saldoSemuaBazar(b.id).catch(() => new Map<string, number>()) : new Map<string, number>();
        const daftar = await daftarParkir().catch(() => []);
        const daftarBiayaBazar = b ? await daftarBiaya(b.id).catch(() => []) : [];
        const jumlahAktif = await daftarBazarAktif().catch(() => [] as BazarRecord[]);
        if (!hidup) return;
        // F3/F4: baca settings yang gagal = belum dimuat, bukan "belum
        // diatur" — jangan set null. Bila gagal, coba sekali lagi
        // sesudah 1,5 detik (baca IndexedDB yang telat); layar login
        // menampilkan "Memuat…" + "Coba lagi" sampai berhasil.
        if (s) {
          setSettings(s);
          setSettingsSiap(true);
        } else {
          window.setTimeout(() => {
            if (!hidup) return;
            ambilSettings()
              .then((s2) => {
                if (!hidup) return;
                setSettings(s2);
                setSettingsSiap(true);
              })
              .catch(() => {
                // Tetap belum siap: layar login menawarkan "Coba lagi".
              });
          }, 1500);
        }
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

  /**
   * Konfirmasi duplikat di dalam aplikasi (C4, tes klik 22 Nov 2026):
   * `window.confirm` diabaikan diam-diam oleh browser otomatis (dialog
   * ditutup otomatis → confirm mengembalikan false), sehingga peringatan
   * duplikat tidak pernah terlihat kasir dan penjualan ganda tersimpan
   * begitu saja. Pola ini menggantikannya: pemanggil `await` jawaban
   * kasir dari panel "Tetap Simpan / Batal" di atas layar.
   */
  const [tanyaDuplikat, setTanyaDuplikat] = useState<string | null>(null);
  const penungguDuplikat = useRef<((ya: boolean) => void) | null>(null);
  const mintaKonfirmasiDuplikat = useCallback(
    (pesan: string) =>
      new Promise<boolean>((selesai) => {
        penungguDuplikat.current = selesai;
        setTanyaDuplikat(pesan);
      }),
    [],
  );
  const jawabDuplikat = useCallback((ya: boolean) => {
    penungguDuplikat.current?.(ya);
    penungguDuplikat.current = null;
    setTanyaDuplikat(null);
  }, []);

  const kembali = useCallback(() => {
    const n = layar.nama;
    if (n === "riwayat-penjualan") return setLayar({ nama: "beranda" });
    if (n === "detail-barang") return setLayar({ nama: "pilih-barang" });
    if (n === "keranjang") {
      if (keranjang.length > 0 && !window.confirm("Barang di keranjang belum disimpan. Mau kembali?")) return;
      return setLayar({ nama: "pilih-barang" });
    }
    if (n === "form-barang") return setLayar({ nama: "barang" });
    if (n === "alokasi-bazar" || n === "tutup-bazar") return setLayar({ nama: "bazar" });
    if (n === "daftar-jahit") return setLayar({ nama: "beranda" });
    if (n === "wizard-jahit") {
      // Mode ubah (BU-56): kembali ke detail pesanan, bukan beranda.
      if (layar.editId) return setLayar({ nama: "detail-jahit", id: layar.editId });
      return setLayar({ nama: "beranda" });
    }
    if (n === "detail-jahit") {
      setJahitanDibuka(null);
      return setLayar({ nama: "daftar-jahit" });
    }
    if (n === "kasir-detail") return setLayar({ nama: "detail-jahit", id: layar.id });
    if (n === "lupa-pin") return setLayar({ nama: layar.kembaliKe });
    if (n === "reset-pin-owner") return setLayar({ nama: "beranda" });
    setBarangBaruDisimpan(null);
    setLayar({ nama: "beranda" });
  }, [layar, keranjang.length]);

  /**
   * Bazar yang dipakai penjualan barang (F14, BU-66): kasir toko selalu
   * menjual dari gudang (null), peran lain memakai bazar aktif. Satu
   * turunan ini yang dipakai pemilih barang, keranjang, simpan, dan
   * parkir — supaya stok yang ditampilkan dan stok yang dikurangi
   * selalu dari sumber yang sama.
   */
  const bazarJual = bazarPenjualan(lokasiKasir, bazar);

  /** Stok tersedia untuk satu barang: saldo bazar bila bazar aktif, selain itu gudang. */
  const stokTersedia = useCallback(
    (p: ProdukRecord) => (bazarJual ? (saldoBazar.get(p.id) ?? 0) : p.stokGudang),
    [bazarJual, saldoBazar],
  );

  const tambahKeKeranjang = useCallback(
    (p: ProdukRecord, kuantitas = 1) => {
      const batas = bazarJual ? (saldoBazar.get(p.id) ?? 0) : p.stokGudang;
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
    [bazarJual, saldoBazar],
  );

  const simpanTransaksiSekarang = useCallback(async () => {
    setPesanSimpan(null);
    // Tanggal transaksi (Fase 2C, re-entry kertas): hari ini = waktu sekarang;
    // tanggal lama = siang hari itu (tetap tanggal yang sama saat diubah ke ISO).
    const hariIni = tanggalHariIni();
    let waktu: Date | undefined;
    if (tanggalTransaksi && tanggalTransaksi !== hariIni) {
      const parsed = waktuDariTanggal(tanggalTransaksi);
      if (!parsed) {
        setPesanSimpan("Tanggal transaksi tidak valid.");
        return;
      }
      if (tanggalTransaksi > hariIni) {
        setPesanSimpan("Tanggal transaksi tidak boleh tanggal besok.");
        return;
      }
      waktu = parsed;
    }
    setSedangMenyimpan(true);
    const rencana = {
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
      bazarId: bazarJual?.id ?? null,
      // (a, tes klik 22 Nov 2026): nama pembeli yang diketik di keranjang
      // ikut disimpan — dulu hanya dipakai saat memarkir, penjualan
      // langsung selalu tercatat tanpa nama ("Pembeli Umum").
      namaPembeli: namaPembeli.trim() || undefined,
    };
    let hasil = await simpanPenjualan(rencana, {
      rekening: settings?.rekening ?? [],
      ...(waktu ? { waktu } : {}),
    });
    // Peringatan duplikat (Fase 2C): transaksi kertas yang sama persis sudah
    // ada — tanyakan dulu di panel dalam aplikasi (C4), simpan lagi hanya
    // bila kasir yakin.
    if (!hasil.ok && hasil.duplikat && (await mintaKonfirmasiDuplikat(hasil.pesan))) {
      hasil = await simpanPenjualan(rencana, {
        rekening: settings?.rekening ?? [],
        ...(waktu ? { waktu } : {}),
        izinkanDuplikat: true,
      });
    }
    setSedangMenyimpan(false);

    if (!hasil.ok) {
      setPesanSimpan(hasil.pesan);
      return;
    }

    setKeranjang([]);
    setNilaiKeranjang(KERANJANG_AWAL);
    setNamaPembeli("");
    setTanggalTransaksi(tanggalHariIni());
    await muat();
    setLayar({ nama: "tersimpan", transaksi: hasil.transaksi });
  }, [keranjang, nilaiKeranjang, settings, bazarJual, muat, tanggalTransaksi, mintaKonfirmasiDuplikat, namaPembeli]);

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
      bazarId: bazarJual?.id ?? null,
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
  }, [namaPembeli, keranjang, nilaiKeranjang, bazarJual, muatParkir]);

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
    "tutup-harian": "Tutup Harian",
    ringkasan: "Ringkasan",
    pengaturan: "Pengaturan",
    "pengaturan-isi": "Pengaturan",
    sinkronisasi: "Sinkronisasi",
    "masuk-admin": "Masuk Admin",
    "masuk-owner": "Masuk Owner",
    "masuk-kasir": "Masuk Kasir",
    "atur-pin": "Atur PIN Admin",
    "atur-pin-owner": "Atur PIN Owner",
    "atur-pin-kasir-toko": "Atur PIN Kasir Toko",
    resi: "Resi",
    "contoh-resi": "Contoh Resi",
    cadangan: "Cadangan",
    kasir: "Kasir",
    "daftar-jahit": "Pesanan Jahit",
    "wizard-jahit":
      layar.nama === "wizard-jahit" && layar.editId ? "Ubah Pesanan Jahit" : "Pesanan Jahit Baru",
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

      {tanyaDuplikat && (
        <div className="content" style={{ paddingBottom: 0 }}>
          <div className="panel panel--warn" role="alert">
            <strong>Transaksi yang sama sudah ada.</strong>
            <p style={{ margin: "0.25rem 0 0" }}>{tanyaDuplikat}</p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button type="button" className="btn btn--primary" onClick={() => jawabDuplikat(true)}>
                Tetap Simpan
              </button>
              <button type="button" className="btn" onClick={() => jawabDuplikat(false)}>
                Batal
              </button>
            </div>
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
          lokasiKasir={lokasiKasir}
          onMintaAdmin={() => setLayar({ nama: "masuk-admin" })}
          onBiayaBazar={() => {
            if (bazar) setLayar({ nama: "biaya-bazar", bazar });
          }}
          onKeluarAdmin={() => {
            setPeran("kasir");
            setLayar({ nama: "beranda" });
          }}
          buka={(nama) => {
            // Kasir tidak boleh membuka layar admin (owner boleh, BU-32).
            if (!bolehAdmin(peran) && khususAdmin(nama)) {
              setLayar({ nama: "masuk-admin" });
              return;
            }
            // Kasir hanya menjual bila boleh jualan (F14): kasir toko
            // selalu boleh (dari gudang); kasir bazar perlu bazar aktif.
            if (!bolehAdmin(peran) && nama === "pilih-barang" && !bolehJualBarang(peran, lokasiKasir, bazar !== null)) {
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
          tanggalTransaksi={tanggalTransaksi}
          onUbahTanggalTransaksi={setTanggalTransaksi}
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

      {layar.nama === "tutup-bazar" &&
        (bolehAdmin(peran) ? (
          <TutupBazar
            bazar={layar.bazar}
            onSelesai={async () => {
              await muat();
              setLayar({ nama: "bazar" });
            }}
          />
        ) : (
          <AksesAdminSaja bazarAktifAda={!!bazar} onMintaAdmin={() => setLayar({ nama: "masuk-admin" })} />
        ))}

      {layar.nama === "tutup-harian" && (
        <TutupHarian
          bazarId={
            lokasiKasir
              ? lokasiKasir.jenis === "bazar"
                ? lokasiKasir.bazarId
                : null
              : (bazar?.id ?? null)
          }
          label={lokasiKasir ? labelLokasiKasir(lokasiKasir) : (bazar?.nama ?? "Toko")}
          peran={peran}
        />
      )}

      {layar.nama === "riwayat-penjualan" && (
        <RiwayatPenjualan
          onLihatResi={(id) => setLayar({ nama: "resi", transaksiId: id })}
          onKembali={() => setLayar({ nama: "beranda" })}
          onBerubah={() => void muat()}
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
          onSinkronisasi={() => setLayar({ nama: "sinkronisasi" })}
        />
      )}

      {layar.nama === "sinkronisasi" && <RiwayatSinkron peran={peran} />}

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
            peran="admin"
            pinAda={!!settings?.pinHash}
            hashLain={[settings?.pinOwnerHash ?? null, settings?.pinKasirTokoHash ?? null]}
            onSimpan={async (hash) => {
              // F4: tanpa guard `if (!settings) return` — guard itu menelan
              // simpan diam-diam saat settings App belum dimuat, sementara
              // AturPin menampilkan "PIN tersimpan". simpanPin membaca
              // settings segar sendiri dan melempar bila gagal tertulis.
              await simpanPin("admin", hash);
              const s = await ambilSettings();
              setSettings(s);
            }}
          />
        ) : (
          <AksesAdminSaja bazarAktifAda={!!bazar} onMintaAdmin={() => setLayar({ nama: "masuk-admin" })} />
        ))}

      {layar.nama === "atur-pin-owner" &&
        (peran === "owner" ? (
          <AturPin
            peran="owner"
            pinAda={!!settings?.pinOwnerHash}
            hashLain={[settings?.pinHash ?? null, settings?.pinKasirTokoHash ?? null]}
            onSimpan={async (hash) => {
              // F4: tanpa guard diam-diam (lihat onSimpan admin di atas).
              await simpanPin("owner", hash);
              const s = await ambilSettings();
              setSettings(s);
            }}
          />
        ) : (
          <AksesAdminSaja bazarAktifAda={!!bazar} onMintaAdmin={() => setLayar({ nama: "masuk-owner" })} />
        ))}

      {layar.nama === "atur-pin-kasir-toko" &&
        (peran === "admin" ? (
          <AturPin
            peran="kasir-toko"
            pinAda={!!settings?.pinKasirTokoHash}
            hashLain={[settings?.pinHash ?? null, settings?.pinOwnerHash ?? null]}
            onSimpan={async (hash) => {
              // F4: tanpa guard diam-diam (lihat onSimpan admin di atas).
              await simpanPin("kasir_toko", hash);
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
          editId={layar.editId}
          onBatal={() => {
            if (layar.editId) return setLayar({ nama: "detail-jahit", id: layar.editId });
            setLayar({ nama: "daftar-jahit" });
          }}
          onSimpan={(rencana) => {
            void (async () => {
              setPesanPesanan(null);
              // Mode ubah (BU-56): ubah pesanan lama, nomor + tanggal + pembayaran tidak berubah.
              if (layar.editId) {
                setSibukPesanan(true);
                const h = await ubahPesananJahit(layar.editId, rencana);
                setSibukPesanan(false);
                if (!h.ok) {
                  setPesanPesanan(h.pesan);
                  return;
                }
                setSegarkanJahitan((n) => n + 1);
                setJahitanDibuka(h.pesanan.id);
                setLayar({ nama: "detail-jahit", id: h.pesanan.id });
                return;
              }
              // Tanggal pesanan (Fase 2C, re-entry kertas): hari ini = waktu sekarang.
              let waktu: Date | undefined;
              if (rencana.tanggalPesanan && rencana.tanggalPesanan !== tanggalHariIni()) {
                const parsed = waktuDariTanggal(rencana.tanggalPesanan);
                if (!parsed) {
                  setPesanPesanan("Tanggal pesanan tidak valid.");
                  return;
                }
                if (rencana.tanggalPesanan > tanggalHariIni()) {
                  setPesanPesanan("Tanggal pesanan tidak boleh tanggal besok.");
                  return;
                }
                waktu = parsed;
              }
              setSibukPesanan(true);
              // Bazar tempat pesanan diterima (C7): kasir yang masuk sebagai
              // kasir bazar → pesanan itu milik bazar tersebut; toko/admin →
              // pesanan butik (null), tidak muncul di tutup bazar mana pun.
              const rencanaSimpan = {
                ...rencana,
                bazarId: lokasiKasir?.jenis === "bazar" ? lokasiKasir.bazarId : null,
              };
              let h = await simpanPesananJahit(rencanaSimpan, {
                rekening: settings?.rekening ?? [],
                ...(waktu ? { waktu } : {}),
              });
              // Peringatan duplikat (Fase 2C): pesanan kertas yang sama persis
              // sudah ada — tanyakan dulu di panel dalam aplikasi (C4),
              // simpan lagi hanya bila kasir yakin.
              if (!h.ok && h.duplikat && (await mintaKonfirmasiDuplikat(h.pesan))) {
                h = await simpanPesananJahit(rencanaSimpan, {
                  rekening: settings?.rekening ?? [],
                  ...(waktu ? { waktu } : {}),
                  izinkanDuplikat: true,
                });
              }
              setSibukPesanan(false);
              if (!h.ok) {
                setPesanPesanan(h.pesan);
                return;
              }
              setSegarkanJahitan((n) => n + 1);
              setJahitanDibuka(h.pesanan.id);
              setLayar({ nama: "detail-jahit", id: h.pesanan.id });
            })();
          }}
        />
      )}

      {layar.nama === "detail-jahit" && jahitanDibuka && (
        <DetailPesananJahit
          id={jahitanDibuka}
          segarkan={segarkanJahitan}
          onTerimaPembayaran={() => setLayar({ nama: "kasir-detail", id: jahitanDibuka })}
          onUbah={() => setLayar({ nama: "wizard-jahit", editId: jahitanDibuka })}
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
            // Penjaga yang sama dengan buka("pilih-barang") di Beranda (F14):
            // kasir toko selalu boleh jualan (dari gudang); kasir bazar
            // perlu bazar aktif. Null = tombol Penjualan nonaktif.
            bolehJualBarang(peran, lokasiKasir, bazar !== null)
              ? () => {
                  setLayar({ nama: "pilih-barang" });
                }
              : null
          }
        />
      )}

      {layar.nama === "masuk-admin" && (
        <MasukAdmin
          peran="admin"
          pinHash={settings?.pinHash ?? null}
          memuat={!settingsSiap}
          onMuatUlang={() => void muat()}
          onMasukAdmin={() => {
            setPeran("admin");
            setLayar({ nama: "beranda" });
          }}
          onBatal={() => setLayar({ nama: "beranda" })}
          onLupaPin={() => setLayar({ nama: "lupa-pin", peran: "admin", label: "admin", kembaliKe: "masuk-admin" })}
        />
      )}

      {layar.nama === "masuk-owner" && (
        <MasukAdmin
          peran="owner"
          pinHash={settings?.pinOwnerHash ?? null}
          memuat={!settingsSiap}
          onMuatUlang={() => void muat()}
          onMasukAdmin={() => {
            setPeran("owner");
            setLayar({ nama: "beranda" });
          }}
          onBatal={() => setLayar({ nama: "beranda" })}
          onLupaPin={() => setLayar({ nama: "lupa-pin", peran: "owner", label: "owner", kembaliKe: "masuk-owner" })}
        />
      )}

      {layar.nama === "lupa-pin" && (
        <LupaPin
          peranLabel={layar.label}
          onVerifikasi={async (kode) => {
            const hasil = await verifikasiKodeReset(layar.peran, kode);
            if (!hasil.ok) return hasil;
            // F1, tes klik 22 Nov 2026: pembersihan lokal sesudah sukses
            // server WAJIB best-effort — bila hapus lokal / muat ulang
            // gagal, verifikasi tidak boleh tampil gagal/macet. Hub sudah
            // menghapus PIN (sumber kebenaran); tarik sync berikutnya
            // membersihkan PIN lokal juga.
            try {
              await hapusPinLokalSetelahReset(layar.peran);
            } catch {
              // Abaikan: tarik sync akan membersihkan PIN lokal.
            }
            try {
              await muat();
            } catch {
              // Abaikan: layar sukses tetap tampil.
            }
            return { ok: true as const };
          }}
          onBerhasil={() => setLayar({ nama: layar.kembaliKe })}
          onBatal={() => setLayar({ nama: layar.kembaliKe })}
        />
      )}

      {layar.nama === "reset-pin-owner" &&
        (peran === "owner" ? (
          <ResetPinOwner
            settings={settings}
            onReset={async (peranReset: PeranResetPin) => {
              await hapusPinLokalSetelahReset(peranReset, true);
              await muat();
            }}
            onKembali={() => setLayar({ nama: "beranda" })}
          />
        ) : (
          <AksesAdminSaja bazarAktifAda={!!bazar} onMintaAdmin={() => setLayar({ nama: "masuk-owner" })} />
        ))}

      {layar.nama === "masuk-kasir" && (
        <MasukKasir
          lokasiAktif={lokasiKasir}
          onMasuk={(lokasi) => {
            setLokasiKasir(lokasi);
            setLayar({ nama: "beranda" });
          }}
          onKeluarLokasi={() => {
            setLokasiKasir(null);
            setLayar({ nama: "beranda" });
          }}
          onBatal={() => setLayar({ nama: "beranda" })}
          onLupaPin={(peran, label) => setLayar({ nama: "lupa-pin", peran, label, kembaliKe: "masuk-kasir" })}
        />
      )}

      {layar.nama === "ringkasan" &&
        (bolehAdmin(peran) ? (
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

