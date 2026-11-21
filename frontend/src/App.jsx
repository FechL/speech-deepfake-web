import { useCallback, useEffect, useRef, useState } from 'react';
import catalog from './analysisCatalog.json';
import { batchMetrics } from './metrics';
import { researchConfigs } from './researchConfigs';
import { sortRows, useTableSort } from './tableSort';
import { defaultTheme, themes } from './themes';
import readmeSource from '../../README.md?raw';
import './App.css';

const EXTENSIONS = new Set(['wav', 'mp3', 'm4a', 'webm', 'ogg', 'flac']);
const MAX_BATCH_FILES = 50;
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
const tabItems = [
  { id: 'readme', label: '00 / README.md' },
  { id: 'single', label: '01 / Single' },
  { id: 'batch-unlabeled', label: '02 / Batch Unlabeled' },
  { id: 'batch-labeled', label: '03 / Batch Labeled' },
  { id: 'configuration', label: '99 / Configuration' },
];
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

function markdownInline(source) {
  const pieces = [];
  const tokens = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let offset = 0;
  for (const match of source.matchAll(tokens)) {
    if (match.index > offset) pieces.push(source.slice(offset, match.index));
    if (match[2]) pieces.push(<a key={match.index} href={match[3]} target="_blank" rel="noopener noreferrer">{match[2]}</a>);
    else if (match[4]) pieces.push(<code key={match.index}>{match[4]}</code>);
    else pieces.push(<strong key={match.index}>{match[5]}</strong>);
    offset = match.index + match[0].length;
  }
  if (offset < source.length) pieces.push(source.slice(offset));
  return pieces;
}

function MarkdownContent({ source }) {
  const blocks = source.trim().split(/\n\s*\n/);
  return blocks.map((block, index) => {
    const heading = block.match(/^(#{1,3}) (.+)$/);
    if (heading) {
      const Heading = `h${heading[1].length}`;
      return <Heading key={index}>{markdownInline(heading[2])}</Heading>;
    }
    if (block === '---') return <hr key={index} />;
    if (block.startsWith('```')) return <pre key={index}><code>{block.replace(/^```[^\n]*\n/, '').replace(/\n```$/, '')}</code></pre>;
    const lines = block.split('\n');
    if (lines.every(line => /^- /.test(line))) return <ul key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}>{markdownInline(line.slice(2))}</li>)}</ul>;
    if (lines.every(line => /^\d+\. /.test(line))) return <ol key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}>{markdownInline(line.replace(/^\d+\. /, ''))}</li>)}</ol>;
    return <p key={index}>{markdownInline(lines.join(' '))}</p>;
  });
}

