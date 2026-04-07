export const PaymentConfig = {
  bankName: 'TODO: Cập nhật tên ngân hàng',
  accountNumber: 'TODO: Cập nhật số tài khoản',
  accountName: 'TODO: Cập nhật tên tài khoản',
  transferNote(bookingCode: string) {
    return `COC ${bookingCode}`
  },
} as const
