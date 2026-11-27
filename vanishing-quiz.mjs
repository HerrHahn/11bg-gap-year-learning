import {questions} from './vanishing-quiz-data.mjs';
const TTL=90*86400000;
export function gradeQuiz(body){
 if(!body||body.version!=='vanishing-chapter1-quiz-v1'||typeof body.name!=='string'||typeof body.attemptId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.attemptId))return null;
 const name=body.name.trim().replace(/\s+/gu,' ');
 if(name.length<2||name.length>80||/[\u0000-\u001f\u007f]/u.test(name)||!Array.isArray(body.answers)||body.answers.length!==questions.length||body.answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=questions[i].options.length))return null;
 const feedback=questions.map((q,i)=>({id:q.id,correct:body.answers[i]===q.answer,answer:q.answer,explanation:q.explanation}));
 return {id:body.attemptId,version:body.version,name,answers:body.answers,score:feedback.filter(f=>f.correct).length,total:questions.length,feedback};
}
export function csvRows(rows){const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[['Name','Zeitpunkt (UTC)','Punkte','Maximum','Prozent','Versuch',...questions.map(q=>'Frage '+q.id)],...rows.map(r=>[r.name,r.date,r.score,r.total,Math.round(r.score/r.total*100),r.id,...r.feedback.map(f=>f.correct?1:0)])].map(r=>r.map(cell).join(';')).join('\r\n');}
async function readBody(req){const reader=req.body?.getReader();if(!reader)throw Error();let n=0,s='';const d=new TextDecoder();while(true){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>12000){await reader.cancel();throw Error();}s+=d.decode(r.value,{stream:true});}return JSON.parse(s+d.decode());}
async function equalSecret(a,b){const enc=new TextEncoder();const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s)));const [x,y]=await Promise.all([digest(a),digest(b)]);let v=0;for(let i=0;i<x.length;i++)v|=x[i]^y[i];return v===0;}
export async function handleVanishingQuiz(req,env){
 const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!env.ALLOWED_ORIGIN||req.headers.get('Origin')!==env.ALLOWED_ORIGIN)return reply({error:'Origin not allowed.'},403);
 Object.assign(headers,{'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'POST required.'},405);
 const path=new URL(req.url).pathname;
 if(!['/vanishing-half/chapter-1/quiz/submit','/vanishing-half/chapter-1/quiz/export'].includes(path))return reply({error:'Not found.'},404);
 if(!env.RESULTS)return reply({error:'Storage unavailable. Your draft is retained.'},503);
 try{
 const stub=env.RESULTS.get(env.RESULTS.idFromName('vanishing-chapter1-quiz-v1'));
 if(path.endsWith('/export')){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!env.TEACHER_SECRET||!token||token.length>512||!await equalSecret(token,env.TEACHER_SECRET))return reply({error:'Lehrkraft-Schlüssel ungültig.'},401);
 const r=await stub.fetch('https://results/vanishing-quiz/list');if(!r.ok)throw Error();const {rows}=await r.json();
 return new Response(csvRows(rows),{headers:{...headers,'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="Vanishing-Half-Chapter-1-Ergebnisse.csv"'}});
 }
 if(!req.headers.get('Content-Type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 let b;try{b=await readBody(req);}catch{return reply({error:'Invalid or oversized submission.'},400);}
 const row=gradeQuiz(b);if(!row)return reply({error:'Enter your name and answer all 20 questions.'},400);
 row.date=new Date().toISOString();
 const r=await stub.fetch('https://results/vanishing-quiz/save',{method:'POST',body:JSON.stringify(row)});const data=await r.json();return reply(data,r.status);
 }catch{return reply({error:'Saving failed. Your draft is retained. Please try again.'},503);}
}
export async function vanishingQuizStorage(req,state){
 if(new URL(req.url).pathname==='/vanishing-quiz/list'){const all=await state.storage.list({prefix:'result:'});return Response.json({rows:[...all.values()].filter(r=>Date.now()-Date.parse(r.date)<TTL).sort((a,b)=>b.date.localeCompare(a.date))});}
 if(new URL(req.url).pathname!=='/vanishing-quiz/save'||req.method!=='POST')return Response.json({error:'Not found.'},{status:404});
 const row=await req.json();let status=201;
 const saved=await state.storage.transaction(async tx=>{const key='result:'+row.id;const old=await tx.get(key);if(old){if(old.name!==row.name||JSON.stringify(old.answers)!==JSON.stringify(row.answers)){status=409;return null;}status=200;return old;}const day='count:'+row.date.slice(0,10),count=(await tx.get(day))||0;if(count>=1000){status=429;return null;}await tx.put(key,row);await tx.put(day,count+1);return row;});
 if(await state.storage.getAlarm()===null)await state.storage.setAlarm(Date.now()+86400000);
 return Response.json(saved?{saved:true,...saved}:{error:status===409?'This attempt was already submitted with different answers.':'Daily service capacity reached. Please try later.'},{status});
}

