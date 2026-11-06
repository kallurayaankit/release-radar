import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageReport} from '../dist/coverage.js';
const cases=[{name:'Discount'},{name:'Boundary'}];
test('unexecuted and prepared cases never count as coverage',()=>{
 const r=coverageReport([],cases);assert.equal(r.passed,0);assert.deepEqual(r.untested,['Discount','Boundary']);
});
test('partial fixed-build results do not borrow passes from previous builds',()=>{
 const r=coverageReport([{name:'Discount',version:'buggy',pass:true},{name:'Boundary',version:'fixed',pass:true}],cases);
 assert.equal(r.build,'fixed');assert.equal(r.passed,1);assert.deepEqual(r.untested,['Discount']);
});
test('execution errors and assertion failures remain blockers',()=>{
 const r=coverageReport([{name:'Discount',version:'fixed',pass:true,error:'timeout'},{name:'Boundary',version:'fixed',pass:false}],cases);
 assert.equal(r.passed,0);assert.equal(r.decision,'Investigate failures before proceeding');
});
test('fully passing checks still retain release boundaries',()=>{
 const r=coverageReport(cases.map(c=>({...c,version:'fixed',pass:true})),cases);
 assert.equal(r.passed,2);assert.match(r.decision,/risks still require review/);assert.equal(r.exclusions.length,3);
});
