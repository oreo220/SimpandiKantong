"use server";

import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_AMOUNT, expenseCategories } from "@/lib/money";
import { hash } from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { appDate } from "@/lib/app-date";

const idSchema = z.string().cuid();
const amountSchema = z.coerce.number().int().positive().max(MAX_AMOUNT);
const fail = (message: string) => ({ error: message });
async function userId() { const session = await auth(); return session?.user?.id ?? null; }

export async function registerAction(_previous: { error: string } | undefined, formData: FormData) {
  const data = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254), password: z.string().min(10).max(72).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/), confirm: z.string() }).refine(v => v.password === v.confirm).safeParse(Object.fromEntries(formData));
  if (!data.success) return fail("Periksa nama, email, dan password.");
  const email = data.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return fail("Email atau password tidak valid.");
  try { await prisma.user.create({ data: { name: data.data.name, email, passwordHash: await hash(data.data.password, 12), wallets: { create: { name: "Dompet Utama", isPrimary: true } } } }); }
  catch { return fail("Akun tidak dapat dibuat. Coba lagi."); }
  await signIn("credentials", { email, password: data.data.password, redirectTo: "/dashboard" });
}
export async function loginAction(_previous: { error: string } | undefined, formData: FormData) {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Email atau password tidak valid.");
  try { await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" }); } catch (e) { if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e; return fail("Email atau password tidak valid."); }
  return fail("Email atau password tidak valid.");
}
export async function logoutAction() { await signOut({ redirectTo: "/masuk" }); }
export async function createWalletFormAction(formData:FormData):Promise<void>{await createWalletAction(formData)}
export async function renameWalletFormAction(formData:FormData):Promise<void>{await renameWalletAction(formData)}
export async function deleteWalletFormAction(id:string):Promise<void>{await deleteWalletAction(id)}
export async function createTransactionFormAction(formData:FormData):Promise<void>{await createTransactionAction(formData)}
export async function editTransactionFormAction(id:string,formData:FormData):Promise<void>{await editTransactionAction(id,formData)}
export async function createGoalFormAction(formData:FormData):Promise<void>{await createGoalAction(formData)}
export async function contributeFormAction(formData:FormData):Promise<void>{await contributeAction(formData)}
export async function archiveGoalFormAction(id:string):Promise<void>{await archiveGoalAction(id)}
export async function deleteGoalFormAction(id:string):Promise<void>{await deleteGoalAction(id)}
export async function useGoalFormAction(id:string):Promise<void>{await consumeGoalAction(id)}
export async function deleteTransactionFormAction(id:string):Promise<void>{await deleteTransactionAction(id)}
export async function updateProfileFormAction(formData:FormData):Promise<void>{await updateProfileAction(formData)}
export async function markNotificationRead(id:string){const uid=await userId();if(!uid||!idSchema.safeParse(id).success)return;await prisma.notification.updateMany({where:{id,userId:uid,readAt:null},data:{readAt:appDate()}});revalidatePath("/notifikasi");}
export async function markAllNotificationsRead(){const uid=await userId();if(!uid)return;await prisma.notification.updateMany({where:{userId:uid,readAt:null},data:{readAt:appDate()}});revalidatePath("/notifikasi");}
export async function updateProfileAction(formData:FormData){const uid=await userId();if(!uid)return fail("Silakan masuk kembali.");const p=z.object({name:z.string().trim().min(1).max(80)}).safeParse(Object.fromEntries(formData));if(!p.success)return fail("Nama wajib diisi (maks. 80 karakter).");await prisma.user.updateMany({where:{id:uid},data:{name:p.data.name}});revalidatePath("/profil");revalidatePath("/dashboard");}

export async function createWalletAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const parsed = z.object({ name: z.string().trim().min(1).max(50) }).safeParse(Object.fromEntries(formData)); if (!parsed.success) return fail("Nama dompet wajib diisi (maks. 50 karakter).");
  try { await prisma.wallet.create({ data: { userId: uid, name: parsed.data.name } }); } catch { return fail("Nama dompet sudah digunakan atau tidak dapat dibuat."); }
  revalidatePath("/dompet");
}
export async function renameWalletAction(formData: FormData) {
 const uid=await userId();if(!uid)return fail("Silakan masuk kembali.");const p=z.object({id:idSchema,name:z.string().trim().min(1).max(50)}).safeParse(Object.fromEntries(formData));if(!p.success)return fail("Nama dompet wajib diisi (maks. 50 karakter)." );
 try{await prisma.wallet.updateMany({where:{id:p.data.id,userId:uid},data:{name:p.data.name}})}catch{return fail("Nama dompet sudah digunakan.");}revalidatePath("/dompet");
}
export async function deleteWalletAction(id:string){const uid=await userId();if(!uid||!idSchema.safeParse(id).success)return fail("Dompet tidak ditemukan.");const w=await prisma.wallet.findFirst({where:{id,userId:uid},include:{_count:{select:{transactions:true,contributions:true}}}});if(!w||w.isPrimary)return fail("Dompet Utama tidak dapat dihapus.");if(w._count.transactions||w._count.contributions)return fail("Dompet yang memiliki riwayat tidak dapat dihapus.");await prisma.wallet.delete({where:{id:w.id}});revalidatePath("/dompet");}

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
export async function deleteTransactionAction(id:string){const uid=await userId();if(!uid||!idSchema.safeParse(id).success)return fail("Transaksi tidak ditemukan.");try{await prisma.$transaction(async tx=>{const t=await tx.transaction.findFirst({where:{id,userId:uid}});if(!t)throw new Error("INVALID");if(t.type==="INCOME")await tx.wallet.update({where:{id:t.walletId},data:{balance:{decrement:t.amount}}});if(t.type==="EXPENSE"&&!t.isGoalUsage)await tx.wallet.update({where:{id:t.walletId},data:{balance:{increment:t.amount}}});if(t.type==="TRANSFER"&&t.destinationWalletId){await tx.wallet.update({where:{id:t.walletId},data:{balance:{increment:t.amount}}});await tx.wallet.update({where:{id:t.destinationWalletId},data:{balance:{decrement:t.amount}}});}await tx.transaction.delete({where:{id:t.id}});});}catch{return fail("Transaksi tidak dapat dihapus.");}revalidatePath("/transaksi");revalidatePath("/dashboard");revalidatePath("/dompet");}
export async function editTransactionAction(id:string,formData:FormData){const uid=await userId();if(!uid||!idSchema.safeParse(id).success)return fail("Transaksi tidak ditemukan.");const p=z.object({amount:amountSchema,category:z.string().min(1).max(40),walletId:idSchema,date:z.string().date(),note:z.string().max(200).optional()}).safeParse(Object.fromEntries(formData));if(!p.success)return fail("Periksa kembali data transaksi.");try{await prisma.$transaction(async tx=>{const old=await tx.transaction.findFirst({where:{id,userId:uid}});const wallet=await tx.wallet.findFirst({where:{id:p.data.walletId,userId:uid}});if(!old||old.type==="TRANSFER"||old.isGoalUsage||!wallet)throw new Error("INVALID");if(old.type==="INCOME")await tx.wallet.update({where:{id:old.walletId},data:{balance:{decrement:old.amount}}});else await tx.wallet.update({where:{id:old.walletId},data:{balance:{increment:old.amount}}});if(old.type==="INCOME")await tx.wallet.update({where:{id:wallet.id},data:{balance:{increment:p.data.amount}}});else await tx.wallet.update({where:{id:wallet.id},data:{balance:{decrement:p.data.amount}}});await tx.transaction.update({where:{id:old.id},data:{amount:p.data.amount,category:p.data.category,walletId:wallet.id,date:new Date(`${p.data.date}T12:00:00Z`),note:p.data.note||null}});});}catch{return fail("Transaksi tidak dapat diubah.");}revalidatePath("/transaksi");revalidatePath(`/transaksi/${id}`);revalidatePath("/dashboard");revalidatePath("/dompet");}

