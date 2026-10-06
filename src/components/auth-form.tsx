"use client";
import { useActionState } from "react";
import Link from "next/link";
import { loginAction, registerAction } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
 const action=mode==="login"?loginAction:registerAction;const [state,formAction,pending]=useActionState(action,{error:""});
 return <form className="form" action={formAction}>{mode==="register"&&<div className="field"><label htmlFor="name">Nama</label><input id="name" name="name" autoComplete="name" maxLength={80} required placeholder="Nama kamu"/></div>}<div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="nama@email.com"/></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={mode==="login"?"current-password":"new-password"} required minLength={mode==="login"?1:10} placeholder={mode==="login"?"Password kamu":"Min. 10 karakter, huruf & angka"}/></div>{mode==="register"&&<div className="field"><label htmlFor="confirm">Konfirmasi password</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" required/></div>}{state?.error&&<div className="error" role="alert">{state.error}</div>}<button className="btn" disabled={pending}>{pending?"Mohon tunggu…":mode==="login"?"Masuk":"Buat akun"}</button>{mode==="login"&&<Link className="small muted" href="/lupa-kata-sandi">Lupa kata sandi?</Link>}</form>
}
