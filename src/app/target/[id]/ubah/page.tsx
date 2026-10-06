import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { editGoalFormAction } from "@/app/actions";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session=await auth();if(!session?.user)redirect("/masuk");const {id}=await params;
  const goal=await prisma.savingGoal.findFirst({where:{id,userId:session.user.id,status:{in:["ACTIVE","ARCHIVED"]}}});if(!goal)notFound();
  return <AppShell current="Target"><h2 className="page-title">Ubah target</h2><p className="muted page-intro">Perbarui rincian target tabunganmu.</p><section className="card"><form action={editGoalFormAction.bind(null,id)} className="form"><div className="field"><label htmlFor="name">Nama target</label><input id="name" name="name" maxLength={50} defaultValue={goal.name} required/></div><div className="field"><label htmlFor="targetAmount">Nominal target (Rp)</label><input id="targetAmount" name="targetAmount" type="number" min="1" max="1000000000" defaultValue={goal.targetAmount.toString()} required/></div><div className="field"><label htmlFor="targetDate">Tanggal target (opsional)</label><input id="targetDate" name="targetDate" type="date" defaultValue={goal.targetDate?.toISOString().slice(0,10)}/></div><div className="field"><label htmlFor="description">Deskripsi (opsional)</label><textarea id="description" name="description" maxLength={500} defaultValue={goal.description||""}/></div><button className="btn">Simpan perubahan</button></form></section></AppShell>;
}
