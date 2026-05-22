import React, { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message, Divider, Typography, Spin, Tag, Space } from 'antd'
import { ApiOutlined, KeyOutlined, UserOutlined, RobotOutlined, LinkOutlined, ThunderboltOutlined, SyncOutlined } from '@ant-design/icons'
import { useAuthStore } from '../store/auth'
import { metabaseService } from '../services'
import api from '../services/api'

const { Text } = Typography

const Settings: React.FC = () => {
  const { user, updateUser } = useAuthStore()
  const [profileForm] = Form.useForm()
  const [kaggleForm] = Form.useForm()
  const [aiForm] = Form.useForm()
  const [mbForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [kaggleLoading, setKaggleLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [mbLoading, setMbLoading] = useState(false)
  const [mbStatus, setMbStatus] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  const handleProfileSave = async (values: any) => {
    updateUser({ ...user!, ...values })
    message.success('Settings saved')
  }

  const loadKaggleConfig = async () => {
    setKaggleLoading(true)
    try {
      const resp = await api.get('/auth/config', { params: { key: ['kaggle_username', 'kaggle_key'] } })
      kaggleForm.setFieldsValue({
        kaggle_username: resp.data.kaggle_username || '',
        kaggle_key: resp.data.kaggle_key || '',
      })
    } catch {
      // ignore
    } finally {
      setKaggleLoading(false)
    }
  }

  const handleKaggleSave = async (values: any) => {
    setLoading(true)
    try {
      await api.put('/auth/config', {
        kaggle_username: values.kaggle_username,
        kaggle_key: values.kaggle_key,
      })
      message.success('Kaggle API credentials saved')
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Failed to save Kaggle credentials')
    } finally {
      setLoading(false)
    }
  }

  const loadAiConfig = async () => {
    setAiLoading(true)
    try {
      const resp = await api.get('/auth/config', { params: { key: ['ai_api_key', 'ai_api_endpoint', 'ai_model'] } })
      aiForm.setFieldsValue({
        ai_api_key: resp.data.ai_api_key || '',
        ai_api_endpoint: resp.data.ai_api_endpoint || 'https://openrouter.ai/api/v1',
        ai_model: resp.data.ai_model || 'gpt-4o-mini',
      })
    } catch {
      // ignore
    } finally {
      setAiLoading(false)
    }
  }

  const handleAiSave = async (values: any) => {
    setLoading(true)
    try {
      await api.put('/auth/config', {
        ai_api_key: values.ai_api_key,
        ai_api_endpoint: values.ai_api_endpoint,
        ai_model: values.ai_model,
      })
      message.success('AI API settings saved')
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Failed to save AI settings')
    } finally {
      setLoading(false)
    }
  }

  const loadMbConfig = async () => {
    setMbLoading(true)
    try {
      const resp = await api.get('/auth/config', { params: { key: ['mb_api_key', 'mb_url'] } })
      mbForm.setFieldsValue({
        mb_api_key: resp.data.mb_api_key || '',
        mb_url: resp.data.mb_url || 'http://localhost:3001',
      })
      const status = await metabaseService.status()
      setMbStatus(status)
    } catch {
      // ignore
    } finally {
      setMbLoading(false)
    }
  }

  const handleMbSave = async (values: any) => {
    setLoading(true)
    try {
      await api.put('/auth/config', {
        mb_api_key: values.mb_api_key,
        mb_url: values.mb_url,
      })
      message.success('Metabase settings saved')
      const status = await metabaseService.status()
      setMbStatus(status)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Failed to save Metabase settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await metabaseService.sync()
      if (result.error) {
        message.error(result.error)
      } else {
        message.success(`Imported ${result.imported} charts from Metabase (${result.skipped} skipped)`)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadKaggleConfig()
      loadAiConfig()
      loadMbConfig()
    }
  }, [user])

  return (
    <div>
      <h2>Settings</h2>

      <Card title="Profile" style={{ marginBottom: 16 }}>
        <Form
          form={profileForm}
          onFinish={handleProfileSave}
          layout="vertical"
          initialValues={{
            username: user?.username,
            email: user?.email,
            first_name: user?.first_name,
            last_name: user?.last_name,
          }}
        >
          <Form.Item name="username" label="Username">
            <Input disabled />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="first_name" label="First Name">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name">
            <Input />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Save Changes</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={<span><RobotOutlined /> AI Assistant</span>}
        style={{ marginBottom: 16 }}
      >
        <Text style={{ marginBottom: 16, display: 'block' }}>
          The AI assistant can work in two modes:
        </Text>
        <ul style={{ marginBottom: 16, paddingLeft: 20 }}>
          <li><Text strong>Browser mode (Puter.js — free, no key needed):</Text> <Text>Puter.js runs in your browser automatically. You may be asked to sign in to Puter on first use. No configuration needed.</Text></li>
          <li><Text strong>Server mode (API Key):</Text> <Text>Enter an OpenAI-compatible API endpoint + key below. Works with <a href="https://openrouter.ai" target="_blank" rel="noreferrer">OpenRouter</a>, OpenAI, Ollama, or any OpenAI-compatible API.</Text></li>
        </ul>
        {aiLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin tip="Loading settings..." /></div>
        ) : (
          <Form
            form={aiForm}
            onFinish={handleAiSave}
            layout="vertical"
          >
            <Form.Item
              name="ai_api_endpoint"
              label="API Endpoint (leave default if using OpenAI)"
            >
              <Input prefix={<LinkOutlined />} placeholder="https://openrouter.ai/api/v1" />
            </Form.Item>
            <Form.Item
              name="ai_api_key"
              label="API Key (leave empty to use Puter.js browser mode)"
            >
              <Input.Password prefix={<KeyOutlined />} placeholder="sk-... or leave empty for Puter" />
            </Form.Item>
            <Form.Item
              name="ai_model"
              label="Model (used only with API key above)"
            >
              <Input prefix={<RobotOutlined />} placeholder="gpt-4o-mini, qwen/qwen3.6-plus, etc." />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<RobotOutlined />} loading={loading}>
                Save AI Settings
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>

      <Card
        title={<span><ApiOutlined /> Kaggle API</span>}
        style={{ marginBottom: 16 }}
      >
        <Text style={{ marginBottom: 16, display: 'block' }}>
          Enter your Kaggle API credentials to enable dataset imports from Kaggle.
          Get your API key from{' '}
          <a href="https://www.kaggle.com/settings" target="_blank" rel="noreferrer">
            kaggle.com/settings
          </a>
        </Text>
        {kaggleLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin tip="Loading credentials..." /></div>
        ) : (
          <Form
            form={kaggleForm}
            onFinish={handleKaggleSave}
            layout="vertical"
          >
            <Form.Item
              name="kaggle_username"
              label="Kaggle Username"
              rules={[{ required: true, message: 'Please enter your Kaggle username' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Your Kaggle username" />
            </Form.Item>
            <Form.Item
              name="kaggle_key"
              label="Kaggle API Key"
              rules={[{ required: true, message: 'Please enter your Kaggle API key' }]}
            >
              <Input.Password prefix={<KeyOutlined />} placeholder="Paste your Kaggle API key" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<ApiOutlined />} loading={loading}>
                Save Kaggle Credentials
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>

      <Card
        title={<span><ThunderboltOutlined /> Metabase Sync</span>}
        style={{ marginBottom: 16 }}
      >
        <Text style={{ marginBottom: 16, display: 'block' }}>
          Connect to a Metabase instance to import questions as INGAMAR charts.
        </Text>
        {mbStatus && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>Status:</Text>
              {mbStatus.connected ? (
                <Tag color="green">Connected as {mbStatus.user}</Tag>
              ) : mbStatus.configured ? (
                <Tag color="orange">Disconnected</Tag>
              ) : (
                <Tag>Not configured</Tag>
              )}
            </Space>
          </div>
        )}
        {mbLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin tip="Loading..." /></div>
        ) : (
          <Form
            form={mbForm}
            onFinish={handleMbSave}
            layout="vertical"
          >
            <Form.Item
              name="mb_url"
              label="Metabase URL"
            >
              <Input prefix={<LinkOutlined />} placeholder="http://localhost:3001" />
            </Form.Item>
            <Form.Item
              name="mb_api_key"
              label="API Key"
            >
              <Input.Password prefix={<KeyOutlined />} placeholder="mb_..." />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />} loading={loading}>
                Save Metabase Settings
              </Button>
              <Button
                style={{ marginLeft: 8 }}
                icon={<SyncOutlined />}
                loading={syncing}
                onClick={handleSync}
                disabled={!mbStatus?.connected}
              >
                Sync Questions
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>

      <Divider />

      <Card title="About INGAMAR">
        <p><strong>Version:</strong> 1.0.0</p>
        <p><strong>Platform:</strong> Data Visualization & Exploration</p>
        <p><strong>By:</strong> AMARZOU</p>
      </Card>
    </div>
  )
}

export default Settings