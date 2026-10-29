export function interpolate(value, variables) {
  return String(value).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    if (!Object.hasOwn(variables, key)) throw Error(`Missing environment variable: ${key}`);
    return String(variables[key]);
  });
}
export function objectJson(text, label) {
  const value=JSON.parse(text || '{}');
  if (!value || typeof value!=='object' || Array.isArray(value)) throw Error(`${label} must be a JSON object`);
  return value;
}
export function prepare(request, variables={}) {
  const url=interpolate(request.url, variables);
  if (!url.startsWith('demo://')) {
    const parsed=new URL(url);
    if (!['https:','http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw Error('Use an HTTP(S) URL without embedded credentials.');
  }
  const headers=objectJson(interpolate(request.headers || '{}',variables),'Headers');
  for (const value of Object.values(headers)) if(typeof value!=='string') throw Error('Header values must be strings');
  return {...request,url,headers,body:interpolate(request.body || '',variables)};
}
export function checkAssertions(response, assertions) {
  if (!Array.isArray(assertions) || assertions.length>50) throw Error('Assertions must be an array of up to 50 checks');
  let json;try{json=JSON.parse(response.body);}catch{}
  return assertions.map(a=>{
    let actual,pass=false;
    switch(a.type){
      case 'status': actual=response.status;pass=actual===Number(a.value);break;
      case 'time': actual=response.ms;pass=actual<=Number(a.value);break;
      case 'contains': actual=response.body.includes(String(a.value));pass=actual;break;
      case 'json': actual=String(a.path||'').split('.').filter(Boolean).reduce((v,k)=>v!=null&&Object.hasOwn(Object(v),k)?v[k]:undefined,json);pass=JSON.stringify(actual)===JSON.stringify(a.value);break;
      default: actual='Unsupported assertion';
    }
    return {...a,actual:actual===undefined?'(missing)':actual,pass};
  });
}
export function diffJson(before,after,path='$',out=[]) {
  if(JSON.stringify(before)===JSON.stringify(after))return out;
  if(before && after && typeof before==='object' && typeof after==='object' && Array.isArray(before)===Array.isArray(after)){
    for(const k of new Set([...Object.keys(before),...Object.keys(after)]))diffJson(before[k],after[k],`${path}.${k}`,out);
  }else out.push({path,before:before===undefined?'(missing)':before,after:after===undefined?'(missing)':after});
  return out;
}
export function validateCollection(items){
  if(!Array.isArray(items)||items.length>30)throw Error('Collection must be an array of at most 30 requests');
  for(const item of items){
    if(!item || typeof item.name!=='string'||typeof item.url!=='string'||!['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(item.method))throw Error('Each request needs a name, URL and supported method');
    objectJson(item.headers||'{}','Headers');checkAssertions({body:'',status:0,ms:0},item.assertions);
  }
  return items;
}
export function safeRequest(request){
  // Saved collections intentionally omit all headers, payloads and query strings.
  return {...request,headers:'{}',body:'',url:request.url.split('?')[0].split('#')[0]};
}
export function curl(request){
  const q=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
  return ['curl', '-X',request.method,q(request.url),...Object.entries(request.headers).flatMap(([k,v])=>['-H',q(`${k}: ${v}`)]),...(!['GET','HEAD'].includes(request.method)&&request.body?['--data-raw',q(request.body)]:[])].join(' ');
}
