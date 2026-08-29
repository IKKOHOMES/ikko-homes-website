export function formatQuoteNumber(isoDate: string, sequence: number) {
  const period = isoDate.slice(0, 7).replace('-', '');
  return `IKKO${period}${String(sequence).padStart(4, '0')}`;
}