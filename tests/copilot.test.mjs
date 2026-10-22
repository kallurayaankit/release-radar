import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQaInput,qualifyQaReport,generateQa,qaExample,qaExampleReport} from '../dist/copilot-core.js';
test('brief rejects oversized or unsupported evidence status and incomplete passing evidence',()=>{
  assert.throws(()=>validateQaInput({...qaExample,requirements:'x'.repeat(5001)}));
  assert.throws(()=>validateQaInput({...qaExample,testStatus:'approved'}));
  assert.throws(()=>validateQaInput({...qaExample,testStatus:'passed',revision:''}));
  assert.deepEqual(validateQaInput(qaExample),qaExample);
});
test('release gates override optimistic AI recommendations on failures, risks and unknowns',()=>{
  const report=structuredClone(qaExampleReport);report.recommendation.decision='conditional';
  assert.equal(qualifyQaReport(report,qaExample).recommendation.decision,'hold');
  assert.equal(qualifyQaReport(report,{...qaExample,testStatus:'passed'}).recommendation.decision,'hold');
  report.risks=[];
  assert.equal(qualifyQaReport(report,{...qaExample,testStatus:'unknown'}).recommendation.decision,'review');
  assert.equal(qualifyQaReport(report,{...qaExample,testStatus:'passed'}).recommendation.decision,'review');
  report.unknowns=[];
  assert.equal(qualifyQaReport(report,{...qaExample,testStatus:'passed'}).recommendation.decision,'conditional');
  assert.equal(report.recommendation.conditions.length,1);
});
test('generation uses structured output and never substitutes for incomplete or malformed responses',async()=>{
  const success=await generateQa(qaExample,{key:'test',model:'test-model',fetcher:async(url,options)=>{
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    return Response.json({status:'completed',model:'test-model',output:[{content:[{type:'output_text',text:JSON.stringify(qaExampleReport)}]}]});
  }});assert.equal(success.source,'live-ai');assert.equal(success.report.recommendation.decision,'hold');
  for(const payload of [{status:'incomplete'},{status:'completed',output:[]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}]){
    await assert.rejects(()=>generateQa(qaExample,{key:'test',model:'test',fetcher:async()=>Response.json(payload)}));
  }
});
