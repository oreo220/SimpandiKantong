"use server";

import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_AMOUNT, expenseCategories } from "@/lib/money";
import { hash } from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const idSchema = z.string().cuid();
const amountSchema = z.coerce.number().int().positive().max(MAX_AMOUNT);
const fail = (message: string) => ({ error: message });
async function userId() { const session = await auth(); return session?.user?.id ?? null; }

export async function registerAction(formData: FormData) {
  const data = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254), password: z.string().min(10).max(72).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/), confirm: z.string() }).refine(v => v.password === v.confirm).safeParse(Object.fromEntries(formData));
  if (!data.success) return fail("Periksa nama, email, dan password (min. 10 karakter, huruf besar/kecil, angka).”);
  const email = data.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return fail("Email atau password tidak valid.");
  try { await prisma.user.create({ data: { name: data.data.name, email, passwordHash: await hash(data.data.password, 12), wallets: { create: { name: "Dompet Utama", isPrimary: true } } } }); }
  catch { return fail("Akun tidak dapat dibuat. Coba lagi."); }
  await signIn("credentials", { email, password: data.data.password, redirectTo: "/dashboard" });
}
export async function loginAction(formData: FormData) {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Email atau password tidak valid.");
  try { await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" }); } catch (e) { if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e; return fail("Email atau password tidak valid."); }
  return fail("Email atau password tidak valid.");
}
export async function logoutAction() { await signOut({ redirectTo: "/masuk" }); }

export async function createWalletAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const parsed = z.object({ name: z.string().trim().min(1).max(50) }).safeParse(Object.fromEntries(formData)); if (!parsed.success) return fail("Nama dompet wajib diisi (maks. 50 karakter).");
  try { await prisma.wallet.create({ data: { userId: uid, name: parsed.data.name } }); } catch { return fail("Nama dompet sudah digunakan atau tidak dapat dibuat."); }
  revalidatePath("/dompet");
}

export async function createTransactionAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const parsed = z.object({ type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]), amount: amountSchema, category: z.string().max(40), walletId: idSchema, destinationWalletId: z.string().optional(), date: z.string().date(), note: z.string().max(200).optional(), allowNegative: z.literal("true").optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Periksa kembali data transaksi.");
  const d = parsed.data; if (d.type === "EXPENSE" && !expenseCategories.includes(d.category as typeof expenseCategories[number])) return fail("Kategori tidak valid.");
  if (d.type === "TRANSFER" && (!d.destinationWalletId || d.destinationWalletId === d.walletId)) return fail("Pilih dua dompet yang berbeda.");
  try { await prisma.$transaction(async tx => {
    const source = await tx.wallet.findFirst({ where: { id: d.walletId, userId: uid } }); if (!source) throw new Error("WALLET");
    if (d.type === "INCOME") { await tx.wallet.update({ where: { id: source.id }, data: { balance: { increment: d.amount } } }); }
    if (d.type === "EXPENSE") { await tx.wallet.update({ where: { id: source.id }, data: { balance: { decrement: d.amount } } }); }
    if (d.type === "TRANSFER") { const dest = await tx.wallet.findFirst({ where: { id: d.destinationWalletId, userId: uid } }); if (!dest) throw new Error("WALLET"); if (Number(source.balance) < d.amount && d.allowNegative !== "true") throw new Error("INSUFFICIENT"); await tx.wallet.update({ where: { id: source.id }, data: { balance: { decrement: d.amount } } }); await tx.wallet.update({ where: { id: dest.id }, data: { balance: { increment: d.amount } } }); }
    await tx.transaction.create({ data: { userId: uid, type: d.type, amount: d.amount, category: d.type === "TRANSFER" ? "Transfer" : d.category, walletId: source.id, destinationWalletId: d.type === "TRANSFER" ? d.destinationWalletId : null, date: new Date(`${d.date}T12:00:00Z`), note: d.note || null } });
  }); } catch (e) { if (e instanceof Error && e.message === "INSUFFICIENT") return fail("Saldo dompet tidak mencukupi. Konfirmasi transfer dengan allowNegative=true jika ingin lanjut."); return fail("Transaksi gagal. Periksa dompet dan coba lagi."); }
  revalidatePath("/dashboard"); revalidatePath("/transaksi"); revalidatePath("/dompet"); revalidatePath("/laporan");
}

export async function createGoalAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const p = z.object({ name: z.string().trim().min(1).max(50), targetAmount: amountSchema, targetDate: z.string().optional(), description: z.string().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return fail("Periksa nama (maks. 50), target, dan deskripsi (maks. 500 karakter).");
  const date = p.data.targetDate ? new Date(`${p.data.targetDate}T12:00:00Z`) : null;
  if (date && (Number.isNaN(date.getTime()) || date < new Date(new Date().toDateString()))) return fail("Tanggal target tidak boleh di masa lalu.");
  await prisma.savingGoal.create({ data: { userId: uid, name: p.data.name, targetAmount: p.data.targetAmount, targetDate: date, description: p.data.description || null } });
  revalidatePath("/target");
}
export async function contributeAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const p = z.object({ goalId: idSchema, walletId: idSchema, amount: amountSchema, date: z.string().date(), note: z.string().max(200).optional() }).safeParse(Object.fromEntries(formData)); if (!p.success) return fail("Periksa kembali data tabungan.");
  try { await prisma.$transaction(async tx => { const goal = await tx.savingGoal.findFirst({ where: { id: p.data.goalId, userId: uid, status: "ACTIVE" } }); const wallet = await tx.wallet.findFirst({ where: { id: p.data.walletId, userId: uid } }); if (!goal || !wallet) throw new Error("INVALID"); if (Number(wallet.balance) < p.data.amount) throw new Error("INSUFFICIENT"); await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: p.data.amount } } }); await tx.savingContribution.create({ data: { ...p.data, date: new Date(`${p.data.date}T12:00:00Z`), note: p.data.note || null, userId: uid } }); }); } catch (e) { return fail(e instanceof Error && e.message === "INSUFFICIENT" ? "Saldo dompet tidak mencukupi." : "Target tidak ditemukan atau sudah tidak menerima tabungan."); }
  revalidatePath("/target"); revalidatePath("/dashboard"); revalidatePath("/dompet");
}
export async function archiveGoalAction(id: string) { const uid = await userId(); if (!uid || !idSchema.safeParse(id).success) return; await prisma.savingGoal.updateMany({ where: { id, userId: uid, status: "ACTIVE" }, data: { status: "ARCHIVED" } }); revalidatePath("/target"); }
export async function useGoalAction(id: string) {
  const uid = await userId(); if (!uid || !idSchema.safeParse(id).success) return fail("Target tidak ditemukan.");
  try { await prisma.$transaction(async tx => { const goal = await tx.savingGoal.findFirst({ where: { id, userId: uid, status: { in: ["ACTIVE", "ARCHIVED"] } } }); if (!goal) throw new Error("INVALID"); const c = await tx.savingContribution.aggregate({ where: { goalId: id, userId: uid }, _sum: { amount: true } }); const primary = await tx.wallet.findFirst({ where: { userId: uid, isPrimary: true } }); if (!primary) throw new Error("INVALID"); await tx.transaction.create({ data: { userId: uid, type: "EXPENSE", amount: c._sum.amount ?? 0, category: "Lainnya", walletId: primary.id, date: new Date(), note: `Target: ${goal.name}` } }); await tx.savingGoal.update({ where: { id: goal.id }, data: { status: "USED" } }); }); } catch { return fail("Target tidak dapat digunakan."); }
  revalidatePath("/target"); revalidatePath("/transaksi"); revalidatePath("/laporan");
}
