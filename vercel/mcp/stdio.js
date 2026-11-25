import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createServer} from './server.js';

await serveStdio(()=>createServer({githubToken:process.env.RR_GITHUB_ACTIONS_TOKEN}));
