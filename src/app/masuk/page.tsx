import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
export default async function LoginPage(){if(await auth())redirect("/dashboard");return <main className="auth-wrap"><section className="auth-card"><Link className="logo" style={{padding:0}} href="/"><span className="logo-mark">k</span>kantong</Link><h1>Senang bertemu lagi</h1><p className="muted">Masuk untuk melanjutkan perjalanan finansialmu.</p><AuthForm mode="login"/><div className="auth-foot">Belum punya akun? <Link href="/daftar" style={{color:"var(--teal)",fontWeight:700}}>Daftar</Link></div></section></main>}
