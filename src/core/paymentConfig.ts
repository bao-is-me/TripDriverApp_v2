export const PaymentConfig = {
  bankName: 'TP Bank',
  accountNumber: '0000 1066 117',
  accountName: 'Nguyen Gia Bao',
  transferNote(bookingCode: string) {
    return `COC ${bookingCode}`
  },
} as const
