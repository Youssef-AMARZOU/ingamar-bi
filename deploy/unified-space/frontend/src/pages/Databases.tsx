import React, { useState } from 'react'
import { Table, Button, Space, Modal, Form, Input, message, Card, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { sqlLabService } from '../services'

const Databases: React.FC = () => {
  const [databases, setDatabases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
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

  const handleCreate = async (values: any) => {
    try {
      await sqlLabService.createDatabase(values)
      message.success('Database added')
      setModalVisible(false)
      form.resetFields()
      fetchDatabases()
    } catch (error) {
      message.error('Failed to add database')
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
      title: 'Async',
      dataIndex: 'allow_run_async',
      key: 'async',
      render: (val: boolean) => <Tag color={val ? 'green' : 'red'}>{val ? 'Yes' : 'No'}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} />
          <Button icon={<DeleteOutlined />} danger />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Databases</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          Add Database
        </Button>
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
        title="Add Database"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="database_name" label="Display Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="sqlalchemy_uri"
            label="SQLAlchemy URI"
            rules={[{ required: true }]}
            tooltip="e.g., postgresql://user:password@host:5432/dbname"
          >
            <Input />
          </Form.Item>
          <Form.Item name="cache_timeout" label="Cache Timeout (seconds)">
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Databases
