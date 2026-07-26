import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
})

// Auth token injection
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    return Promise.reject(error)
  }
)

// ─── Dataset APIs ──────────────────────────────────────────────────────────

export const uploadDataset = (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
  })
}

export const getDatasets = () => api.get('/api/datasets')
export const getDataset = (id) => api.get(`/api/datasets/${id}`)
export const deleteDataset = (id) => api.delete(`/api/datasets/${id}`)

// ─── Chat APIs ─────────────────────────────────────────────────────────────

export const sendMessage = (data) => api.post('/api/chat', data)
export const getSessions = () => api.get('/api/sessions')
export const getSessionMessages = (sessionId) => api.get(`/api/sessions/${sessionId}/messages`)
export const getQueryHistory = (limit = 20) => api.get(`/api/history?limit=${limit}`)

// ─── Export APIs ───────────────────────────────────────────────────────────

export const exportCSV = (sessionId) => `${API_BASE_URL}/api/export/${sessionId}/csv`
export const exportExcel = (sessionId) => `${API_BASE_URL}/api/export/${sessionId}/excel`
export const exportPDF = (sessionId) => `${API_BASE_URL}/api/export/${sessionId}/pdf`
export const exportChartPNG = (sessionId) => `${API_BASE_URL}/api/export/${sessionId}/chart-png`

// ─── Auth APIs ─────────────────────────────────────────────────────────────

export const register = (data) => api.post('/api/auth/register', data)
export const login = (data) => api.post('/api/auth/login', data)
export const getMe = () => api.get('/api/auth/me')

export default api
