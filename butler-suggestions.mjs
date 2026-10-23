// Butler-only routes and storage. No calls to any AI service.
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
export const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
export const berlinDay = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
async function readBody(request) {
 const reader=request.body?.getReader(); if(!reader)throw Error('empty');
 const chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw Error('large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleButlerSuggestions(request,env) {
 const path=new URL(request.url).pathname;
 const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!['/butler/suggestions','/butler/suggestions/export'].includes(path))return reply({error:'Nicht gefunden.'},404);
 if(!env.ALLOWED_ORIGIN||request.headers.get('Origin')!==env.ALLOWED_ORIGIN)return reply({error:'Website nicht freigeschaltet.'},403);
 Object.assign(headers,{'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply({error:'Nur über das Formular erreichbar.'},405);
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'').trim();
 const teacher=path.endsWith('/export');let hash;
 if(teacher){
  if(!env.TEACHER_SECRET||!token||await digest(token)!==await digest(env.TEACHER_SECRET))return reply({error:'Lehrkraft-Schlüssel ungültig.'},401);
 }
 if(!env.RESULTS)return reply({error:'Sammlung derzeit nicht erreichbar.'},503);
 try {
  const store=env.RESULTS.get(env.RESULTS.idFromName('butler-suggestions-v1'));
  if(teacher){const result=await store.fetch('https://results/butler-suggestions/list');if(!result.ok)throw Error('storage');return reply(await result.json());}
  if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({error:'Ungültiges Datenformat.'},415);
  let body;try{body=await readBody(request);}catch{return reply({error:'Eingabe zu groß oder unlesbar.'},400);}
  if(!body||typeof body.text!=='string'||!body.text.trim()||body.text.length>2000||controls.test(body.text)||typeof body.page!=='string'||!body.page.trim()||body.page.length>240||/[\r\n]/.test(body.page)||controls.test(body.page)||!uuid.test(body.attemptId||'')||!uuid.test(body.clientId||''))return reply({error:'Bitte 1 bis 2.000 Zeichen und einen gültigen Seitenbezug senden.'},400);
  hash=await digest('butler-anonymous-v1:'+body.clientId);
  const result=await store.fetch('https://results/butler-suggestions/save',{method:'POST',body:JSON.stringify({id:body.attemptId,hash,text:body.text.trim(),page:body.page,date:new Date().toISOString()})});
  if(result.status===429)return reply({error:'Das tägliche Vorschlagslimit ist erreicht. Bitte morgen erneut versuchen (deutsche Zeit).'},429);
  if(result.status===409)return reply({error:'Diese Sende-ID gehört bereits zu einem anderen Text. Bitte einen neuen Vorschlag beginnen.'},409);
  if(!result.ok)throw Error('storage');
  return reply({saved:true,id:body.attemptId});
 }catch{return reply({error:'Keine Speicherbestätigung. Dein Entwurf bleibt erhalten. Bitte erneut versuchen.'},503);}
}
export async function butlerSuggestionStorage(request,state) {
 const path=new URL(request.url).pathname;
 if(path==='/butler-suggestions/list'){
  const records=await state.storage.list({prefix:'suggestion:'});
  return Response.json({rows:[...records.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(({id,date,page,text})=>({id,date,page,text}))});
 }
 if(path!=='/butler-suggestions/save'||request.method!=='POST')return new Response(null,{status:404});
 const row=await request.json();
 const status=await state.storage.transaction(async tx=>{
  const key='suggestion:'+row.hash+':'+row.id,existing=await tx.get(key);
  if(existing)return existing.text===row.text&&existing.page===row.page?200:409;
  const day=berlinDay(row.date),limitKey='limit:'+row.hash,prior=await tx.get(limitKey);
  const count=prior?.day===day?prior.count:0;
  const daily=await tx.get('anonymous-day');
  const dailyCount=daily?.day===day?daily.count:0;
  if(count>=5||dailyCount>=200)return 429;
  const total=await tx.get('total')||0;if(total>=5000)return 507;
  await tx.put(key,{id:row.id,text:row.text,page:row.page,date:row.date});
  await tx.put(limitKey,{day,count:count+1});await tx.put('total',total+1);await tx.put('anonymous-day',{day,count:dailyCount+1});
  return 201;
 });
 return new Response(null,{status});
}
