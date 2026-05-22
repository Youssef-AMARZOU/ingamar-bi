import React, { useState, useEffect } from 'react'
import { Table, Card, Button, Space, Modal, Form, Input, message, Tag, Typography, Popconfirm, Select, Tooltip } from 'antd'
import { PlayCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { sqlLabService } from '../services'

const { TextArea } = Input
const { Text } = Typography

const SavedQueries: React.FC = () => {
  const navigate = useNavigate()
  const [queries, setQueries] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [databases, setDatabases] = useState<any[]>([])
  const [form] = Form.useForm()

  const fetchQueries = async () => {
    setLoading(true)
    try {
      const data = await sqlLabService.getSavedQueries()
      setQueries(data)
    } catch (error: any) {
      message.error('Failed to load saved queries')
    } finally {
      setLoading(false)
    }
  }

  const fetchDatabases = async () => {
    try {
      const data = await sqlLabService.getDatabases()
      setDatabases(data)
    } catch (_) {}
  }

  useEffect(() => {
    fetchQueries()
    fetchDatabases()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      database_id: record.database_id,
      sql: record.sql,
      schema: record.schema,
    })
    setModalVisible(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await sqlLabService.updateSavedQuery(editing.id, values)
        message.success('Query updated')
      } else {
        await sqlLabService.createSavedQuery(values)
        message.success('Query saved')
      }
      setModalVisible(false)
      setEditing(null)
      form.resetFields()
      fetchQueries()
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'Operation failed')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await sqlLabService.deleteSavedQuery(id)
      message.success('Query deleted')
      fetchQueries()
    } catch (_) {
      message.error('Failed to delete')
    }
  }

  const handleRun = (record: any) => {
    navigate('/sqllab', { state: { sql: record.sql, databaseId: record.database_id } })
  }

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (n: string, r: any) => <a onClick={() => openEdit(r)}>{n}</a> },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Database', dataIndex: 'database_name', key: 'database_name' },
    {
      title: 'SQL',
      dataIndex: 'sql',
      key: 'sql',
      ellipsis: true,
      render: (sql: string) => <Text code style={{ maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sql}</Text>
    },
    { title: 'Updated', dataIndex: 'updated_at', key: 'updated_at', render: (v: string) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Run in SQL Lab">
            <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)} />
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this query?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Saved Queries</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchQueries}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Save Query
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={queries}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: 'No saved queries. Save a query from SQL Lab or create one here.' }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Saved Query' : 'Save Query'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditing(null) }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="name" label="Query Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="database_id" label="Database" rules={[{ required: true }]}>
            <Select
              options={databases.map((d: any) => ({ label: d.database_name, value: d.id }))}
              placeholder="Select database"
            />
          </Form.Item>
          <Form.Item name="sql" label="SQL Query" rules={[{ required: true }]}>
            <TextArea rows={8} style={{ fontFamily: "'Fira Code', 'Consolas', monospace" }} />
          </Form.Item>
          <Form.Item name="schema" label="Schema">
            <Input placeholder="public" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SavedQueries