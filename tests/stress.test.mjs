import test from 'node:test';
import assert from 'node:assert/strict';
import {checkout} from '../dist/checkout.js';
import {generateCorpus,runStress} from '../dist/stress-core.js';
test('seed reproduces the exact corpus and different seeds explore different cases',()=>{
  assert.deepEqual(generateCorpus(42,100),generateCorpus(42,100));
  assert.notDeepEqual(generateCorpus(42,100),generateCorpus(43,100));
  assert.throws(()=>generateCorpus(-1));assert.throws(()=>generateCorpus(1,20001));
});
test('multiple seeds verify controls and detect all hand-seeded defects',()=>{
  for(const seed of [0,1,42,20261020,4294967295]){
    const r=runStress({seed,count:5000});
    assert.equal(r.controlsPass,true);assert.equal(r.detected,3);assert.equal(r.verdict,'passed');
    for(const m of r.mutants)assert.ok(m.witness.issues.length);
  }
});
test('broken controls, runner errors and surviving mutants cannot report success',()=>{
  const bad=runStress({count:10,run:(s,d,v)=>({...checkout(s,d,v),total:0})});
  assert.equal(bad.verdict,'inconclusive');assert.equal(bad.detected,0);
  const crashed=runStress({count:10,run:(s,d,v)=>{if(v==='rounding')throw Error('runner failed');return checkout(s,d,v);}});
  assert.equal(crashed.mutants.find(m=>m.version==='rounding').status,'inconclusive');
  assert.notEqual(crashed.verdict,'passed');
  const survivors=runStress({count:10,run:(s,d)=>checkout(s,d,'correct')});
  assert.equal(survivors.verdict,'gaps-found');assert.equal(survivors.detected,0);
});
test('invalid input acceptance and arithmetic corruption fail the control gate',()=>{
  const accept=runStress({count:10,run:(s,d,v)=>{try{return checkout(s,d,v);}catch{return {total:0};}}});
  assert.equal(accept.controlsPass,false);
  const shipping=runStress({count:10,run:(s,d,v)=>({...checkout(s,d,v),shipping:100})});
  assert.equal(shipping.controlsPass,false);
});