function Readme() {
  const sections = readmeSource.trim().split(/(?=^## )/m);
  const sidebarTitles = ['Repositories', 'Contributors', 'Credits and sources'];
  const titleOf = section => section.match(/^## ([^\n]+)/)?.[1];
  const main = sections.filter(section => !sidebarTitles.includes(titleOf(section)));
  return <div className="readme-layout" role="tabpanel" aria-label="README.md">
    <article className="panel readme-panel markdown-document"><MarkdownContent source={main.join('\n\n')} /></article>
    <aside className="readme-sidebar" aria-label="Project details">
      {sidebarTitles.map(title => {
        const section = sections.find(item => titleOf(item) === title);
        return section && <section className="panel readme-panel markdown-document" key={title}><MarkdownContent source={section} /></section>;
      })}
    </aside>
  </div>;
}

function Configuration({ theme, onThemeChange }) {
  return <div className="mode-content" role="tabpanel" aria-label="Configuration">
    <section className="panel readme-panel">
      <h2>Color scheme</h2>
      <p>Select a terminal palette. Your choice is saved in this browser.</p>
      <div className="theme-grid">{themes.map(item => <button type="button" key={item.id} className={'theme-option' + (theme === item.id ? ' selected' : '')} aria-pressed={theme === item.id} onClick={() => onThemeChange(item.id)}>
        <span className="theme-swatches" aria-hidden="true">{item.colors.map(color => <i key={color} style={{ backgroundColor: color }} />)}</span>
        <span>{item.name}</span><span className="theme-check" aria-hidden="true">{theme === item.id ? '✓' : ''}</span>
      </button>)}</div>
    </section>
    <section className="panel readme-panel">
      <div className="config-intro"><h2>Research parameters</h2><p>Reference settings from each research repository. These values are read-only in the web app.</p></div>
      <div className="research-config-grid">{researchConfigs.map(config => <section className="research-config-card" key={config.id}>
        <div className="research-config-head"><h3>{config.title}</h3><a href={config.url} target="_blank" rel="noopener noreferrer">{config.repo} ↗</a></div>
        <p className="config-source">Source: <code>{config.source}</code></p>
        {config.groups.map(group => <div className="config-group" key={group.title}>
          <h4>{group.title}</h4>
          <dl>{group.rows.map(([parameter, value]) => <div key={parameter}><dt>{parameter}</dt><dd>{value}</dd></div>)}</dl>
        </div>)}
      </section>)}</div>
    </section>
  </div>;
}

function NotificationCard({ item, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(item.id), 15000);
    return () => window.clearTimeout(timer);
  }, [item.id, onClose]);

  return <div className={'notification-card' + (item.type === 'error' ? ' error' : '')} role="alert">
    <span>{item.message}</span>
    <button type="button" className="notification-close" aria-label="Close notification" onClick={() => onClose(item.id)}>×</button>
  </div>;
}

function App() {
  const [tab, setTab] = useState('readme');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(true);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('deepguard-theme');
      return themes.some(item => item.id === saved) ? saved : defaultTheme;
    } catch { return defaultTheme; }
  });
  const [singleFile, setSingleFile] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [singleBusy, setSingleBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [dragSide, setDragSide] = useState(null);
  const [unlabeledBatch, setUnlabeledBatch] = useState([]);
  const [labeledBatch, setLabeledBatch] = useState([]);
  const [busyTab, setBusyTab] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const notificationId = useRef(0);
  const controller = useRef(null);
  const stop = useRef(false);
  const isLabeled = tab === 'batch-labeled';
  const batch = isLabeled ? labeledBatch : unlabeledBatch;
  const setBatch = isLabeled ? setLabeledBatch : setUnlabeledBatch;
  const batchBusy = busyTab !== null;
  const pushNotification = useCallback((message, type = 'error') => {
    const id = ++notificationId.current;
    setNotifications(current => [...current, { id, message, type }]);
  }, []);
  const dismissNotification = useCallback(id => {
    setNotifications(current => current.filter(item => item.id !== id));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('deepguard-theme', theme); } catch { /* Storage may be unavailable. */ }
  }, [theme]);

  const addFiles = useCallback((files, labeled, forcedLabel = null) => {
    const list = Array.from(files || []);
    const allowed = list.filter(validAudio);
    const seen = new Set();
    const uniqueAllowed = allowed.filter(file => { const id = key(file); if (seen.has(id)) return false; seen.add(id); return true; });
    const setRows = labeled ? setLabeledBatch : setUnlabeledBatch;
    const currentRows = labeled ? labeledBatch : unlabeledBatch;
    const currentIds = new Set(currentRows.map(row => row.id));
    const fresh = uniqueAllowed.filter(file => !currentIds.has(key(file)));
    const overflow = Math.max(0, fresh.length - Math.max(0, MAX_BATCH_FILES - currentRows.length));
    if (list.length !== allowed.length) pushNotification((list.length - allowed.length) + ' files skipped: unsupported format, size, or empty file.', 'warning');
    if (overflow) pushNotification(overflow + ' files skipped: batch limit is ' + MAX_BATCH_FILES + ' files.', 'warning');
    setRows(current => {
      const existing = new Set(current.map(row => row.id));
      const available = Math.max(0, MAX_BATCH_FILES - current.length);
      const added = uniqueAllowed.filter(file => !existing.has(key(file))).slice(0, available);
      return added.length ? [...current, ...added.map(file => ({ id: key(file), file, label: labeled ? (forcedLabel === 1 ? 1 : 0) : null, status: 'ready', result: null, error: '' }))] : current;
    });
  }, [labeledBatch, unlabeledBatch, pushNotification]);

  useEffect(() => {
    const isFileDrag = event => Array.from(event.dataTransfer?.types || []).includes('Files');
    const menuIsVisible = () => mobileMenuOpen && window.matchMedia('(max-width: 700px)').matches;
    const onDragEnter = event => { if (isFileDrag(event)) { event.preventDefault(); if (!menuIsVisible() && tab !== 'readme' && tab !== 'configuration') setDragActive(true); } };
    const onDragOver = event => { if (isFileDrag(event)) { event.preventDefault(); event.dataTransfer.dropEffect = menuIsVisible() || tab === 'readme' || tab === 'configuration' ? 'none' : 'copy'; if (!menuIsVisible() && tab !== 'readme' && tab !== 'configuration') { setDragActive(true); setDragSide(tab === 'batch-labeled' ? (event.clientX >= window.innerWidth / 2 ? 'fake' : 'real') : null); } } };
    const onDragLeave = event => { if (!event.relatedTarget) { setDragActive(false); setDragSide(null); } };
    const onDrop = event => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDragActive(false);
      setDragSide(null);
      if (menuIsVisible() || tab === 'readme' || tab === 'configuration') return;
      const files = Array.from(event.dataTransfer.files);
      if (tab !== 'single') { addFiles(files, tab === 'batch-labeled', tab === 'batch-labeled' ? Number(event.clientX >= window.innerWidth / 2) : null); return; }
      if (files.length !== 1) {
        pushNotification('Drop one audio file in Single mode, or use Batch for multiple files.');
        return;
      }
      if (!validAudio(files[0])) {
        pushNotification('Unsupported format, empty file, or file exceeds 25 MB.');
        return;
      }
      setSingleFile(files[0]);
      setSingleResult(null);
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
  }, [tab, mobileMenuOpen, addFiles, pushNotification]);

  useEffect(() => {
    if (tab === 'readme' || tab === 'configuration') { setDragActive(false); setDragSide(null); }
  }, [tab]);
  const runSingle = async () => {
    if (!singleFile) return;
    setSingleResult(null); setSingleBusy(true);
    try { setSingleResult(await analyze(singleFile)); }
    catch (error) { pushNotification(String(error.message)); }
    finally { setSingleBusy(false); }
  };
  const runBatch = async () => {
    if (!batch.length) return;
    if (batchBusy) return;
    setBusyTab(tab); stop.current = false;
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
        pushNotification(item.file.name + ': ' + String(error.message));
      }
    }
    controller.current = null; setBusyTab(null);
  };
  const completed = batch.filter(row => row.status === 'done');
  const selectTab = id => {
    setTab(id);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  return <div className="terminal-app">
    {dragActive && <div className={'page-drop-overlay' + (isLabeled ? ' labeled' : ' active')} aria-hidden="true">{isLabeled ? <><span className={dragSide === 'real' ? 'active' : ''}>DROP REAL FILES</span><span className={dragSide === 'fake' ? 'active' : ''}>DROP FAKE FILES</span></> : <span>DROP AUDIO {tab === 'single' ? 'FILE' : 'FILES'} ANYWHERE</span>}</div>}
    <main className="workspace">
      <div className="topbar">
        <h1 className="site-title">DEEPFORENSIC</h1>
        <div className="credits"><a href="https://github.com/FechL" target="_blank" rel="noopener noreferrer">FechL</a><span aria-hidden="true">·</span><a href="https://github.com/alvinrw" target="_blank" rel="noopener noreferrer">alvinrw</a></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Analysis mode">{tabItems.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} className={(item.id === 'configuration' ? 'configuration-tab ' : '') + (tab === item.id ? 'active' : '')} onClick={() => selectTab(item.id)}>{item.label}</button>)}</div>
      <nav className={'mobile-menu' + (mobileMenuOpen ? '' : ' mobile-hidden')} aria-label="Pages">
        {tabItems.map(item => <button type="button" key={item.id} onClick={() => selectTab(item.id)}><span>{item.label}</span><span aria-hidden="true">→</span></button>)}
      </nav>
      <div className={'mobile-page' + (mobileMenuOpen ? ' mobile-hidden' : '')}>
      <div className="mobile-page-nav"><button type="button" onClick={() => { setMobileMenuOpen(true); setDragActive(false); setDragSide(null); window.scrollTo(0, 0); }}>← Menu</button><span>{tabItems.find(item => item.id === tab)?.label}</span></div>
      {tab === 'readme' ? <Readme /> : tab === 'configuration' ? <Configuration theme={theme} onThemeChange={setTheme} /> : tab === 'single' ? <div className="mode-content" role="tabpanel">
        <section className="panel input-panel"><div className="single-controls">
          <label className="import-button">Choose file<input type="file" accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { setSingleFile(e.target.files?.[0] || null); setSingleResult(null); e.target.value = ''; }} /></label>
          {singleFile ? <div className="single-file"><div className="queue-name"><strong title={singleFile.name}>{singleFile.name}</strong><small>{(singleFile.size / 1048576).toFixed(2)} MB</small></div><AudioPlayer key={key(singleFile)} file={singleFile} /></div> : <div className="dropzone"><span className="drop-icon">[ + ]</span><span className="file-choice"><strong>Drop audio here</strong><small>WAV · MP3 · M4A · WEBM · OGG · FLAC · max. 25 MB</small></span></div>}
          {singleFile && <><button className="primary" disabled={singleBusy} onClick={runSingle}>{singleBusy ? 'Running...' : 'Run'}</button><button className="secondary-button" disabled={singleBusy} onClick={() => { setSingleFile(null); setSingleResult(null); }}>Clear</button></>}</div></section>
        <Result data={singleResult} />
      </div> : <div className="mode-content" role="tabpanel">
        <section className="panel input-panel"><div className="batch-import">
          {!isLabeled ? <><label className="import-button">Choose files<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files, false); e.target.value = ''; }} /></label><span>{batch.length}/{MAX_BATCH_FILES} files</span></> : <>
            <label className="import-button">Choose REAL files<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files, true, 0); e.target.value = ''; }} /></label>
            <label className="import-button">Choose FAKE files<input type="file" multiple accept=".wav,.mp3,.m4a,.webm,.ogg,.flac" onChange={e => { addFiles(e.target.files, true, 1); e.target.value = ''; }} /></label>
            <span>{batch.length}/{MAX_BATCH_FILES} files</span>
          </>}</div>
          {!!batch.length && <><div className="queue-head"><span>QUEUE</span><div>{isLabeled && <><button disabled={batchBusy} onClick={() => setBatch(rows => rows.map(row => ({ ...row, label: 0 })))}>All REAL</button><button disabled={batchBusy} onClick={() => setBatch(rows => rows.map(row => ({ ...row, label: 1 })))}>All FAKE</button></>}<button disabled={batchBusy} onClick={() => setBatch([])}>Clear</button></div></div>
            <div className="queue-list" tabIndex="0">{batch.map(item => <div className="queue-item" key={item.id}><div className="queue-name"><strong>{item.file.name}</strong><small>{item.status === 'error' ? item.error : item.status === 'done' ? item.result.predictions.length + ' models · ' + item.result.featureGroups.length + ' feature groups' : item.status === 'running' ? 'Analyzing...' : (item.file.size / 1048576).toFixed(2) + ' MB'}</small></div><AudioPlayer file={item.file} compact />{isLabeled && <select aria-label={'Ground truth label for ' + item.file.name} disabled={batchBusy} value={item.label ?? 0} onChange={e => setBatch(rows => rows.map(row => row.id === item.id ? { ...row, label: Number(e.target.value) } : row))}><option value="0">REAL</option><option value="1">FAKE</option></select>}<span className={'tag ' + (item.status === 'error' ? 'fake' : item.status === 'done' ? 'real' : '')}>{item.status.toUpperCase()}</span></div>)}</div>
            <div className="actions"><button className="primary" disabled={batchBusy || batch.every(row => row.status === 'done')} onClick={runBatch}>{busyTab === tab ? 'Processing batch...' : 'Run batch'}</button>{batchBusy && <button className="secondary-button" onClick={() => { stop.current = true; controller.current?.abort(); }}>Stop</button>}<span>{completed.length}/{batch.length} completed</span></div>
          </>}
        </section>
        <section className="panel">{isLabeled ? <BatchMetricsTable batch={batch} /> : <UnlabeledMetricsTable batch={batch} />}</section>
        {!!completed.length && <section className="batch-results">{completed.map(item => <details className="file-detail" key={item.id}><summary><span>{item.file.name}</span><span>{item.label === null ? 'UNLABELED' : item.label ? 'FAKE' : 'REAL'} · {item.result.predictions.length} MODELS</span></summary><Result data={item.result} /></details>)}</section>}
      </div>}
      </div>
    </main>
    {!!notifications.length && <div className="notification-stack" aria-label="Notifications">
      {notifications.slice().reverse().map(item => <NotificationCard key={item.id} item={item} onClose={dismissNotification} />)}
    </div>}
  </div>;
}

export default App;
