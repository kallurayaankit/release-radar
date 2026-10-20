import test from 'node:test';
import assert from 'node:assert/strict';
import {checkout,money} from '../dist/checkout.js';
import {starterPlan,preparedRepair,freezePlan,oracle,classify,challengePrompt,variants} from '../dist/challenge-core.js';
const rowsFor=tests=>['correct',...variants.map(v=>v.id)].flatMap(version=>tests.map(t=>({name:t.name,version,actual:money(checkout(t.subtotal,t.discount,version).shipping),pass:checkout(t.subtotal,t.discount,version).shipping===t.expectedShipping,error:null})));
test('baseline reveals gaps, additions catch all three distinct injected defects',()=>{
  const initial=classify(rowsFor(starterPlan.tests),starterPlan.tests);
  assert.deepEqual(initial.map(v=>v.status),['missed','detected','missed']);
  const expanded=[...starterPlan.tests,...preparedRepair.tests];
  assert.ok(classify(rowsFor(expanded),expanded).every(v=>v.status==='detected'));
  for(const t of expanded)assert.equal(checkout(t.subtotal,t.discount,'fixed').shipping,t.expectedShipping);
});
test('frozen assertions cannot mutate, contradictory expectations cannot freeze',()=>{
  const frozen=freezePlan(starterPlan);assert.throws(()=>{frozen.tests[0].expectedShipping=0;});
  assert.throws(()=>freezePlan({summary:'wrong',tests:[{...starterPlan.tests[0],expectedShipping:0}]}),/contradicts/);
  assert.equal(oracle({subtotal:11000,discount:1001,expectedShipping:1000}).net,9999);
});
test('runner errors and failed controls never count as detected bugs',()=>{
  const cases=preparedRepair.tests;const rows=rowsFor(cases);rows.find(r=>r.version==='correct').pass=false;
  assert.ok(classify(rows,cases).every(v=>v.status==='inconclusive'));
  const partial=rowsFor(cases).filter(r=>r.version!=='rounding');
  assert.equal(classify(partial,cases).find(v=>v.id==='rounding').status,'inconclusive');
});
test('initial prompt has no implementation diff or selected challenge',()=>{
  const prompt=challengePrompt();assert.ok(!prompt.includes('Math.round'));assert.ok(!prompt.includes('+++'));assert.ok(!prompt.includes('Observed results'));
  assert.ok(challengePrompt(starterPlan.tests,[{version:'rounding',actual:'$0.00'}]).includes('Observed results'));
});
