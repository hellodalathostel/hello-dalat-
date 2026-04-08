export function downloadCsv(fileName: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (value: string | number) => {
    const raw = String(value ?? '')
    const escaped = raw.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
