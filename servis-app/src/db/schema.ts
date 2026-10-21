// db/schema.ts
// Skema Drizzle (PostgreSQL / Neon) - Sistem Manajemen Servis Multi-Toko
// Aturan utama: semua tabel milik toko WAJIB punya toko_id dan setiap query
// harus difilter dengan toko_id milik pengguna yang login.

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------ ENUM ------------------------------ */

export const peranEnum = pgEnum("peran", ["owner", "kasir", "teknisi"]);

export const statusServisEnum = pgEnum("status_servis", [
  "diterima",
  "diagnosa",
  "menunggu_persetujuan",
  "menunggu_sparepart",
  "dikerjakan",
  "selesai",
  "diambil",
  "dibatalkan",
]);

export const statusBayarEnum = pgEnum("status_bayar", [
  "belum_bayar",
  "dp",
  "lunas",
]);

export const tipeFieldEnum = pgEnum("tipe_field", [
  "teks",
  "angka",
  "pilihan",
  "pilihan_ganda",
  "tanggal",
]);

export const kanalNotifEnum = pgEnum("kanal_notif", ["whatsapp", "email"]);

export const paketEnum = pgEnum("paket", ["gratis", "pro"]);

/* ------------------------- helper kolom umum ----------------------- */

const id = () => uuid("id").primaryKey().defaultRandom();
const dibuatPada = () =>
  timestamp("dibuat_pada", { withTimezone: true }).notNull().defaultNow();
// Uang disimpan sebagai integer rupiah (tanpa desimal).
const rupiah = (nama: string) => integer(nama).notNull().default(0);

/* ------------------------------ TOKO ------------------------------ */

export const toko = pgTable(
  "toko",
  {
    id: id(),
    nama: varchar("nama", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 60 }).notNull(), // subdomain / path
    alamat: text("alamat"),
    telepon: varchar("telepon", { length: 30 }),
    logoUrl: text("logo_url"),
    awalanNomor: varchar("awalan_nomor", { length: 10 }).notNull().default("SRV"),
    nomorTerakhir: integer("nomor_terakhir").notNull().default(0), // counter nomor servis
    footerNota: text("footer_nota"),
    paket: paketEnum("paket").notNull().default("gratis"),
    aktif: boolean("aktif").notNull().default(true),
    dibuatPada: dibuatPada(),
  },
  (t) => [uniqueIndex("toko_slug_uq").on(t.slug)],
);

/* ----------------------------- PENGGUNA --------------------------- */

export const pengguna = pgTable(
  "pengguna",
  {
    id: id(),
    tokoId: uuid("toko_id").references(() => toko.id, { onDelete: "cascade" }), // null = super admin
    nama: varchar("nama", { length: 120 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    peran: peranEnum("peran").notNull().default("kasir"),
    superAdmin: boolean("super_admin").notNull().default(false),
    aktif: boolean("aktif").notNull().default(true),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    uniqueIndex("pengguna_email_uq").on(t.email),
    index("pengguna_toko_idx").on(t.tokoId),
  ],
);

/* ----------------------------- PELANGGAN -------------------------- */

export const pelanggan = pgTable(
  "pelanggan",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    nama: varchar("nama", { length: 120 }).notNull(),
    telepon: varchar("telepon", { length: 30 }).notNull(),
    email: varchar("email", { length: 190 }),
    alamat: text("alamat"),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    index("pelanggan_toko_telepon_idx").on(t.tokoId, t.telepon),
    index("pelanggan_toko_nama_idx").on(t.tokoId, t.nama),
  ],
);

/* ------------------- KATEGORI PERANGKAT & FORM DINAMIS ------------- */

// tokoId = null  -> kategori global (HP, Elektronik, Laptop, PC)
// tokoId terisi  -> kategori kustom milik satu toko
export const kategoriPerangkat = pgTable(
  "kategori_perangkat",
  {
    id: id(),
    tokoId: uuid("toko_id").references(() => toko.id, { onDelete: "cascade" }),
    kode: varchar("kode", { length: 30 }).notNull(), // hp, laptop, pc, elektronik
    nama: varchar("nama", { length: 80 }).notNull(),
    aktif: boolean("aktif").notNull().default(true),
  },
  (t) => [index("kategori_toko_idx").on(t.tokoId)],
);

// Kategori mana yang diaktifkan oleh tiap toko
export const tokoKategori = pgTable(
  "toko_kategori",
  {
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => kategoriPerangkat.id, { onDelete: "cascade" }),
    aktif: boolean("aktif").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.tokoId, t.kategoriId] })],
);

