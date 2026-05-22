import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Select, message, Card, Tag } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { authService } from '../services'

const ROLES = ['Admin', 'Data Engineer', 'Analyst', 'Contributor', 'Reviewer', 'Viewer']

const roleColor: Record<string, string> = {
  Admin: 'red',
  'Data Engineer': 'blue',
  Analyst: 'green',
  Contributor: 'orange',
  Reviewer: 'purple',
  Viewer: 'default'
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await authService.getUsers()
      setUsers(data)
    } catch (error: any) {
      console.error('[Users] fetchUsers error:', error?.response?.data, error?.message)
      message.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleEditRoles = (user: any) => {
    setSelectedUser(user)
    form.setFieldsValue({ roles: user.roles })
    setModalVisible(true)
  }

  const handleSaveRoles = async (values: any) => {
    try {
      await authService.assignRoles(selectedUser.id, values.roles)
      message.success('Roles updated')
      setModalVisible(false)
      fetchUsers()
    } catch (error) {
      message.error('Failed to update roles')
    }
  }

  const columns = [
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Name', dataIndex: 'first_name', key: 'name', render: (_: any, r: any) => `${r.first_name} ${r.last_name}` },
    {
      title: 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <>
          {roles.map(role => (
            <Tag color={roleColor[role]} key={role}>{role}</Tag>
          ))}
        </>
      )
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button icon={<EditOutlined />} onClick={() => handleEditRoles(record)} />
      ),
    },
  ]

  return (
    <div>
      <h2>Users Management</h2>
      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={`Edit Roles - ${selectedUser?.username}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSaveRoles} layout="vertical">
          <Form.Item name="roles" label="Roles" rules={[{ required: true }]}>
            <Select mode="multiple" options={ROLES.map(r => ({ label: r, value: r }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
