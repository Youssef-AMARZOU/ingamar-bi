import React from 'react'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  CodeOutlined,
  TeamOutlined,
  SettingOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useThemeStore } from '../store/theme'

const { Sider } = Layout

const menuItems = [
  { key: '/dashboards', icon: <DashboardOutlined />, label: 'Dashboards' },
  { key: '/charts', icon: <BarChartOutlined />, label: 'Charts' },
  { key: '/sqllab', icon: <CodeOutlined />, label: 'SQL Lab' },
  { key: '/datasets', icon: <DatabaseOutlined />, label: 'Datasets' },
  { key: '/databases', icon: <DatabaseOutlined />, label: 'Databases' },
  { key: '/contributions', icon: <FileTextOutlined />, label: 'Contributions' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
]

const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { darkMode } = useThemeStore()

  return (
    <Sider
      width={240}
      style={{
        background: darkMode ? '#1a1a2e' : '#1a1a2e',
        overflow: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
      }}
    >
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}>I</div>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: 0.5 }}>INGAMAR</span>
        </div>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        defaultSelectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{
          background: 'transparent',
          borderRight: 0,
          fontSize: 14,
        }}
      />
    </Sider>
  )
}

export default Sidebar
