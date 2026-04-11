export function formatMoney(amount: number | null | undefined): string {
  return `${Number(amount ?? 0).toLocaleString('vi-VN')} đ`
}
