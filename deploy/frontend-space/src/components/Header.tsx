import React from 'react'
import { Layout, Avatar, Dropdown, Space, Typography } from 'antd'
import {
  UserOutlined, LogoutOutlined, SettingOutlined,
  BellOutlined, SearchOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useThemeStore } from '../store/theme'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { darkMode } = useThemeStore()

  const menuItems = [
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
      onClick: () => navigate('/settings'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  return (
    <AntHeader style={{
      background: darkMode ? '#1f1f1f' : '#fff',
      padding: '0 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
      height: 56,
      lineHeight: '56px',
      zIndex: 10,
    }}>
      <Space>
        <Typography.Text style={{
          color: darkMode ? '#9ca3af' : '#6b7280',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}>
          {window.location.pathname === '/' ? 'Home' :
            window.location.pathname.split('/')[1]?.charAt(0).toUpperCase() +
            window.location.pathname.split('/')[1]?.slice(1) || 'Home'}
        </Typography.Text>
      </Space>

      <Space size={20}>
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 6, background: darkMode ? '#2d2d2d' : '#f5f7fa' }}>
            <Avatar
              size={28}
              icon={<UserOutlined />}
              style={{ background: '#667eea' }}
            />
            <span style={{ color: darkMode ? '#e5e7eb' : '#374151', fontSize: 14, fontWeight: 500 }}>
              {user?.username || 'User'}
            </span>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}

export default Header
