/* Servidor local de conferência. A Biblioteca Aurora continua sendo um PWA estático. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const args=process.argv;
const option=(name,defaultValue)=>args.includes(name)?args[args.indexOf(name)+1]:defaultValue;
const port=Number(option('--port','4173'));
const host=option('--host','0.0.0.0');
const root=process.cwd();
const mime={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.webp':'image/webp','.png':'image/png','.pdf':'application/pdf',
  '.webmanifest':'application/manifest+json','.json':'application/json',
  '.txt':'text/plain; charset=utf-8'
};
createServer(async (request,response)=>{
  let pathname;
  try {pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);} catch {
    response.writeHead(400);response.end('Bad request');return;
  }
  if(pathname.endsWith('/')) pathname+='index.html';
  const filename=path.resolve(root,'.'+pathname);
  if(!filename.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  try {
    const content=await readFile(filename);
    response.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(request.method==='HEAD'?undefined:content);
  } catch {
    response.writeHead(404);response.end('Arquivo não encontrado');
  }
}).listen(port,host,()=>console.log('Aurora local: http://'+host+':'+port+'/'));
