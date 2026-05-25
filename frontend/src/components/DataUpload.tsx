import React, { useState } from 'react'
import { Modal, Upload, Button, Progress, message, Typography, Input, Tabs, Space, Alert, Card, Table, Tag, Steps, Divider } from 'antd'
import { InboxOutlined, UploadOutlined, LinkOutlined, CheckCircleOutlined, RobotOutlined, BarChartOutlined, TableOutlined } from '@ant-design/icons'
import { datasetService } from '../services'

const { Text, Title } = Typography
const { Dragger } = Upload

interface ColMeta {
  name: string; type: string; null_pct: number; sample_values: any[]
}
interface Recommendation {
  title: string; chart_type: string; x_column: string
  y_columns: string[]; aggregation: string; reason: string
}
interface UploadResult {
  table_name: string; rows: number; columns: number
  column_names: string[]; column_metadata?: ColMeta[]
  chart_recommendations?: Recommendation[]
}

interface DataUploadProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const CHART_COLORS: Record<string, string> = {
  bar: '#1890ff', line: '#52c41a',
  pie: '#faad14', scatter: '#f5222d', area: '#722ed1',
}

const DataUpload: React.FC<DataUploadProps> = ({ open, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('file')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [kaggleUrl, setKaggleUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [step, setStep] = useState(0)

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setProgress(0)
    setProgressMsg('Uploading file...')
    setError(null)
    setUploadResult(null)
    setStep(1)

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + Math.random() * 10
      })
    }, 300)

    try {
      setStep(2)
      setProgressMsg('Processing data...')
      const result = await datasetService.upload(file)
      clearInterval(interval)
      setProgress(100)
      setProgressMsg('Done!')
      setUploadResult(result)
      setStep(3)
      onSuccess()
    } catch (err: any) {
      clearInterval(interval)
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      setError(detail)
      setStep(0)
    } finally {
      setUploading(false)
      setProgress(0)
      setProgressMsg('')
    }
  }

  const handleKaggleImport = async () => {
    if (!kaggleUrl) {
      setError('Please enter a Kaggle dataset URL')
      return
    }
    setError(null)
    if (!kaggleUrl.includes('kaggle.com/datasets/')) {
      setError('URL must be a Kaggle dataset URL like: https://www.kaggle.com/datasets/username/dataset-name')
      return
    }

    setUploading(true)
    setProgress(0)
    setProgressMsg('Downloading from Kaggle...')

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + Math.random() * 10
      })
    }, 500)

    try {
      setProgressMsg('Importing data...')
      const result = await datasetService.importFromKaggle(kaggleUrl)
      clearInterval(interval)
      setProgress(100)
      setProgressMsg('Done!')
      const tables = result.tables || []
      message.success(`Kaggle dataset imported! ${tables.length} table(s), ${result.total_rows} rows`)
      onSuccess()
      onClose()
    } catch (err: any) {
      clearInterval(interval)
      const detail = err?.response?.data?.error || err?.message || 'Failed to import'
      const status = err?.response?.data?.status
      if (status === 'auth_required' || status === 'auth_failed') {
        setError('Kaggle authentication required. Add your Kaggle API key in Settings page (click your profile icon -> Settings).')
      } else {
        setError(detail)
      }
    } finally {
      setUploading(false)
      setProgress(0)
      setProgressMsg('')
    }
  }

  const resetUpload = () => {
    setUploadResult(null)
    setStep(0)
    setError(null)
  }

  const colTableCols = [
    { title: 'Column', dataIndex: 'name', key: 'name',
      render: (v: string) => <code>{v}</code> },
    { title: 'Type', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Nulls %', dataIndex: 'null_pct', key: 'null_pct',
      render: (v: number) => (
        <Tag color={v > 20 ? 'red' : v > 5 ? 'orange' : 'green'}>{v}%</Tag>
      )},
    { title: 'Sample', dataIndex: 'sample_values', key: 'sample_values',
      render: (v: any[]) => v?.slice(0, 3).map(String).join(', ') || '-' },
  ]

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv,.tsv,.xlsx,.xls,.parquet,.json',
    beforeUpload: (file: File) => {
      handleFileUpload(file)
      return false
    },
    showUploadList: false,
  }

  return (
    <Modal
      title={uploadResult ? 'Import Results' : 'Import Data'}
      open={open}
      onCancel={!uploading ? onClose : undefined}
      footer={null}
      width={uploadResult ? 700 : 600}
      closable={!uploading}
      maskClosable={!uploading}
    >
      {!uploadResult ? (
        <>
          <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key); setError(null) }}>
            <Tabs.TabPane
              tab={<span><UploadOutlined /> Upload File</span>}
              key="file"
            >
              <div style={{ padding: '20px 0' }}>
                <Steps
                  current={step}
                  style={{ marginBottom: 24 }}
                  size="small"
                  items={[
                    { title: 'Select' },
                    { title: 'Upload' },
                    { title: 'Process' },
                  ]}
                />
                <Dragger {...uploadProps} disabled={uploading}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Click or drag file to this area</p>
                  <p className="ant-upload-hint">
                    CSV, TSV, Excel, Parquet, or JSON (max 50MB)
                  </p>
                </Dragger>

                {uploading && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Text type="secondary">{progressMsg}</Text>
                    <Progress percent={Math.round(progress)} status="active" />
                  </div>
                )}
              </div>
            </Tabs.TabPane>

            <Tabs.TabPane
              tab={<span><LinkOutlined /> Kaggle Link</span>}
              key="kaggle"
            >
              <div style={{ padding: '20px 0' }}>
                <Text style={{ marginBottom: 8, display: 'block' }}>
                  Paste a Kaggle dataset URL to download and import its CSV files
                </Text>
                <Input
                  placeholder="https://www.kaggle.com/datasets/username/dataset-name"
                  value={kaggleUrl}
                  onChange={(e) => { setKaggleUrl(e.target.value); setError(null) }}
                  prefix={<LinkOutlined />}
                  disabled={uploading}
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  onClick={handleKaggleImport}
                  loading={uploading}
                  block
                  disabled={!kaggleUrl}
                >
                  Import from Kaggle
                </Button>

                {uploading && (
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <Text type="secondary">{progressMsg}</Text>
                    <Progress percent={Math.round(progress)} status="active" />
                  </div>
                )}
              </div>
            </Tabs.TabPane>
          </Tabs>

          {error && (
            <Alert
              message="Import Error"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginTop: 8 }}
            />
          )}
        </>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            message={
              <span>
                <b>{uploadResult.column_names?.join(', ').substring(0, 60) || uploadResult.table_name}</b> imported —{' '}
                <b>{uploadResult.rows.toLocaleString()}</b> rows ×{' '}
                <b>{uploadResult.columns}</b> columns
              </span>
            }
            showIcon
          />

          {uploadResult.column_metadata && uploadResult.column_metadata.length > 0 && (
            <Card title={<><TableOutlined /> Column Profile</>} size="small">
              <Table
                dataSource={uploadResult.column_metadata}
                columns={colTableCols}
                rowKey="name"
                pagination={false}
                size="small"
              />
            </Card>
          )}

          {uploadResult.chart_recommendations && uploadResult.chart_recommendations.length > 0 && (
            <Card title={<><RobotOutlined /> AI Chart Recommendations</>} size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                {uploadResult.chart_recommendations.map((rec, i) => (
                  <Card
                    key={i}
                    size="small"
                    style={{ background: '#fafafa' }}
                  >
                    <Space>
                      <Tag color={CHART_COLORS[rec.chart_type]}>
                        {rec.chart_type.toUpperCase()}
                      </Tag>
                      <Text strong>{rec.title}</Text>
                    </Space>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {rec.reason}
                    </Text>
                    <br />
                    <Text style={{ fontSize: 11, color: '#888' }}>
                      X: <code>{rec.x_column}</code> · Y: <code>{rec.y_columns.join(', ')}</code> · {rec.aggregation}
                    </Text>
                  </Card>
                ))}
              </Space>
            </Card>
          )}

          <Divider />
          <Space>
            <Button onClick={() => { resetUpload(); onClose() }}>Close</Button>
            <Button type="primary" onClick={resetUpload}>Upload another dataset</Button>
          </Space>
        </Space>
      )}
    </Modal>
  )
}

export default DataUpload