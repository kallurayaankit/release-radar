import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {investigate,readCases,compareReports} from '../mcp/evidence.js';

const xml = (...names)=>'<testsuite name="cart">'+names.map(name=>'<testcase name="'+name+'"/>').join('')+'</testsuite>';
const identity = {name:'old',className:'',suites:['cart']};
const baseline = readCases(xml('old'));
const candidate = readCases(xml('new'));
const diff = '--- a/cart.js\n+++ b/cart.js\n@@ -1 +1 @@\n-test("old", check);\n+test("new", check);';
test('missing-test evidence is conservative about renames and scope',()=>{
  for (const [input,expected] of [
    [diff,'possible rename'],
    [diff.replace('+test("new", check);',''),'declaration removal observed'],
    [diff.replace('+test("new", check);','@@ -20 +20 @@\n+test("new", check);'),'declaration removal observed'],
    [diff.replace('-test','-//test'),'unresolved'],
    ['','unresolved']
  ]) assert.equal(investigate(baseline,candidate,identity,input).assessment,expected);
  const ambiguous = readCases('<testsuites>'+xml('old')+'<testsuite name="other"><testcase name="old"/></testsuite></testsuites>');
  assert.equal(investigate(ambiguous,candidate,identity,diff).assessment,'unresolved');
  assert.throws(()=>investigate(baseline,baseline,identity,diff));
});
test('shared findings retain skips, errors and full counts on later pages',()=>{
  const before = readCases(xml('same','broken','omitted','later'));
  const after = readCases('<testsuite name="cart"><testcase name="same"/><testcase name="broken"><error/></testcase><testcase name="later"><skipped/></testcase></testsuite>');
  const page = compareReports(before,after,{offset:1,limit:1});
  assert.equal(page.rows[0].finding,'Missing in candidate');
  assert.equal(page.nextOffset,2);
  assert.equal(page.counts['Now skipped'],1);
  assert.equal(page.counts['New failure'],1);
  for (const input of [xml('a','a'),'<!DOCTYPE testsuite><testsuite/>','<testsuite>','<other/>']) assert.throws(()=>readCases(input));
});
const report = (project,label,title='Login')=>'<testsuite name="'+project+'"><testsuite name="'+label+'"><testsuite name="login.spec.ts"><testcase name="'+title+'"/></testsuite></testsuite></testsuite>';
const grouped = {suites:['Chromium','Account','login.spec.ts'],className:'',name:'Login'};
test('report relabels require a one-to-one new identity anchored to the same project and file',()=>{
  const check = (a,b)=>investigate(readCases('<testsuites>'+a+'</testsuites>'),readCases('<testsuites>'+b+'</testsuites>'),grouped);
  const old = report('Chromium','Account'), replacement = report('Chromium','Account Page','LOGIN');
  assert.deepEqual(check(old,replacement).candidateIdentity,{...grouped,suites:['Chromium','Account Page','login.spec.ts'],name:'LOGIN'});
  assert.equal(check(old,report('WebKit','Account Page')).assessment,'unresolved');
  assert.equal(check(old+replacement,replacement).assessment,'unresolved');
  assert.equal(check(old,replacement+report('Chromium','Other')).assessment,'unresolved');
});
test('runner evidence exposes qualified matches and abstains on ambiguous files or projects',()=>{
  const a = readCases(report('Chromium','Account')), b = readCases('<testsuites/>');
  const row = {file:'tests/login.spec.ts',project:'setup',name:'Login',outcome:'skipped'};
  const check = rows=>investigate(a,b,grouped,'',{ref:'run 5',rows});
  assert.deepEqual(check([row,row]).runnerMatch,{ref:'run 5',file:row.file,project:'setup',outcomes:['skipped'],observations:2});
  for(const other of [{project:'other'},{file:'elsewhere/login.spec.ts'}]){
    assert.equal(check([row,{...row,...other}]).assessment,'unresolved');
  }
  assert.equal(check([{...row,name:'Login again'}]).assessment,'unresolved');
});
test('official MCP client discovers and uses the example, tools, pagination and error path over stdio',async()=>{
  const client = new Client({name:'release-review-test',version:'1'});
  const entry = fileURLToPath(new URL('../mcp/stdio.js',import.meta.url));
  try {
    await client.connect(new StdioClientTransport({command:process.execPath,args:[entry]}));
    const {tools} = await client.listTools();
    assert.ok(tools.some(t=>t.name==='compare_runs' && t.outputSchema));
    const {resources} = await client.listResources();
    const example = JSON.parse((await client.readResource({uri:resources[0].uri})).contents[0].text);
    const {baselineXml,candidateXml} = example;
    const pair = await client.callTool({name:'compare_runs',arguments:{baselineXml,candidateXml,limit:1}});
    assert.equal(pair.structuredContent.nextOffset,1);
    const missing = await client.callTool({name:'investigate_missing_test',arguments:example});
    assert.equal(missing.structuredContent.assessment,'possible rename');
    const runner = await client.callTool({name:'investigate_missing_test',arguments:{
      baselineXml:report('Chromium','Account'),candidateXml:'<testsuites/>',identity:grouped,
      runnerReport:{ref:'candidate 25',rows:[{file:'tests/login.spec.ts',project:'setup',name:'Login',outcome:'passed'}]}}});
    assert.equal(runner.structuredContent.runnerMatch.ref,'candidate 25');
    const history = await client.callTool({name:'trace_test_history',arguments:{identity:example.identity,
      runs:[{ref:'previous',xml:baselineXml},{ref:'current',xml:candidateXml}]}});
    assert.equal(history.structuredContent.lastObserved,'previous');
    assert.equal(history.structuredContent.trailingAbsent,1);
    const invalid = await client.callTool({name:'compare_runs',arguments:{baselineXml:'bad',candidateXml}});
    assert.equal(invalid.isError,true);
  } finally {await client.close();}
});
