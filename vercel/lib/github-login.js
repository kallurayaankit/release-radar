import {createHash, randomBytes, createCipheriv, createDecipheriv, hkdfSync} from 'node:crypto';
import {parse, serialize} from 'cookie';

const names = {flow:'__Host-rr-gh-flow', session:'__Host-rr-gh-session'};
const options = {httpOnly:true, secure:true, sameSite:'lax', path:'/'};
const random = () => randomBytes(32).toString('base64url');
const configured = env => Boolean(env.RR_GITHUB_CLIENT_ID && env.RR_GITHUB_CLIENT_SECRET);
function key(env, kind) {
  return hkdfSync('sha256', env.RR_GITHUB_CLIENT_SECRET, env.RR_GITHUB_CLIENT_ID, 'ReleaseRadar/' + kind, 32);
}
function seal(env, kind, fields, seconds) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(env, kind), iv);
  const data = JSON.stringify({...fields, until:Date.now() + seconds * 1000});
  const bytes = Buffer.concat([iv, cipher.update(data,'utf8'),cipher.final(),cipher.getAuthTag()]);
  return serialize(names[kind], bytes.toString('base64url'), {...options,maxAge:seconds});
}
function read(request, env, kind) {
  try {
    const bytes = Buffer.from(parse(request.headers.get('cookie') || '')[names[kind]],'base64url');
    const decipher = createDecipheriv('aes-256-gcm',key(env,kind),bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(-16));
    const value = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString());
    return value.until > Date.now() ? value : null;
  } catch { return null; }
}
export const githubToken = (request,env) => read(request,env,'session')?.token;
const clear = kind => serialize(names[kind],'',{...options,maxAge:0});

export async function githubLogin(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const route = url.pathname.split('/').pop();
  const headers = new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});
  const json = (value,status = 200) => Response.json(value,{status,headers});
  const redirect = location => {
    headers.set('Location',location);
    return new Response(null,{status:303,headers});
  };
  if (route === 'logout') {
    if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin) return json({error:'Invalid logout request.'},403);
    headers.append('Set-Cookie',clear('session'));
    headers.append('Set-Cookie',clear('flow'));
    return redirect('/compare.html');
  }
  if (request.method !== 'GET') return json({error:'Use GET.'},405);
  if (route === 'session') return json({configured:configured(env),connected:Boolean(githubToken(request,env))});
  if (!configured(env)) return redirect('/compare.html?github=setup');
  const callback = url.origin + '/api/actions/callback';
  if (route === 'login') {
    const state = random(), verifier = random();
    headers.append('Set-Cookie',seal(env,'flow',{state,verifier},600));
    const params = new URLSearchParams({client_id:env.RR_GITHUB_CLIENT_ID,redirect_uri:callback,state,
      code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')});
    return redirect('https://github.com/login/oauth/authorize?' + params);
  }
  const flow = read(request,env,'flow');
  headers.append('Set-Cookie',clear('flow'));
  if (!flow || flow.state !== url.searchParams.get('state') || !url.searchParams.get('code')) return redirect('/compare.html?github=retry');
  try {
    const exchange = await fetchImpl('https://github.com/login/oauth/access_token',{method:'POST',redirect:'error',
      headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000),
      body:new URLSearchParams({client_id:env.RR_GITHUB_CLIENT_ID,client_secret:env.RR_GITHUB_CLIENT_SECRET,
        redirect_uri:callback,code:url.searchParams.get('code'),code_verifier:flow.verifier})});
    const token = await exchange.json();
    if (!exchange.ok || !/^ghu_[A-Za-z0-9_]+$/.test(token.access_token)) throw Error();
    const seconds = Math.min(28800,token.expires_in ?? 28800);
    if (!Number.isInteger(seconds) || seconds < 1) throw Error();
    headers.append('Set-Cookie',seal(env,'session',{token:token.access_token},seconds));
    return redirect('/compare.html?github=connected');
  } catch { return redirect('/compare.html?github=retry'); }
}
