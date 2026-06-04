import React from 'react'
import { Layout, Avatar, Dropdown, Space, Typography } from 'antd'
import {
  UserOutlined, LogoutOutlined, SettingOutlined,
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

  const pageTitle = window.location.pathname === '/' ? 'Home' :
    window.location.pathname.split('/')[1]?.charAt(0).toUpperCase() +
    window.location.pathname.split('/')[1]?.slice(1) || 'Home'

  return (
    <AntHeader style={{
      background: darkMode ? '#1e2028' : '#ffffff',
      padding: '0 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `1px solid ${darkMode ? '#2e3138' : '#e5e7eb'}`,
      height: 52,
      lineHeight: '52px',
      zIndex: 10,
    }}>
      {/* Breadcrumb */}
      <Space size={8}>
        <Typography.Text style={{
          color: darkMode ? '#8e9399' : '#6b7280',
          fontSize: 13,
          fontWeight: 500,
        }}>
          Home
        </Typography.Text>
        <Typography.Text style={{
          color: darkMode ? '#4a4e54' : '#c4c8cc',
          fontSize: 13,
        }}>
          /
        </Typography.Text>
        <Typography.Text style={{
          color: darkMode ? '#ccd0d6' : '#24292e',
          fontSize: 13,
          fontWeight: 500,
        }}>
          {pageTitle}
        </Typography.Text>
      </Space>

      {/* User Menu */}
      <Space size={16}>
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 2,
            background: darkMode ? '#22242b' : '#f4f5f5',
            border: `1px solid ${darkMode ? '#2e3138' : '#e5e7eb'}`,
          }}>
            <Avatar
              size={24}
              icon={<UserOutlined />}
              style={{ background: '#5794F2' }}
            />
            <span style={{
              color: darkMode ? '#ccd0d6' : '#24292e',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {user?.username || 'User'}
            </span>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  )
}

export default Header
