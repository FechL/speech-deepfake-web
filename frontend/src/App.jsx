import { useCallback, useEffect, useRef, useState } from 'react';
import catalog from './analysisCatalog.json';
import { batchMetrics } from './metrics';
import { sortRows, useTableSort } from './tableSort';
import { defaultTheme, themes } from './themes';
import './App.css';

const EXTENSIONS = new Set(['wav', 'mp3', 'm4a', 'webm', 'ogg', 'flac']);
const validAudio = file => EXTENSIONS.has(file.name.split('.').pop().toLowerCase()) && file.size > 0 && file.size <= 25 * 1024 * 1024;
const fmt = value => value === null || value === undefined ? '—' : (value * 100).toFixed(1) + '%';
const num = value => value === null || value === undefined || !Number.isFinite(value) ? '—' : Number(value).toFixed(4);
const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const key = file => (file.webkitRelativePath || file.name) + ':' + file.size + ':' + file.lastModified;
const groupTitles = {
  modulation: 'Modulation spectrum',
  glottal_g0: 'Glottal G0 · Prosody',
  glottal_g1: 'Glottal G1 · Perturbation & HNR',
  glottal_g2: 'Glottal G2 · Harmonics',
  glottal_qc: 'Glottal measurement quality',
};
const englishGroup = group => ({ ...group, title: groupTitles[group.id] || group.title });
const modelRows = catalog.models.map(model => ({ ...model, score: null, prediction: null, confidence: null }));
const featureGroups = catalog.featureGroups.map(group => ({ id: group.id, title: groupTitles[group.id] || group.title, values: group.names.map(name => ({ name, value: null })) }));
const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

async function analyze(file, signal) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(apiBase + '/api/analyze', { method: 'POST', body: form, signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status !== 'success') {
    const detail = data.detail;
    const message = data.message || (Array.isArray(detail) ? detail[0]?.message : detail) || data.errors?.[0]?.message;
    if (!message && [502, 503, 504].includes(response.status)) {
      throw new Error('Analysis service is unavailable. Start the backend on port 5001, then try again.');
    }
    throw new Error(message || 'Analysis failed (HTTP ' + response.status + ')');
  }
  return data;
}

function SortHeader({ label, column, sort, onSort, title }) {
  const direction = sort.key === column ? sort.direction : null;
  return <th scope="col" aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
    <button type="button" className="sort-header" title={title} onClick={() => onSort(column)}>{label}{direction && <span className="sort-indicator" aria-hidden="true">{direction === 'asc' ? '↑' : '↓'}</span>}</button>
  </th>;
}

function FeatureTable({ groups }) {
  const [groupId, setGroupId] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, selectSort] = useTableSort('group');
  const rows = groups.flatMap(group => groupId === 'all' || group.id === groupId
    ? group.values.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(item => ({ ...item, group: group.title }))
    : []);
  const sortedRows = sortRows(rows, sort, (row, column) => row[column]);
  return <>
    <div className="feature-tools">
      <select aria-label="Feature group" value={groupId} onChange={e => setGroupId(e.target.value)}>
        <option value="all">All features · {groups.reduce((n, group) => n + group.values.length, 0)}</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.title} · {group.values.length}</option>)}
      </select>
      <input type="search" aria-label="Search features" placeholder="Search features..." value={query} onChange={e => setQuery(e.target.value)} />
    </div>
    <div className="table-scroll feature-scroll"><table><thead><tr><SortHeader label="Group" column="group" sort={sort} onSort={selectSort} /><SortHeader label="Feature name" column="name" sort={sort} onSort={selectSort} /><SortHeader label="Value" column="value" sort={sort} onSort={selectSort} /></tr></thead>
      <tbody>{sortedRows.map((item, i) => <tr key={item.group + item.name + i}><td>{item.group}</td><td className="mono">{item.name}</td><td className="mono">{num(item.value)}</td></tr>)}
        {!rows.length && <tr><td colSpan="3">No matching features.</td></tr>}</tbody></table></div>
  </>;
}

