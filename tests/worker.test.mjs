import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleApi} from '../worker/handler.js';
function env(limit='300'){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_conscious_proemial_gods.sql',import.meta.url),'utf8'));
  return {OPENAI_API_KEY:'test-placeholder',OPENAI_MODEL:'test-model',CHAT_DAILY_LIMIT:limit,DB:{prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}};}}};
}
const request=(ip='192.0.2.1',origin='https://demo.test')=>new Request('https://demo.test/api/chat',{method:'POST',headers:{origin,'cf-connecting-ip':ip,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Help me build a small project'}],context:{}})});
const ok=async()=>new Response(JSON.stringify({status:'completed',model:'test-model',output:[{content:[{type:'output_text',text:'Pick one requirement.'}]}]}));
test('hosted config separates chat from local test generation and never exposes key',async()=>{const response=await handleApi(new Request('https://demo.test/api/config'),env());const data=await response.json();assert.equal(data.chatConfigured,true);assert.equal(data.configured,false);assert.ok(!JSON.stringify(data).includes('test-placeholder'));});
test('shared database enforces per-visitor and global allowances before AI requests',async()=>{let calls=0;const fetcher=async()=>{calls++;return ok();};const state=env();for(let i=0;i<6;i++)assert.equal((await handleApi(request(),state,null,fetcher)).status,200);assert.equal((await handleApi(request(),state,null,fetcher)).status,429);assert.equal(calls,6);const small=env('1');assert.equal((await handleApi(request('192.0.2.2'),small,null,fetcher)).status,200);assert.equal((await handleApi(request('192.0.2.3'),small,null,fetcher)).status,429);});
test('origin, missing key and unavailable limiter fail closed',async()=>{assert.equal((await handleApi(request('x','https://other.test'),env(),null,ok)).status,403);assert.equal((await handleApi(request(),{},null,ok)).status,503);const state=env();state.DB.prepare=()=>{throw Error('database unavailable');};assert.equal((await handleApi(request(),state,null,ok)).status,503);});
test('upstream failures return a safe retry message',async()=>{const response=await handleApi(request(),env(),null,async()=>new Response('private error',{status:401}));assert.equal(response.status,502);assert.ok(!(await response.text()).includes('private error'));});
