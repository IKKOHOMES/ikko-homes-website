export function formatQuoteNumber(isoDate: string, sequence: number) {
  const period = isoDate.slice(0, 7).replace('-', '');
  return `QTE-${period}${String(sequence).padStart(4, '0')}`;
}

export function formatOrderNumber(isoDate: string, sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error('Order sequence must be between 1 and 9999.');
  }
  const period = isoDate.slice(0, 7).replace('-', '');
  return `ORD-${period}${String(sequence).padStart(4, '0')}`;
}

export function excelColumnName(sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Sequence must be a positive integer.');
  }
  let value = sequence;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

export function formatInvoiceNumber(period: string, sequence: number, paymentSequence: number) {
  const compactPeriod = period.replace(/\D/g, '').slice(0, 6);
  return `INV-${compactPeriod}${String(sequence).padStart(4, '0')}${excelColumnName(paymentSequence)}`;
}