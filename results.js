import {quizPoints} from './grading.js';
export const RETENTION_MS=90*24*60*60*1000;
export function studentName(value){if(typeof value!=='string')return '';const n=value.trim().replace(/\s+/gu,' ');return n.length>=2&&n.length<=80&&!/[\u0000-\u001f\u007f]/u.test(n)?n:'';}
export function quizRecord(body,modules){const name=studentName(body.name);if(!name||!modules.some(m=>m.id===body.module)||body.total!==6||!Number.isInteger(body.correct)||body.correct<0||body.correct>6||![0,20,40].includes(body.seconds)||typeof body.attemptId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.attemptId))return null;return {name,kind:'quiz',taskId:body.module,correct:body.correct,total:6,seconds:body.seconds,points:quizPoints(body.correct,6),verification:'Selbst übermitteltes Quiz'};}
// Only names and score summaries are retained, never access codes or student texts.
export class Results {
 constructor(state){this.state=state;}
 async fetch(request){const path=new URL(request.url).pathname;
  if(path==='/list'){const records=await this.state.storage.list({prefix:'result:'});return Response.json({rows:[...records.values()].filter(r=>Date.now()-Date.parse(r.date)<RETENTION_MS).sort((a,b)=>b.date.localeCompare(a.date))});}
  if(path!=='/record')return new Response(null,{status:404});
  const row=await request.json();if(!row.id||!row.date||!studentName(row.name))return new Response(null,{status:400});
  const status=await this.state.storage.transaction(async tx=>{const key='result:'+row.id;if(await tx.get(key))return 200;const day=row.date.slice(0,10),keyCount='count:'+day;const count=(await tx.get(keyCount))||0;if(count>=1000)return 429;await tx.put(key,row);await tx.put(keyCount,count+1);return 201;});
  if(await this.state.storage.getAlarm()===null)await this.state.storage.setAlarm(Date.now()+24*60*60*1000);return new Response(null,{status});
 }
 async alarm(){const rows=await this.state.storage.list();const cutoff=Date.now()-RETENTION_MS;const keys=[...rows].filter(([k,v])=>k.startsWith('result:')?Date.parse(v.date)<cutoff:k.startsWith('count:')&&Date.parse(k.slice(6))<cutoff).map(([k])=>k);for(let i=0;i<keys.length;i+=100)await this.state.storage.delete(keys.slice(i,i+100));if(rows.size>keys.length)await this.state.storage.setAlarm(Date.now()+24*60*60*1000);}
}
