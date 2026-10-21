import { daftar, masuk } from "@/lib/actions";
export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (<>
    <h1>Manajemen Servis</h1>{e && <div className="err">{e}</div>}
    <div className="card"><h2>Masuk</h2><form action={masuk}><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Password" required /><button>Masuk</button></form></div>
    <div className="card"><h2>Daftarkan toko baru</h2><form action={daftar}><input name="toko" placeholder="Nama toko" required /><input name="nama" placeholder="Nama Anda" /><input name="email" type="email" placeholder="Email" required /><input name="password" type="password" placeholder="Password (min 6)" required /><button>Daftar</button></form></div>
  </>);
}
