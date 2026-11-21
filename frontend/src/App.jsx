import { useRef, useState } from 'react';
import { batchMetrics } from './metrics';
import './App.css';

const EXTENSIONS = new Set(['wav', 'mp3', 'm4a', 'webm', 'ogg', 'flac']);
const fmt = value => value === null || value === undefined ? '—' : (value * 100).toFixed(1) + '%';
const num = value => value === null || value === undefined || !Number.isFinite(value) ? '—' : Number(value).toFixed(4);
const key = file => (file.webkitRelativePath || file.name) + ':' + file.size + ':' + file.lastModified;
const inferredLabel = file => {
  const folders = (file.webkitRelativePath || '').toLowerCase().split('/');
  return folders.includes('real') ? 0 : folders.includes('fake') ? 1 : null;
};
const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || (location.port === '5173' ? '' : location.origin);

async function analyze(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(apiBase + '/api/analyze', { method: 'POST', body: form, signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== 'success') {
    const detail = data.detail;
    throw new Error(data.message || (Array.isArray(detail) ? detail[0]?.message : detail) || data.errors?.[0]?.message || 'Analisis gagal (HTTP ' + response.status + ')');
  }
  return data;
}

function FeatureTable({ groups }) {
  const [groupId, setGroupId] = useState('all');
  const [query, setQuery] = useState('');
  const rows = groups.flatMap(group => groupId === 'all' || group.id === groupId
    ? group.values.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => ({ ...item, group: group.title }))
    : []);
  return <>
    <div className="feature-tools">
      <select aria-label="Kelompok fitur" value={groupId} onChange={e => setGroupId(e.target.value)}>
        <option value="all">Semua fitur · {groups.reduce((n, group) => n + group.values.length, 0)}</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.title} · {group.values.length}</option>)}
      </select>
      <input type="search" aria-label="Cari fitur" placeholder="Cari fitur..." value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <div className="table-scroll feature-scroll"><table><thead><tr><th>Kelompok</th><th>Nama fitur</th><th>Nilai</th></tr></thead>
      <tbody>{rows.map((item, i) => <tr key={item.group + item.name + i}><td>{item.group}</td><td className="mono">{item.name}</td><td className="mono">{num(item.value)}</td></tr>)}
      {!rows.length && <tr><td colSpan="3">Tidak ada fitur yang cocok.</td></tr>}</tbody></table></div>
  </>;
}

function Predictions({ predictions }) {
  return <div className="table-scroll"><table><thead><tr><th>Model</th><th>Fitur</th><th>P(fake)</th><th>Ambang</th><th>Keputusan</th><th title="Probabilitas kelas hasil model; belum dikalibrasi sebagai kepastian forensik.">Confidence</th></tr></thead>
    <tbody>{predictions.map(p => <tr key={p.id}>
      <td className="model-name">{p.name}</td><td>{p.feature_count}</td><td className="mono">{fmt(p.score)}</td><td className="mono">{fmt(p.threshold)}</td>
      <td><span className={'tag ' + (p.prediction === 'FAKE' ? 'fake' : 'real')}>{p.prediction}</span></td><td className="mono">{fmt(p.confidence)}</td>
    </tr>)}</tbody></table></div>;
}

function Result({ data }) {
  return <div className="result-stack">
    {data.errors?.length > 0 && <div className="notice">{data.errors.map((error, i) => <div key={i}>{error.source}: {error.message}</div>)}</div>}
    <section className="panel"><Predictions predictions={data.predictions} /></section>
    <section className="panel"><FeatureTable groups={data.featureGroups} /></section>
  </div>;
}

