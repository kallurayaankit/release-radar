import {waitUntil,ipAddress} from '@vercel/functions';
import {database} from '../lib/database.js';
import {application} from '../lib/application.js';
export default async function handler(req,res){
 try{
  const path=new URL(req.url,'https://local.invalid');const route=path.searchParams.get('route');if(!route||!/^[a-z0-9/-]+$/i.test(route)){res.statusCode=404;return res.end();}path.searchParams.delete('route');
  const origin=process.env.APP_ORIGIN||(process.env.VERCEL_PROJECT_PRODUCTION_URL?"https://"+process.env.VERCEL_PROJECT_PRODUCTION_URL:null);if(!origin){res.statusCode=503;return res.end('APP_ORIGIN is not configured.');}
  if(req.headers.host!==new URL(origin).host){res.statusCode=403;return res.end('Use the production site.');}
  const h=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)h.set(k,Array.isArray(v)?v.join(','):v);
  const isBody=!['GET','HEAD'].includes(req.method);let body;
  if(isBody){if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);else{const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>250000){res.statusCode=413;return res.end('Request too large');}chunks.push(c);}body=Buffer.concat(chunks);}if(Buffer.byteLength(body)>250000){res.statusCode=413;return res.end('Request too large');}}
  const request=new Request(origin+'/api/'+route+path.search,{method:req.method,headers:h,body});
  const response=await application(request,{...process.env,APP_ORIGIN:origin},{db:database(process.env),clientIp:ipAddress(request)||'anonymous',waitUntil});
  res.statusCode=response.status;for(const [k,v]of response.headers)if(k!=='set-cookie')res.setHeader(k,v);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.end('Service temporarily unavailable.');}
}