// Definisi field form per kategori; nilainya disimpan di servis.data_khusus
export const fieldKategori = pgTable(
  "field_kategori",
  {
    id: id(),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => kategoriPerangkat.id, { onDelete: "cascade" }),
    tokoId: uuid("toko_id").references(() => toko.id, { onDelete: "cascade" }), // null = field bawaan
    kunci: varchar("kunci", { length: 50 }).notNull(), // mis. "imei"
    label: varchar("label", { length: 100 }).notNull(), // mis. "IMEI"
    tipe: tipeFieldEnum("tipe").notNull().default("teks"),
    opsi: jsonb("opsi").$type<string[]>(), // untuk tipe pilihan / pilihan_ganda
    sensitif: boolean("sensitif").notNull().default(false), // mis. password perangkat
    wajib: boolean("wajib").notNull().default(false),
    urutan: integer("urutan").notNull().default(0),
  },
  (t) => [index("field_kategori_idx").on(t.kategoriId)],
);

/* ------------------------------- SERVIS --------------------------- */

export const servis = pgTable(
  "servis",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    nomor: varchar("nomor", { length: 30 }).notNull(), // mis. TKA-0001
    kodeCek: varchar("kode_cek", { length: 24 }).notNull(), // token acak untuk halaman publik / QR
    pelangganId: uuid("pelanggan_id")
      .notNull()
      .references(() => pelanggan.id, { onDelete: "restrict" }),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => kategoriPerangkat.id, { onDelete: "restrict" }),
    merek: varchar("merek", { length: 80 }),
    tipe: varchar("tipe", { length: 120 }),
    keluhan: text("keluhan").notNull(),
    dataKhusus: jsonb("data_khusus")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: statusServisEnum("status").notNull().default("diterima"),
    teknisiId: uuid("teknisi_id").references(() => pengguna.id, { onDelete: "set null" }),
    diterimaOleh: uuid("diterima_oleh").references(() => pengguna.id, { onDelete: "set null" }),
    catatanDiagnosa: text("catatan_diagnosa"),
    estimasiBiaya: rupiah("estimasi_biaya"),
    biayaJasa: rupiah("biaya_jasa"),
    diskon: rupiah("diskon"),
    statusBayar: statusBayarEnum("status_bayar").notNull().default("belum_bayar"),
    estimasiSelesai: timestamp("estimasi_selesai", { withTimezone: true }),
    selesaiPada: timestamp("selesai_pada", { withTimezone: true }),
    diambilPada: timestamp("diambil_pada", { withTimezone: true }),
    dibuatPada: dibuatPada(),
  },
  (t) => [
    uniqueIndex("servis_toko_nomor_uq").on(t.tokoId, t.nomor),
    uniqueIndex("servis_kode_cek_uq").on(t.kodeCek),
    index("servis_toko_status_idx").on(t.tokoId, t.status),
    index("servis_toko_teknisi_idx").on(t.tokoId, t.teknisiId),
    index("servis_toko_pelanggan_idx").on(t.tokoId, t.pelangganId),
  ],
);

export const fotoServis = pgTable("foto_servis", {
  id: id(),
  tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
  servisId: uuid("servis_id").notNull().references(() => servis.id, { onDelete: "cascade" }),
  url: text("url").notNull(), // lokasi file di Cloudflare R2
  keterangan: varchar("keterangan", { length: 150 }),
  dibuatPada: dibuatPada(),
});

export const riwayatStatus = pgTable(
  "riwayat_status",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    servisId: uuid("servis_id").notNull().references(() => servis.id, { onDelete: "cascade" }),
    status: statusServisEnum("status").notNull(),
    penggunaId: uuid("pengguna_id").references(() => pengguna.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    tampilPublik: boolean("tampil_publik").notNull().default(true),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("riwayat_servis_idx").on(t.servisId, t.waktu)],
);

/* --------------------------- SPAREPART & STOK --------------------- */

export const sparepart = pgTable(
  "sparepart",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    nama: varchar("nama", { length: 150 }).notNull(),
    sku: varchar("sku", { length: 50 }),
    hargaBeli: rupiah("harga_beli"),
    hargaJual: rupiah("harga_jual"),
    stok: integer("stok").notNull().default(0),
    stokMin: integer("stok_min").notNull().default(0),
    aktif: boolean("aktif").notNull().default(true),
  },
  (t) => [
    index("sparepart_toko_idx").on(t.tokoId),
    uniqueIndex("sparepart_toko_sku_uq").on(t.tokoId, t.sku),
  ],
);

