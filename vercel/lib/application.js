import {handleApi} from '../worker/handler.js';
import {authClient,authRoute} from './auth.js';
export async function application(request,env,{db,clientIp='anonymous',waitUntil,makeAuth=authClient,api=handleApi}={}){
 const cookies=[];let response;
 try{
  const origin=new URL(env.APP_ORIGIN);if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Invalid origin');
  const incoming=new URL(request.url);if(incoming.origin!==origin.origin)return Response.json({error:'Use the configured production site.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const h=new Headers(request.headers);for(const key of ['oai-authenticated-user-id','cf-connecting-ip','x-forwarded-for','x-real-ip','authorization'])h.delete(key);h.set('cf-connecting-ip',clientIp);
  let safe=new Request(request,{headers:h});const configured=!!(env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY);
  const client=configured?makeAuth(safe,env,cookies):null;
  if(incoming.pathname.startsWith('/api/auth/'))response=client?await authRoute(safe,client,db):Response.json({error:'Sign-in is not configured yet.'},{status:503});
  else{
   if(client){const {data:{user},error}=await client.auth.getUser();if(user&&!error)h.set('oai-authenticated-user-id',user.id);}
   safe=new Request(safe,{headers:h});response=await api(safe,{...env,DB:db},{waitUntil});
  }
 }catch{response=Response.json({error:'Service setup or connection is unavailable. Please retry later.'},{status:503});}
 const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');for(const c of cookies)headers.append('Set-Cookie',c);return new Response(response.body,{status:response.status,headers});
}
