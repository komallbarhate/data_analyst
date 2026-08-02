import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Upload, Clock, Database,
  LogOut, ChevronLeft, ChevronRight, Sparkles, Settings, User
} from 'lucide-react'
import { useAuthStore, useDatasetStore, useUIStore } from '../../store'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
  { id: 'upload', label: 'Upload Data', icon: Upload, path: '/upload' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const { activeDataset } = useDatasetStore()

  const handleLogout = () => {
    logout()
    toast.success('Logged out')
    navigate('/auth')
  }

  return (
    <div className="sidebar" style={{ width: collapsed ? 60 : 260, transition: 'width 0.25s ease' }}>
      {/* Brand */}
      <div className="sidebar-brand" style={{ padding: collapsed ? '16px 10px' : undefined }}>
        <div className="brand-logo">
          <div className="brand-icon">🤖</div>
          {!collapsed && (
            <div>
              <div className="brand-name">DataMind AI</div>
              <div className="brand-sub">Data Analyst Agent</div>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {!collapsed && (
          <div className="nav-section-label">Navigation</div>
        )}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <div
              key={item.id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{ justifyContent: collapsed ? 'center' : undefined }}
            >
              <Icon size={18} className="nav-icon" />
              {!collapsed && <span>{item.label}</span>}
            </div>
          )
        })}

        {/* Active Dataset */}
        {activeDataset && !collapsed && (
          <>
            <div className="nav-section-label" style={{ marginTop: 16 }}>Active Dataset</div>
            <div
              className="nav-item active"
              onClick={() => navigate('/chat')}
              style={{
                background: 'rgba(6,182,212,0.1)',
                borderColor: 'rgba(6,182,212,0.3)',
                color: 'var(--cyan-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <Database size={16} className="nav-icon" />
                <span className="truncate">{activeDataset.name}</span>
              </div>
              <Trash2
                size={14}
                style={{ cursor: 'pointer', opacity: 0.7 }}
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!confirm(`Delete dataset "${activeDataset.name}"?`)) return
                  try {
                    await deleteDataset(activeDataset.id)
                    const { removeDataset, setActiveDataset } = useDatasetStore.getState()
                    removeDataset(activeDataset.id)
                    setActiveDataset(null)
                    toast.success('Dataset deleted')
                  } catch {
                    toast.error('Failed to delete dataset')
                  }
                }}
                title="Delete dataset"
              />
            </div>
            <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
              {activeDataset.row_count?.toLocaleString()} rows · {activeDataset.column_count} cols
            </div>
          </>
        )}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border-light)' }}>
        {user && !collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)', marginBottom: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--gradient-hero)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{user.username}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate">{user.email}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {user && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              style={{ flex: collapsed ? 1 : undefined, justifyContent: 'center' }}
              title="Logout"
            >
              <LogOut size={14} />
              {!collapsed && 'Logout'}
            </button>
          )}
          {!user && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/auth')}
              style={{ flex: 1 }}
            >
              <User size={14} /> Login
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
