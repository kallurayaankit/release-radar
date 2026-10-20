// Money is represented in integer cents. The defect is deliberately seeded.
export function checkout(subtotal, discount, version = 'correct') {
  if (![subtotal, discount].every(Number.isSafeInteger) || subtotal < 0 || discount < 0 || discount > subtotal) throw new Error('Use non-negative integer cents; discount cannot exceed subtotal.');
  if (!['correct', 'buggy', 'fixed', 'boundary', 'rounding'].includes(version)) throw new Error('Unknown checkout version.');
  const discountedSubtotal = subtotal - discount;
  const shippingBasis = version === 'buggy' ? subtotal : discountedSubtotal;
  const shipping = version === 'boundary' ? (discountedSubtotal > 10000 ? 0 : 1000)
    : version === 'rounding' ? (Math.round(discountedSubtotal / 100) >= 100 ? 0 : 1000)
    : shippingBasis >= 10000 ? 0 : 1000;
  return { subtotal, discount, discountedSubtotal, shipping, total: discountedSubtotal + shipping };
}
export const money = cents => '$' + (cents / 100).toFixed(2);
