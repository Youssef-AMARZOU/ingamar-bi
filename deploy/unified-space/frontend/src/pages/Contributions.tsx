import React, { useState } from 'react'
import { Table, Button, Card, message, Tag } from 'antd'
import { EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'

const mockContributions = [
  {
    id: 1,
    title: 'Sales Dashboard',
    contribution_type: 'dashboard',
    status: 'pending',
    submitter: 'john_doe',
    created_at: '2026-05-20T10:00:00Z'
  },
  {
    id: 2,
    title: 'Revenue Chart',
    contribution_type: 'chart',
    status: 'approved',
    submitter: 'jane_smith',
    created_at: '2026-05-19T15:30:00Z'
  },
  {
    id: 3,
    title: 'User Metrics Dataset',
    contribution_type: 'dataset',
    status: 'rejected',
    submitter: 'bob_wilson',
    created_at: '2026-05-18T09:15:00Z'
  },
]

const Contributions: React.FC = () => {
  const [contributions, setContributions] = useState(mockContributions)

  const handleReview = async (id: number, status: 'approved' | 'rejected') => {
    setContributions(prev =>
      prev.map(c => c.id === id ? { ...c, status } : c)
    )
    message.success(`Contribution ${status}`)
  }

  const statusColor: Record<string, string> = {
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
    merged: 'blue'
  }

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    {
      title: 'Type',
      dataIndex: 'contribution_type',
      key: 'type',
      render: (type: string) => <Tag>{type}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColor[status]}>{status}</Tag>
    },
    { title: 'Submitter', dataIndex: 'submitter', key: 'submitter' },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <>
          <Button icon={<EyeOutlined />} size="small" style={{ marginRight: 8 }} />
          {record.status === 'pending' && (
            <>
              <Button
                icon={<CheckOutlined />}
                type="primary"
                size="small"
                style={{ marginRight: 8 }}
                onClick={() => handleReview(record.id, 'approved')}
              />
              <Button
                icon={<CloseOutlined />}
                danger
                size="small"
                onClick={() => handleReview(record.id, 'rejected')}
              />
            </>
          )}
        </>
      ),
    },
  ]

  return (
    <div>
      <h2>Contributions</h2>
      <Card>
        <Table
          columns={columns}
          dataSource={contributions}
          rowKey="id"
        />
      </Card>
    </div>
  )
}

export default Contributions
