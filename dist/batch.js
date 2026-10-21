import {metrics} from './metrics.js';

export function normalizeLabel(value){
  if(value===null||value===undefined||value==='')return null;
  if(value===0||value==='0')return 0;
  if(value===1||value==='1')return 1;
  throw Error('Label harus REAL=0, FAKE=1, atau tanpa label.');
}
export const labelName=value=>value===0?'REAL':value===1?'FAKE':'Tanpa label';
export function summarizeBatch(items){
  const attempted=items.filter(x=>['done','error'].includes(x.status));
  const ids=[...new Set(attempted.flatMap(x=>x.modelIds||[]))];
  return ids.map(model=>{
    const cohort=attempted.filter(x=>x.modelIds.includes(model));
    const stats={model,total:cohort.length,ok:0,abstained:0,error:0,labeled_scored:0,real_total:0,real_ok:0,fake_total:0,fake_ok:0,rows:[]};
    for(const item of cohort){
      if(item.label===0)stats.real_total++;
      if(item.label===1)stats.fake_total++;
      const p=item.result?.predictions?.find(x=>x.model_id===model);
      if(item.status==='error'||!p){stats.error++;continue;}
      if(p.status==='abstained'){stats.abstained++;continue;}
      if(p.status!=='ok'||!Number.isFinite(p.score)||!Number.isFinite(p.threshold)){stats.error++;continue;}
      stats.ok++;
      if(item.label===0)stats.real_ok++;
      if(item.label===1)stats.fake_ok++;
      if(item.label!==null&&item.label!==undefined)stats.rows.push({label:normalizeLabel(item.label),score:p.score,threshold:p.threshold,sample_id:item.id});
    }
    stats.labeled_scored=stats.rows.length;
    stats.coverage=stats.total?stats.ok/stats.total:null;
    stats.real_coverage=stats.real_total?stats.real_ok/stats.real_total:null;
    stats.fake_coverage=stats.fake_total?stats.fake_ok/stats.fake_total:null;
    const thresholds=new Set(stats.rows.map(x=>x.threshold));
    stats.mixed_thresholds=thresholds.size>1;
    stats.metrics=stats.rows.length&&thresholds.size===1?metrics(stats.rows,stats.rows[0].threshold):null;
    return stats;
  });
}
export function batchDetails(items){
  return items.filter(x=>['done','error'].includes(x.status)).flatMap(item=>(item.modelIds||[]).map(model=>{
    const p=item.result?.predictions?.find(x=>x.model_id===model);
    const status=item.status==='error'?'error':p?.status||'error';
    return {sample_id:item.id,file:item.name,ground_truth:item.label,model,status,prediction:status==='ok'?p.prediction:null,score:status==='ok'?p.score:null,threshold:status==='ok'?p.threshold:null,correct:status==='ok'&&item.label!==null&&item.label!==undefined?Number(p.prediction==='FAKE')===item.label:null,reason:item.error||p?.reason||(p?'':'Model tidak mengembalikan hasil.'),audio_sha256:item.result?.audio_sha256||null};
  }));
}
export function batchCSV(items){
  const keys=['sample_id','file','ground_truth','model','status','prediction','score','threshold','correct','reason','audio_sha256'];
  const quote=x=>{let value=x==null?'':String(x);if(typeof x==='string'&&/^[=+\-@\t\r]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';};
  return keys.join(',')+'\n'+batchDetails(items).map(row=>keys.map(k=>quote(row[k])).join(',')).join('\n');
}
