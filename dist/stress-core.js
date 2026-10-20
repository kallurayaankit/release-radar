import {checkout} from './checkout.js';
export const stressVersion = 'shipping-stress-v1';
const versions = ['correct','fixed','buggy','boundary','rounding'];
// Expectations come from SHIPPING-001; the implementation under test is injected separately.
function expected(subtotal, discount) {
  const net = BigInt(subtotal) - BigInt(discount);
  const shipping = net < 10000n ? 1000n : 0n;
  return {discountedSubtotal:Number(net),shipping:Number(shipping),total:Number(net+shipping)};
}
export function generateCorpus(seed=20261020, count=5000) {
  if (!Number.isInteger(seed)||seed<0||seed>4294967295) throw Error('Seed must be a 32-bit unsigned integer.');
  if (!Number.isInteger(count)||count<1||count>20000) throw Error('Choose 1–20,000 generated cases.');
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
  const cases=[];
  for(const net of [0,1,9949,9950,9999,10000,10001,10050,1000000])
    for(const discount of [0,1,1000,20000]) cases.push({subtotal:net+discount,discount,kind:'boundary'});
  for(let i=0;i<count;i++){
    const net=i%3===0?9900+Math.floor(random()*201):Math.floor(random()*1000001);
    const discount=Math.floor(random()*100001);
    cases.push({subtotal:net+discount,discount,kind:'generated'});
  }
  return cases;
}
function observe(run, t, version) {
  try {
    const actual=run(t.subtotal,t.discount,version), want=expected(t.subtotal,t.discount);
    const issues=[];
    for(const key of ['discountedSubtotal','shipping','total'])
      if(actual?.[key]!==want[key]) issues.push(key);
    if(!Number.isSafeInteger(actual?.total)||actual.total<0)issues.push('safe nonnegative total');
    // Increasing price and discount equally must leave the payable result unchanged.
    const shifted=run(t.subtotal+137,t.discount+137,version);
    if(shifted?.shipping!==actual?.shipping||shifted?.total!==actual?.total)issues.push('equal-offset invariance');
    return {issues,expected:want,actual};
  } catch(error) { return {error:String(error.message||error)}; }
}
export function runStress({seed=20261020,count=5000,run=checkout}={}) {
  const cases=generateCorpus(seed,count);
  const results=versions.map(version=>{
    let failures=0,errors=0,witness=null;
    for(const [index,t] of cases.entries()){
      const result=observe(run,t,version);
      if(result.error)errors++;
      else if(result.issues.length)failures++;
      if(!witness&&(result.error||result.issues.length))witness={index,input:t,...result};
    }
    return {version,failures,errors,witness};
  });
  const invalidInputs=[[-1,0],[0,-1],[100,101],[1.5,0],[100,.5],[NaN,0],[Infinity,0],[Number.MAX_SAFE_INTEGER+1,0],['100',0],[null,0]];
  const invalid= ['correct','fixed'].map(version=>({
    version,checks:invalidInputs.length,
    rejected:invalidInputs.filter(([s,d])=>{try{run(s,d,version);return false;}catch{return true;}}).length
  }));
  const controlsPass=results.slice(0,2).every(r=>!r.failures&&!r.errors)&&invalid.every(r=>r.checks===r.rejected);
  const mutants=results.slice(2).map(r=>({...r,status:!controlsPass||r.errors?'inconclusive':r.failures?'detected':'survived'}));
  return {schemaVersion:1,engine:stressVersion,rule:'SHIPPING-001',seed,generatedCount:count,boundaryCount:36,
    caseCount:cases.length,scope:'Calculation logic only; three hand-seeded mutants, not general code coverage or release approval.',
    checks:['shipping and total against BigInt reference','safe nonnegative totals','equal price/discount offset invariance','invalid input rejection'],
    controlsPass,controls:results.slice(0,2),invalidInputs:invalid,mutants,
    detected:mutants.filter(r=>r.status==='detected').length,
    verdict:!controlsPass||mutants.some(r=>r.status==='inconclusive')?'inconclusive':mutants.every(r=>r.status==='detected')?'passed':'gaps-found'};
}
