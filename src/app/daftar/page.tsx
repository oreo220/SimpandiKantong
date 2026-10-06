import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export default async function RegisterPage(){if(await auth())redirect("/dashboard");return <main className="auth-wrap"><section className="auth-card"><Link className="logo" style={{padding:0}} href="/"><span className="logo-mark">k</span>kantong</Link><h1>Mulai atur uangmu</h1><p className="muted">Buat akun gratis, mulai dari langkah kecil.</p><AuthForm mode="register"/><div className="auth-foot">Sudah punya akun? <Link href="/masuk" style={{color:"var(--teal)",fontWeight:700}}>Masuk</Link></div></section></main>}
