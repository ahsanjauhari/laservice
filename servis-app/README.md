# Manajemen Servis Multi-Toko (Next.js + Drizzle + Neon)

## Deploy
1. Buat database di https://neon.tech, salin connection string.
2. Salin `.env.example` ke `.env`, isi `DATABASE_URL` dan `AUTH_SECRET` (string acak panjang).
3. `npm install` lalu `npx drizzle-kit push` (membuat tabel).
4. Lokal: `npm run dev`. Produksi: push ke GitHub, import ke Vercel/Netlify/Cloudflare, isi 2 env var yang sama.
5. Buka /login, daftarkan toko pertama (kategori HP/Laptop/PC/Elektronik dibuat otomatis).

## Fitur
Multi-toko, login, servis masuk (form dinamis per kategori), status + riwayat, biaya & pembayaran, cetak tanda terima, halaman cek status publik (/cek/kode).

## Belum ada
Manajemen pengguna tambahan (kasir/teknisi), sparepart/stok, foto (R2), notifikasi, laporan, panel Super Admin.
