import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './components/Dashboard/Dashboard'
import ChatInterface from './components/Chat/ChatInterface'
import UploadZone from './components/Upload/UploadZone'
import AuthPage from './pages/AuthPage'
import { useDatasetStore } from './store'
import { useNavigate } from 'react-router-dom'
import './index.css'

function AppLayout() {
  const { activeDataset, setActiveDataset } = useDatasetStore()

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard
            onSelectDataset={(ds) => setActiveDataset(ds)}
          />} />
          <Route path="/chat" element={
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{
                padding: '14px 24px',
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>AI Analyst Chat</h3>
                  {activeDataset ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      📊 {activeDataset.name} · {activeDataset.row_count?.toLocaleString()} rows
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--amber-400)' }}>
                      ⚠️ No dataset selected — go to Upload or Dashboard
                    </div>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ChatInterface datasetId={activeDataset?.id} />
              </div>
            </div>
          } />
          <Route path="/upload" element={
            <div style={{ padding: '40px 32px', maxWidth: 850, margin: '0 auto', width: '100%' }}>
              <h2 style={{ marginBottom: 8, fontSize: 24, fontWeight: 800 }}>Upload Dataset</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 15 }}>
                Upload a CSV, Excel, or SQLite file to start analyzing with AI.
              </p>
              <UploadZone onUploadSuccess={(ds) => setActiveDataset(ds)} />
            </div>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <>
      <AppRouter />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#fb7185', secondary: '#1e293b' } },
        }}
      />
    </>
  )
}
