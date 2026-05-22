import React, { useState, useEffect } from 'react'
import { Table, Card, Tag, Input, Space, Button, Modal, Typography, Progress, message } from 'antd'
import { SearchOutlined, UploadOutlined, RobotOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import DataUpload from '../components/DataUpload'
import AIAssistant from '../components/AIAssistant'
import { datasetService } from '../services'

const { Title } = Typography

const Datasets: React.FC = () => {
  const [searchText, setSearchText] = useState('')
  const [datasets, setDatasets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<any>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDatasets = async () => {
    setLoading(true)
    try {
      const data = await datasetService.list()
      setDatasets(data.datasets || [])
    } catch (error) {
      message.error('Failed to load datasets')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDatasets()
    setRefreshing(false)
    message.success('Datasets refreshed')
  }

  useEffect(() => {
    fetchDatasets()
  }, [])

  const handlePreview = async (record: any) => {
    try {
      const data = await datasetService.preview(record.id)
      setPreviewData(data)
      setPreviewOpen(true)
    } catch (error) {
      message.error('Failed to load preview')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await datasetService.delete(id)
      message.success('Dataset deleted')
      fetchDatasets()
    } catch (error) {
      message.error('Failed to delete dataset')
    }
  }

  const handleAiSuccess = () => {
    fetchDatasets()
  }

  const filteredDatasets = datasets.filter((d: any) =>
    d.table_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    d.source?.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'Name', dataIndex: 'table_name', key: 'table_name' },
    { title: 'Source', dataIndex: 'source', key: 'source' },
    { 
      title: 'Rows', 
      dataIndex: 'row_count', 
      key: 'row_count',
      render: (count: number) => count?.toLocaleString()
    },
    { title: 'Columns', dataIndex: 'column_count', key: 'column_count' },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => (
        <Tag color={record.status === 'ready' ? 'green' : 'orange'}>
          {record.status || 'Ready'}
        </Tag>
      )
    },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          >
            Preview
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<RobotOutlined />}
            onClick={() => {
              setSelectedDataset(record)
              setAiOpen(true)
            }}
          >
            AI
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      )
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Datasets</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing}>
            Refresh
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            Import Data
          </Button>
        </Space>
      </div>
      
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search datasets..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </Space>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredDatasets}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <DataUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={fetchDatasets}
      />

      <AIAssistant
        open={aiOpen}
        onClose={() => {
          setAiOpen(false)
          setSelectedDataset(null)
        }}
        datasetId={selectedDataset?.id}
        datasetName={selectedDataset?.table_name}
        columns={selectedDataset?.columns?.map((c: any) => c.name)}
        onSuccess={handleAiSuccess}
      />

      <Modal
        title={`Preview: ${previewData?.table_name}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={previewData?.data || []}
          columns={previewData?.columns?.map((col: string) => ({
            title: col,
            dataIndex: col,
            key: col,
          })) || []}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: true }}
        />
      </Modal>
    </div>
  )
}

export default Datasets
