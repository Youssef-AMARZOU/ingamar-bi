import React, { useState, useEffect } from 'react'
import { Table, Button, Space, Modal, Form, Input, message, Card } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { dashboardService } from '../services'
import { useAuthStore } from '../store/auth'

const DashboardList: React.FC = () => {
  const [dashboards, setDashboards] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const fetchDashboards = async () => {
    setLoading(true)
    try {
      const data = await dashboardService.list()
      setDashboards(data.dashboards || [])
    } catch (error: any) {
      console.error('[DashboardList] fetchDashboards error:', error?.response?.data, error?.message)
      message.error('Failed to load dashboards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboards()
  }, [])

  const handleCreate = async (values: any) => {
    try {
      await dashboardService.create({
        ...values,
        owner_id: user?.id
      })
      message.success('Dashboard created')
      setModalVisible(false)
      form.resetFields()
      fetchDashboards()
    } catch (error) {
      message.error('Failed to create dashboard')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await dashboardService.delete(id)
      message.success('Dashboard deleted')
      fetchDashboards()
    } catch (error) {
      message.error('Failed to delete dashboard')
    }
  }

  const columns = [
    { title: 'Title', dataIndex: 'dashboard_title', key: 'title' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/dashboards/${record.id}`)} />
          <Button icon={<EditOutlined />} onClick={() => navigate(`/dashboards/${record.id}`)} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Dashboards</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          New Dashboard
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={dashboards}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title="Create Dashboard"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="dashboard_title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DashboardList
