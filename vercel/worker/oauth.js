import {relayTarget,publicDns} from './relay.js';
const oauthJson=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const un64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export async function sealOAuth(data,key,owner){const iv=crypto.getRandomValues(new Uint8Array(12));const k=await crypto.subtle.importKey('raw',un64(key),'AES-GCM',false,['encrypt']);const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(owner)},k,enc.encode(JSON.stringify(data)));return b64(iv)+'.'+b64(bytes);}
export async function openOAuth(value,key,owner){const [iv,data]=value.split('.');const k=await crypto.subtle.importKey('raw',un64(key),'AES-GCM',false,['decrypt']);return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:enc.encode(owner)},k,un64(data))));}
function secureUrl(value){const u=relayTarget(value);if(u.protocol!=='https:')throw Error('OAuth requires HTTPS endpoints and API origins.');return u;}
export function oauthConfig(input){
  const c={};for(const k of ['provider','authorizationUrl','tokenUrl','clientId','clientSecret','scopes','apiOrigin','authMethod']){c[k]=String(input[k]||'').trim();if(c[k].length>3000)throw Error('OAuth configuration is too long.');}
  if(!c.clientId)throw Error('Register an OAuth application and enter its client ID.');
  for(const k of ['authorizationUrl','tokenUrl']){const u=secureUrl(c[k]);if(u.search)throw Error('Endpoint URLs must not contain query parameters.');}
  const origin=secureUrl(c.apiOrigin);if(origin.pathname!=='/'||origin.search)throw Error('API origin must contain only scheme and hostname.');c.apiOrigin=origin.origin;
  if(!['none','post','basic'].includes(c.authMethod))throw Error('Choose a supported token authentication method.');if(c.authMethod!=='none'&&!c.clientSecret)throw Error('This client authentication method requires a client secret.');
  c.extra={};for(const [k,v]of Object.entries(input.extra||{})){if(!['audience','resource','access_type','prompt','include_granted_scopes'].includes(k)||typeof v!=='string'||v.length>2000)throw Error('Unsupported authorization parameter.');c.extra[k]=v;}return c;
}
async function tokenCall(c,params,fetcher){
  const signal=AbortSignal.timeout(20000);await publicDns(new URL(c.tokenUrl).hostname,fetcher,signal);
  params.set('client_id',c.clientId);const headers={'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
  if(c.authMethod==='post')params.set('client_secret',c.clientSecret);if(c.authMethod==='basic')headers.Authorization='Basic '+btoa(encodeURIComponent(c.clientId)+':'+encodeURIComponent(c.clientSecret));
  const r=await fetcher(c.tokenUrl,{method:'POST',headers,body:params.toString(),redirect:'manual',signal});
  const reader=r.body?.getReader();let text='',size=0;if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>64000){await reader.cancel();throw Error('Token response too large.');}text+=dec.decode(value,{stream:true});}
  let d;try{d=JSON.parse(text);}catch{throw Error('Provider did not return a JSON token response.');}
  if(!r.ok||d.error){const error=new Error(d.error==='invalid_grant'?'Authorization expired or was revoked. Connect again.':'Provider rejected the token exchange. Check the client settings, callback URL and scopes.');error.invalidGrant=d.error==='invalid_grant';throw error;}
  if(typeof d.access_token!=='string'||d.access_token.length>16000||/[\r\n]/.test(d.access_token)||String(d.token_type||'Bearer').toLowerCase()!=='bearer')throw Error('Provider must return a Bearer access token.');
  if(d.refresh_token!==undefined&&(typeof d.refresh_token!=='string'||d.refresh_token.length>16000))throw Error('Invalid refresh token response.');
  return {accessToken:d.access_token,refreshToken:d.refresh_token,expiresAt:Number(d.expires_in)>0?Date.now()+Number(d.expires_in)*1000:0};
}
async function connection(env,owner){const row=await env.DB.prepare('SELECT * FROM oauth_connections WHERE owner = ?').bind(owner).first();return row?{row,data:await openOAuth(row.payload,env.OAUTH_TOKEN_KEY,owner)}:null;}
export async function oauthAccess(env,owner,target,fetcher=fetch,force=false){
  if(!owner)throw Error('Sign in to ReleaseRadar before using OAuth.');if(!env.OAUTH_TOKEN_KEY||!env.DB)throw Error('OAuth storage is unavailable.');
  let found=await connection(env,owner);if(!found)throw Error('Connect an OAuth account first.');
  const allowed=d=>{if(target&&secureUrl(target).origin!==d.config.apiOrigin)throw Error('OAuth token is restricted to its configured API origin.');};allowed(found.data);
  if(!force&&(!found.data.expiresAt||found.data.expiresAt>Date.now()+60000))return found.data.accessToken;
  if(!found.data.refreshToken)throw Error('This provider did not issue a refresh token. Connect again.');
  const lease=await env.DB.prepare('UPDATE oauth_connections SET locked_until = ? WHERE owner = ? AND version = ? AND locked_until < ? RETURNING owner').bind(Date.now()+30000,owner,found.row.version,Date.now()).first();
  if(!lease)throw Error('Another request is refreshing this connection. Retry in a moment.');
  try{
    const tokens=await tokenCall(found.data.config,new URLSearchParams({grant_type:'refresh_token',refresh_token:found.data.refreshToken}),fetcher);
    const data={...found.data,...tokens,refreshToken:tokens.refreshToken??found.data.refreshToken};const payload=await sealOAuth(data,env.OAUTH_TOKEN_KEY,owner);
    const updated=await env.DB.prepare('UPDATE oauth_connections SET payload = ?, version = ?, locked_until = 0 WHERE owner = ? AND version = ? RETURNING owner').bind(payload,random(),owner,found.row.version).first();if(!updated)throw Error('Connection changed while refreshing. Retry.');return data.accessToken;
  }catch(e){if(e.invalidGrant)await env.DB.prepare('DELETE FROM oauth_connections WHERE owner = ? AND version = ?').bind(owner,found.row.version).run();throw e;}finally{await env.DB.prepare('UPDATE oauth_connections SET locked_until = 0 WHERE owner = ? AND version = ?').bind(owner,found.row.version).run();}
}
export async function handleOAuth(request,env,ctx,fetcher=fetch){
  const url=new URL(request.url),route=url.pathname.split('/').pop(),owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return oauthJson(401,{error:'Sign in to ReleaseRadar to keep OAuth connections private.',signIn:'/signin-with-chatgpt?return_to=%2Fapi-lab.html'});
  if(!env.DB||!env.OAUTH_TOKEN_KEY)return oauthJson(503,{error:'OAuth storage is not configured.'});
  const callback=url.origin+'/api/oauth/callback';
  try{
    if(route==='status'&&request.method==='GET'){const found=await connection(env,owner);return oauthJson(200,{connected:!!found,callback,provider:found?.data.config.provider,apiOrigin:found?.data.config.apiOrigin,expiresAt:found?.data.expiresAt,refreshAvailable:!!found?.data.refreshToken});}
    if(route==='callback'&&request.method==='GET'){
      const state=url.searchParams.get('state');if(!state||state.length>100)throw Error('Invalid OAuth state. Start a new connection.');
      const pending=await env.DB.prepare('DELETE FROM oauth_pending WHERE state = ? AND owner = ? AND expires > ? RETURNING payload').bind(state,owner,Date.now()).first();if(!pending)throw Error('OAuth request expired, was already used, or belongs to another user.');
      if(url.searchParams.has('error'))throw Error('Provider authorization was cancelled or denied.');const code=url.searchParams.get('code');if(!code||code.length>10000)throw Error('Missing authorization code.');
      const data=await openOAuth(pending.payload,env.OAUTH_TOKEN_KEY,owner);const tokens=await tokenCall(data.config,new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:callback,code_verifier:data.verifier}),fetcher);
      await env.DB.prepare('INSERT INTO oauth_connections (owner,payload,version,locked_until) VALUES (?,?,?,0) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload,version=excluded.version,locked_until=0').bind(owner,await sealOAuth({config:data.config,...tokens},env.OAUTH_TOKEN_KEY,owner),random()).run();
      return new Response(null,{status:303,headers:{Location:'/api-lab.html?oauth=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    if(request.method!=='POST')return oauthJson(405,{error:'POST required.'});if(request.headers.get('origin')!==url.origin)return oauthJson(403,{error:'Same-origin request required.'});
    if(route==='disconnect'){await env.DB.prepare('DELETE FROM oauth_connections WHERE owner = ?').bind(owner).run();await env.DB.prepare('DELETE FROM oauth_pending WHERE owner = ?').bind(owner).run();return oauthJson(200,{disconnected:true});}
    const allowance=await env.DB.prepare('INSERT INTO chat_quota (key,used,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used').bind('oauth:'+owner+':'+Math.floor(Date.now()/60000),Date.now()+120000,10).first();if(!allowance)return oauthJson(429,{error:'Please wait before starting or refreshing another connection.'});
    if(route==='refresh'){await oauthAccess(env,owner,null,fetcher,true);return oauthJson(200,{refreshed:true});}
    if(route!=='start')return oauthJson(404,{error:'Unknown OAuth action.'});
    const reader=request.body?.getReader();let text='',size=0;if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw Error('OAuth configuration too large.');}text+=dec.decode(value,{stream:true});}
    const config=oauthConfig(JSON.parse(text));for(const endpoint of [config.authorizationUrl,config.tokenUrl])await publicDns(new URL(endpoint).hostname,fetcher,AbortSignal.timeout(10000));
    const state=random(),verifier=random(),challenge=b64(await crypto.subtle.digest('SHA-256',enc.encode(verifier)));
    await env.DB.prepare('DELETE FROM oauth_pending WHERE owner = ? OR expires < ?').bind(owner,Date.now()).run();
    await env.DB.prepare('INSERT INTO oauth_pending (state,owner,payload,expires) VALUES (?,?,?,?)').bind(state,owner,await sealOAuth({config,verifier},env.OAUTH_TOKEN_KEY,owner),Date.now()+600000).run();
    const authorize=new URL(config.authorizationUrl);for(const [k,v]of Object.entries({...config.extra,response_type:'code',client_id:config.clientId,redirect_uri:callback,scope:config.scopes,state,code_challenge:challenge,code_challenge_method:'S256'}))authorize.searchParams.set(k,v);
    return oauthJson(200,{authorizeUrl:authorize.href});
  }catch(e){if(route==='callback')return new Response('OAuth connection could not be completed. Return to API Lab and connect again. Check the provider application, callback URL and requested scopes.',{status:400,headers:{'Content-Type':'text/plain','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});return oauthJson(400,{error:e.message.includes('decrypt')?'Connection storage could not be read. Connect again.':e.message});}
}
