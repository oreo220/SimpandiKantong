# Kantong

Kantong adalah aplikasi web untuk membantu mahasiswa mencatat arus uang, mengatur dompet, dan menabung berdasarkan target.

## Fitur

- Registrasi dan login email/password dengan Auth.js Credentials dan hash bcrypt.
- Dashboard dari data PostgreSQL: saldo semua dompet, ringkasan pemasukan/pengeluaran/tabungan, transaksi terbaru, dan target berjalan.
- Pemasukan, pengeluaran, transfer antar dompet, pencarian transaksi, filter jenis, dan pagination 20 item.
- Transfer saldo rendah menampilkan peringatan sebelum pengguna memilih lanjut.
- Dompet utama otomatis dibuat saat registrasi; rename dan penghapusan dompet tanpa riwayat.
- Target tabungan, kontribusi atomic, arsip, progress di atas 100%, dan penggunaan tanpa pengurangan saldo kedua kali.
- Laporan berbasis tanggal untuk minggu ini, bulan berjalan, bulan sebelumnya, dan rentang kustom.
- Notifikasi deduplicated untuk target tercapai/terlampaui, tenggat dekat, dan dompet negatif.
- Profil, UI Bahasa Indonesia, responsive navigation, PostgreSQL, Prisma migrations.

## Tech stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- PostgreSQL dan Prisma ORM
- Auth.js (NextAuth v5 Credentials), bcryptjs, Zod

## Requirements

- Node.js 24 LTS atau versi yang didukung Next.js 16.
- PostgreSQL 14+ (lokal atau provider managed, seperti Neon/Supabase).
- Database dapat diakses dari mesin build dan deployment.

## Installation

```bash
npm install
Copy-Item .env.example .env.local
```

Isi `DATABASE_URL` dan buat `AUTH_SECRET` acak. Jangan commit `.env.local`.

## Environment variables

| Nama | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | Ya | URL koneksi PostgreSQL. Gunakan URL pooled untuk runtime bila provider menyarankan. |
| `AUTH_SECRET` | Ya | Secret sesi Auth.js, minimal 32 byte acak. |
| `APP_SIMULATED_DATE` | Tidak | Override tanggal di mode development untuk QA, format `YYYY-MM-DD`; hapus pada production. |

Generate secret, misalnya `openssl rand -base64 32`.

## Database setup

```bash
npm run db:migrate
```

`prisma/migrations` menyimpan schema awal. Perubahan schema selanjutnya dibuat dengan `npm run db:dev` di development lalu commit migration baru. `npm run build` menjalankan Prisma Client generation terlebih dahulu.

## Development

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Deployment ke Vercel

1. Push folder project ini ke repository GitHub.
2. Import repository ke Vercel sebagai Next.js project.
3. Tambahkan `DATABASE_URL` PostgreSQL production dan `AUTH_SECRET` di Vercel Project Settings → Environment Variables untuk Production, Preview, dan Development sesuai kebutuhan.
4. Deploy. Build script menjalankan Prisma Client generation terlebih dahulu lalu `next build`.
5. Jalankan `npm run db:migrate` terhadap database production sebelum menerima trafik (gunakan koneksi migrasi non-pooled bila provider membutuhkannya).
6. Pastikan domain production HTTPS dan URL callback/Auth.js sesuai deployment.

Jangan menaruh credential database atau secret di source control. `.env*` diabaikan Git.

## Catatan implementasi

- Nilai uang disimpan sebagai PostgreSQL `DECIMAL(14,0)` dan tidak menggunakan floating point sebagai sumber saldo.
- Operasi saldo dan pembuatan transaksi terkait dijalankan dalam Prisma transaction.
- Query data memfilter setiap request dengan user session; ID saja tidak cukup untuk mengambil data pengguna lain.
- `APP_SIMULATED_DATE` hanya berlaku saat `NODE_ENV` bukan `production`.
- Reset password via email belum diaktifkan karena layanan pengiriman email memerlukan konfigurasi provider dan credential tersendiri.

## Lisensi

Source code aplikasi ini disiapkan untuk repository Kantong.
