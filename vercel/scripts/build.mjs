import {copyFile,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of await readdir('dist',{withFileTypes:true})){if(!file.isFile()||! /\.(html|css|js)$/.test(file.name))continue;let text=await readFile('dist/'+file.name,'utf8');text=text.replaceAll('/signin-with-chatgpt?return_to=','/signin.html?return_to=');if(file.name.endsWith('.html'))text=text.replace('</body>','<script type="module" src="/account-menu.js"></script></body>');await writeFile('public/'+file.name,text);}
await mkdir('public/studies/missing-tests',{recursive:true});
await copyFile('bench/exercise.html','public/studies/missing-tests/index.html');
await copyFile('bench/exercise-data.js','public/studies/missing-tests/exercise-data.js');
console.log('Built Vercel static assets. Server code and credentials are excluded.');
