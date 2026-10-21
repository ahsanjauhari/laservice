"use server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { toko, pengguna, pelanggan, servis, riwayatStatus, pembayaran, statusServisEnum } from "@/db/schema";
import { buatSesi, wajibSesi } from "./auth";
import { pastikanKategori } from "./kategori";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Math.max(0, parseInt(str(f, k)) || 0);

export async function daftar(f: FormData) {
  const namaToko = str(f, "toko"), email = str(f, "email").toLowerCase(), pw = str(f, "password");
  if (!namaToko || !email || pw.length < 6) redirect("/login?e=Data+tidak+lengkap+(password+min+6)");
  const slug = namaToko.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + nanoid(4).toLowerCase();
  const [ada] = await db.select().from(pengguna).where(eq(pengguna.email, email));
  if (ada) redirect("/login?e=Email+sudah+terdaftar");
  const awalan = namaToko.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "SRV";
  const [t] = await db.insert(toko).values({ nama: namaToko, slug, awalanNomor: awalan }).returning();
  const [u] = await db.insert(pengguna).values({ tokoId: t.id, nama: str(f, "nama") || "Owner", email, passwordHash: await bcrypt.hash(pw, 10), peran: "owner" }).returning();
  await pastikanKategori(t.id);
  await buatSesi({ uid: u.id, tokoId: t.id, peran: "owner" });
  redirect("/servis");
}

export async function masuk(f: FormData) {
  const [u] = await db.select().from(pengguna).where(eq(pengguna.email, str(f, "email").toLowerCase()));
  if (!u || !u.aktif || !u.tokoId || !(await bcrypt.compare(str(f, "password"), u.passwordHash))) redirect("/login?e=Email+atau+password+salah");
  await buatSesi({ uid: u.id, tokoId: u.tokoId, peran: u.peran });
  redirect("/servis");
}

export async function keluar() { (await cookies()).delete("sesi"); redirect("/login"); }

export async function buatServis(f: FormData) {
  const s = await wajibSesi();
  const telepon = str(f, "telepon");
  let [p] = await db.select().from(pelanggan).where(and(eq(pelanggan.tokoId, s.tokoId), eq(pelanggan.telepon, telepon)));
  if (!p) [p] = await db.insert(pelanggan).values({ tokoId: s.tokoId, nama: str(f, "nama"), telepon, email: str(f, "email") || null }).returning();
  const [t] = await db.update(toko).set({ nomorTerakhir: sql`${toko.nomorTerakhir} + 1` }).where(eq(toko.id, s.tokoId)).returning();
  const dataKhusus: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("f_") && String(v).trim()) dataKhusus[k.slice(2)] = String(v).trim();
  const [r] = await db.insert(servis).values({
    tokoId: s.tokoId, nomor: `${t.awalanNomor}-${String(t.nomorTerakhir).padStart(4, "0")}`, kodeCek: nanoid(16),
    pelangganId: p.id, kategoriId: str(f, "kategori"), merek: str(f, "merek"), tipe: str(f, "tipe"), keluhan: str(f, "keluhan"),
    dataKhusus, estimasiBiaya: num(f, "estimasi"), diterimaOleh: s.uid,
  }).returning();
  await db.insert(riwayatStatus).values({ tokoId: s.tokoId, servisId: r.id, status: "diterima", penggunaId: s.uid, catatan: "Barang diterima" });
  redirect(`/servis/${r.id}`);
}

export async function ubahStatus(id: string, f: FormData) {
  const s = await wajibSesi();
  const st = str(f, "status") as (typeof statusServisEnum.enumValues)[number];
  if (!statusServisEnum.enumValues.includes(st)) return;
  const now = new Date();
  await db.update(servis).set({ status: st, ...(st === "selesai" && { selesaiPada: now }), ...(st === "diambil" && { diambilPada: now }), ...(str(f, "diagnosa") && { catatanDiagnosa: str(f, "diagnosa") }) })
    .where(and(eq(servis.id, id), eq(servis.tokoId, s.tokoId)));
  await db.insert(riwayatStatus).values({ tokoId: s.tokoId, servisId: id, status: st, penggunaId: s.uid, catatan: str(f, "catatan") || null });
  revalidatePath(`/servis/${id}`);
}

export async function setBiaya(id: string, f: FormData) {
  const s = await wajibSesi();
  await db.update(servis).set({ biayaJasa: num(f, "biaya"), diskon: num(f, "diskon") }).where(and(eq(servis.id, id), eq(servis.tokoId, s.tokoId)));
  await hitungBayar(id, s.tokoId);
}

export async function bayar(id: string, f: FormData) {
  const s = await wajibSesi();
  const jumlah = num(f, "jumlah");
  if (!jumlah) return;
  const [ok] = await db.select({ id: servis.id }).from(servis).where(and(eq(servis.id, id), eq(servis.tokoId, s.tokoId)));
  if (!ok) return;
  await db.insert(pembayaran).values({ tokoId: s.tokoId, servisId: id, jumlah, metode: str(f, "metode") || "tunai", penggunaId: s.uid });
  await hitungBayar(id, s.tokoId);
}

async function hitungBayar(id: string, tokoId: string) {
  const [v] = await db.select().from(servis).where(and(eq(servis.id, id), eq(servis.tokoId, tokoId)));
  const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(${pembayaran.jumlah}),0)::int` }).from(pembayaran).where(eq(pembayaran.servisId, id));
  const tagihan = Math.max(0, (v.biayaJasa || v.estimasiBiaya) - v.diskon);
  const status = total <= 0 ? "belum_bayar" : total >= tagihan && tagihan > 0 ? "lunas" : "dp";
  await db.update(servis).set({ statusBayar: status }).where(eq(servis.id, id));
  revalidatePath(`/servis/${id}`);
}
