import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { servis, toko, pelanggan } from "@/db/schema";
import { wajibSesi } from "@/lib/auth";
import Print from "./Print";
export default async function Cetak({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const s = await wajibSesi();
  const [v] = await db.select({ sv: servis, t: toko, p: pelanggan }).from(servis).innerJoin(toko, eq(servis.tokoId, toko.id)).innerJoin(pelanggan, eq(servis.pelangganId, pelanggan.id)).where(and(eq(servis.id, id), eq(servis.tokoId, s.tokoId)));
  if (!v) notFound();
  return (<div className="card"><h2>{v.t.nama}</h2><p>{v.t.alamat} {v.t.telepon}</p><h3>Tanda Terima Servis {v.sv.nomor}</h3>
    <p>Pelanggan: {v.p.nama} ({v.p.telepon})<br />Perangkat: {v.sv.merek} {v.sv.tipe}<br />Keluhan: {v.sv.keluhan}<br />Estimasi: Rp {v.sv.estimasiBiaya.toLocaleString("id-ID")}</p>
    <p>Cek status: /cek/{v.sv.kodeCek}</p><p>{v.t.footerNota}</p><Print /></div>);
}
