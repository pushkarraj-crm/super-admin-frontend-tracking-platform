import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
export function rewriteCookie(cookie) {
  let value = cookie.replace(/(;\s*Path=)\/auth(?=;|$)/i, '$1/api/auth').replace(/;\s*Domain=[^;]+/ig, '');
  if (!/;\s*Secure(?:;|$)/i.test(value)) value += '; Secure';
  return value;
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const error=(status,detail)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({detail}));};
  if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method)) return error(405,'Method not allowed');
  const origin=process.env.API_ORIGIN;
  if (!origin) return error(503,'The test backend is being connected. Please try again shortly.');
  let target;
  try {
    const upstream=new URL(origin);
    if (upstream.protocol!=='https:' || upstream.username || upstream.password || upstream.pathname!=='/') throw new Error('origin');
    const incoming=new URL(req.url,'https://frontend.invalid');
    const candidates=incoming.searchParams.getAll('upstreamPath');
    const raw=candidates.length===1?candidates[0]:req.query?.upstreamPath;
    if (typeof raw!=='string' || !raw || candidates.length>1) return error(400,'Invalid API path');
    const segments=raw.split('/').map(decodeURIComponent);
    if(segments.some(p=>!p || p==='.' || p==='..' || !/^[a-zA-Z0-9._~-]+$/.test(p)) || segments[0]==='internal') return error(400,'Invalid API path');
    target=new URL('/'+segments.map(encodeURIComponent).join('/'),upstream);
    incoming.searchParams.delete('upstreamPath'); target.search=incoming.searchParams.toString();
  } catch { return error(503,'Backend URL configuration is invalid.'); }
  const headers=new Headers();
  for(const name of ['accept','content-type','authorization','cookie','origin','user-agent','x-csrf-token','x-postback-key']) {
    let value=req.headers[name]; if(name==='cookie' && typeof value==='string') value=value.split(';').map(v=>v.trim()).filter(v=>/^(refresh_token|csrf_token)=/.test(v)).join('; '); if(typeof value==='string' && value) headers.set(name,value);
  }
  // Derive routing only from the actual request host; ignore client-supplied company headers.
  const baseDomain=process.env.COMPANY_BASE_DOMAIN;
  if(baseDomain) {
    const host=String(req.headers.host||'').toLowerCase().split(':')[0];
    const suffix='.'+baseDomain;
    if(host.endsWith(suffix)) {
      const slug=host.slice(0,-suffix.length);
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return error(400,'Invalid company dashboard.');
      headers.set('x-company-slug',slug);
    }
  }
  let body;
  if(!['GET','HEAD'].includes(req.method) && req.body!==undefined && req.body!==null) {
    body=Buffer.isBuffer(req.body)?req.body:typeof req.body==='string'?req.body:JSON.stringify(req.body);
    if(Buffer.byteLength(body)>65536) return error(413,'Request body too large');
  }
  try {
    const upstream=await fetch(target,{method:req.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(90000)});
    res.statusCode=upstream.status;
    for(const name of ['content-type','content-disposition','x-request-id','x-export-rows','x-export-max-rows','x-export-truncated','retry-after']) {
      const value=upstream.headers.get(name);if(value)res.setHeader(name,value);
    }
    const cookies=upstream.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies.map(rewriteCookie));
    if(req.method==='HEAD'||upstream.status===204||!upstream.body) return res.end();
    await pipeline(Readable.fromWeb(upstream.body),res);
  } catch {
    if(!res.headersSent) return error(502,'The test API is starting or temporarily unavailable. Please retry in a minute.');
    res.end();
  }
}
