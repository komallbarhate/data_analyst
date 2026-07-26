import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Database, CheckCircle, AlertCircle, X } from 'lucide-react'
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

export default function UploadZone({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploaded, setUploaded] = useState(null)
  const [error, setError] = useState(null)
  const { addDataset, setActiveDataset } = useDatasetStore()

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    const file = acceptedFiles[0]

    setUploading(true)
    setProgress(0)
    setError(null)
    setUploaded(null)

    try {
      const res = await uploadDataset(file, setProgress)
      const dataset = res.data
      addDataset(dataset)
      setActiveDataset(dataset)
      setUploaded(dataset)
      toast.success(`"${dataset.name}" uploaded successfully!`)
      onUploadSuccess?.(dataset)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload failed. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }, [addDataset, setActiveDataset, onUploadSuccess])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/octet-stream': ['.sqlite', '.db'],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  const ext = uploaded?.filename?.split('.').pop()

  return (
    <div>
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'drag-over' : ''}`}
        style={{ opacity: uploading ? 0.7 : 1 }}
      >
        <input {...getInputProps()} />

        {uploaded ? (
          <div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {FILE_ICONS[ext] || '📁'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
              <CheckCircle size={20} color="#34d399" />
              <span style={{ color: '#34d399', fontWeight: 600 }}>Upload Successful!</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{uploaded.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {uploaded.row_count?.toLocaleString()} rows · {uploaded.column_count} columns · {(uploaded.file_size / 1024).toFixed(1)} KB
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 16 }}
              onClick={(e) => { e.stopPropagation(); setUploaded(null); }}
            >
              Upload Another File
            </button>
          </div>
        ) : uploading ? (
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
            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setError(null); }}>
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="upload-zone-icon">
              <Upload size={28} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
              {isDragActive ? 'Drop your file here!' : 'Drop your dataset here'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              or click to browse your files
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['CSV', 'Excel (.xlsx)', 'SQLite (.db)'].map((f) => (
                <span key={f} className="badge badge-purple">{f}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {uploaded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Schema Preview
          </div>
          <div className="schema-grid">
            {Object.entries(uploaded.schema || {}).slice(0, 10).map(([col, type]) => (
              <div key={col} className="schema-item">
                <span className="schema-col truncate">{col}</span>
                <span className="schema-type">{type}</span>
              </div>
            ))}
          </div>
          {Object.keys(uploaded.schema || {}).length > 10 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              +{Object.keys(uploaded.schema).length - 10} more columns
            </div>
          )}
        </div>
      )}
    </div>
  )
}