function Predictions({ predictions }) {
  const [sort, selectSort] = useTableSort('name');
  const sortedPredictions = sortRows(predictions, sort, (row, column) => row[column]);
  return <div className="table-scroll model-table"><table><thead><tr><SortHeader label="Model" column="name" sort={sort} onSort={selectSort} /><SortHeader label="Features" column="feature_count" sort={sort} onSort={selectSort} /><SortHeader label="P(fake)" column="score" sort={sort} onSort={selectSort} /><SortHeader label="Threshold" column="threshold" sort={sort} onSort={selectSort} /><SortHeader label="Decision" column="prediction" sort={sort} onSort={selectSort} /><SortHeader label="Confidence" column="confidence" sort={sort} onSort={selectSort} title="Model class probability; not calibrated as forensic certainty." /></tr></thead>
    <tbody>{sortedPredictions.map(p => <tr key={p.id}>
      <td className="model-name">{p.name}</td><td>{p.feature_count}</td><td className="mono">{fmt(p.score)}</td><td className="mono">{fmt(p.threshold)}</td>
      <td>{p.prediction ? <span className={'tag ' + (p.prediction === 'FAKE' ? 'fake' : 'real')}>{p.prediction}</span> : '—'}</td><td className="mono">{fmt(p.confidence)}</td>
    </tr>)}</tbody></table></div>;
}

function BatchMetricsTable({ batch }) {
  const [sort, selectSort] = useTableSort('name');
  const rows = modelRows.map(model => ({ model, metrics: batchMetrics(batch, model.id) }));
  const sortedRows = sortRows(rows, sort, (row, column) => {
    if (column === 'name') return row.model.name;
    if (column === 'files') return row.metrics.scored;
    if (column === 'confusion') return row.metrics.labeled ? row.metrics.tp : null;
    return row.metrics[column];
  });
  const columns = [
    ['Model', 'name'], ['Files', 'files'], ['Labeled', 'labeled'],
    ['Accuracy', 'accuracy'], ['Precision', 'precision'], ['Recall', 'recall'],
    ['F1', 'f1'], ['Balanced acc.', 'balancedAccuracy'], ['AUC', 'auc'],
    ['EER', 'eer'], ['TP / FP / TN / FN', 'confusion'],
  ];
  return <div className="table-scroll model-table"><table><thead><tr>{columns.map(([label, column]) => <SortHeader key={column} label={label} column={column} sort={sort} onSort={selectSort} />)}</tr></thead>
    <tbody>{sortedRows.map(({ model, metrics: m }) => <tr key={model.id}>
      <td className="model-name">{model.name}</td><td>{m.scored}/{m.attempted}</td><td>{m.labeled}</td>
      <td>{fmt(m.accuracy)}</td><td>{fmt(m.precision)}</td><td>{fmt(m.recall)}</td><td>{fmt(m.f1)}</td>
      <td>{fmt(m.balancedAccuracy)}</td><td>{fmt(m.auc)}</td><td>{fmt(m.eer)}</td>
      <td>{m.labeled ? `${m.tp} / ${m.fp} / ${m.tn} / ${m.fn}` : '—'}</td>
    </tr>)}</tbody></table></div>;
}

