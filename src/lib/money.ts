export const MAX_AMOUNT = 1_000_000_000;
export const expenseCategories = ["Makanan", "Transportasi", "Belanja", "Tagihan", "Pendidikan", "Kesehatan", "Hiburan", "Lainnya"] as const;
export const idr = (value: number | string) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));
