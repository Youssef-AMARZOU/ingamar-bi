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
  ExperimentOutlined,
  NodeIndexOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useThemeStore } from '../store/theme'

const { Sider } = Layout

const menuItems = [
  { key: '/dashboards', icon: <DashboardOutlined />, label: 'Dashboards' },
  { key: '/charts', icon: <BarChartOutlined />, label: 'Charts' },
  { key: '/sqllab', icon: <CodeOutlined />, label: 'SQL Lab' },
  { key: '/saved-queries', icon: <FileTextOutlined />, label: 'Saved Queries' },
  { key: '/datasets', icon: <DatabaseOutlined />, label: 'Datasets' },
  { key: '/ml', icon: <ExperimentOutlined />, label: 'ML Studio' },
  { key: '/dl', icon: <NodeIndexOutlined />, label: 'Deep Learning' },
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
        background: '#181b1f',
        overflow: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        borderRight: '1px solid #2e3138',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #2e3138',
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg, #F55F3E 0%, #FF9830 100%)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}>I</div>
          <span style={{
            color: '#ccd0d6',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: -0.3,
          }}>INGAMAR</span>
        </div>
      </div>

      {/* Navigation */}
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
          fontSize: 13,
          fontWeight: 500,
        }}
      />
    </Sider>
  )
}

export default Sidebar
