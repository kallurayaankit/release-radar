import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchRunnerReport,inspectReport,pinnedReportUrl,summarizeRunner} from '../mcp/playwright-report.js';
import {investigate,readCases} from '../mcp/evidence.js';
import {InMemoryTransport} from '@modelcontextprotocol/server';
import {Client} from '@modelcontextprotocol/client';
import {createServer} from '../mcp/server.js';

// A two-entry ZIP containing report.json and one test file. Includes a retry and a failure message.
const zip='UEsDBBQAAAAIALVqeV0VUBqPHwAAACQAAAALAAAAcmVwb3J0Lmpzb26rVkrLzEktVrJSiK4GMz1TgGylktTiEl0QV6k2thYAUEsDBBQAAAAIALVqeV37Q83anAAAAOoAAAAOAAAAdGVzdC1maWxlLmpzb25NjkEKwkAMRa9SshZduBA8hBeQLsKYttGZpkwybkrvblIRJJvP//kvWcFITeHa3VcwtkwuIcvIMxw6WKo8KdkNy+6nqUrhViLKktBYZvdXGPhb1IXSaW8fHRpbPEdwcZkktxLr5y3IaFNcdSallzSD3t1K2vLvHTW0FhoGdP4jeFSr1D333/iNRt2DcZxFjRP0Tv7vLajqva33+QBQSwECFAAUAAAACAC1anldFVAajx8AAAAkAAAACwAAAAAAAAAAAAAAgAEAAAAAcmVwb3J0Lmpzb25QSwECFAAUAAAACAC1anld+0PN2pwAAADqAAAADgAAAAAAAAAAAAAAgAFIAAAAdGVzdC1maWxlLmpzb25QSwUGAAAAAAIAAgB1AAAAEAEAAAAA';
const html=Buffer.from('<template id="playwrightReportBase64">data:application/zip;base64,'+zip+'</template>');
const ref='https://raw.githubusercontent.com/example/qa/'+'1'.repeat(40)+'/ci/index.html';
test('records retry outcomes at their test location and omits diagnostic payloads',async()=>{
  const report=await fetchRunnerReport(ref,'login',async(url,options)=>{
    assert.equal(url,ref); assert.equal(options.redirect,'error'); assert.equal(options.headers,undefined);
    return new Response(html);
  });
  const summary=summarizeRunner(report);
  assert.match(summary.sha256,/^[0-9a-f]{64}$/);assert.equal(summary.attempts,2);
  assert.deepEqual(summary.locations[0],{file:'spec/login.ts',name:'login',project:'chromium',line:7,column:3,suitePath:['checkout'],outcomes:{failed:1,passed:1}});
  assert.ok(!JSON.stringify(report).includes('private diagnostic'));
  assert.equal((await inspectReport(html,'other')).rows.length,0);
});
test('import refuses mutable or foreign sources, oversize downloads and unsupported exports',async()=>{
  for (const url of [ref.replace('raw.githubusercontent.com','example.org'),ref.replace('1'.repeat(40),'main'),ref+'?x=1']) assert.throws(()=>pinnedReportUrl(url));
  await assert.rejects(fetchRunnerReport(ref,'login',async()=>new Response('x',{headers:{'content-length':String(5*1024*1024)}})),/exceeds/);
  await assert.rejects(inspectReport(Buffer.from('<!doctype html>'),'login'),/embedded/);
});
test('a JUnit source-file attribute links attempts and conflicting declarations give no attribution',async()=>{
  const report={ref,...await inspectReport(html,'login')};
  const baseline=readCases('<testsuite name="suite"><testcase file="spec/login.ts" name="login"/></testsuite>');
  const candidate=readCases('<testsuites/>'), identity={suites:['suite'],className:'',name:'login'};
  assert.deepEqual(investigate(baseline,candidate,identity,'',report).runnerMatch.outcomes,['failed','passed']);
  report.rows.push({...report.rows[0],line:65});
  assert.equal(investigate(baseline,candidate,identity,'',report).assessment,'unresolved');
});
test('a client can inspect a published report and investigate without preparing runner rows',async()=>{
  const server=createServer({fetchReport:async(url,name)=>({ref:url,...await inspectReport(html,name)})});
  const client=new Client({name:'test-reviewer',version:'1'});
  const [a,b]=InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(a),client.connect(b)]);
    const inspected=await client.callTool({name:'inspect_playwright_test',arguments:{publicReportUrl:ref,name:'login'}});
    assert.equal(inspected.structuredContent.attempts,2);
    const investigation=await client.callTool({name:'investigate_missing_test',arguments:{publicReportUrl:ref,
      identity:{suites:['suite'],className:'',name:'login'},baselineXml:'<testsuite name="suite"><testcase file="spec/login.ts" name="login"/></testsuite>',candidateXml:'<testsuites/>'}});
    assert.equal(investigation.structuredContent.runnerSource.sha256,inspected.structuredContent.sha256);
    assert.equal(investigation.structuredContent.runnerMatch.observations,2);
  } finally {await client.close();await server.close();}
});
