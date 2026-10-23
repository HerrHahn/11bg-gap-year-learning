// Separate namespace of the existing Results binding; no AI calls or grade records.
const badControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
export function validSuggestion(body) {
  if (!body || typeof body.text !== 'string' || body.text.trim().length < 5 || body.text.length > 2000 || badControls.test(body.text)) return false;
  return typeof body.page === 'string' && body.page.length <= 160 && !/[\r\n]/.test(body.page) && !badControls.test(body.page)
    && typeof body.attemptId === 'string' && /^[a-f0-9-]{36}$/i.test(body.attemptId);
}
async function limitedJSON(request) {
  const reader = request.body?.getReader(); if (!reader) throw Error('empty');
  const chunks = []; let size = 0;
  for (;;) { const {value, done} = await reader.read(); if (done) break; size += value.byteLength; if (size > 12000) { await reader.cancel(); throw Error('large'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleSuggestions(request, env) {
  const path = new URL(request.url).pathname;
  const headers = {'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
  if (!env.ALLOWED_ORIGIN || request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return reply({error:'Diese Website ist nicht freigeschaltet.'},403);
  Object.assign(headers, {'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return reply({error:'Bitte das Vorschlagsformular verwenden.'},405);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /,'').trim();
  const teacher = path === '/britain/suggestions/export';
  if (teacher) {
    if (!env.TEACHER_SECRET || token !== env.TEACHER_SECRET) return reply({error:'Lehrkraftzugang ungültig.'},401);
  } else {
    const code = token.length === 6 ? token.toUpperCase() : token;
    const codes = [env.ACCESS_CODES,env.BRITAIN_ACCESS_CODES].filter(Boolean).join(',').split(',').map(x=>x.trim()).filter(Boolean);
    if (!code || !codes.includes(code)) return reply({error:'Bitte einen gültigen Übungscode eingeben.'},401);
  }
  if (!env.RESULTS) return reply({error:'Die Sammlung ist gerade nicht erreichbar.'},503);
  try {
    const store = env.RESULTS.get(env.RESULTS.idFromName('britain-suggestions-v1'));
    if (teacher) {
      const response = await store.fetch('https://results/suggestions/list');
      if (!response.ok) throw Error('storage');
      return reply(await response.json());
    }
    if (!request.headers.get('Content-Type')?.includes('application/json')) return reply({error:'Ungültiges Datenformat.'},415);
    let body; try { body = await limitedJSON(request); } catch { return reply({error:'Der Vorschlag ist zu groß oder unlesbar.'},400); }
    if (!validSuggestion(body)) return reply({error:'Bitte 5 bis 2.000 Zeichen eingeben.'},400);
    const code = token.length === 6 ? token.toUpperCase() : token;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('suggestions:'+code))),x=>x.toString(16).padStart(2,'0')).join('');
    const response = await store.fetch('https://results/suggestions/save',{method:'POST',body:JSON.stringify({id:hash+':'+body.attemptId,hash,date:new Date().toISOString(),page:body.page,text:body.text.trim()})});
    if (response.status === 429) return reply({error:'Maximal fünf Vorschläge pro Tag und Code. Bitte morgen erneut versuchen.'},429);
    if (!response.ok) throw Error('storage');
    return reply({saved:true});
  } catch { return reply({error:'Nicht gesendet. Dein Entwurf bleibt im Feld. Bitte später erneut versuchen.'},503); }
}
export async function suggestionStorage(request, state) {
  if (new URL(request.url).pathname === '/suggestions/list') {
    const records = await state.storage.list({prefix:'suggestion:'});
    return Response.json({rows:[...records.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(({id,date,page,text})=>({id,date,page,text}))});
  }
  if (new URL(request.url).pathname !== '/suggestions/save' || request.method !== 'POST') return new Response(null,{status:404});
  const row = await request.json();
  const result = await state.storage.transaction(async tx => {
    const key = 'suggestion:'+row.id;
    if (await tx.get(key)) return 200;
    const dailyKey = 'limit:'+row.hash;
    const prior = await tx.get(dailyKey);
    const day = row.date.slice(0,10), count = prior?.day === day ? prior.count : 0;
    if (count >= 5) return 429;
    const total = (await tx.get('total')) || 0;
    if (total >= 5000) return 507;
    // Hash is only used for rate limits; neither code nor hash appears in exports.
    await tx.put(key,{id:row.id.split(':').at(-1),date:row.date,page:row.page,text:row.text});
    await tx.put(dailyKey,{day,count:count+1}); await tx.put('total',total+1);
    return 201;
  });
  return new Response(null,{status:result});
}