function App() {
  const [tab, setTab] = useState('single');
  const [singleFile, setSingleFile] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [singleError, setSingleError] = useState('');
  const [singleBusy, setSingleBusy] = useState(false);
  const [batch, setBatch] = useState([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const controller = useRef(null);
  const stop = useRef(false);

  const addFiles = files => {
    const list = Array.from(files || []);
    const allowed = list.filter(file => EXTENSIONS.has(file.name.split('.').pop().toLowerCase()) && file.size > 0 && file.size <= 25 * 1024 * 1024);
    setBatchError(list.length !== allowed.length ? (list.length - allowed.length) + ' file dilewati: format, ukuran, atau file kosong.' : '');
    setBatch(current => {
      const existing = new Set(current.map(row => row.id));
      return [...current, ...allowed.filter(file => !existing.has(key(file))).map(file => ({ id: key(file), file, label: inferredLabel(file), status: 'ready', result: null, error: '' }))];
    });
  };
  const runSingle = async () => {
    if (!singleFile) return;
    setSingleError(''); setSingleResult(null); setSingleBusy(true);
    try { setSingleResult(await analyze(singleFile)); }
    catch (error) { setSingleError(String(error.message)); }
    finally { setSingleBusy(false); }
  };
  const runBatch = async () => {
    if (!batch.length) return;
    setBatchBusy(true); setBatchError(''); stop.current = false;
    for (const item of batch.filter(row => row.status !== 'done')) {
      if (stop.current) break;
      controller.current = new AbortController();
      setBatch(rows => rows.map(row => row.id === item.id ? { ...row, status: 'running', error: '' } : row));
      try {
        const result = await analyze(item.file, controller.current.signal);
        setBatch(rows => rows.map(row => row.id === item.id ? { ...row, status: 'done', result } : row));
      } catch (error) {
        if (error.name === 'AbortError') {
          setBatch(rows => rows.map(row => row.id === item.id ? { ...row, status: 'ready' } : row));
          break;
        }
        setBatch(rows => rows.map(row => row.id === item.id ? { ...row, status: 'error', error: String(error.message) } : row));
      }
    }
    controller.current = null; setBatchBusy(false);
  };
  const completed = batch.filter(row => row.status === 'done');
  const models = [...new Map(completed.flatMap(row => row.result.predictions).map(p => [p.id, p])).values()];

  return <div className="terminal-app">
    <main className="workspace">
      <h1 className="site-title">DEEPGUARD</h1>
      <div className="tabs" role="tablist" aria-label="Mode pengujian"><button role="tab" aria-selected={tab === 'single'} className={tab === 'single' ? 'active' : ''} onClick={() => setTab('single')}>01 / Satu audio</button><button role="tab" aria-selected={tab === 'batch'} className={tab === 'batch' ? 'active' : ''} onClick={() => setTab('batch')}>02 / Batch</button></div>
      {tab === 'single' ? <div className="mode-content" role="tabpanel">
        <section className="panel input-panel"><div className="single-controls">
          <label className="dropzone"><input type="file" accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { setSingleFile(e.target.files?.[0] || null); setSingleResult(null); setSingleError(''); }} /><span className="drop-icon">[ + ]</span><span className="file-choice"><strong>{singleFile?.name || 'Pilih file audio'}</strong><small>WAV · MP3 · M4A · WEBM · OGG · FLAC · maks. 25 MB</small></span></label>
          <button className="primary" disabled={!singleFile || singleBusy} onClick={runSingle}>{singleBusy ? 'Menganalisis...' : 'Analisis'}</button></div>{singleError && <div className="notice error">{singleError}</div>}</section>
        {singleResult && <Result data={singleResult} />}
      </div> : <div className="mode-content" role="tabpanel">
        <section className="panel input-panel"><div className="batch-import"><label className="import-button">Pilih banyak file<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label><label className="import-button secondary">Pilih folder REAL/FAKE<input type="file" multiple webkitdirectory="" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /></label><span>{batch.length} file</span></div>
          <p className="hint">Label opsional · folder REAL/FAKE otomatis</p>
          {!!batch.length && <><div className="queue-head"><span>ANTREAN</span><div><button disabled={batchBusy} onClick={() => setBatch(rows => rows.map(row => ({ ...row, label: 0 })))}>Semua REAL</button><button disabled={batchBusy} onClick={() => setBatch(rows => rows.map(row => ({ ...row, label: 1 })))}>Semua FAKE</button><button disabled={batchBusy} onClick={() => setBatch([])}>Kosongkan</button></div></div>
            <div className="queue-list">{batch.map(item => <div className="queue-item" key={item.id}><div className="queue-name"><strong>{item.file.name}</strong><small>{item.status === 'error' ? item.error : item.status === 'done' ? item.result.predictions.length + ' model · ' + item.result.featureGroups.length + ' kelompok fitur' : item.status === 'running' ? 'Sedang dianalisis...' : (item.file.size / 1048576).toFixed(2) + ' MB'}</small></div><select aria-label={'Label asli ' + item.file.name} value={item.label ?? ''} onChange={e => setBatch(rows => rows.map(row => row.id === item.id ? { ...row, label: e.target.value === '' ? null : Number(e.target.value) } : row))}><option value="">Tanpa label</option><option value="0">REAL</option><option value="1">FAKE</option></select><span className={'tag ' + (item.status === 'error' ? 'fake' : item.status === 'done' ? 'real' : '')}>{item.status.toUpperCase()}</span></div>)}</div>
            <div className="actions"><button className="primary" disabled={batchBusy || batch.every(row => row.status === 'done')} onClick={runBatch}>{batchBusy ? 'Memproses batch...' : 'Jalankan batch'}</button>{batchBusy && <button className="secondary-button" onClick={() => { stop.current = true; controller.current?.abort(); }}>Hentikan</button>}<span>{completed.length}/{batch.length} selesai</span></div></>}
          {batchError && <div className="notice">{batchError}</div>}</section>
        {!!completed.length && <section className="panel"><div className="table-scroll"><table><thead><tr><th>Model</th><th>File</th><th>Berlabel</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>Balanced acc.</th><th>AUC</th><th>EER</th><th>TP / FP / TN / FN</th></tr></thead><tbody>{models.map(model => { const m = batchMetrics(batch, model.id); return <tr key={model.id}><td className="model-name">{model.name}</td><td>{m.scored}/{m.attempted}</td><td>{m.labeled}</td><td>{fmt(m.accuracy)}</td><td>{fmt(m.precision)}</td><td>{fmt(m.recall)}</td><td>{fmt(m.f1)}</td><td>{fmt(m.balancedAccuracy)}</td><td>{fmt(m.auc)}</td><td>{fmt(m.eer)}</td><td>{m.tp} / {m.fp} / {m.tn} / {m.fn}</td></tr>; })}</tbody></table></div></section>}
        {!!completed.length && <section className="batch-results">{completed.map(item => <details className="file-detail" key={item.id}><summary><span>{item.file.name}</span><span>{item.label === null ? 'TANPA LABEL' : item.label ? 'FAKE' : 'REAL'} · {item.result.predictions.length} MODEL</span></summary><Result data={item.result} /></details>)}</section>}
      </div>}
    </main>
  </div>;
}

export default App;
