import {load as yaml,CORE_SCHEMA} from './yaml-parser.js';
import {validateCollection} from './api-core.js';
const methods=['get','post','put','patch','delete','head','options'];
export function importApi(text){
  if(text.length>1000000)throw Error('Import limit is 1 MB');
  let doc;try{doc=JSON.parse(text);}catch{doc=yaml(text,{schema:CORE_SCHEMA,maxAliases:0,maxDepth:50});}
  const requests=[],variables=Object.create(null),warnings=new Set();
  const warn=s=>warnings.add(s);const add=r=>{if(requests.length<30)requests.push(r);else warn('Only the first 30 requests were imported. Split larger collections.');};
  const put=(k,v)=>{if(!/^[\w.-]+$/.test(k)||['__proto__','constructor','prototype'].includes(k))return;variables[k]=v??'';};
  const vars=list=>{for(const v of list||[])if(!v.disabled)put(v.key??v.id,v.value);};
  const resolve=(value,depth=0)=>{
    if(!value?.$ref)return value||{};
    if(depth>12){warn('Circular/deep reference omitted.');return {};}
    if(!value.$ref.startsWith('#/')){warn('External references are not fetched; inline them before import.');return {};}
    let found=doc;for(const k of value.$ref.slice(2).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'))){if(!found||!Object.hasOwn(found,k)){warn(`Unresolved reference: ${value.$ref}`);return {};}found=found[k];}return resolve(found,depth+1);
  };
  const sample=(s,depth=0)=>{s=resolve(s);if(depth>5)return null;if(s.example!==undefined)return s.example;if(s.default!==undefined)return s.default;if(s.enum?.length)return s.enum[0];if(s.type==='object'||s.properties)return Object.fromEntries(Object.entries(s.properties||{}).slice(0,30).map(([k,v])=>[k,sample(v,depth+1)]));if(s.type==='array')return [sample(s.items,depth+1)];if(s.type==='integer'||s.type==='number')return 0;if(s.type==='boolean')return false;return 'example';};
  const auth=(a,h,setQuery)=>{
    if(!a||a.type==='noauth')return;const values=Object.fromEntries((a[a.type]||[]).map(x=>[x.key,x.value]));
    if(a.type==='bearer')h.Authorization='Bearer '+(values.token||'{{token}}');
    else if(a.type==='basic'){put('basicAuth','');h.Authorization='Basic {{basicAuth}}';warn('Basic auth: set basicAuth to base64(username:password); credentials are not auto-encoded.');}
    else if(a.type==='apikey'){if(values.in==='query')setQuery(values.key||'api_key',values.value||'{{apiKey}}');else h[values.key||'X-API-Key']=values.value||'{{apiKey}}';}
    else warn(`Authentication ${a.type} needs manual setup. OAuth token acquisition and request signing are not executed.`);
  };
  let format;
  if(Array.isArray(doc)){format='ReleaseRadar';validateCollection(doc);doc.forEach(add);}
  else if(doc?.item&&doc?.info){
    format='Postman';vars(doc.variable);if(doc.event?.length)warn('Postman scripts are not executed. Add assertions in the editor.');
    function walk(items,parentAuth=doc.auth,prefix='',depth=0){if(depth>20)throw Error('Collection folders are too deeply nested');for(const item of items){vars(item.variable);if(item.event?.length)warn('Postman scripts are not executed. Add assertions in the editor.');if(item.item){walk(item.item,item.auth??parentAuth,prefix+item.name+' / ',depth+1);continue;}
      const r=typeof item.request==='string'?{url:item.request}:item.request;if(!r)continue;const method=(r.method||'GET').toUpperCase();if(!methods.includes(method.toLowerCase())){warn(`Unsupported method ${method} omitted.`);continue;}
      let url=typeof r.url==='string'?r.url:r.url?.raw;if(!url&&r.url){const host=Array.isArray(r.url.host)?r.url.host.join('.'):r.url.host;const path=Array.isArray(r.url.path)?r.url.path.join('/'):r.url.path||'';url=`${r.url.protocol||'https'}://${host}/${path}`;const q=(r.url.query||[]).filter(x=>!x.disabled).map(x=>`${encodeURIComponent(x.key)}=${x.value??''}`).join('&');if(q)url+='?'+q;}
      if(!url){warn('A request without a URL was omitted.');continue;}for(const v of r.url?.variable||[])put(v.key,v.value);url=url.replace(/:([\w]+)(?=\/|\?|$)/g,'{{$1}}');
      const h=Object.fromEntries((r.header||[]).filter(x=>!x.disabled).map(x=>[x.key,String(x.value??'')]));const query=(k,v)=>{url+=(url.includes('?')?'&':'?')+encodeURIComponent(k)+'='+v;};auth(r.auth??parentAuth,h,query);
      let body='';if(r.body?.mode==='raw'){body=r.body.raw||'';if(r.body.options?.raw?.language==='json'&&!Object.keys(h).some(k=>k.toLowerCase()==='content-type'))h['Content-Type']='application/json';}else if(r.body?.mode==='urlencoded'){body=new URLSearchParams((r.body.urlencoded||[]).filter(x=>!x.disabled).map(x=>[x.key,x.value||''])).toString().replaceAll('%7B%7B','{{').replaceAll('%7D%7D','}}');h['Content-Type']='application/x-www-form-urlencoded';}else if(r.body?.mode==='graphql'){body=JSON.stringify({query:r.body.graphql.query,variables:JSON.parse(r.body.graphql.variables||'{}')});h['Content-Type']='application/json';}else if(r.body?.mode)warn(`Body mode ${r.body.mode} needs manual setup; file uploads are not imported.`);
      add({name:prefix+(item.name||url),method,url,headers:JSON.stringify(h,null,2),body,assertions:[]});
    }}walk(doc.item);warn('Postman expected responses are examples, not assertions. Add checks before running. Folder variables are merged; review duplicate names.');
  }else if(doc?.swagger==='2.0'||/^3\./.test(doc?.openapi||'')){
    format=doc.swagger?'Swagger 2.0':`OpenAPI ${doc.openapi}`;
    for(const [path,pathInput] of Object.entries(doc.paths||{})){const pathItem=resolve(pathInput);for(const method of methods){if(!pathItem[method])continue;const op=resolve(pathItem[method]);const server=(op.servers||pathItem.servers||doc.servers||[])[0];let base;
      if(doc.swagger)base=doc.host?`${doc.schemes?.[0]||'https'}://${doc.host}${doc.basePath||''}`:'{{baseUrl}}';
      else if(server){base=server.url;for(const [k,v]of Object.entries(server.variables||{}))base=base.replaceAll('{'+k+'}',v.default??'');if(!/^https?:\/\//.test(base)){put('origin','');base='{{origin}}'+base;warn('Relative server URL: set origin to the API scheme and hostname.');}}
      else{base='{{baseUrl}}';put('baseUrl','');warn('No server URL: set baseUrl before sending.');}
      let url=base.replace(/\/$/,'')+path.replace(/\{([^}]+)\}/g,(_,k)=>'{{'+k+'}}'),h={},body='';const params=new Map();for(const input of [...(pathItem.parameters||[]),...(op.parameters||[])]){const p=resolve(input);params.set(p.in+':'+p.name,p);}
      for(const p of params.values()){const s=resolve(p.schema||p);const val=p.example??s.default??s.example??(p.in==='path'?'':sample(s));if(p.in==='path'){put(p.name,val);if(val==='')warn('Fill path parameter variables before sending.');}else if(p.in==='query'){url+=(url.includes('?')?'&':'?')+encodeURIComponent(p.name)+'='+encodeURIComponent(typeof val==='object'?JSON.stringify(val):String(val));if(p.style||p.collectionFormat)warn('Review query serialization for styled or array parameters.');}else if(p.in==='header')h[p.name]=String(val);else if(p.in==='body'){body=JSON.stringify(sample(s),null,2);h['Content-Type']=doc.consumes?.[0]||'application/json';}else if(p.in==='formData')warn('Swagger formData parameters require manual body setup.');}
      const rb=resolve(op.requestBody);if(rb.content){const type=Object.keys(rb.content).find(t=>t.includes('json'))||Object.keys(rb.content)[0];const media=rb.content[type];if(type.includes('json')){body=JSON.stringify(media.example??resolve(Object.values(media.examples||{})[0]).value??sample(media.schema),null,2);h['Content-Type']=type;}else warn(`Request body ${type} requires manual setup.`);}
      const schemes=doc.securityDefinitions||doc.components?.securitySchemes||{};const security=op.security??doc.security??[];
      if(security.length>1)warn('Only the first alternative security requirement is imported.');
      for(const name of Object.keys(security[0]||{})){const s=resolve(schemes[name]);const variable='auth_'+name.replace(/[^\w.-]/g,'_');put(variable,'');if(s.type==='apiKey'){if(s.in==='query')url+=(url.includes('?')?'&':'?')+encodeURIComponent(s.name)+'={{'+variable+'}}';else if(s.in==='header')h[s.name]='{{'+variable+'}}';else warn('Cookie auth requires manual Cookie header setup.');}else if(s.type==='basic'||s.scheme==='basic'){h.Authorization='Basic {{'+variable+'}}';warn('Basic auth variable must contain base64(username:password).');}else if(s.scheme==='bearer'||s.type==='oauth2'||s.type==='openIdConnect'){h.Authorization='Bearer {{'+variable+'}}';warn('Supply an existing token; OAuth login is not performed.');}else warn(`Security scheme ${name} needs manual setup.`);}
      const success=Object.keys(op.responses||{}).filter(k=>/^2\d\d$/.test(k));add({name:op.summary||op.operationId||`${method.toUpperCase()} ${path}`,method:method.toUpperCase(),url,headers:JSON.stringify(h,null,2),body,assertions:success.length===1?[{type:'status',value:Number(success[0])}]:[]});
    }}warn('Generated parameter and body examples are starting points. Review values and assertions before sending.');
  }else throw Error('Use a Postman v2 collection, Swagger 2.0, OpenAPI 3.x, or ReleaseRadar JSON collection.');
  if(!requests.length)throw Error('No supported HTTP operations found.');validateCollection(requests);
  return {format,requests,variables,warnings:[...warnings]};
}
