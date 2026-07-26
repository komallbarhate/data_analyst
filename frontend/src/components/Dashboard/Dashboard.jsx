import { useEffect, useState } from 'react'
import {
  Database, Trash2, MessageSquare, Clock, FileText,
  BarChart3, Eye, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { getDatasets, deleteDataset, getSessions, getQueryHistory } from '../../api/client'
import { useDatasetStore } from '../../store'
import toast from 'react-hot-toast'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `rgba(${color},0.15)` }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

// ─── Dataset Row ──────────────────────────────────────────────────────────────

function DatasetRow({ dataset, onSelect, onDelete, active }) {
  const typeColors = { csv: 'badge-green', excel: 'badge-amber', sqlite: 'badge-cyan' }

  return (
    <div
      className={`dataset-card ${active ? 'selected' : ''}`}
      onClick={() => onSelect(dataset)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }} className="truncate">
            {dataset.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span className={`badge ${typeColors[dataset.file_type] || 'badge-purple'}`}>
              {dataset.file_type?.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {dataset.row_count?.toLocaleString()} rows · {dataset.column_count} cols
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {(dataset.file_size / 1024).toFixed(1)} KB
            </span>
          </div>
        </div>
        <button
          className="btn btn-danger btn-sm btn-icon"
          onClick={(e) => { e.stopPropagation(); onDelete(dataset.id) }}
          title="Delete dataset"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Uploaded {format(new Date(dataset.created_at), 'MMM d, yyyy · HH:mm')}
      </div>
    </div>
  )
}

// ─── History Item ─────────────────────────────────────────────────────────────

function HistoryItem({ item }) {
  const [showCode, setShowCode] = useState(false)
  const toolColors = { sql: 'badge-purple', python: 'badge-cyan', stats: 'badge-amber' }

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span className={`badge ${toolColors[item.tool_used] || 'badge-purple'}`} style={{ flexShrink: 0 }}>
          {item.tool_used?.toUpperCase() || 'N/A'}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{item.question}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {format(new Date(item.created_at), 'MMM d, HH:mm')}
        </span>
        {item.execution_time && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {item.execution_time.toFixed(3)}s</span>
        )}
        <span style={{ fontSize: 11, color: item.success ? '#34d399' : '#fb7185' }}>
          {item.success ? '✓ Success' : '✗ Failed'}
        </span>
        {item.generated_code && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
            onClick={() => setShowCode(!showCode)}
          >
            {showCode ? 'Hide' : 'View'} Code
          </button>
        )}
      </div>
      {showCode && item.generated_code && (
        <pre style={{
          marginTop: 10, padding: 10, background: 'var(--bg-base)',
          borderRadius: 'var(--radius-sm)', fontSize: 11, overflow: 'auto',
          color: 'var(--purple-300)', fontFamily: 'JetBrains Mono, monospace',
          maxHeight: 150
        }}>
          {item.generated_code}
        </pre>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ onSelectDataset, onStartChat }) {
  const [datasets, setDatasets] = useState([])
  const [sessions, setSessions] = useState([])
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('datasets')
  const [loading, setLoading] = useState(true)
  const { activeDataset, setActiveDataset } = useDatasetStore()

  const loadData = async () => {
    setLoading(true)
    try {
      const [dsRes, sessRes, histRes] = await Promise.all([
        getDatasets(),
        getSessions(),
        getQueryHistory(30),
      ])
      setDatasets(dsRes.data)
      setSessions(sessRes.data)
      setHistory(histRes.data)
    } catch (err) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this dataset?')) return
    try {
      await deleteDataset(id)
      setDatasets((prev) => prev.filter((d) => d.id !== id))
      if (activeDataset?.id === id) setActiveDataset(null)
      toast.success('Dataset deleted')
    } catch {
      toast.error('Failed to delete dataset')
    }
  }

  const totalRows = datasets.reduce((sum, d) => sum + (d.row_count || 0), 0)
  const successRate = history.length
    ? Math.round((history.filter((h) => h.success).length / history.length) * 100)
    : 0

  return (
    <div style={{ padding: 24 }}>
      {/* Stats */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ marginBottom: 4, fontSize: 22 }}>Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
          Overview of your datasets, sessions, and analysis history
        </p>
        <div className="stats-grid">
          <StatCard
            icon={<Database size={20} color="#8b5cf6" />}
            label="Datasets"
            value={datasets.length}
            color="139,92,246"
          />
          <StatCard
            icon={<MessageSquare size={20} color="#06b6d4" />}
            label="Chat Sessions"
            value={sessions.length}
            color="6,182,212"
          />
          <StatCard
            icon={<BarChart3 size={20} color="#10b981" />}
            label="Total Rows"
            value={totalRows.toLocaleString()}
            color="16,185,129"
          />
          <StatCard
            icon={<Clock size={20} color="#f59e0b" />}
            label="Queries Run"
            value={history.length}
            color="245,158,11"
          />
          <StatCard
            icon={<Eye size={20} color="#ec4899" />}
            label="Success Rate"
            value={`${successRate}%`}
            color="236,72,153"
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="tab-bar" style={{ width: 'auto', gap: 0 }}>
          {[
            { id: 'datasets', label: '📁 Datasets', count: datasets.length },
            { id: 'sessions', label: '💬 Sessions', count: sessions.length },
            { id: 'history', label: '🕐 History', count: history.length },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px' }}
            >
              {tab.label}
              <span className="nav-badge" style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80 }} />
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'datasets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {datasets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No datasets yet. Upload a CSV or Excel file to get started.
                </div>
              ) : datasets.map((d) => (
                <DatasetRow
                  key={d.id}
                  dataset={d}
                  active={activeDataset?.id === d.id}
                  onSelect={(ds) => { setActiveDataset(ds); onSelectDataset?.(ds); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No chat sessions yet. Start a conversation!
                </div>
              ) : sessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: '14px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'var(--transition)',
                  }}
                  onClick={() => onStartChat?.(s)}
                  className="dataset-card"
                >
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>💬 {s.message_count} messages</span>
                    <span>{format(new Date(s.updated_at), 'MMM d, HH:mm')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No queries yet.
                </div>
              ) : history.map((h) => (
                <HistoryItem key={h.id} item={h} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
