import { useState, useRef, useEffect } from 'react'
import {
  Send, Sparkles, Bot, User, Download, FileText,
  BarChart3, Table, RefreshCw, Lightbulb, Code2
} from 'lucide-react'
import { format } from 'date-fns'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { sendMessage, getSessionMessages } from '../../api/client'
import { useChatStore, useDatasetStore } from '../../store'
import toast from 'react-hot-toast'
import {
  CodeBlock, DataTable, ReasoningTrace, InsightCard, ToolBadge, TypingIndicator
} from './ChatComponents'

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6']

const EXAMPLE_QUESTIONS = [
  'Show me the first 10 rows',
  'What are the total sales by category?',
  'Plot a bar chart of top 5 values',
  'Show me descriptive statistics',
  'Which column has the most missing values?',
  'Find any anomalies or outliers',
]

function PlotlyChart({ chartData }) {
  // Render recharts from Plotly JSON data
  if (!chartData) return null

  const data = chartData.chart_json?.data?.[0]
  const chartType = chartData.chart_type

  if (!data) return null

  // Build recharts-compatible data
  const xValues = data.x || []
  const yValues = data.y || []
  const rechartsData = xValues.map((x, i) => ({ name: String(x), value: yValues[i] ?? 0 }))

  if (!rechartsData.length) return null

  const commonProps = {
    data: rechartsData,
    margin: { top: 10, right: 20, left: 0, bottom: 60 }
  }

  const tooltipStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    color: '#0f172a',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  }

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      margin: '12px 0',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <ResponsiveContainer width="100%" height={280}>
        {chartType === 'pie' ? (
          <PieChart>
            <Pie data={rechartsData} cx="50%" cy="50%" outerRadius={100}
              dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {rechartsData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
          </PieChart>
        ) : chartType === 'line' ? (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} angle={-45} textAnchor="end" />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} />
          </LineChart>
        ) : chartType === 'scatter' ? (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
            <YAxis dataKey="value" tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Scatter data={rechartsData} fill="#7c3aed" />
          </ScatterChart>
        ) : (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {rechartsData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'

  return (
    <div className="message">
      <div className={`message-avatar ${isUser ? 'user' : 'assistant'}`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>
      <div className="message-body">
        <div className="message-meta">
          <span className="message-sender">{isUser ? 'You' : 'AI Analyst'}</span>
          {msg.created_at && (
            <span className="message-time">
              {format(new Date(msg.created_at), 'HH:mm')}
            </span>
          )}
          {msg.tool_used && !isUser && (
            <ToolBadge tool={msg.tool_used} execTime={msg.execution_time} />
          )}
        </div>

        <div className="message-bubble">
          <p style={{ marginBottom: (msg.generated_code || msg.table_data || msg.chart_data || msg.insight) ? 8 : 0 }}>
            {msg.content}
          </p>

          {!isUser && (
            <>
              {/* Generated Code */}
              {msg.generated_code && (
                <CodeBlock
                  code={msg.generated_code}
                  language={msg.tool_used === 'python' ? 'python' : 'sql'}
                />
              )}

              {/* Chart */}
              {msg.chart_data && <PlotlyChart chartData={msg.chart_data} />}

              {/* Table */}
              {msg.table_data && Array.isArray(msg.table_data) && msg.table_data.length > 0 && (
                <DataTable
                  columns={msg.table_columns || Object.keys(msg.table_data[0] || {})}
                  rows={msg.table_data}
                />
              )}

              {/* AI Insight */}
              {msg.insight && msg.insight !== msg.content && (
                <InsightCard text={msg.insight} />
              )}

              {/* Reasoning Trace */}
              {msg.reasoning_trace?.length > 0 && (
                <ReasoningTrace steps={msg.reasoning_trace} />
              )}

              {/* Error */}
              {msg.error && (
                <div style={{
                  background: 'rgba(251,113,133,0.1)',
                  border: '1px solid rgba(251,113,133,0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  marginTop: 10,
                  fontSize: 13,
                  color: '#fb7185'
                }}>
                  ⚠️ {msg.error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatInterface({ sessionId, datasetId }) {
  const [input, setInput] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(sessionId)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef(null)
  const messagesEndRef = useRef(null)
  const { activeDataset } = useDatasetStore()

  const effectiveDatasetId = datasetId || activeDataset?.id

  // Load messages if session exists
  useEffect(() => {
    if (currentSessionId) {
      getSessionMessages(currentSessionId)
        .then((res) => setMessages(res.data))
        .catch(console.error)
    } else {
      setMessages([])
    }
  }, [currentSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !effectiveDatasetId) return

    const userMsg = {
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await sendMessage({
        session_id: currentSessionId || null,
        dataset_id: effectiveDatasetId,
        question: userMsg.content,
      })

      const data = res.data
      if (!currentSessionId) setCurrentSessionId(data.session_id)

      const assistantMsg = {
        role: 'assistant',
        content: data.answer,
        tool_used: data.tool_used,
        generated_code: data.generated_code,
        chart_data: data.chart_data,
        table_data: data.table_data,
        table_columns: data.table_columns,
        insight: data.insight,
        execution_time: data.execution_time,
        reasoning_trace: data.reasoning_trace,
        error: data.error,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      toast.error('Failed to get response. Please try again.')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleExampleClick = (q) => {
    setInput(q)
    textareaRef.current?.focus()
  }

  return (
    <div className="chat-container">
      {/* Messages */}
      <div className="messages-area">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 32,
            }}>🤖</div>
            <h2 style={{ marginBottom: 8 }} className="text-gradient">AI Data Analyst</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Ask me anything about your data. I can run SQL queries, generate charts, find anomalies, and explain insights in plain English.
            </p>
            {!effectiveDatasetId && (
              <div style={{
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: 'var(--radius-md)', padding: '12px 20px',
                fontSize: 14, color: '#fbbf24', marginBottom: 24
              }}>
                ⚠️ Please upload a dataset or select one from the sidebar to begin.
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleExampleClick(q)}
                  disabled={!effectiveDatasetId}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        {currentSessionId && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <a href={`http://localhost:8000/api/export/${currentSessionId}/csv`} target="_blank" rel="noopener noreferrer">
              <button className="btn btn-ghost btn-sm"><Download size={12} /> CSV</button>
            </a>
            <a href={`http://localhost:8000/api/export/${currentSessionId}/excel`} target="_blank" rel="noopener noreferrer">
              <button className="btn btn-ghost btn-sm"><Download size={12} /> Excel</button>
            </a>
            <a href={`http://localhost:8000/api/export/${currentSessionId}/pdf`} target="_blank" rel="noopener noreferrer">
              <button className="btn btn-ghost btn-sm"><FileText size={12} /> PDF Report</button>
            </a>
          </div>
        )}
        <div className="chat-input-wrapper">
          <Sparkles size={18} style={{ color: 'var(--purple-400)', flexShrink: 0 }} />
          <textarea
            ref={textareaRef}
            className="chat-input-field"
            placeholder={effectiveDatasetId ? "Ask anything about your data... (Shift+Enter for new line)" : "Upload a dataset to start chatting"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !effectiveDatasetId}
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !effectiveDatasetId}
            id="send-btn"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
