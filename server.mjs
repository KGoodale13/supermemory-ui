import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const upstream = (process.env.SUPERMEMORY_API_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
const apiKey = process.env.SUPERMEMORY_API_KEY || '';
const demoFallback = process.env.DEMO_FALLBACK !== 'false';

const sampleDocuments = [
  { id:'doc_arch', title:'Satellite architecture notes', summary:'SmallWebRTC topology, local wake-word detection and service boundaries.', status:'done', type:'text', createdAt:'2026-06-18T15:20:00Z', updatedAt:'2026-06-20T12:04:00Z', containerTags:['project:pipecat','source:notes'], memories:[
    { id:'mem_webrtc', memory:'The Pipecat satellite uses a SmallWebRTC client.', type:'fact', createdAt:'2026-06-18T15:21:00Z', connections:['mem_ice'] },
    { id:'mem_ice', memory:'UDP media connectivity required resolving ICE path issues.', type:'fact', createdAt:'2026-06-18T15:22:00Z' }
  ]},
  { id:'doc_audio', title:'Audio configuration', summary:'Persistent hardware and audio-path settings for the satellite.', status:'done', type:'text', createdAt:'2026-06-17T10:10:00Z', updatedAt:'2026-06-19T09:42:00Z', containerTags:['project:pipecat','source:config'], memories:[
    { id:'mem_amp', memory:'DigiAMP+ output volume is set to 70% and persists across restarts.', type:'preference', createdAt:'2026-06-17T10:11:00Z' },
    { id:'mem_wake', memory:'Hey Jarvis detection runs locally before microphone audio leaves the device.', type:'fact', createdAt:'2026-06-17T10:12:00Z', connections:['mem_webrtc'] }
  ]},
  { id:'doc_perf', title:'Agent latency investigation', summary:'Timing observations from delayed tool and home-control requests.', status:'done', type:'text', createdAt:'2026-06-16T08:30:00Z', updatedAt:'2026-06-16T09:00:00Z', containerTags:['agent:hermes','source:debug'], memories:[
    { id:'mem_latency', memory:'Large payloads delayed tool and home-control queries by 15.7–30.8 seconds.', type:'episode', createdAt:'2026-06-16T08:31:00Z' }
  ]}
];

function json(res, status, body) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
  res.end(JSON.stringify(body));
}

async function body(req) {
  const chunks=[]; for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

async function proxy(path, payload) {
  try {
    const response=await fetch(`${upstream}${path}`, { method:'POST', headers:{ 'content-type':'application/json', ...(apiKey?{authorization:`Bearer ${apiKey}`}:{}) }, body:JSON.stringify(payload), signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    return response.json();
  } catch (error) {
    if (!demoFallback) throw error;
    return null;
  }
}

function normalizeDocuments(data) {
  const source = Array.isArray(data?.documents)
    ? data.documents
    : Array.isArray(data?.memories)
      ? data.memories
      : [];

  return source
    .filter((document) => document && typeof document.id === 'string')
    .map((document) => ({
      ...document,
      title: document.title ?? null,
      url: document.url ?? null,
      summary: document.summary ?? null,
      documentType: document.documentType ?? document.type ?? 'text',
      createdAt: document.createdAt ?? new Date(0).toISOString(),
      updatedAt: document.updatedAt ?? document.createdAt ?? new Date(0).toISOString(),
      memories: Array.isArray(document.memories)
        ? document.memories
        : Array.isArray(document.memoryEntries)
          ? document.memoryEntries
          : [],
    }));
}

async function api(req,res,url) {
  if (url.pathname==='/api/health') return json(res,200,{ ok:true, upstream });
  if (url.pathname==='/api/documents') {
    const payload=await body(req);
    try {
      const data=await proxy('/v3/documents/documents',{ page:1, limit:500, sort:'createdAt', order:'desc', ...payload });
      if (data) return json(res,200,{ documents:normalizeDocuments(data), pagination:data.pagination });
      return json(res,200,{ documents:sampleDocuments, pagination:{currentPage:1,totalPages:1,totalItems:sampleDocuments.length,limit:500}, demo:true });
    } catch(error) { return json(res,502,{error:error.message}); }
  }
  return json(res,404,{error:'Not found'});
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
async function serve(req,res,url) {
  const requested=url.pathname==='/'?'index.html':url.pathname.slice(1);
  const safe=normalize(requested).replace(/^(\.\.[/\\])+/, '');
  let path=join(dist,safe);
  try { if (!(await stat(path)).isFile()) throw new Error(); }
  catch { path=join(dist,'index.html'); }
  try { const file=await readFile(path); res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}); res.end(file); }
  catch { res.writeHead(503,{'content-type':'text/plain'}); res.end('UI not built. Run `pnpm build` first.'); }
}

createServer(async (req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if (url.pathname.startsWith('/api/')) return api(req,res,url);
  return serve(req,res,url);
}).listen(port,host,()=>console.log(`Memory Observatory listening on http://${host}:${port}`));
