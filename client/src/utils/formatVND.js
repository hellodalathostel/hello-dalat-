export function formatVND(amount) {
  if (amount === null || amount === undefined) return '0'
  return Number(amount).toLocaleString('de-DE')
}