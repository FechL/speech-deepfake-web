const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)?value.toFixed(4):'—';

export function predictionSummary(results){
 const counts={real:0,fake:0,abstained:0,error:0};
 for(const p of results){
  if(p.status==='abstained')counts.abstained++;
  else if(p.status==='ok'&&p.prediction==='REAL')counts.real++;
  else if(p.status==='ok'&&p.prediction==='FAKE')counts.fake++;
  else counts.error++;
 }
 const valid=counts.real+counts.fake;
 const title=!results.length?'Belum ada kesimpulan':!valid?'Tidak dapat disimpulkan':counts.real===counts.fake?'Hasil model berimbang':counts.fake>counts.real?'Mayoritas model: FAKE':'Mayoritas model: REAL';
 const message=!results.length?'Kesimpulan akan muncul setelah inferensi selesai.':!valid?'Tidak ada model yang menghasilkan prediksi REAL atau FAKE. Periksa alasan pada tabel.':counts.real===counts.fake?`${counts.real} model memilih REAL dan ${counts.fake} model memilih FAKE.`:`${Math.max(counts.real,counts.fake)} dari ${valid} model yang berprediksi memilih ${counts.fake>counts.real?'FAKE':'REAL'}.`;
 return {...counts,valid,title,message};
}
export function predictionsHTML(results,{busy=false,hasAudio=false}={}){
 const summary=predictionSummary(results);
 const status=busy?'MEMPROSES AUDIO':results.length?'SELESAI':hasAudio?'MENUNGGU ANALISIS':'MENUNGGU AUDIO';
 const empty=busy?'Analisis sedang berjalan…':hasAudio?'Pilih model lalu jalankan analisis.':'Unggah audio lalu jalankan analisis.';
 const rows=results.map(p=>{
  const ok=p.status==='ok';
  const outcome=ok?p.prediction:p.status==='abstained'?'ABSTAIN':'ERROR';
  const details=[ok?`${p.feature_count??'—'} fitur · ${p.missing_features??0} missing`:p.reason,...(p.warnings||[]).filter(w=>!w.startsWith('Serialisasi XGBoost versi lama:'))].filter(Boolean);
  return `<tr><td>${escape(p.model_id)}</td><td><span class="chip">${escape(outcome)}</span></td><td>${ok?number(p.score):'—'}</td><td>${ok?number(p.threshold):'—'}</td><td class="prediction-notes">${details.map(escape).join('<br>')||'—'}</td></tr>`;
 }).join('');
 return `<div class="prediction-layout"><div class="prediction-table-panel"><div class="card-heading"><h2>Hasil inferensi model</h2><span class="chip">${status}</span></div><div class="table-scroll prediction-table-scroll" tabindex="0" role="region" aria-label="Tabel hasil inferensi model yang dapat digulir"><table><thead><tr><th>MODEL</th><th>HASIL</th><th>SKOR</th><th>THRESHOLD</th><th>KETERANGAN</th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="prediction-placeholder">${empty}</td></tr>`}</tbody></table></div><p class="footnote">Skor dibandingkan dengan threshold masing-masing model; skala skor antarmodel dapat berbeda.</p></div><aside class="prediction-conclusion"><h2>Kesimpulan keseluruhan</h2><strong class="conclusion-title">${busy?'Menunggu hasil inferensi':summary.title}</strong><p>${busy?'Prediksi model sedang diproses.':summary.message}</p><dl class="prediction-counts">${[['REAL',summary.real],['FAKE',summary.fake],['ABSTAIN',summary.abstained],['ERROR',summary.error]].map(([label,count])=>`<div><dt>${label}</dt><dd>${results.length?count:'—'}</dd></div>`).join('')}</dl><p class="footnote">Ringkasan memakai suara terbanyak tanpa bobot. Abstain/error tidak ikut memilih. Ini bukan ensemble tervalidasi atau probabilitas keaslian; model dapat memiliki kesalahan yang berkaitan.</p></aside></div>`;
}