function UnlabeledMetricsTable({ batch }) {
  const [sort, selectSort] = useTableSort('name');
  const rows = modelRows.map(model => {
    const predictions = batch.flatMap(item => {
      const prediction = item.result?.predictions?.find(row => row.id === model.id);
      return prediction ? [prediction] : [];
    });
    const average = column => {
      const values = predictions.map(row => row[column]).filter(Number.isFinite);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    return {
      id: model.id, name: model.name, files: predictions.length, attempted: batch.length,
      real: predictions.filter(row => row.prediction === 'REAL').length,
      fake: predictions.filter(row => row.prediction === 'FAKE').length,
      avgScore: average('score'), avgConfidence: average('confidence'),
    };
  });
  const sortedRows = sortRows(rows, sort, (row, column) => row[column]);
  const columns = [['Model', 'name'], ['Files', 'files'], ['Pred REAL', 'real'], ['Pred FAKE', 'fake'], ['Avg P(fake)', 'avgScore'], ['Avg confidence', 'avgConfidence']];
  return <div className="table-scroll model-table"><table><thead><tr>{columns.map(([label, column]) => <SortHeader key={column} label={label} column={column} sort={sort} onSort={selectSort} />)}</tr></thead>
    <tbody>{sortedRows.map(row => <tr key={row.id}><td className="model-name">{row.name}</td><td>{row.files}/{row.attempted}</td><td>{row.real}</td><td>{row.fake}</td><td>{fmt(row.avgScore)}</td><td>{fmt(row.avgConfidence)}</td></tr>)}</tbody></table></div>;
}

function Result({ data }) {
  const reportedModels = new Map(data?.predictions?.map(model => [model.id, model]) || []);
  const reportedGroups = new Map(data?.featureGroups?.map(group => [group.id, group]) || []);
  const predictions = modelRows.map(model => ({ ...model, ...reportedModels.get(model.id) }));
  const groups = featureGroups.map(group => englishGroup(reportedGroups.get(group.id) || group));
  return <div className="result-stack">
    {data?.errors?.length > 0 && <div className="notice">{data.errors.map((error, i) => <div key={i}>{error.source}: {error.message}</div>)}</div>}
    <section className="panel"><Predictions predictions={predictions} /></section>
    <section className="panel"><FeatureTable groups={groups} /></section>
  </div>;
}

function AudioPlayer({ file, compact = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.load();
    return () => { audio.pause(); URL.revokeObjectURL(url); };
  }, [file]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (audio.paused) {
      try { await audio.play(); } catch { setPlaying(false); }
    } else audio.pause();
  };

  return <div className={'playback-controls' + (compact ? ' queue-playback' : '')}>
    <audio ref={audioRef} preload="metadata" onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    <button type="button" className="playback-toggle" aria-label={(playing ? 'Pause ' : 'Play ') + file.name} onClick={toggle}>{playing ? 'Ⅱ' : '▶'}</button>
    <input type="range" className="playback-seek" aria-label={'Seek ' + file.name} min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={e => { audioRef.current.currentTime = Number(e.target.value); setCurrentTime(Number(e.target.value)); }} />
    <span className="playback-time">{time(currentTime)} / {time(duration)}</span>
  </div>;
}

