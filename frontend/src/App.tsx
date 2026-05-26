import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, ConfigProvider, theme } from 'antd'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardList from './pages/DashboardList'
import DashboardBuilder from './pages/DashboardBuilder'
import ChartBuilder from './pages/ChartBuilder'
import ChartList from './pages/ChartList'
import SQLLab from './pages/SQLLab'
import SavedQueries from './pages/SavedQueries'
import Datasets from './pages/Datasets'
import ETLPage from './pages/ETLPage'
import Databases from './pages/Databases'
import Contributions from './pages/Contributions'
import Users from './pages/Users'
import Settings from './pages/Settings'
import MLPage from './pages/MLPage'
import DLPage from './pages/DLPage'
import { useAuthStore } from './store/auth'
import { useThemeStore } from './store/theme'
import { useEffect } from 'react'

const { Content } = Layout

function App() {
  const { isAuthenticated } = useAuthStore()
  const { darkMode } = useThemeStore()

  // Apply theme class to root element to prevent flicker
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
  }, [darkMode])

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <ConfigProvider
       theme={{
         algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
         token: {
           colorPrimary: '#1890ff',
           borderRadius: 8,
           // Dark mode adjustments
           colorBgBase: darkMode ? '#0f0f0f' : '#fff',
           colorBgLayout: darkMode ? '#141414' : '#f5f7fa',
           colorBgElevated: darkMode ? '#1e1e1e' : '#fff',
           colorBgContainer: darkMode ? '#1a1a2e' : '#fff',
           colorTextBase: darkMode ? '#e5e7eb' : '#374151',
           colorBorder: darkMode ? '#4b5563' : '#e5e7eb',
         },
       }}
    >
      <Layout style={{ minHeight: '100vh', background: darkMode ? '#141414' : '#f5f7fa' }}>
        <Sidebar />
        <Layout style={{ background: darkMode ? '#141414' : '#f5f7fa' }}>
          <Header />
           <Content style={{
             margin: 0,
             padding: 24,
             background: 'transparent',
             minHeight: 280,
             maxWidth: 1200
           }}>
<Routes>
  <Route path="/" element={<Navigate to="/dashboards" replace />} />
  <Route path="/dashboards" element={<DashboardList />} />
  <Route path="/dashboards/:id" element={<DashboardBuilder />} />
  <Route path="/dashboards/:id/view" element={<Dashboard />} />
  <Route path="/charts" element={<ChartList />} />
  <Route path="/charts/new" element={<ChartBuilder />} />
  <Route path="/charts/:id" element={<ChartBuilder />} />
  <Route path="/sqllab" element={<SQLLab />} />
  <Route path="/saved-queries" element={<SavedQueries />} />
  <Route path="/datasets" element={<Datasets />} />
  <Route path="/datasets/:tableName" element={<ETLPage />} />
  <Route path="/databases" element={<Databases />} />
  <Route path="/contributions" element={<Contributions />} />
  <Route path="/users" element={<Users />} />
  <Route path="/settings" element={<Settings />} />
              <Route path="/ml" element={<MLPage />} />
              <Route path="/dl" element={<DLPage />} />
</Routes>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}

export default App