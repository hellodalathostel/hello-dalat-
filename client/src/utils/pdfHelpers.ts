import { jsPDF } from 'jspdf'
import { HOSTEL_INFO, buildVietQR } from '../constants/hostelInfo'

const BRAND = {
  r: 45,
  g: 80,
  b: 22,
}

export function formatVND(amount: number): string {
  return `${Math.max(0, amount || 0).toLocaleString('vi-VN')}đ`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) {
    return ''
  }

  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return dateStr
  }

  return date.toLocaleDateString('vi-VN')
}

export function drawHeader(doc: jsPDF): number {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(HOSTEL_INFO.name, 12, 11)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(HOSTEL_INFO.address, 12, 17)
  doc.text(`SDT: ${HOSTEL_INFO.phone} | Email: ${HOSTEL_INFO.email}`, 12, 21.5)

  doc.setTextColor(33, 37, 41)
  return 36
}

export function drawFooter(doc: jsPDF): void {
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setDrawColor(220, 226, 230)
  doc.line(12, pageHeight - 18, pageWidth - 12, pageHeight - 18)

  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text('Cam on quy khach da tin tuong Hello Dalat Hostel!', pageWidth / 2, pageHeight - 11, {
    align: 'center',
  })

  doc.setTextColor(33, 37, 41)
}

export async function fetchQRImage(url: string): Promise<string> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Khong tai duoc QR: HTTP ${response.status}`)
  }

  const blob = await response.blob()

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Khong doc duoc QR image'))
      }
    }
    reader.onerror = () => {
      reject(new Error('Khong doc duoc QR image'))
    }
    reader.readAsDataURL(blob)
  })
}

export async function drawBankingInfo(
  doc: jsPDF,
  yStart: number,
  amount: number,
  transferContent: string,
): Promise<number> {
  const x = 12
  const boxWidth = 186
  const boxHeight = 58

  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
  doc.roundedRect(x, yStart, boxWidth, boxHeight, 2, 2)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setFontSize(11)
  doc.text('THONG TIN CHUYEN KHOAN', x + 4, yStart + 7)

  doc.setDrawColor(225, 232, 220)
  doc.line(x + 4, yStart + 10, x + boxWidth - 42, yStart + 10)

  doc.setTextColor(33, 37, 41)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const bankLabel = `${HOSTEL_INFO.bank.bankName} - CN Lam Dong`
  doc.text(`Ngan hang: ${bankLabel}`, x + 4, yStart + 16)
  doc.text(`So tai khoan: ${HOSTEL_INFO.bank.accountNumber}`, x + 4, yStart + 21)
  doc.text(`Chu TK: ${HOSTEL_INFO.bank.accountName}`, x + 4, yStart + 26)
  doc.text(`So tien: ${formatVND(amount)}`, x + 4, yStart + 31)

  doc.setTextColor(220, 53, 69)
  doc.setFont('helvetica', 'bold')
  doc.text(`Noi dung CK: ${transferContent}`, x + 4, yStart + 36)

  doc.setTextColor(33, 37, 41)
  doc.setFont('helvetica', 'normal')
  doc.text('Quet ma QR de thanh toan nhanh', x + 4, yStart + 44)

  const qrUrl = buildVietQR(amount, transferContent)
  const base64 = await fetchQRImage(qrUrl)
  doc.addImage(base64, 'PNG', x + boxWidth - 39, yStart + 13, 35, 35)

  return yStart + boxHeight + 6
}
