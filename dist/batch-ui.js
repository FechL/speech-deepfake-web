import {normalizeLabel,labelName,summarizeBatch,batchDetails,batchCSV} from './batch.js';

export function initBatch({api,toast,models,busy,onBusy,download,setEvaluation}){
 const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=x=>x==null?'—':(100*x).toFixed(1)+'%',num=x=>x==null?'—':x.toFixed(3);
 const items=[];let running=false,stop=false,runId=crypto.randomUUID();
 const selected=()=>[...document.querySelectorAll('input[name=model]:checked')].map(x=>x.value);
 function refresh(){const n=selected().length;$('batch-model-hint').textContent=`${n} model dipilih di halaman Analisis audio. Pilihan dibekukan saat batch dimulai.`;}
 function addFiles(files){
  if(running)return;
  let label=null;
  try{if($('batch-label-enabled').checked){label=normalizeLabel($('batch-label').value);if(label===null)throw Error('Pilih REAL atau FAKE sebelum menambahkan file.');}}catch(e){toast(e.message);return;}
  let added=0,skipped=0;
  for(const file of files){
   if(items.length>=100){toast('Maksimum 100 file dalam antrean.');break;}
   if(file.size>25*1024*1024){skipped++;continue;}
   const key=JSON.stringify([file.webkitRelativePath||file.name,file.size,file.lastModified]);
   if(items.some(x=>x.key===key)){skipped++;continue;}
   items.push({id:crypto.randomUUID(),key,file,name:file.webkitRelativePath||file.name,label,status:'pending',modelIds:[],result:null,error:null});added++;
  }
  render();toast(`${added} file ditambahkan${skipped?`; ${skipped} duplikat/terlalu besar dilewati`:''}. Label tidak ditentukan dari nama file atau folder.`);
 }
 $('batch-files').onchange=e=>{addFiles([...e.target.files]);e.target.value='';};
 $('batch-folder').onchange=e=>{addFiles([...e.target.files].filter(f=>/\.(wav|mp3|flac|ogg|m4a|aac|aiff|aif|opus|webm)$/i.test(f.name)));e.target.value='';};
 $('batch-label-enabled').onchange=()=>{$('batch-label').disabled=!$('batch-label-enabled').checked;};
 const drop=$('batch-drop');drop.ondragover=e=>{e.preventDefault();if(!running)drop.classList.add('drag');};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');addFiles([...e.dataTransfer.files]);};
 function render(){
  const attempted=items.filter(x=>['done','error'].includes(x.status)).length,labeled=items.filter(x=>x.label!==null).length;
  $('batch-counts').innerHTML=[['FILE DALAM ANTREAN',items.length],['SELESAI / GAGAL',attempted],['MEMILIKI LABEL',labeled],['MENUNGGU',items.filter(x=>x.status==='pending').length]].map(([k,v])=>`<div class="card metric-card"><span>${k}</span><strong>${v}</strong></div>`).join('');
  $('batch-queue').innerHTML=items.map(item=>`<tr><td>${escape(item.name)}<small class="queue-size">${(item.file.size/1024).toFixed(1)} KB</small></td><td><select aria-label="Label ${escape(item.name)}" data-label="${item.id}" ${running?'disabled':''}><option value="" ${item.label===null?'selected':''}>Tanpa label</option><option value="0" ${item.label===0?'selected':''}>REAL</option><option value="1" ${item.label===1?'selected':''}>FAKE</option></select></td><td>${{pending:'Menunggu',running:'Memproses…',done:'Selesai',error:'Gagal'}[item.status]}</td><td><button class="text-button" data-remove="${item.id}" ${running?'disabled':''}>Hapus</button></td></tr>`).join('');
  $('batch-queue').querySelectorAll('[data-label]').forEach(input=>input.onchange=()=>{const item=items.find(x=>x.id===input.dataset.label);item.label=normalizeLabel(input.value);item.status='pending';item.result=null;item.error=null;item.modelIds=[];render();});
  $('batch-queue').querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{items.splice(items.findIndex(x=>x.id===button.dataset.remove),1);render();});
  $('batch-run').disabled=running||!items.some(x=>x.status==='pending');$('batch-cancel').disabled=!running||stop;
  $('batch-clear').disabled=running||!items.length;$('batch-retry').disabled=running||!items.some(x=>x.status==='error');
  for(const id of ['batch-files','batch-folder','batch-label-enabled'])$(id).disabled=running;
  $('batch-label').disabled=running||!$('batch-label-enabled').checked;
  for(const id of ['batch-export-json','batch-export-csv'])$(id).disabled=running||!attempted;
  const stats=summarizeBatch(items);$('batch-summary-section').hidden=!attempted;
  $('batch-summary').innerHTML=stats.map(s=>`<tr><td>${escape(s.model)}</td><td>${s.total}</td><td>${s.ok}</td><td>${s.abstained}</td><td>${s.error}</td><td>${pct(s.coverage)}</td><td>${s.real_ok}/${s.real_total} (${pct(s.real_coverage)})</td><td>${s.fake_ok}/${s.fake_total} (${pct(s.fake_coverage)})</td><td>${s.labeled_scored}</td><td>${pct(s.metrics?.accuracy)}</td><td>${pct(s.metrics?.balanced_accuracy)}</td><td>${num(s.metrics?.auc)}</td><td>${num(s.metrics?.f1)}</td></tr>`).join('');
  const warnings=stats.flatMap(s=>s.mixed_thresholds?[`${s.model}: threshold berubah antarrun. Metrik gabungan tidak dihitung; mulai antrean baru untuk membandingkan secara konsisten.`]:s.real_total&&s.fake_total&&(!s.real_ok||!s.fake_ok)?[`${s.model}: salah satu kelas tidak memiliki prediksi yang lolos. Jangan menafsirkan akurasi pada sampel yang lolos sebagai performa seluruh batch.`]:[]);
  $('batch-warnings').innerHTML=warnings.map(x=>`<p class="warning">ⓘ ${escape(x)}</p>`).join('');
  $('batch-to-evaluation').disabled=running||!stats.some(x=>x.rows.length&&!x.mixed_thresholds);
  renderDetails();refresh();
 }
 function renderDetails(){
  const old=$('batch-filter-model').value,ids=[...new Set(items.flatMap(x=>x.modelIds))];
  $('batch-filter-model').innerHTML='<option value="">Semua model</option>'+ids.map(id=>`<option value="${escape(id)}">${escape(id)}</option>`).join('');if(ids.includes(old))$('batch-filter-model').value=old;
  const model=$('batch-filter-model').value,status=$('batch-filter-status').value;
  $('batch-details').innerHTML=batchDetails(items).filter(r=>(!model||r.model===model)&&(!status||r.status===status)).map(r=>`<tr><td>${escape(r.file)}</td><td>${labelName(r.ground_truth)}</td><td>${escape(r.model)}</td><td>${r.status==='ok'?escape(r.prediction):r.status==='abstained'?'ABSTAIN':'ERROR'}</td><td>${num(r.score)}</td><td>${num(r.threshold)}</td><td>${r.correct===null?'—':r.correct?'Benar':'Salah'}</td><td class="reason-cell">${escape(r.reason)}</td></tr>`).join('');
 }
 $('batch-filter-model').onchange=renderDetails;$('batch-filter-status').onchange=renderDetails;
 $('batch-clear').onclick=()=>{items.splice(0);runId=crypto.randomUUID();$('batch-progress').textContent='Antrean dikosongkan.';render();};
 $('batch-retry').onclick=()=>{for(const item of items)if(item.status==='error'){item.status='pending';item.error=null;item.result=null;}render();};
 $('batch-cancel').onclick=()=>{stop=true;$('batch-progress').textContent='Akan berhenti setelah file yang sedang diproses selesai.';render();};
 $('batch-run').onclick=async()=>{
  if(running||busy()){toast('Tunggu analisis yang sedang berjalan selesai.');return;}
  const ids=selected();if(!ids.length){toast('Pilih minimal satu model pada halaman Analisis audio.');return;}
  const jobs=items.filter(x=>x.status==='pending');if(!jobs.length)return;
  running=true;stop=false;onBusy(true);render();let done=0;
  try{
   for(const item of jobs){
    if(stop)break;
    item.status='running';item.modelIds=[...ids];$('batch-progress').textContent=`${done+1}/${jobs.length} · ${item.name} · ${ids.length} model`;render();
    const form=new FormData();form.append('audio',item.file);form.append('model_ids',JSON.stringify(ids));if(item.label!==null)form.append('ground_truth',String(item.label));
    try{const result=await api('/api/infer',{method:'POST',body:form});item.result={predictions:result.predictions,audio_sha256:result.audio_sha256,duration:result.duration,ground_truth:result.ground_truth,ground_truth_source:result.ground_truth_source};item.status='done';item.error=null;}
    catch(e){item.status='error';item.error=e.name==='AbortError'?'Batas waktu request terlampaui; file dapat diulang.':e.message;}
    done++;render();
   }
  }finally{running=false;onBusy(false);$('batch-progress').textContent=stop?`Dihentikan. ${done} file selesai diproses pada run ini; antrean tersisa dapat dilanjutkan.`:`Selesai memproses ${done} file pada ${ids.length} model.`;render();}
 };
 function report(){if(!items.length)return null;return {run_id:runId,generated_at:new Date().toISOString(),items:items.map(({file,key,...item})=>({...item,size_bytes:file.size})),summaries:summarizeBatch(items),notes:['Labels are user-provided ground truth and never model input.','Accuracy/AUC/F1 use only labeled scored samples. Coverage includes abstentions and errors.','Per-class coverage must be considered when comparing models.','Batch files are processed sequentially; stopping waits for the in-flight request.']};}
 function reportHTML(){const data=report();if(!data)return '';return `<h2>Ringkasan batch</h2><p>${data.items.length} file dalam antrean. Label diberikan pengguna dan tidak menjadi input model.</p>`+data.summaries.map(s=>`<p><strong>${escape(s.model)}</strong>: ${s.ok}/${s.total} berprediksi, ${s.abstained} abstain, ${s.error} gagal. Coverage REAL ${pct(s.real_coverage)}, FAKE ${pct(s.fake_coverage)}. Akurasi sampel berlabel yang lolos ${pct(s.metrics?.accuracy)} (n=${s.labeled_scored}).</p>`).join('');}
 $('batch-export-json').onclick=()=>download('deepguard-batch.json',report());$('batch-export-csv').onclick=()=>download('deepguard-batch.csv',batchCSV(items),'text/csv');
 $('batch-to-evaluation').onclick=()=>{
  const stats=summarizeBatch(items);if(stats.some(s=>s.mixed_thresholds)){toast('Threshold berubah antarrun; gunakan antrean baru sebelum membuka evaluasi gabungan.');return;}
  const rows=stats.flatMap(s=>s.rows.map(r=>({...r,model:s.model,dataset:'Batch lokal / '+runId,seed:''})));
  if(!rows.length){toast('Belum ada skor berlabel. Abstain/error tidak dimasukkan ke metrik.');return;}
  setEvaluation(rows,report());
 };
 render();return {report,reportHTML,refresh};
}
