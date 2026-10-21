import { wajibSesi } from "@/lib/auth";
import { daftarKategori } from "@/lib/kategori";
import { buatServis } from "@/lib/actions";
import FormServis from "./FormServis";
export default async function Baru() {
  const s = await wajibSesi();
  return (<><h1>Servis Masuk</h1><FormServis kategori={await daftarKategori(s.tokoId)} action={buatServis} /></>);
}
