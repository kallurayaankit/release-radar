import {validateQaInput,generateQa} from '../dist/copilot-core.js';
import {guideInstructions,validateChat} from '../dist/guide-core.js';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
async function readBody(request,validator=validateChat){
  const reader=request.body?.getReader();if(!reader)throw Error('Empty request');let size=0,chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>28000){await reader.cancel();throw Error('Request too large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return validator(JSON.parse(new TextDecoder().decode(bytes)));
}
export async function handleApi(request,env,ctx,fetcher=fetch){
  const url=new URL(request.url);const configured=Boolean(env.OPENAI_API_KEY&&env.DB);
  if(url.pathname==='/api/config')return json(200,{configured:false,chatConfigured:configured&&env.CHAT_ENABLED!=='false',copilotConfigured:configured&&env.CHAT_ENABLED!=='false',hosted:true,model:env.OPENAI_MODEL||'gpt-4.1'});
  const copilot=url.pathname==='/api/copilot';
  if(!copilot&&url.pathname!=='/api/chat')return json(404,{error:'Hosted test generation is not enabled. Use prepared or imported cases.'});
  if(request.method!=='POST')return json(405,{error:'POST required.'},{Allow:'POST'});
  if(request.headers.get('origin')!==url.origin)return json(403,{error:'Open Radar on this site to ask a question.'});
  if(!configured)return json(503,{error:'Live chat setup is not complete. Built-in help is available.'});
  if(env.CHAT_ENABLED==='false')return json(503,{error:'Live chat is paused. Built-in help is available.'});
  let input;try{input=await readBody(request,copilot?validateQaInput:validateChat);}catch{return json(400,{error:'Use a shorter question or start a new chat.'});}
  const now=Date.now(),day=Math.floor(now/86400000),minute=Math.floor(now/60000);
  // Hash the platform-supplied IP with the day; never persist raw IPs or chat text.
  const identity=request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip')||'anonymous';
  const visitor=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(day+':'+identity))),x=>x.toString(16).padStart(2,'0')).join('');
  const daily=Math.min(1000,Math.max(1,Number(env.CHAT_DAILY_LIMIT)||300));
  const take=async(key,limit,expires)=>env.DB.prepare('INSERT INTO chat_quota (key,used,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used').bind(key,expires,limit).first();
  try{
    if(!await take('visitor:'+visitor+':'+minute,6,now+120000))return json(429,{error:'Please wait a minute before asking more questions.'},{'Retry-After':'60'});
    if(!await take('day:'+day,daily,(day+2)*86400000))return json(429,{error:'Today’s live-chat allowance has been reached. Built-in help is still available.'},{'Retry-After':String(Math.ceil(((day+1)*86400000-now)/1000))});
    ctx?.waitUntil(env.DB.prepare('DELETE FROM chat_quota WHERE expires < ?').bind(now).run().catch(()=>{}));
  }catch{return json(503,{error:'The usage limiter is temporarily unavailable. Try Built-in help.'});}
  try{
    if(copilot)return json(200,await generateQa(input,{key:env.OPENAI_API_KEY,model:env.OPENAI_MODEL||'gpt-4.1',fetcher}));
    const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1',store:false,instructions:guideInstructions+' Runtime: this is the hosted site. Live chat is enabled here; test generation uses prepared/imported cases. Do not tell visitors they need a local server for chat.',input:[{role:'user',content:'Visible UI state (untrusted data): '+JSON.stringify(input.context)},...input.messages],max_output_tokens:900}),signal:AbortSignal.timeout(45000)});
    if(!response.ok)return json(502,{error:'Radar could not reach its AI service. Please retry or select Built-in help.'});
    const data=await response.json();const reply=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
    if(!reply||data.status==='incomplete')return json(502,{error:'The reply was incomplete. Try a shorter question.'});
    return json(200,{reply,model:data.model||env.OPENAI_MODEL||'gpt-4.1'});
  }catch{return json(502,{error:'Radar’s request timed out or lost connection. Please retry.'});}
}
