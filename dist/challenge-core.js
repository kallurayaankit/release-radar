import {requirement, baseline, prepared, validatePlan} from './scenario.js';
export const variants = [
  {id:'buggy',name:'Discount order',description:'Eligibility uses the subtotal before discounts.'},
  {id:'boundary',name:'Exact threshold',description:'Eligibility uses > instead of ≥ at $100.'},
  {id:'rounding',name:'Currency rounding',description:'Eligibility rounds the discounted amount to whole dollars.'}
];
export const ruleId='SHIPPING-001';
export function oracle(t) {
  const net=t.subtotal-t.discount;
  return {ruleId,net,expectedShipping:net>=10000?0:1000,explanation:`${net} cents ${net>=10000?'≥':'<'} 10000 cents → shipping ${net>=10000?0:1000} cents.`,matches:t.expectedShipping===(net>=10000?0:1000)};
}
export function freezePlan(value) {
  const plan=validatePlan(value);
  if(plan.tests.some(t=>!oracle(t).matches))throw new Error('An expected result contradicts SHIPPING-001. Review the assertion before freezing.');
  plan.tests.forEach(Object.freeze);Object.freeze(plan.tests);return Object.freeze(plan);
}
export const starterPlan={summary:'Original three cases. No challenge-specific additions.',tests:baseline};
export const preparedRepair={summary:'Prepared boundary and discount cases. Authored during development, not generated live.',tests:prepared.tests};
export function challengePrompt(existing=baseline,observations=null){
  return `Propose up to 3 useful additional checkout tests. Return only JSON with {"summary":string,"tests":[{"name":string,"subtotal":integer cents,"discount":integer cents,"expectedShipping":integer cents,"reason":string}]}. Use unique names different from existing tests. Derive expectations only from the requirement. Do not change existing assertions.\nRequirement (${ruleId}): ${requirement}\nExisting tests: ${JSON.stringify(existing)}${observations?'\nObserved results from the completed challenge round: '+JSON.stringify(observations):'\nNo challenge implementations or selected challenge are provided.'}`;
}
export function classify(rows,tests){
  const controls=rows.filter(r=>r.version==='correct');
  const valid=controls.length===tests.length&&controls.every(r=>r.pass&&!r.error);
  return variants.map(v=>{
    const checks=rows.filter(r=>r.version===v.id);
    const errors=checks.length!==tests.length||checks.some(r=>r.error);
    const caught=valid&&!errors&&checks.some(r=>!r.pass);
    return {...v,status:!valid||errors?'inconclusive':caught?'detected':'missed',witness:caught?checks.find(r=>!r.pass):null};
  });
}
