import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './index.css';

const API = 'http://localhost:3000/api';

// ─── Icons (inline SVGs to avoid extra deps) ───
const Icons = {
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  graph: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" /></svg>,
  files: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  terminal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
};

type Tab = 'overview' | 'graph' | 'memory' | 'tasks' | 'rules' | 'settings';

interface GraphData { nodes: { id: number; label: string; path: string }[]; links: { source: number; target: number }[]; }

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState({ files: 0, symbols: 0, tasks: 0, rules: 0, stale: 0 });
  const [tasks, setTasks] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [memory, setMemory] = useState<any[]>([]);
  const [graph, setGraph] = useState<GraphData>({ nodes: [], links: [] });
  const [config, setConfig] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [s, t, r, m, g, c] = await Promise.all([
        fetch(`${API}/stats`).then(res => res.json()),
        fetch(`${API}/tasks`).then(res => res.json()),
        fetch(`${API}/rules`).then(res => res.json()),
        fetch(`${API}/memory`).then(res => res.json()),
        fetch(`${API}/graph`).then(res => res.json()).catch(() => ({ nodes: [], links: [] })),
        fetch(`${API}/config`).then(res => res.ok ? res.json() : null).catch(() => null),
      ]);
      setStats(s); setTasks(t); setRules(r); setMemory(m); setGraph(g); setConfig(c);
    } catch (e) { console.error('API fetch failed:', e); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  const navItems: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'overview', label: 'Overview', icon: Icons.grid },
    { id: 'graph', label: 'Dependency Graph', icon: Icons.graph },
    { id: 'memory', label: 'Files', icon: Icons.files },
    { id: 'tasks', label: 'Tasks', icon: Icons.terminal },
    { id: 'rules', label: 'Rules', icon: Icons.shield },
    { id: 'settings', label: 'Settings', icon: Icons.settings },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">K</div>
          <h1>Kiteretsu</h1>
        </div>
        <nav className="nav-items">
          {navItems.map(n => (
            <button key={n.id} className={`nav-btn ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {tab === 'overview' && <OverviewTab stats={stats} tasks={tasks} rules={rules} edges={graph.links.length} />}
        {tab === 'graph' && <GraphTab graph={graph} />}
        {tab === 'memory' && <MemoryTab memory={memory} />}
        {tab === 'tasks' && <TasksTab tasks={tasks} onReload={load} />}
        {tab === 'rules' && <RulesTab rules={rules} onReload={load} />}
        {tab === 'settings' && <SettingsTab config={config} />}
      </main>
    </div>
  );
}

// ─── Overview ───
function OverviewTab({ stats, tasks, rules, edges }: any) {
  return (
    <div>
      <div className="page-header">
        <h2>Overview</h2>
        <p>Codebase intelligence at a glance</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="label">Files</div><div className="value">{stats.files}</div></div>
        <div className="stat-card"><div className="label">Symbols</div><div className="value">{stats.symbols}</div></div>
        <div className="stat-card"><div className="label">Dependencies</div><div className="value">{edges}</div></div>
        <div className="stat-card"><div className="label">Rules</div><div className="value">{stats.rules}</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Recent Tasks</h3>
            <span className="badge">{tasks.length}</span>
          </div>
          <div className="card-body">
            {tasks.length > 0 ? tasks.slice(0, 5).map((t: any) => (
              <div key={t.id} className="list-item">
                <div className={`dot ${t.outcome === 'success' ? 'success' : 'danger'}`} />
                <div className="content">
                  <div className="title">{t.description}</div>
                  <div className="meta">{t.type} · {t.outcome}</div>
                </div>
              </div>
            )) : <div className="empty">No tasks recorded yet</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Active Rules</h3>
            <span className="badge">{rules.length}</span>
          </div>
          <div className="card-body">
            {rules.length > 0 ? rules.slice(0, 5).map((r: any) => (
              <div key={r.id} className="list-item">
                <div className="content">
                  <div className="title" style={{ color: '#6366f1' }}>{r.name}</div>
                  <div className="meta">{r.description}</div>
                </div>
                <span className="tag warning">{r.severity || 'info'}</span>
              </div>
            )) : <div className="empty">No rules recorded yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dependency Graph (Canvas-based force layout) ───
function GraphTab({ graph }: { graph: GraphData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<any[]>([]);
  const hoveredNodeRef = useRef<any>(null);
  const dragNodeRef = useRef<any>(null);

  // State only for UI overlays (Tooltips)
  const [tooltipNode, setTooltipNode] = useState<any>(null);

  const impactMap = useMemo(() => {
    const counts: Record<number, number> = {};
    graph.nodes.forEach(n => counts[n.id] = 0);
    graph.links.forEach(l => {
      counts[l.source] = (counts[l.source] || 0) + 1;
      counts[l.target] = (counts[l.target] || 0) + 1;
    });
    return counts;
  }, [graph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const nodes = nodesRef.current;
    const links = graph.links;

    // Physics step
    for (let i = 0; i < 3; i++) {
      for (const node of nodes) {
        // ATOMIC LOCK: Check refs directly for zero-latency freezing
        if (node === dragNodeRef.current || node === hoveredNodeRef.current) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        // Repulsion
        for (const other of nodes) {
          if (node.id === other.id) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distSq = dx * dx + dy * dy || 1;
          const force = 600 / distSq;
          node.vx += (dx / Math.sqrt(distSq)) * force;
          node.vy += (dy / Math.sqrt(distSq)) * force;
        }

        // Center gravity
        node.vx += (W / 2 - node.x) * 0.005;
        node.vy += (H / 2 - node.y) * 0.005;
      }

      // Attraction
      for (const link of links) {
        const a = nodes.find(n => n.id === link.source);
        const b = nodes.find(n => n.id === link.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 140) * 0.015;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a !== dragNodeRef.current && a !== hoveredNodeRef.current) { a.vx += fx; a.vy += fy; }
        if (b !== dragNodeRef.current && b !== hoveredNodeRef.current) { b.vx -= fx; b.vy -= fy; }
      }

      for (const node of nodes) {
        node.vx *= 0.8;
        node.vy *= 0.8;
        node.x += node.vx;
        node.y += node.vy;
      }
    }

    // Draw
    ctx.clearRect(0, 0, W, H);

    links.forEach(link => {
      const a = nodes.find(n => n.id === link.source);
      const b = nodes.find(n => n.id === link.target);
      if (!a || !b) return;

      const isRelated = hoveredNodeRef.current && (link.source === hoveredNodeRef.current.id || link.target === hoveredNodeRef.current.id);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = isRelated ? 2 : 1;
      ctx.strokeStyle = isRelated ? '#6366f1' : 'rgba(99, 102, 241, 0.1)';
      ctx.stroke();
    });

    nodes.forEach(node => {
      const impact = impactMap[node.id] || 0;
      const radius = 10 + Math.min(impact * 2, 25);
      const isHovered = hoveredNodeRef.current?.id === node.id;
      const isRelated = hoveredNodeRef.current && (graph.links.some(l => (l.source === hoveredNodeRef.current.id && l.target === node.id) || (l.target === hoveredNodeRef.current.id && l.source === node.id)));

      if (isHovered || impact > 5) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#6366f1';
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered || isRelated ? '#6366f1' : '#1e1e22';
      ctx.fill();
      ctx.strokeStyle = isHovered || isRelated ? '#fff' : '#6366f1';
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (isHovered || isRelated || impact > 3 || nodes.length < 15) {
        ctx.fillStyle = isHovered ? '#fff' : '#a1a1aa';
        ctx.font = `${isHovered ? 'bold ' : ''}12px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + radius + 18);
      }
    });

    animRef.current = requestAnimationFrame(draw);
  }, [graph, impactMap]);

  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 500 * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);

    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    nodesRef.current = graph.nodes.map((n, i) => ({
      ...n,
      x: logicalW / 4 + Math.random() * (logicalW / 2),
      y: logicalH / 4 + Math.random() * (logicalH / 2),
      vx: 0,
      vy: 0,
    }));

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [graph, draw]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragNodeRef.current) {
      dragNodeRef.current.x = x;
      dragNodeRef.current.y = y;
      return;
    }

    const hit = nodesRef.current.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 25; // Increased capture radius
    });

    hoveredNodeRef.current = hit || null;
    setTooltipNode(hit || null); // Update state only for UI overlay
  };

  const handleMouseDown = () => {
    if (hoveredNodeRef.current) dragNodeRef.current = hoveredNodeRef.current;
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
  };

  return (
    <div ref={containerRef}>
      <div className="page-header">
        <h2>Impact Analysis Graph</h2>
        <p>Interactive dependency visualization · {graph.nodes.length} nodes · {graph.links.length} edges</p>
      </div>

      <div className="graph-card" style={{ position: 'relative', overflow: 'hidden', background: '#09090b', borderRadius: '12px', border: '1px solid #27272a' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 500, cursor: tooltipNode ? 'grab' : 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { hoveredNodeRef.current = null; dragNodeRef.current = null; setTooltipNode(null); }}
        />

        {tooltipNode && (
          <div className="graph-tooltip" style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(24, 24, 27, 0.9)', padding: '12px', borderRadius: '8px', border: '1px solid #6366f1', backdropFilter: 'blur(8px)', pointerEvents: 'none', maxWidth: '240px' }}>
            <div style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{tooltipNode.label}</div>
            <div style={{ color: '#a1a1aa', fontSize: '11px', wordBreak: 'break-all' }}>{tooltipNode.path}</div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              <span className="tag info">{impactMap[tooltipNode.id]} Connections</span>
            </div>
          </div>
        )}

        <div className="graph-controls" style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: '#52525b', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }} /> God Node
          </div>
          <div style={{ fontSize: '11px', color: '#52525b', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27272a', border: '1px solid #6366f1' }} /> Module
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Files / Memory ───
function MemoryTab({ memory }: any) {
  return (
    <div>
      <div className="page-header">
        <h2>Indexed Files</h2>
        <p>{memory.length} files in memory</p>
      </div>
      <div className="file-grid">
        {memory.map((f: any) => (
          <div key={f.id} className="file-item">
            <div className="path">{f.path}</div>
            {f.symbols && f.symbols.length > 0 && (
              <div className="symbols">
                {f.symbols.slice(0, 8).map((s: any, i: number) => (
                  <span key={i} className="sym"><span className="type">{s.type[0].toUpperCase()}</span>{s.name}</span>
                ))}
                {f.symbols.length > 8 && <span className="sym" style={{ color: '#52525b' }}>+{f.symbols.length - 8}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tasks ───
function TasksTab({ tasks, onReload }: any) {
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('feature');
  const [outcome, setOutcome] = useState('success');
  const [notes, setNotes] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, type, outcome, notes })
    });
    setDesc(''); setNotes('');
    onReload();
  };

  const remove = async (id: number) => {
    await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    onReload();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Task History</h2>
        <p>{tasks.length} recorded outcomes</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Record Task</h3></div>
        <div className="card-body">
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Task Description" value={desc} onChange={e => setDesc(e.target.value)} required className="form-input" />
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={type} onChange={e => setType(e.target.value)} className="form-input" style={{ flex: 1 }}>
                <option value="feature">Feature</option>
                <option value="bugfix">Bugfix</option>
                <option value="refactor">Refactor</option>
                <option value="chore">Chore</option>
                <option value="unknown">Unknown</option>
              </select>
              <select value={outcome} onChange={e => setOutcome(e.target.value)} className="form-input" style={{ flex: 1 }}>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
            <input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="form-input" />
            <button type="submit" className="btn-submit">Record Task</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {tasks.length > 0 ? tasks.map((t: any) => (
            <div key={t.id} className="list-item" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className={`dot ${t.outcome === 'success' ? 'success' : 'danger'}`} />
                <div className="content">
                  <div className="title">{t.description}</div>
                  <div className="meta">{t.type} · {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className={`tag ${t.outcome === 'success' ? 'success' : 'danger'}`}>{t.outcome}</span>
                <button onClick={() => remove(t.id)} className="btn-delete">×</button>
              </div>
            </div>
          )) : <div className="empty">No tasks recorded yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Rules ───
function RulesTab({ rules, onReload }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('info');
  const [scopeType, setScopeType] = useState('global');
  const [scopeValue, setScopeValue] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, severity, scope_type: scopeType, scope_value: scopeValue })
    });
    setName(''); setDescription(''); setScopeValue('');
    onReload();
  };

  const remove = async (id: number) => {
    await fetch(`${API}/rules/${id}`, { method: 'DELETE' });
    onReload();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Architectural Rules</h2>
        <p>{rules.length} rules governing your codebase</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Record Rule</h3></div>
        <div className="card-body">
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Rule Name (e.g. no-axios)" value={name} onChange={e => setName(e.target.value)} required className="form-input" style={{ flex: 1 }} />
              <select value={severity} onChange={e => setSeverity(e.target.value)} className="form-input" style={{ width: 120 }}>
                <option value="info">Info</option><option value="warning">Warning</option><option value="error">Error</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={scopeType} onChange={e => setScopeType(e.target.value)} className="form-input" style={{ width: 150 }}>
                <option value="global">Global</option>
                <option value="path">Path</option>
                <option value="language">Language</option>
              </select>
              <input
                placeholder={scopeType === 'global' ? 'Applies to all files' : scopeType === 'path' ? 'e.g. src/components' : 'e.g. .ts, .go'}
                value={scopeValue}
                onChange={e => setScopeValue(e.target.value)}
                disabled={scopeType === 'global'}
                className="form-input"
                style={{ flex: 1 }}
              />
            </div>
            <input placeholder="Description (e.g. Use native fetch)" value={description} onChange={e => setDescription(e.target.value)} required className="form-input" />
            <button type="submit" className="btn-submit">Record Rule</button>
          </form>
        </div>
      </div>

      {rules.length > 0 ? (
        <div className="rule-grid">
          {rules.map((r: any) => (
            <div key={r.id} className="rule-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div className="name">{r.name}</div>
                  <span className={`tag ${r.scope_type === 'global' ? 'success' : 'warning'}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                    {r.scope_type}{r.scope_value ? `: ${r.scope_value}` : ''}
                  </span>
                </div>
                <div className="desc">{r.description}</div>
              </div>
              <button onClick={() => remove(r.id)} className="btn-delete">×</button>
            </div>
          ))}
        </div>
      ) : <div className="card"><div className="empty">No rules yet.</div></div>}
    </div>
  );
}

// ─── Settings ───
function SettingsTab({ config }: any) {
  if (!config) return <div className="card"><div className="empty">Loading config...</div></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Configuration</h2>
        <p>.kiteretsu/config.json</p>
      </div>
      <div className="card">
        <div className="settings-group">
          <h4>General</h4>
          <div className="settings-row"><span className="key">Project</span><span className="val">{config.name}</span></div>
          <div className="settings-row"><span className="key">Version</span><span className="val">{config.version}</span></div>
        </div>
        <div className="settings-group">
          <h4>Include Patterns</h4>
          <div className="pattern-list">
            {config.indexing?.include?.map((p: string, i: number) => (
              <span key={i} className="tag success">{p}</span>
            ))}
          </div>
        </div>
        <div className="settings-group">
          <h4>Exclude Patterns</h4>
          <div className="pattern-list">
            {config.indexing?.exclude?.map((p: string, i: number) => (
              <span key={i} className="tag danger">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
