export function formatQuoteNumber(isoDate: string, sequence: number) {
  const period = isoDate.slice(0, 7).replace('-', '');
  return `QTE-${period}${String(sequence).padStart(4, '0')}`;
}

export function orderAlphabeticSuffix(sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= 26 ** 4) {
    throw new Error('Order sequence must be between 0 and 456975.');
  }

  let value = sequence;
  let suffix = '';
  for (let index = 0; index < 4; index += 1) {
    suffix = String.fromCharCode(65 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return suffix;
}

export function formatOrderNumber(isoDate: string, sequence: number) {
  const period = isoDate.slice(0, 7).replace('-', '');
  return `ORD-${period}${orderAlphabeticSuffix(sequence)}`;
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