import {oauthAccess} from './oauth.js';
const relayJson=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function relayTarget(value){
  const u=new URL(value);
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.hash)throw Error('Use an HTTP(S) URL without credentials or a fragment.');
  const host=u.hostname.toLowerCase();
  if(host.endsWith('.')||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||/(^|\.)(localhost|local|internal|test|invalid|onion|home|lan)$/.test(host))throw Error('The hosted relay supports public DNS hostnames only, not private hosts or IP literals.');
  if(u.port&&!['80','443'].includes(u.port))throw Error('The hosted relay supports standard HTTP(S) ports 80 and 443.');
  if(value.length>8000)throw Error('URL too long.');return u;
}
export function publicAddress(ip){
  if(ip.includes(':')){const x=ip.toLowerCase();return /^[23][0-9a-f]{3}:/.test(x)&&!/^2001:(0*:|db8:|10:|20:)/.test(x)&&!x.startsWith('2002:');}
  const p=ip.split('.').map(Number);if(p.length!==4||p.some(v=>!Number.isInteger(v)||v<0||v>255))return false;
  const [a,b]=p;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0);
}
export async function publicDns(host,fetcher,signal){
  const answers=await Promise.all(['A','AAAA'].map(async type=>{const r=await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,{headers:{accept:'application/dns-json'},signal});if(!r.ok)throw Error('DNS verification unavailable.');const d=await r.json();if(d.Status!==0)throw Error('The hostname could not be resolved.');return (d.Answer||[]).filter(a=>[1,28].includes(a.type)).map(a=>a.data);}));
  const ips=answers.flat();if(!ips.length||ips.some(ip=>!publicAddress(ip)))throw Error('Destination does not resolve exclusively to public addresses.');
}
export function relayInput(input){
  if(!input||input.authorized!==true)throw Error('Endpoint authorization is required.');
  relayTarget(input.url);if(!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(input.method))throw Error('Unsupported method.');
  if(!input.headers||typeof input.headers!=='object'||Array.isArray(input.headers))throw Error('Headers must be an object.');
  const h=new Headers();for(const [key,value]of Object.entries(input.headers)){
    if(/^(host|origin|referer|connection|content-length|transfer-encoding|upgrade|expect|te|trailer|forwarded|via|proxy-.*|cf-.*|x-forwarded-.*|oai-.*|sec-.*)$/i.test(key))throw Error(`Header ${key} is managed by the relay and cannot be overridden.`);
    if(typeof value!=='string'||/[\r\n]/.test(value))throw Error('Invalid header value.');h.set(key,value);
  }
  if(typeof input.body!=='string'||new TextEncoder().encode(input.body).length>128000)throw Error('Body limit is 128 KB.');
  const seconds=Number(input.timeout);if(!Number.isFinite(seconds)||seconds<1||seconds>30)throw Error('Timeout must be 1–30 seconds.');
  return {...input,headers:h,timeout:seconds};
}
export async function handleRelay(request,env,ctx,fetcher=fetch){
  const own=new URL(request.url);if(request.method!=='POST')return relayJson(405,{error:'POST required.'});
  if(request.headers.get('origin')!==own.origin)return relayJson(403,{error:'Open API Lab on this site to send a request.'});
  if(!env.DB)return relayJson(503,{error:'The hosted relay usage limiter is unavailable.'});
  let input;
  try{const reader=request.body?.getReader();if(!reader)throw Error('Missing body.');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>150000){await reader.cancel();throw Error('Request exceeds 150 KB.');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}input=relayInput(JSON.parse(new TextDecoder().decode(bytes)));if(new URL(input.url).hostname===own.hostname)throw Error('The relay cannot call its own host.');}catch(e){return relayJson(400,{error:e.message});}
  const now=Date.now(),minute=Math.floor(now/60000),day=Math.floor(now/86400000);
  const identity=request.headers.get('cf-connecting-ip')||request.headers.get('oai-authenticated-user-id')||'anonymous';
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(day+':'+identity))),x=>x.toString(16).padStart(2,'0')).join('');
  const take=async(k,limit,expiry)=>env.DB.prepare('INSERT INTO chat_quota (key,used,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used').bind(k,expiry,limit).first();
  try{if(!await take(`relay:visitor:${digest}:${minute}`,30,now+120000)||!await take(`relay:day:${day}`,1000,(day+2)*86400000))return relayJson(429,{error:'Relay allowance reached (30 requests/minute per visitor; 1,000/day site-wide). Try later.'});ctx?.waitUntil(env.DB.prepare('DELETE FROM chat_quota WHERE expires < ?').bind(now).run().catch(()=>{}));}catch{return relayJson(503,{error:'Relay usage limiter unavailable. No request was sent.'});}
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(input.timeout*1000)]);
  const start=Date.now();try{
    await publicDns(new URL(input.url).hostname,fetcher,signal);
    if(input.oauth===true){
      if(input.headers.has('Authorization'))throw Error('Remove the manual Authorization header when using an OAuth connection.');
      try{input.headers.set('Authorization','Bearer '+await oauthAccess(env,request.headers.get('oai-authenticated-user-id'),input.url,fetcher));}catch(e){return relayJson(401,{error:e.message});}
    }
    // No automatic redirects: prevents credentials being forwarded to another origin.
    const response=await fetcher(input.url,{method:input.method,headers:input.headers,body:['GET','HEAD'].includes(input.method)?undefined:input.body||undefined,redirect:'manual',signal});
    const reader=response.body?.getReader();let size=0;const chunks=[];
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw Error('Response exceeded 1 MB.');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    return relayJson(200,{status:response.status,headers:Object.fromEntries(response.headers),body:new TextDecoder().decode(bytes),ms:Date.now()-start,redirect:response.status>=300&&response.status<400,transport:'hosted-relay'});
  }catch(e){return relayJson(502,{error:signal.aborted?'Relay timed out or was cancelled. The endpoint may still have processed the request.':/DNS|hostname|public addresses|1 MB/.test(e.message)?e.message:'Unable to reach this API. Check its availability, TLS certificate and firewall rules. No response was available for assertions.'});}
}
