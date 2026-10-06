import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idr } from "@/lib/money";
import { redirect } from "next/navigation";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { appDate } from "@/lib/app-date";

export default async function DashboardPage(){
 const session=await auth();if(!session?.user)redirect("/masuk");const uid=session.user.id;
 const today=appDate();const monthStart=new Date(today.getFullYear(),today.getMonth(),1);const monthEnd=new Date(today.getFullYear(),today.getMonth()+1,1);
 const [wallets,income,expenses,contributions,goals,transactions,chartRows]=await Promise.all([
  prisma.wallet.findMany({where:{userId:uid},orderBy:{createdAt:"asc"}}),
  prisma.transaction.aggregate({where:{userId:uid,type:"INCOME"},_sum:{amount:true}}),
  prisma.transaction.aggregate({where:{userId:uid,type:"EXPENSE"},_sum:{amount:true}}),
  prisma.savingContribution.aggregate({where:{userId:uid},_sum:{amount:true}}),
  prisma.savingGoal.findMany({where:{userId:uid,status:"ACTIVE"},include:{contributions:{select:{amount:true}}},take:3,orderBy:{createdAt:"desc"}}),
  prisma.transaction.findMany({where:{userId:uid},include:{wallet:true},orderBy:{date:"desc"},take:6}),
  prisma.transaction.findMany({where:{userId:uid,type:{in:["INCOME","EXPENSE"]},date:{gte:monthStart,lt:monthEnd}},select:{type:true,amount:true,date:true}})
 ]);
 const monthIncome=chartRows.filter(x=>x.type==="INCOME").reduce((n,x)=>n+Number(x.amount),0);const monthExpense=chartRows.filter(x=>x.type==="EXPENSE").reduce((n,x)=>n+Number(x.amount),0);
 const days=Array.from({length:new Date(today.getFullYear(),today.getMonth()+1,0).getDate()},(_,i)=>({label:String(i+1),income:0,expense:0}));for(const row of chartRows){const bucket=days[row.date.getDate()-1];if(bucket)bucket[row.type==="INCOME"?"income":"expense"]+=Number(row.amount)}
 const sum=(xs:{amount:{toString():string}}[])=>xs.reduce((n,x)=>n+Number(x.amount),0);const bal=wallets.reduce((n,w)=>n+Number(w.balance),0);
 const cards=[["↙","Pemasukan","+"+idr(income._sum.amount?.toString()??0),"#"],["↗","Pengeluaran","−"+idr(expenses._sum.amount?.toString()??0),"#"],["◉","Saldo tersedia",idr(bal),"#"],["◎","Total tabungan",idr(contributions._sum.amount?.toString()??0),"#"]];
 return <AppShell current="Beranda"><div className="grid summary-grid">{cards.map(([icon,label,value],i)=><div className="card summary-card" key={label}><div className="summary-label"><span className="summary-icon">{icon}</span>{label}</div><div className={`summary-value ${i===0?"positive":i===1?"negative":""}`}>{value}</div></div>)}</div>
 <div className="grid dash-columns"><section className="card"><div className="section-heading"><h2>Transaksi terbaru</h2><Link className="small" style={{color:"var(--teal)",fontWeight:700}} href="/transaksi">Lihat semua →</Link></div>{transactions.length?<div className="transaction-list">{transactions.map(t=><div className="transaction-row" key={t.id}><div className="transaction-symbol">{t.type==="INCOME"?"↙":t.type==="TRANSFER"?"⇄":"↗"}</div><div className="row-grow"><strong>{t.category}</strong><small>{t.wallet.name} · {t.date.toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</small></div><div className={`amount ${t.type==="INCOME"?"positive":t.type==="EXPENSE"?"negative":""}`}>{t.type==="INCOME"?"+":t.type==="EXPENSE"?"−":""}{idr(t.amount.toString())}</div></div>)}</div>:<div className="empty"><div className="empty-icon">✍️</div><strong>Belum ada transaksi</strong><p className="muted">Mulai catat uang masuk atau keluar.</p><Link className="btn" href="/catat/pengeluaran">Catat transaksi</Link></div>}</section>
 <section className="card"><div className="section-heading"><h2>Target tabungan</h2><Link className="small" style={{color:"var(--teal)",fontWeight:700}} href="/target">Semua →</Link></div>{goals.length?goals.map(g=>{const saved=sum(g.contributions);const percent=Math.min(100,Math.round(saved/Number(g.targetAmount)*100));return <div className="goal-card" key={g.id}><div className="goal-head"><strong>{g.name}</strong><span className="small">{percent}%</span></div><div className="progress"><span style={{width:`${percent}%`}}/></div><div className="muted small">{idr(saved)} dari {idr(g.targetAmount.toString())}</div></div>}):<div className="empty"><div className="empty-icon">🎯</div><strong>Belum ada target</strong><p className="muted">Simpan sedikit demi sedikit.</p><Link className="btn btn-light" href="/target/baru">Buat target</Link></div>}</section></div>
 <div className="grid content-grid" style={{marginTop:18}}><section className="card"><div className="section-heading"><h2>Dompet</h2><Link href="/dompet" className="small" style={{color:"var(--teal)"}}>Kelola →</Link></div>{wallets.map(w=><div className="transaction-row" key={w.id}><div className="transaction-symbol">▣</div><div className="row-grow"><strong>{w.name}{w.isPrimary?" · Utama":""}</strong><small>{Number(w.balance)<0?"Saldo negatif":"Saldo dompet"}</small></div><span className={`amount ${Number(w.balance)<0?"negative":""}`}>{idr(w.balance.toString())}</span></div>)}</section><section className="card"><div className="section-heading"><h2>Ringkasan bulan ini</h2><Link href="/laporan" className="small" style={{color:"var(--teal)"}}>Laporan →</Link></div><CashFlowChart data={days}/><div className="muted small" style={{marginTop:12}}>Pemasukan {idr(monthIncome)} · Pengeluaran {idr(monthExpense)}</div></section></div>
 </AppShell>
}
