import React, { useState } from 'react'
import { Table, Button, Space, Modal, Form, Input, message, Card, Tag, Popconfirm, Tooltip, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons'
import { sqlLabService } from '../services'

const Databases: React.FC = () => {
  const [databases, setDatabases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDb, setEditingDb] = useState<any>(null)
  const [testingUri, setTestingUri] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null)
  const [form] = Form.useForm()

  const fetchDatabases = async () => {
    setLoading(true)
    try {
      const data = await sqlLabService.getDatabases()
      setDatabases(data)
    } catch (error: any) {
      console.error('[Databases] fetchDatabases error:', error?.response?.data, error?.message)
      message.error('Failed to load databases')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchDatabases()
  }, [])

  const openCreate = () => {
    setEditingDb(null)
    setTestResult(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEdit = (record: any) => {
    setEditingDb(record)
    setTestResult(null)
    form.setFieldsValue({
      database_name: record.database_name,
      sqlalchemy_uri: '',
      cache_timeout: record.cache_timeout,
      expose_in_sqllab: record.expose_in_sqllab,
    })
    setModalVisible(true)
  }

  const handleTest = async () => {
    const uri = form.getFieldValue('sqlalchemy_uri')
    if (!uri) { message.warning('Enter a SQLAlchemy URI first'); return }
    setTestingUri(uri)
    setTestResult(null)
    try {
      const result = await sqlLabService.testConnection(uri)
      setTestResult(result)
      if (result.status === 'ok') message.success(result.message)
      else message.error(result.message)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || 'Connection test failed'
      setTestResult({ status: 'error', message: msg })
    } finally {
      setTestingUri(null)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editingDb) {
        const payload: any = { ...values }
        if (!payload.sqlalchemy_uri) delete payload.sqlalchemy_uri
        await sqlLabService.updateDatabase(editingDb.id, payload)
        message.success('Database updated')
      } else {
        await sqlLabService.createDatabase(values)
        message.success('Database added')
      }
      setModalVisible(false)
      form.resetFields()
      setEditingDb(null)
      setTestResult(null)
      fetchDatabases()
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Operation failed'
      message.error(msg)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await sqlLabService.deleteDatabase(id)
      message.success('Database deleted')
      fetchDatabases()
    } catch (error) {
      message.error('Failed to delete database')
    }
  }

  const columns = [
    { title: 'Name', dataIndex: 'database_name', key: 'name' },
    {
      title: 'SQL Lab',
      dataIndex: 'expose_in_sqllab',
      key: 'sqllab',
      render: (val: boolean) => <Tag color={val ? 'green' : 'red'}>{val ? 'Yes' : 'No'}</Tag>
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Test connection">
            <Button icon={<ApiOutlined />} onClick={() => {
              sqlLabService.testConnection(record.sqlalchemy_uri || '').then(r => {
                if (r.status === 'ok') message.success(r.message)
                else message.error(r.message)
              }).catch(() => message.error('Connection failed'))
            }} />
          </Tooltip>
          <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this database?" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Databases</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchDatabases}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Database
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={databases}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingDb ? 'Edit Database' : 'Add Database'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingDb(null); setTestResult(null) }}
        onOk={() => form.submit()}
        width={560}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="database_name" label="Display Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="sqlalchemy_uri"
            label="SQLAlchemy URI"
            rules={editingDb ? [] : [{ required: true }]}
            tooltip="e.g., postgresql://user:password@host:5432/dbname"
          >
            <Input placeholder={editingDb ? 'Leave blank to keep current' : ''} />
          </Form.Item>
          <Form.Item name="cache_timeout" label="Cache Timeout (seconds)">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="expose_in_sqllab" label="Expose in SQL Lab" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <Space>
            <Button icon={<ApiOutlined />} onClick={handleTest} loading={!!testingUri}>
              Test Connection
            </Button>
            {testResult && (
              <Tag color={testResult.status === 'ok' ? 'green' : 'red'}>
                {testResult.status === 'ok' ? 'Connected' : testResult.message.slice(0, 60)}
              </Tag>
            )}
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default Databases
