import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, CheckCircle, AlertCircle, X, FileText } from 'lucide-react'
import { uploadDataset } from '../../api/client'
import { useDatasetStore } from '../../store'
import toast from 'react-hot-toast'

const FILE_ICONS = {
  csv: '📊',
  xlsx: '📗',
  xls: '📗',
  sqlite: '🗄️',
  db: '🗄️',
}

const parseSchema = (schema) => {
  if (!schema) return {}
  if (typeof schema === 'object') return schema
  try { return JSON.parse(schema) } catch { return {} }
}

export default function UploadZone({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedList, setUploadedList] = useState([])  // list of uploaded datasets
  const [error, setError] = useState(null)
  const { addDataset, setActiveDataset } = useDatasetStore()

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return

    setUploading(true)
    setProgress(0)
    setError(null)

    const results = []
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]
      try {
        const res = await uploadDataset(file, (p) => {
          const overall = Math.round(((i + p / 100) / acceptedFiles.length) * 100)
          setProgress(overall)
        })
        const dataset = res.data
        addDataset(dataset)
        setActiveDataset(dataset)
        results.push({ ok: true, dataset })
        toast.success(`"${dataset.name}" uploaded!`)
        onUploadSuccess?.(dataset)
      } catch (err) {
        const msg = err.response?.data?.detail || `Upload failed for ${file.name}`
        results.push({ ok: false, name: file.name, msg })
        toast.error(msg)
      }
    }

    setUploadedList(results)
    setUploading(false)
  }, [addDataset, setActiveDataset, onUploadSuccess])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/octet-stream': ['.sqlite', '.db'],
    },
    maxFiles: 10,
    multiple: true,
    disabled: uploading,
  })

  // Render result list after upload
  if (uploadedList.length > 0 && !uploading) {
    return (
      <div>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <CheckCircle size={20} color="#34d399" />
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {uploadedList.filter(r => r.ok).length} of {uploadedList.length} file(s) uploaded
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {uploadedList.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: r.ok ? 'rgba(52,211,153,0.06)' : 'rgba(251,113,133,0.06)',
                border: `1px solid ${r.ok ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
                borderRadius: 'var(--radius-md)',
              }}>
                <span style={{ fontSize: 22 }}>{r.ok ? (FILE_ICONS[r.dataset?.filename?.split('.').pop()] || '📁') : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.ok ? r.dataset.name : r.name}</div>
                  {r.ok ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.dataset.row_count?.toLocaleString()} rows · {r.dataset.column_count} columns · {(r.dataset.file_size / 1024).toFixed(1)} KB
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#fb7185' }}>{r.msg}</div>
                  )}
                </div>
                {r.ok && <CheckCircle size={16} color="#34d399" />}
              </div>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 16 }}
            onClick={() => setUploadedList([])}
          >
            Upload More Files
          </button>
        </div>

        {/* Schema preview for last successful upload */}
        {(() => {
          const last = [...uploadedList].reverse().find(r => r.ok)
          if (!last) return null
          const entries = Object.entries(parseSchema(last.dataset?.schema))
          if (!entries.length) return null
          return (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Schema Preview — {last.dataset.name}
              </div>
              <div className="schema-grid">
                {entries.slice(0, 10).map(([col, type]) => (
                  <div key={col} className="schema-item">
                    <span className="schema-col truncate">{col}</span>
                    <span className="schema-type">{String(type)}</span>
                  </div>
                ))}
              </div>
              {entries.length > 10 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  +{entries.length - 10} more columns
                </div>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  // Drop zone UI
  return (
    <div
      {...getRootProps()}
      className={`upload-zone ${isDragActive ? 'drag-over' : ''}`}
      style={{ opacity: uploading ? 0.7 : 1 }}
    >
      <input {...getInputProps()} />

      {uploading ? (
        <div>
          <div className="upload-zone-icon pulse-glow" style={{ margin: '0 auto 16px' }}>
            <Upload size={28} />
          </div>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Uploading & Analyzing...</div>
          <div className="progress-bar" style={{ width: 200, margin: '0 auto 8px' }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{progress}%</div>
        </div>
      ) : error ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            <AlertCircle size={24} color="#fb7185" />
            <span style={{ color: '#fb7185', fontWeight: 600 }}>Upload Failed</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{error}</div>
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setError(null) }}>
            Try Again
          </button>
        </div>
      ) : (
        <>
          <div className="upload-zone-icon">
            <Upload size={28} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
            {isDragActive ? 'Drop your files here!' : 'Drop your dataset(s) here'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
            or click to browse — <strong>select multiple files</strong> at once
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
            Hold <kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>Ctrl</kbd> or <kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)' }}>Shift</kbd> to select multiple
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['CSV', 'Excel (.xlsx)', 'SQLite (.db)'].map((f) => (
              <span key={f} className="badge badge-purple">{f}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
