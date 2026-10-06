import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idr, expenseCategories } from "@/lib/money";
import { appDate } from "@/lib/app-date";
import { redirect } from "next/navigation";

type Period = "minggu" | "berjalan" | "sebelumnya" | "kustom";
const parseDate = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ periode?: Period; dari?: string; sampai?: string }> }) {
  const session = await auth(); if (!session?.user) redirect("/masuk");
  const query = await searchParams, now = appDate();
  let start = new Date(now.getFullYear(), now.getMonth(), 1), end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const period = query.periode || "berjalan";
  if (period === "minggu") { start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0); end = new Date(start); end.setDate(start.getDate() + 7); }
  if (period === "sebelumnya") { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1); }
  if (period === "kustom") { start = parseDate(query.dari) || start; const through = parseDate(query.sampai); if (through) { end = new Date(through); end.setDate(end.getDate() + 1); } }
  const uid = session.user.id, date = { gte: start, lt: end };
  const [income, expenses, savings, balance, grouped, rows] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId: uid, type: "INCOME", date }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId: uid, type: "EXPENSE", date }, _sum: { amount: true } }),
    prisma.savingContribution.aggregate({ where: { userId: uid, date }, _sum: { amount: true } }),
    prisma.wallet.aggregate({ where: { userId: uid }, _sum: { balance: true } }),
    prisma.transaction.groupBy({ by: ["category"], where: { userId: uid, type: "EXPENSE", date }, _sum: { amount: true } }),
    prisma.transaction.findMany({ where: { userId: uid, type: { in: ["INCOME", "EXPENSE"] }, date }, select: { type: true, amount: true, date: true }, orderBy: { date: "asc" } }),
  ]);
  const categoryValues = new Map(grouped.map(item => [item.category, Number(item._sum.amount || 0)]));
  const categoryTotal = Number(expenses._sum.amount || 0);
  const categories = expenseCategories.map(category => ({ category, amount: categoryValues.get(category) || 0 })).sort((a, b) => b.amount - a.amount);
  const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  const bucket = (d: Date) => spanDays <= 14 ? d.toISOString().slice(0, 10) : spanDays <= 120 ? String(Math.floor((d.getTime() - start.getTime()) / (7 * 86_400_000))) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const labels = (key: string, d: Date) => spanDays <= 14 ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : spanDays <= 120 ? new Date(start.getTime() + Number(key) * 7 * 86_400_000).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
  const points = new Map<string, { label: string; income: number; expense: number }>();
  for (const row of rows) { const key = bucket(row.date), existing = points.get(key) || { label: labels(key, row.date), income: 0, expense: 0 }; existing[row.type === "INCOME" ? "income" : "expense"] += Number(row.amount); points.set(key, existing); }
  const cards = [["Pemasukan", income._sum.amount?.toString() || "0"], ["Pengeluaran", expenses._sum.amount?.toString() || "0"], ["Tabungan", savings._sum.amount?.toString() || "0"], ["Saldo tersedia", balance._sum.balance?.toString() || "0"]];
  return <AppShell current="Laporan"><h2 className="page-title">Laporan</h2><p className="muted page-intro">Pahami pola keuanganmu dari waktu ke waktu.</p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{([["minggu", "Minggu ini"], ["berjalan", "Bulan berjalan"], ["sebelumnya", "Bulan sebelumnya"]] as const).map(([key, label]) => <Link key={key} className={`btn ${period === key ? "" : "btn-light"}`} href={`/laporan?periode=${key}`}>{label}</Link>)}</div>
    <form className="card" style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 18 }}><input type="hidden" name="periode" value="kustom"/><div className="field"><label htmlFor="dari">Dari</label><input id="dari" type="date" name="dari" defaultValue={query.dari}/></div><div className="field"><label htmlFor="sampai">Sampai</label><input id="sampai" type="date" name="sampai" defaultValue={query.sampai}/></div><button className="btn btn-light">Terapkan</button></form>
    <div className="grid summary-grid">{cards.map(([label, value]) => <div className="card summary-card" key={label}><div className="summary-label">{label}</div><div className="summary-value">{idr(value)}</div></div>)}</div>
    <div className="grid content-grid"><section className="card"><h2>Arus kas</h2><p className="muted small">Pemasukan dibanding pengeluaran pada periode ini</p>{points.size ? <CashFlowChart data={[...points.values()]}/> : <div className="empty"><strong>Belum ada data</strong><p className="muted">Catat transaksi untuk melihat arus kas.</p></div>}<p className="small"><span className="positive">● Pemasukan</span>　<span className="negative">● Pengeluaran</span></p></section><section className="card"><h2>Pengeluaran per kategori</h2>{categories.map(item => <div className="transaction-row" key={item.category}><div className="row-grow"><strong>{item.category}</strong><small>{categoryTotal ? Math.round(item.amount * 100 / categoryTotal) : 0}%</small></div><strong>{idr(item.amount)}</strong></div>)}</section></div>
  </AppShell>;
}