function App() {
  const [tab, setTab] = useState('single');
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('deepguard-theme');
      return themes.some(item => item.id === saved) ? saved : defaultTheme;
    } catch { return defaultTheme; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const [singleFile, setSingleFile] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [singleError, setSingleError] = useState('');
  const [singleBusy, setSingleBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [dragSide, setDragSide] = useState(null);
  const [unlabeledBatch, setUnlabeledBatch] = useState([]);
  const [labeledBatch, setLabeledBatch] = useState([]);
  const [busyTab, setBusyTab] = useState(null);
  const [unlabeledError, setUnlabeledError] = useState('');
  const [labeledError, setLabeledError] = useState('');
  const controller = useRef(null);
  const stop = useRef(false);
  const isLabeled = tab === 'batch-labeled';
  const batch = isLabeled ? labeledBatch : unlabeledBatch;
  const setBatch = isLabeled ? setLabeledBatch : setUnlabeledBatch;
  const batchError = isLabeled ? labeledError : unlabeledError;
  const setBatchError = isLabeled ? setLabeledError : setUnlabeledError;
  const batchBusy = busyTab !== null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('deepguard-theme', theme); } catch { /* Storage may be unavailable. */ }
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    const closeOutside = event => { if (!settingsRef.current?.contains(event.target)) setSettingsOpen(false); };
    const closeEscape = event => { if (event.key === 'Escape') setSettingsOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [settingsOpen]);

  const addFiles = useCallback((files, labeled, forcedLabel = null) => {
    const list = Array.from(files || []);
    const allowed = list.filter(validAudio);
    const setError = labeled ? setLabeledError : setUnlabeledError;
    const setRows = labeled ? setLabeledBatch : setUnlabeledBatch;
    setError(list.length !== allowed.length ? (list.length - allowed.length) + ' files skipped: unsupported format, size, or empty file.' : '');
    setRows(current => {
      const existing = new Set(current.map(row => row.id));
      return [...current, ...allowed.filter(file => !existing.has(key(file))).map(file => ({ id: key(file), file, label: labeled ? (forcedLabel === 1 ? 1 : 0) : null, status: 'ready', result: null, error: '' }))];
    });
  }, []);

  useEffect(() => {
    const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files');
    const onDragEnter = event => { if (isFileDrag(event)) { event.preventDefault(); setDragActive(true); } };
    const onDragOver = event => { if (isFileDrag(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragActive(true); setDragSide(tab === 'batch-labeled' ? (event.clientX >= window.innerWidth / 2 ? 'fake' : 'real') : null); } };
    const onDragLeave = event => { if (!event.relatedTarget) { setDragActive(false); setDragSide(null); } };
    const onDrop = event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDragActive(false);
      setDragSide(null);
      const files = Array.from(event.dataTransfer.files);
      if (tab !== 'single') { addFiles(files, tab === 'batch-labeled', tab === 'batch-labeled' ? Number(event.clientX >= window.innerWidth / 2) : null); return; }
      if (files.length !== 1) {
        setSingleError('Drop one audio file in Single mode, or use Batch for multiple files.');
        return;
      }
      if (!validAudio(files[0])) {
        setSingleError('Unsupported format, empty file, or file exceeds 25 MB.');
        return;
      }
      setSingleFile(files[0]);
      setSingleResult(null);
      setSingleError('');
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [tab, addFiles]);
  const runSingle = async () => {
    if (!singleFile) return;
    setSingleError(''); setSingleResult(null); setSingleBusy(true);
    try { setSingleResult(await analyze(singleFile)); }
    catch (error) { setSingleError(String(error.message)); }
    finally { setSingleBusy(false); }
  };
  const runBatch = async () => {
    if (!batch.length) return;
    if (batchBusy) return;
    setBusyTab(tab); setBatchError(''); stop.current = false;
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
    controller.current = null; setBusyTab(null);
  };
  const completed = batch.filter(row => row.status === 'done');

  return <div className="terminal-app">
    {dragActive && <div className={'page-drop-overlay' + (isLabeled ? ' labeled' : ' active')} aria-hidden="true">{isLabeled ? <><span className={dragSide === 'real' ? 'active' : ''}>DROP REAL FILES</span><span className={dragSide === 'fake' ? 'active' : ''}>DROP FAKE FILES</span></> : <span>DROP AUDIO {tab === 'single' ? 'FILE' : 'FILES'} ANYWHERE</span>}</div>}
    <main className="workspace">
      <div className="topbar">
        <h1 className="site-title">DEEPGUARD</h1>
        <div className="settings" ref={settingsRef}>
          <button type="button" className="settings-toggle" aria-label="Choose color scheme" aria-expanded={settingsOpen} aria-controls="theme-menu" onClick={() => setSettingsOpen(open => !open)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20h1.1a2.9 2.9 0 0 0 2.9-2.9c0-.7-.3-1.4-.8-1.9a2.4 2.4 0 0 1-.7-1.7 2.5 2.5 0 0 1 2.5-2.5h1A4 4 0 0 0 22 9a10 10 0 0 0-10-7Z" /><circle cx="7.5" cy="11" r=".8" fill="currentColor" stroke="none" /><circle cx="10" cy="6.8" r=".8" fill="currentColor" stroke="none" /><circle cx="15" cy="7.2" r=".8" fill="currentColor" stroke="none" /><circle cx="18" cy="10.5" r=".8" fill="currentColor" stroke="none" /></svg>
          </button>
          {settingsOpen && <div className="theme-menu" id="theme-menu" aria-label="Color scheme">
            <div className="theme-menu-title">COLOR SCHEME</div>
            {themes.map(item => <button type="button" key={item.id} className={'theme-option' + (theme === item.id ? ' selected' : '')} aria-pressed={theme === item.id} onClick={() => { setTheme(item.id); setSettingsOpen(false); }}>
              <span className="theme-swatches" aria-hidden="true">{item.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>
              <span>{item.name}</span><span className="theme-check" aria-hidden="true">{theme === item.id ? '✓' : ''}</span>
            </button>)}
          </div>}
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Analysis mode"><button role="tab" aria-selected={tab === 'single'} className={tab === 'single' ? 'active' : ''} onClick={() => setTab('single')}>01 / Single</button><button role="tab" aria-selected={tab === 'batch-unlabeled'} className={tab === 'batch-unlabeled' ? 'active' : ''} onClick={() => setTab('batch-unlabeled')}>02 / Batch Unlabeled</button><button role="tab" aria-selected={tab === 'batch-labeled'} className={tab === 'batch-labeled' ? 'active' : ''} onClick={() => setTab('batch-labeled')}>03 / Batch Labeled</button></div>
      {tab === 'single' ? <div className="mode-content" role="tabpanel">
        <section className="panel input-panel"><div className="single-controls">
          <label className="import-button">Choose file<input type="file" accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { setSingleFile(e.target.files?.[0] || null); setSingleResult(null); setSingleError(''); e.target.value = ''; }} /></label>
          {singleFile ? <div className="single-file"><div className="queue-name"><strong title={singleFile.name}>{singleFile.name}</strong><small>{(singleFile.size / 1048576).toFixed(2)} MB</small></div><AudioPlayer key={key(singleFile)} file={singleFile} /></div> : <div className="dropzone"><span className="drop-icon">[ + ]</span><span className="file-choice"><strong>Drop audio here</strong><small>WAV · MP3 · M4A · WEBM · OGG · FLAC · max. 25 MB</small></span></div>}
          {singleFile && <><button className="primary" disabled={singleBusy} onClick={runSingle}>{singleBusy ? 'Running...' : 'Run'}</button><button className="secondary-button" disabled={singleBusy} onClick={() => { setSingleFile(null); setSingleResult(null); setSingleError(''); }}>Clear</button></>}</div>{singleError && <div className="notice error">{singleError}</div>}</section>
        <Result data={singleResult} />
      </div> : <div className="mode-content" role="tabpanel">
        <section className="panel input-panel"><div className="batch-import">
          {!isLabeled ? <><label className="import-button">Choose files<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files, false); e.target.value = ''; }} /></label><span>{batch.length} files</span></> : <>
            <label className="import-button">Choose REAL files<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files, true, 0); e.target.value = ''; }} /></label>
            <label className="import-button">Choose FAKE files<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files, true, 1); e.target.value = ''; }} /></label>
            <span>{batch.length} files</span>
          </>}</div>
          {!!batch.length && <><div className="queue-head"><span>QUEUE</span><div>{isLabeled && <><button disabled={batchBusy} onClick={() => setBatch(rows => rows.map(row => ({ ...row, label: 0 })))}>All REAL</button><button disabled={batchBusy} onClick={() => setBatch(rows => rows.map(row => ({ ...row, label: 1 })))}>All FAKE</button></>}<button disabled={batchBusy} onClick={() => setBatch([])}>Clear</button></div></div>
            <div className="queue-list" tabIndex="0">{batch.map(item => <div className="queue-item" key={item.id}><div className="queue-name"><strong>{item.file.name}</strong><small>{item.status === 'error' ? item.error : item.status === 'done' ? item.result.predictions.length + ' models · ' + item.result.featureGroups.length + ' feature groups' : item.status === 'running' ? 'Analyzing...' : (item.file.size / 1048576).toFixed(2) + ' MB'}</small></div><AudioPlayer file={item.file} compact />{isLabeled && <select aria-label={'Ground truth label for ' + item.file.name} disabled={batchBusy} value={item.label ?? 0} onChange={e => setBatch(rows => rows.map(row => row.id === item.id ? { ...row, label: Number(e.target.value) } : row))}><option value="0">REAL</option><option value="1">FAKE</option></select>}<span className={'tag ' + (item.status === 'error' ? 'fake' : item.status === 'done' ? 'real' : '')}>{item.status.toUpperCase()}</span></div>)}</div>
            <div className="actions"><button className="primary" disabled={batchBusy || batch.every(row => row.status === 'done')} onClick={runBatch}>{busyTab === tab ? 'Processing batch...' : 'Run batch'}</button>{batchBusy && <button className="secondary-button" onClick={() => { stop.current = true; controller.current?.abort(); }}>Stop</button>}<span>{completed.length}/{batch.length} completed</span></div>
            </>}
          {batchError && <div className="notice">{batchError}</div>}</section>
        <section className="panel">{isLabeled ? <BatchMetricsTable batch={batch} /> : <UnlabeledMetricsTable batch={batch} />}</section>
        {!!completed.length && <section className="batch-results">{completed.map(item => <details className="file-detail" key={item.id}><summary><span>{item.file.name}</span><span>{item.label === null ? 'UNLABELED' : item.label ? 'FAKE' : 'REAL'} · {item.result.predictions.length} MODELS</span></summary><Result data={item.result} /></details>)}</section>}
      </div>}
    </main>
  </div>;
}

export default App;
