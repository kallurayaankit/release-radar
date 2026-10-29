import pg from 'pg';import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL securely before migrating.');
const pool=new pg.Pool({connectionString:cleanDatabaseUrl(process.env.DATABASE_URL),ssl:{rejectUnauthorized:true,...(process.env.DATABASE_CA_CERT?{ca:process.env.DATABASE_CA_CERT}:{})}});
try{await pool.query(await readFile(new URL('../migrations/001.sql',import.meta.url),'utf8'));console.log('Database migration completed.');}catch{console.error('Migration failed. Check database access and schema permissions.');process.exitCode=1;}finally{await pool.end();}

function cleanDatabaseUrl(value){const u=new URL(value);for(const key of ["sslmode","sslcert","sslkey","sslrootcert"])u.searchParams.delete(key);return u.toString();}
