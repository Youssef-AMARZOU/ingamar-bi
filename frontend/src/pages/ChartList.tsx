import React, { useState, useEffect, useMemo } from 'react'
import { Table, Button, Space, Modal, Form, Input, Select, message, Card, Collapse, Tag, Radio } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined, SortAscendingOutlined, BarChartOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { chartService } from '../services'

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'area', label: 'Area Chart' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'table', label: 'Table' },
  { value: 'big_number', label: 'Big Number' },
  { value: 'map', label: 'Map' },
  { value: 'sunburst', label: 'Sunburst' },
  { value: 'treemap', label: 'Treemap' },
  { value: 'funnel', label: 'Funnel' },
]

type SortKey = 'name' | 'created_at' | 'type'

const ChartList: React.FC = () => {
  const [charts, setCharts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [sortBy, setSortBy] = useState<SortKey>('created_at')
  const navigate = useNavigate()

  const fetchCharts = async () => {
    setLoading(true)
    try {
      const data = await chartService.list()
      setCharts(data.charts || [])
    } catch (error) {
      message.error('Failed to load charts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCharts()
  }, [])

  const handleCreate = async (values: any) => {
    try {
      await chartService.create(values)
      message.success('Chart created')
      setModalVisible(false)
      form.resetFields()
      fetchCharts()
    } catch (error) {
      message.error('Failed to create chart')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await chartService.delete(id)
      message.success('Chart deleted')
      fetchCharts()
    } catch (error) {
      message.error('Failed to delete chart')
    }
  }

  const sortedCharts = useMemo(() => {
    const sorted = [...charts]
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.chart_name.localeCompare(b.chart_name))
        break
      case 'type':
        sorted.sort((a, b) => a.viz_type.localeCompare(b.viz_type))
        break
      case 'created_at':
      default:
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
    }
    return sorted
  }, [charts, sortBy])

  const groupedCharts = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const ungrouped: any[] = []
    for (const chart of sortedCharts) {
      const dsName = chart.datasource_name
      if (dsName) {
        if (!groups[dsName]) groups[dsName] = []
        groups[dsName].push(chart)
      } else {
        ungrouped.push(chart)
      }
    }
    const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    return { groups: entries, ungrouped }
  }, [sortedCharts])

  const columns = [
    { title: 'Name', dataIndex: 'chart_name', key: 'name' },
    { title: 'Type', dataIndex: 'viz_type', key: 'type', render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (d: string) => new Date(d).toLocaleDateString() },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/charts/${record.id}`)} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Charts</h2>
        <Space wrap>
          <Radio.Group value={sortBy} onChange={e => setSortBy(e.target.value)} optionType="button" buttonStyle="solid" size="small">
            <Radio.Button value="created_at"><SortAscendingOutlined /> Date</Radio.Button>
            <Radio.Button value="name"><SortAscendingOutlined /> Name</Radio.Button>
            <Radio.Button value="type"><SortAscendingOutlined /> Type</Radio.Button>
          </Radio.Group>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            New Chart
          </Button>
        </Space>
      </div>

      {!loading && groupedCharts.groups.length === 0 && groupedCharts.ungrouped.length === 0 ? (
        <Card className="mb-card" style={{ textAlign: 'center', padding: 60 }}>
          <BarChartOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>No charts yet</div>
          <div style={{ color: '#9ca3af', marginBottom: 24 }}>
            Import a dataset and use AI analysis to create your first chart.
          </div>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/datasets')}>
              Import Data
            </Button>
            <Button icon={<BarChartOutlined />} onClick={() => setModalVisible(true)}>
              Create Manually
            </Button>
          </Space>
        </Card>
      ) : (
        <>
          {groupedCharts.groups.map(([dsName, dsCharts]) => (
            <Card
              key={dsName}
              title={<span><FolderOutlined /> {dsName}</span>}
              size="small"
              style={{ marginBottom: 12 }}
              extra={<Tag>{dsCharts.length} chart{dsCharts.length > 1 ? 's' : ''}</Tag>}
            >
              <Table
                columns={columns}
                dataSource={dsCharts}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="small"
              />
            </Card>
          ))}
          {groupedCharts.ungrouped.length > 0 && (
            <Card
              title={<span><FolderOutlined /> Uncategorized</span>}
              size="small"
              style={{ marginBottom: 12 }}
              extra={<Tag>{groupedCharts.ungrouped.length} chart{groupedCharts.ungrouped.length > 1 ? 's' : ''}</Tag>}
            >
              <Table
                columns={columns}
                dataSource={groupedCharts.ungrouped}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </>
      )}

      <Modal
        title="Create Chart"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="chart_name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="viz_type" label="Chart Type" rules={[{ required: true }]}>
            <Select options={CHART_TYPES} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ChartList