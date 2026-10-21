import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { servis, pelanggan } from "@/db/schema";
import { wajibSesi } from "@/lib/auth";
import { keluar } from "@/lib/actions";
export default async function Daftar() {
  const s = await wajibSesi();
  const rows = await db.select({ id: servis.id, nomor: servis.nomor, status: servis.status, merek: servis.merek, tipe: servis.tipe, nama: pelanggan.nama })
    .from(servis).innerJoin(pelanggan, eq(servis.pelangganId, pelanggan.id)).where(eq(servis.tokoId, s.tokoId)).orderBy(desc(servis.dibuatPada)).limit(100);
  return (<>
    <div className="row"><h1>Daftar Servis</h1><form action={keluar}><button className="sec">Keluar</button></form></div>
    <Link href="/servis/baru"><button>+ Servis Baru</button></Link>
    {rows.map((r) => (<Link key={r.id} href={`/servis/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}><div className="card row"><div><b>{r.nomor}</b><br />{r.nama} · {r.merek} {r.tipe}</div><span className="badge">{r.status.replace(/_/g, " ")}</span></div></Link>))}
    {!rows.length && <p>Belum ada servis.</p>}
  </>);
}