export async function createGoalAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const p = z.object({ name: z.string().trim().min(1).max(50), targetAmount: amountSchema, targetDate: z.string().optional(), description: z.string().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return fail("Periksa nama (maks. 50), target, dan deskripsi (maks. 500 karakter).");
  const date = p.data.targetDate ? new Date(`${p.data.targetDate}T12:00:00Z`) : null;
  if (date && (Number.isNaN(date.getTime()) || date < appDate())) return fail("Tanggal target tidak boleh di masa lalu.");
  await prisma.savingGoal.create({ data: { userId: uid, name: p.data.name, targetAmount: p.data.targetAmount, targetDate: date, description: p.data.description || null } });
  revalidatePath("/target");
}
export async function editGoalAction(id:string,formData:FormData){const uid=await userId();if(!uid||!idSchema.safeParse(id).success)return fail("Target tidak ditemukan.");const p=z.object({name:z.string().trim().min(1).max(50),targetAmount:amountSchema,targetDate:z.string().optional(),description:z.string().max(500).optional()}).safeParse(Object.fromEntries(formData));if(!p.success)return fail("Periksa kembali nama, target, dan deskripsi.");const targetDate=p.data.targetDate?new Date(`${p.data.targetDate}T12:00:00Z`):null;if(targetDate&&(Number.isNaN(targetDate.getTime())||targetDate<appDate()))return fail("Tanggal target tidak boleh di masa lalu.");const updated=await prisma.savingGoal.updateMany({where:{id,userId:uid,status:{in:["ACTIVE","ARCHIVED"]}},data:{name:p.data.name,targetAmount:p.data.targetAmount,targetDate,description:p.data.description||null}});if(!updated.count)return fail("Target tidak ditemukan atau sudah digunakan.");revalidatePath("/target");revalidatePath(`/target/${id}`);revalidatePath("/dashboard");}
export async function editGoalFormAction(id:string,formData:FormData):Promise<void>{await editGoalAction(id,formData)}
export async function contributeAction(formData: FormData) {
  const uid = await userId(); if (!uid) return fail("Silakan masuk kembali.");
  const p = z.object({ goalId: idSchema, walletId: idSchema, amount: amountSchema, date: z.string().date(), note: z.string().max(200).optional() }).safeParse(Object.fromEntries(formData)); if (!p.success) return fail("Periksa kembali data tabungan.");
  try { await prisma.$transaction(async tx => { const goal = await tx.savingGoal.findFirst({ where: { id: p.data.goalId, userId: uid, status: "ACTIVE" } }); if (!goal) throw new Error("INVALID"); const updated=await tx.wallet.updateMany({where:{id:p.data.walletId,userId:uid,balance:{gte:p.data.amount}},data:{balance:{decrement:p.data.amount}}}); if(updated.count!==1)throw new Error("INSUFFICIENT"); await tx.savingContribution.create({ data: { ...p.data, date: new Date(`${p.data.date}T12:00:00Z`), note: p.data.note || null, userId: uid } }); }); } catch (e) { return fail(e instanceof Error && e.message === "INSUFFICIENT" ? "Saldo dompet tidak mencukupi." : "Target tidak ditemukan atau sudah tidak menerima tabungan."); }
  revalidatePath("/target"); revalidatePath("/dashboard"); revalidatePath("/dompet");
}
export async function archiveGoalAction(id: string) { const uid = await userId(); if (!uid || !idSchema.safeParse(id).success) return; await prisma.savingGoal.updateMany({ where: { id, userId: uid, status: "ACTIVE" }, data: { status: "ARCHIVED" } }); revalidatePath("/target"); }
export async function deleteGoalAction(id:string){const uid=await userId();if(!uid||!idSchema.safeParse(id).success)return;await prisma.savingGoal.deleteMany({where:{id,userId:uid}});revalidatePath("/target");revalidatePath("/dashboard");}
export async function consumeGoalAction(id: string) {
  const uid = await userId(); if (!uid || !idSchema.safeParse(id).success) return fail("Target tidak ditemukan.");
  try { await prisma.$transaction(async tx => { const goal = await tx.savingGoal.findFirst({ where: { id, userId: uid, status: { in: ["ACTIVE", "ARCHIVED"] } } }); if (!goal) throw new Error("INVALID"); const c = await tx.savingContribution.aggregate({ where: { goalId: id, userId: uid }, _sum: { amount: true } }); if (!c._sum.amount || Number(c._sum.amount) <= 0) throw new Error("EMPTY"); const primary = await tx.wallet.findFirst({ where: { userId: uid, isPrimary: true } }); if (!primary) throw new Error("INVALID"); await tx.transaction.create({ data: { userId: uid, type: "EXPENSE", amount: c._sum.amount, category: "Lainnya", walletId: primary.id, date: appDate(), note: `Target: ${goal.name}`, isGoalUsage: true } }); await tx.savingGoal.update({ where: { id: goal.id }, data: { status: "USED" } }); }); } catch { return fail("Target tidak dapat digunakan."); }
  revalidatePath("/target"); revalidatePath("/transaksi"); revalidatePath("/laporan");
}

