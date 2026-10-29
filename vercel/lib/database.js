import pg from 'pg';
let pool;
// Only application-owned SQL reaches this adapter. Values remain parameterized.
export function postgresAdapter(execute) {
 return {prepare(sql) {
  let n=0;
  const query=sql.replace('SET used=used+1 WHERE used <','SET used=chat_quota.used+1 WHERE chat_quota.used <').replace(/\?/g,()=>'$'+(++n));
  return {bind(...params) {
   if(params.length!==n)throw Error('Database parameter mismatch');
   return {async first(){return (await execute(query,params)).rows[0]||null;},async run(){await execute(query,params);return {success:true};}};
  }};
 }};
}
export function database(env) {
 if(!env.DATABASE_URL)return null;
 if(!pool)pool=new pg.Pool({connectionString:cleanDatabaseUrl(env.DATABASE_URL),max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,statement_timeout:15000,ssl:{rejectUnauthorized:true,...(env.DATABASE_CA_CERT?{ca:env.DATABASE_CA_CERT}:{})}});
 return postgresAdapter(async(text,values)=>{try{return await pool.query(text,values);}catch{throw Error('Database operation unavailable.');}});
}

function cleanDatabaseUrl(value){const u=new URL(value);for(const key of ["sslmode","sslcert","sslkey","sslrootcert"])u.searchParams.delete(key);return u.toString();}