export const pemakaianSparepart = pgTable(
  "pemakaian_sparepart",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    servisId: uuid("servis_id").notNull().references(() => servis.id, { onDelete: "cascade" }),
    sparepartId: uuid("sparepart_id")
      .notNull()
      .references(() => sparepart.id, { onDelete: "restrict" }),
    jumlah: integer("jumlah").notNull().default(1),
    hargaSatuan: rupiah("harga_satuan"), // snapshot harga saat dipakai
    dibuatPada: dibuatPada(),
  },
  (t) => [index("pemakaian_servis_idx").on(t.servisId)],
);

/* ------------------- PEMBAYARAN, GARANSI, NOTIFIKASI -------------- */

export const pembayaran = pgTable(
  "pembayaran",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    servisId: uuid("servis_id").notNull().references(() => servis.id, { onDelete: "cascade" }),
    jumlah: integer("jumlah").notNull(),
    metode: varchar("metode", { length: 30 }).notNull().default("tunai"), // tunai, transfer, qris
    penggunaId: uuid("pengguna_id").references(() => pengguna.id, { onDelete: "set null" }),
    catatan: text("catatan"),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pembayaran_servis_idx").on(t.servisId)],
);

export const garansi = pgTable("garansi", {
  id: id(),
  tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
  servisId: uuid("servis_id").notNull().references(() => servis.id, { onDelete: "cascade" }),
  mulai: timestamp("mulai", { withTimezone: true }).notNull(),
  berakhir: timestamp("berakhir", { withTimezone: true }).notNull(),
  catatan: text("catatan"),
});

export const notifikasiLog = pgTable(
  "notifikasi_log",
  {
    id: id(),
    tokoId: uuid("toko_id").notNull().references(() => toko.id, { onDelete: "cascade" }),
    servisId: uuid("servis_id").references(() => servis.id, { onDelete: "cascade" }),
    kanal: kanalNotifEnum("kanal").notNull(),
    tujuan: varchar("tujuan", { length: 190 }).notNull(),
    pesan: text("pesan").notNull(),
    berhasil: boolean("berhasil").notNull().default(false),
    galat: text("galat"),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_toko_idx").on(t.tokoId, t.waktu)],
);

/* ----------------------------- RELATIONS -------------------------- */

export const tokoRelations = relations(toko, ({ many }) => ({
  pengguna: many(pengguna),
  pelanggan: many(pelanggan),
  servis: many(servis),
  sparepart: many(sparepart),
}));

export const penggunaRelations = relations(pengguna, ({ one }) => ({
  toko: one(toko, { fields: [pengguna.tokoId], references: [toko.id] }),
}));

export const kategoriRelations = relations(kategoriPerangkat, ({ many }) => ({
  fields: many(fieldKategori),
}));

export const fieldKategoriRelations = relations(fieldKategori, ({ one }) => ({
  kategori: one(kategoriPerangkat, {
    fields: [fieldKategori.kategoriId],
    references: [kategoriPerangkat.id],
  }),
}));

export const servisRelations = relations(servis, ({ one, many }) => ({
  toko: one(toko, { fields: [servis.tokoId], references: [toko.id] }),
  pelanggan: one(pelanggan, { fields: [servis.pelangganId], references: [pelanggan.id] }),
  kategori: one(kategoriPerangkat, {
    fields: [servis.kategoriId],
    references: [kategoriPerangkat.id],
  }),
  teknisi: one(pengguna, { fields: [servis.teknisiId], references: [pengguna.id] }),
  foto: many(fotoServis),
  riwayat: many(riwayatStatus),
  pemakaian: many(pemakaianSparepart),
  pembayaran: many(pembayaran),
}));

export const pemakaianRelations = relations(pemakaianSparepart, ({ one }) => ({
  servis: one(servis, { fields: [pemakaianSparepart.servisId], references: [servis.id] }),
  sparepart: one(sparepart, {
    fields: [pemakaianSparepart.sparepartId],
    references: [sparepart.id],
  }),
}));

/* ------------------------------ CATATAN --------------------------- */
// 1. Nomor servis: di dalam transaksi, jalankan
//      UPDATE toko SET nomor_terakhir = nomor_terakhir + 1 WHERE id = $1 RETURNING nomor_terakhir
//    lalu susun nomor = awalan_nomor + "-" + nomor_terakhir (padStart 4).
// 2. kode_cek: buat string acak (nanoid 16-24 karakter) dan pakai untuk URL/QR publik,
//    bukan nomor servis yang mudah ditebak.
// 3. Field bertanda sensitif (mis. password perangkat) sebaiknya dienkripsi di aplikasi
//    sebelum disimpan di data_khusus dan tidak ditampilkan di halaman publik.
// 4. Tabel akun/sesi Auth.js (jika memakai adapter database) ditambahkan terpisah.
// 5. Opsional: aktifkan Row-Level Security Postgres per toko_id sebagai lapis kedua.
