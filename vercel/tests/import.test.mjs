import test from 'node:test';import assert from 'node:assert/strict';import {importApi} from '../dist/api-import.js';
test('Postman nested folders retain bodies, auth, URL and variables without executing scripts',()=>{
 const r=importApi(JSON.stringify({info:{name:'demo'},variable:[{key:'base',value:'https://example.com'}],auth:{type:'bearer',bearer:[{key:'token',value:'{{token}}'}]},item:[{name:'folder',item:[{name:'create',event:[{script:{exec:['throw Error()']}}],request:{method:'POST',url:'{{base}}/items',body:{mode:'raw',raw:'{"name":"test"}',options:{raw:{language:'json'}}}}}]}]}));assert.equal(r.requests[0].body,'{"name":"test"}');assert.equal(JSON.parse(r.requests[0].headers).Authorization,'Bearer {{token}}');assert.equal(r.variables.base,'https://example.com');assert.match(r.warnings.join(' '),/scripts/);
});
test('OpenAPI YAML resolves local schemas and imports server, params and expected status',()=>{
 const r=importApi(`openapi: 3.0.3
info: {title: Demo, version: '1'}
servers:
  - url: https://example.com/v1
paths:
  /items/{id}:
    parameters:
      - {name: id, in: path, required: true, schema: {type: integer, example: 42}}
    post:
      requestBody:
        content:
          application/json:
            schema: {$ref: '#/components/schemas/Item'}
      responses:
        '201': {description: Created}
components:
  schemas:
    Item:
      type: object
      properties:
        name: {type: string, example: desk}
`);assert.equal(r.requests[0].url,'https://example.com/v1/items/{{id}}');assert.equal(r.variables.id,42);assert.equal(JSON.parse(r.requests[0].body).name,'desk');assert.equal(r.requests[0].assertions[0].value,201);
});
test('Swagger 2 accepts body schemas and API key security',()=>{const r=importApi(JSON.stringify({swagger:'2.0',host:'example.com',basePath:'/v2',security:[{key:[]}],securityDefinitions:{key:{type:'apiKey',in:'header',name:'X-Key'}},paths:{'/items':{post:{parameters:[{in:'body',name:'body',schema:{type:'object',properties:{n:{type:'integer',default:2}}}}],responses:{200:{description:'OK'}}}}}}));assert.equal(JSON.parse(r.requests[0].body).n,2);assert.equal(JSON.parse(r.requests[0].headers)['X-Key'],'{{auth_key}}');});
test('invalid and hostile YAML/import shapes fail; external references are never fetched',()=>{assert.throws(()=>importApi('x: &a [1]\ny: *a'),/aliases/);assert.throws(()=>importApi('{"hello":1}'),/Postman/);const r=importApi(JSON.stringify({openapi:'3.1.0',paths:{'/x':{get:{parameters:[{$ref:'https://private.invalid/x'}],responses:{200:{}}}}}}));assert.match(r.warnings.join(' '),/External references/);});
