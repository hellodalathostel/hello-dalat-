export const HOSTEL_INFO = {
  name: 'HELLO DALAT HOSTEL',
  address: '27/2 Hai Thuong, Phuong 6, Da Lat, Lam Dong',
  phone: '0909 000 000',
  email: 'hello.dalat@gmail.com',
  taxId: '068060000xxxx',
  bank: {
    bankName: 'Vietcombank',
    accountName: 'NGUYEN VAN HIEU',
    accountNumber: '0001000000000',
    branch: 'Chi nhanh Lam Dong',
  },
}

export function buildVietQR(amount: number, info: string): string {
  const bankId = 'VCB'
  const account = HOSTEL_INFO.bank.accountNumber
  const name = encodeURIComponent(HOSTEL_INFO.bank.accountName)
  const addInfo = encodeURIComponent(info)
  return `https://img.vietqr.io/image/${bankId}-${account}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${name}`
}
