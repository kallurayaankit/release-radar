// Offline replay. The Python driver independently extracts the expected facts with zipfile.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {inspectReport,summarizeRunner} from '../mcp/playwright-report.js';
import {readCases,investigate} from '../mcp/evidence.js';
let input='';
for await (const part of process.stdin) input+=part;
const totals={reports:0,titles:0,attempts:0,linked:0,ambiguous:0,absent:0};
for (const {path,ref,sha256,cases} of JSON.parse(input)) {
  const bytes=await readFile(path);
  for (const {title,locations} of cases) {
    const report={ref,...await inspectReport(bytes,title)};
    const result=summarizeRunner(report);
    assert.equal(result.sha256,sha256);
    assert.deepEqual(result.locations,locations);
    totals.attempts+=result.attempts;
    if (!locations.length) {totals.absent++;continue;}
    totals.titles++;
    const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
    for (const file of new Set(locations.map(row=>row.file))) {
      const xml='<testsuite name="pilot"><testcase file="'+escape(file)+'" name="'+escape(title)+'"/></testsuite>';
      const a=readCases(xml),b=readCases('<testsuites/>');
      const finding=investigate(a,b,{suites:['pilot'],className:'',name:title},'',report);
      const matching=locations.filter(row=>row.file===file || (!file.includes('/') && row.file.split('/').at(-1)===file));
      if (matching.length===1) {
        assert.equal(finding.assessment,'matching runner result');
        assert.equal(finding.runnerMatch.project,matching[0].project);
        assert.deepEqual(finding.runnerMatch.outcomes,Object.keys(matching[0].outcomes));
        totals.linked++;
      } else {assert.equal(finding.assessment,'unresolved');totals.ambiguous++;}
    }
  }
  totals.reports++;
}
console.log(JSON.stringify(totals));
