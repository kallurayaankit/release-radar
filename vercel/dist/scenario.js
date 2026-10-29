export const requirement = 'Shipping is free when the subtotal AFTER discounts is at least $100. Otherwise shipping costs $10. All values are in AUD; use integer cents. Discounts cannot exceed the subtotal.';
export const diff = `--- a/checkout.js
+++ b/checkout.js
 const discountedSubtotal = subtotal - discount;
-const shipping = discountedSubtotal >= 10000 ? 0 : 1000;
+const shipping = subtotal >= 10000 ? 0 : 1000;
 return { shipping, total: discountedSubtotal + shipping };`;
export const baseline = [
  {name:'Standard order below threshold',subtotal:8000,discount:0,expectedShipping:1000,reason:'An $80 order pays $10 shipping.'},
  {name:'Qualifying order',subtotal:11000,discount:0,expectedShipping:0,reason:'A $110 order qualifies for free shipping.'},
  {name:'Exactly at the threshold',subtotal:10000,discount:0,expectedShipping:0,reason:'An order at $100 qualifies for free shipping.'}
];
export const prepared = {summary:'Discounts can move a qualifying cart below the shipping threshold. Existing tests never apply a discount.',tests:[
  {name:'Discount crosses the shipping threshold',subtotal:11000,discount:2000,expectedShipping:1000,reason:'$110 − $20 = $90 after discounts: $10 shipping is required.'},
  {name:'Discount lands exactly on the threshold',subtotal:12000,discount:2000,expectedShipping:0,reason:'$120 − $20 = $100: shipping must remain free.'},
  {name:'One cent below the threshold',subtotal:11000,discount:1001,expectedShipping:1000,reason:'$110 − $10.01 = $99.99: shipping must cost $10.'}
]};
export function validatePlan(plan) {
  if (!plan || typeof plan.summary !== 'string' || plan.summary.length > 2000 || !Array.isArray(plan.tests) || plan.tests.length < 1 || plan.tests.length > 8) throw new Error('Provide a summary and 1–8 test cases.');
  const names = new Set();
  for (const t of plan.tests) {
    if (!t || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 160 || names.has(t.name) || typeof t.reason !== 'string' || t.reason.length > 1000) throw new Error('Every test needs a unique name and a short reason.');
    names.add(t.name);
    if (![t.subtotal,t.discount,t.expectedShipping].every(Number.isSafeInteger) || t.subtotal < 0 || t.subtotal > 1000000 || t.discount < 0 || t.discount > t.subtotal || ![0,1000].includes(t.expectedShipping)) throw new Error('Invalid case: use integer cents, a valid discount, and shipping of 0 or 1000.');
  }
  return {summary:plan.summary,tests:plan.tests.map(({name,subtotal,discount,expectedShipping,reason})=>({name,subtotal,discount,expectedShipping,reason}))};
}
export function playwrightSpec(tests) {
  return `import { test, expect } from '@playwright/test';\n\n// Set CHECKOUT_VERSION=correct, buggy, or fixed.\nconst version = process.env.CHECKOUT_VERSION || 'buggy';\nconst cases = ${JSON.stringify(tests,null,2)};\n\nfor (const c of cases) {\n  test(c.name, async ({ page }) => {\n    await page.goto('/cart.html?version=' + version);\n    await page.getByLabel('Subtotal (AUD)').fill(String(c.subtotal / 100));\n    await page.getByLabel('Discount (AUD)').fill(String(c.discount / 100));\n    await page.getByRole('button', { name: 'Calculate checkout' }).click();\n    await expect(page.getByTestId('shipping')).toHaveText('$' + (c.expectedShipping / 100).toFixed(2));\n  });\n}\n`;
}
export function generationPrompt(){return `Find missing regression tests for this checkout change. Return only JSON with {"summary":string,"tests":[{"name":string,"subtotal":integer cents,"discount":integer cents,"expectedShipping":integer cents,"reason":string}]}. Generate 3 cases covering the changed behavior and boundary conditions. Derive expected results from the requirement, not from the changed implementation. Keep test names short, literal, and consistent with expectedShipping and reason. Do not describe shipping as free when expectedShipping is 1000. Check your arithmetic and labels before returning.\n\nRequirement:\n${requirement}\n\nDiff:\n${diff}\n\nExisting tests:\n${JSON.stringify(baseline)}`;}
