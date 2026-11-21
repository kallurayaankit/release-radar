import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {githubLogin,githubToken} from '../lib/github-login.js';

const env = {RR_GITHUB_CLIENT_ID:'example-app',RR_GITHUB_CLIENT_SECRET:'test-fixture-secret'};
const url = 'https://release.example/api/actions/';
const cookiePair = cookie => cookie.split(';')[0];
test('PKCE callback binds the session to the browser and never exposes the GitHub token', async () => {
  const start = await githubLogin(new Request(url+'login'),env);
  const auth = new URL(start.headers.get('location'));
  const flow = cookiePair(start.headers.get('set-cookie'));
  const req = state => new Request(url+'callback?code=example&state='+state,{headers:{cookie:flow}});
  const denied = await githubLogin(req('different'),env,assert.fail);
  assert.match(denied.headers.get('location'),/retry/);
  const callback = await githubLogin(req(auth.searchParams.get('state')),env,async (_,options) => {
    const proof = createHash('sha256').update(options.body.get('code_verifier')).digest('base64url');
    assert.equal(proof,auth.searchParams.get('code_challenge'));
    return Response.json({access_token:'ghu_fixture',expires_in:3600});
  });
  const cookie = callback.headers.getSetCookie().find(value=>value.startsWith('__Host-rr-gh-session='));
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/Secure/);
  assert.ok(!cookie.includes('ghu_fixture'));
  const request = new Request(url+'session',{headers:{cookie:cookiePair(cookie)}});
  assert.equal(githubToken(request,env),'ghu_fixture');
  assert.deepEqual(await (await githubLogin(request,env)).json(),{connected:true,configured:true});
  assert.equal(githubToken(request,{...env,RR_GITHUB_CLIENT_SECRET:'rotated'}),undefined);
  assert.equal((await githubLogin(new Request(url+'logout',{method:'POST'}),env)).status,403);
  const logout = await githubLogin(new Request(url+'logout',{method:'POST',headers:{Origin:'https://release.example'}}),env);
  assert.ok(logout.headers.getSetCookie().every(value=>value.includes('Max-Age=0')));
});
