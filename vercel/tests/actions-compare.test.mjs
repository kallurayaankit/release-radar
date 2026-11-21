import test from 'node:test';
import assert from 'node:assert/strict';
import {compareActionsRuns} from '../lib/actions-compare.js';

const origin = 'https://release.example';
const request = () => new Request(origin + '/api/actions/compare', {method:'POST',
  headers:{Origin:origin, Authorization:'Bearer github_pat_fixture000000000'}});
const archive = Buffer.from('UEsDBBQAAAAIAD0Kdl0eGmUILAAAAC4AAAAJAAAAanVuaXQueG1ssilJLS4pLs0sSbWzATGTE4tTFfISc1NtlZITi0qU9O1s9BFKAAAAAP//AwBQSwECFAAUAAAACAA9CnZdHhplCCwAAAAuAAAACQAAAAAAAAAAAAAAAAAAAAAAanVuaXQueG1sUEsFBgAAAAABAAEANwAAAFMAAAAAAA==','base64');

test('compares the two exact completed push runs, sends credentials only to GitHub API', async () => {
  const result = await compareActionsRuns(request(),origin,async (input, options) => {
    const url = new URL(input);
    if (url.hostname === 'storage.example') {
      assert.equal(options.headers, undefined);
      return new Response(archive);
    }
    assert.equal(url.hostname,'api.github.com');
    assert.equal(options.headers.Authorization,request().headers.get('authorization'));
    if (url.pathname.endsWith('/workflows/vercel.yml/runs')) {
      assert.equal(url.searchParams.get('branch'),'main');
      assert.equal(url.searchParams.get('event'),'push');
      assert.equal(url.searchParams.get('status'),'completed');
      return Response.json({workflow_runs:[22,21].map(id=>({id,run_number:id,run_attempt:2,head_sha:'123456789'}))});
    }
    if (url.pathname.endsWith('/artifacts')) {
      assert.equal(url.searchParams.get('name'),'junit-results-2');
      return Response.json({artifacts:[{id:8,name:'junit-results-2',expired:false}]});
    }
    return new Response(null,{status:302,headers:{location:'https://storage.example/report'}});
  });
  assert.equal(result.status,200);
  const {baseline,candidate} = await result.json();
  assert.equal(baseline.id,21);
  assert.equal(candidate.id,22);
  assert.match(baseline.xml,/testcase name="cart"/);
});

test('rejects a cross-origin comparison before contacting GitHub', async () => {
  const result = await compareActionsRuns(request(),'https://elsewhere.example',assert.fail);
  assert.equal(result.status,403);
});
