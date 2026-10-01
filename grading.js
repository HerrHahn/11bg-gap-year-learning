// The 1–15 quiz scale is an explicitly local practice scale, not an official grade conversion.
export function quizPoints(correct,total){return total>0?Math.max(1,Math.round(15*correct/total)):1;}
export function writingPoints(content,lexis,grammar,design){
 const language=(lexis+grammar+design)/3;
 const raw=content*.4+language*.6;
 return {content,lexis,grammar,design,language:Math.round(language*10)/10,raw:Math.round(raw*10)/10,total:Math.max(1,Math.round(raw)),floorApplied:raw<.5};
}
export function validateGrade(data){
 if(!data||typeof data!=='object')throw new Error('Unvollständige Rückmeldung.');
 for(const k of ['content','lexis','grammar','design'])if(!Number.isInteger(data[k])||data[k]<0||data[k]>15)throw new Error('Ungültige Bewertung.');
 for(const k of ['contentReason','lexisReason','grammarReason','designReason','nextStep'])if(typeof data[k]!=='string'||data[k].length>5000)throw new Error('Unvollständige Rückmeldung.');
 if(!Array.isArray(data.strengths)||!Array.isArray(data.improvements)||!Array.isArray(data.corrections))throw new Error('Unvollständige Rückmeldung.');
 for(const k of ['strengths','improvements'])if(data[k].length>8||data[k].some(x=>typeof x!=='string'||x.length>2000))throw new Error('Ungültige Rückmeldung.');
 if(data.corrections.length>8||data.corrections.some(x=>!x||['original','suggestion','explanation'].some(k=>typeof x[k]!=='string'||x[k].length>2000)))throw new Error('Ungültige Korrekturen.');
 return {...data,scores:writingPoints(data.content,data.lexis,data.grammar,data.design)};
}
