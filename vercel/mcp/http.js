import {createMcpHandler} from '@modelcontextprotocol/server';
import {createServer} from './server.js';

const handler = createMcpHandler(()=>createServer(),{responseMode:'json',maxRequestBodySize:250000,maxSubscriptions:0});
export function handleMcp(request,origin) {
  const caller = request.headers.get('origin');
  if (caller && caller !== origin) return new Response('Unexpected origin',{status:403});
  return handler.fetch(request);
}
