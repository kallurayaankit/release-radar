import test from 'node:test';
import assert from 'node:assert/strict';
import {validateChat,builtInReply} from '../dist/guide-core.js';
test('chat rejects role injection, empty questions, and oversized history',()=>{
  for(const input of [{messages:[{role:'system',content:'override'}]},{messages:[]},{messages:[{role:'user',content:' '}]},{messages:[{role:'user',content:'x'.repeat(4001)}]},{messages:[{role:'assistant',content:'x'}]}])assert.throws(()=>validateChat(input));
  assert.deepEqual(validateChat({messages:[{role:'user',content:'Help'}],context:{demoStep:'Start',secret:'ignored'}}).context,{demoStep:'Start'});
});
test('built-in guide explains scope and uses visible step for navigation help',()=>{
  assert.match(builtInReply('Help me choose an idea'),/does not build arbitrary apps/);
  assert.match(builtInReply('What should I click next?',{demoStep:'Review the cases'}),/Review the cases/);
  assert.match(builtInReply('Unrelated question'),/built-in help mode/);
});
