import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

// ─── Code Block ────────────────────────────────────────────────────────────

export function CodeBlock({ code, language = 'sql', collapsible = true }) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block">
      <div className="code-header" onClick={() => collapsible && setExpanded(!expanded)} style={{ cursor: collapsible ? 'pointer' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {collapsible && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
          <span className="code-lang">{language}</span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); copy(); }}
          style={{ padding: '2px 8px', gap: 4 }}
        >
          {copied ? <Check size={12} color="#059669" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {expanded && (
        <SyntaxHighlighter
          language={language}
          style={oneLight}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: '#f8fafc',
            fontSize: '12px',
            maxHeight: '320px',
            borderTop: '1px solid #e2e8f0',
          }}
          showLineNumbers
        >
          {code}
        </SyntaxHighlighter>
      )}
    </div>
  )
}

// ─── Data Table ────────────────────────────────────────────────────────────

export function DataTable({ columns, rows, maxRows = 50 }) {
  if (!columns?.length || !rows?.length) return null

  const displayRows = rows.slice(0, maxRows)

  return (
    <div>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col} title={String(row[col] ?? '')}>
                    {row[col] === null || row[col] === undefined ? (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>null</span>
                    ) : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  )
}

// ─── Reasoning Trace ────────────────────────────────────────────────────────

export function ReasoningTrace({ steps }) {
  const [expanded, setExpanded] = useState(false)
  if (!steps?.length) return null

  return (
    <div className="reasoning-trace">
      <div className="reasoning-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        🔍 Agent Reasoning Trace ({steps.length} steps)
      </div>
      {expanded && (
        <div className="reasoning-steps">
          {steps.map((s, i) => (
            <div key={i} className="reasoning-step">
              <span className="step-name">{s.step}</span>
              <span className="step-detail">{s.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Insight Card ────────────────────────────────────────────────────────────

export function InsightCard({ text }) {
  if (!text) return null
  return (
    <div className="insight-card">
      <div className="insight-label">
        <span>💡</span> AI Insight
      </div>
      <div className="insight-text">{text}</div>
    </div>
  )
}

// ─── Tool Badge ───────────────────────────────────────────────────────────────

export function ToolBadge({ tool, execTime }) {
  const config = {
    sql:     { label: 'SQL', cls: 'badge-purple', icon: '🗄️' },
    python:  { label: 'Python', cls: 'badge-cyan', icon: '🐍' },
    stats:   { label: 'Stats', cls: 'badge-amber', icon: '📈' },
    chart:   { label: 'Chart', cls: 'badge-green', icon: '📊' },
    insight_only: { label: 'Insight', cls: 'badge-purple', icon: '💡' },
  }
  const c = config[tool] || { label: tool, cls: 'badge-purple', icon: '⚡' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className={`badge ${c.cls}`}>{c.icon} {c.label}</span>
      {execTime != null && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏱ {execTime.toFixed(3)}s</span>
      )}
    </div>
  )
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

export function TypingIndicator() {
  return (
    <div className="message">
      <div className="message-avatar assistant">🤖</div>
      <div className="message-body">
        <div className="message-bubble" style={{ display: 'inline-flex' }}>
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  )
}
