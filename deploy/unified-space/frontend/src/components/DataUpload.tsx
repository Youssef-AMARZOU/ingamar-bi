import React, { useState } from 'react'
import { Modal, Upload, Button, Progress, message, Typography, Input, Tabs, Space, Alert } from 'antd'
import { InboxOutlined, UploadOutlined, LinkOutlined } from '@ant-design/icons'
import { datasetService } from '../services'

const { Text } = Typography
const { Dragger } = Upload

interface DataUploadProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const DataUpload: React.FC<DataUploadProps> = ({ open, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('file')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [kaggleUrl, setKaggleUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setProgress(0)
    setProgressMsg('Uploading file...')
    setError(null)

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 80) {
          clearInterval(interval)
          return 80
        }
        return prev + Math.random() * 15
      })
    }, 200)

    try {
      setProgressMsg('Processing data...')
      const result = await datasetService.upload(file)
      clearInterval(interval)
      setProgress(100)
      setProgressMsg('Done!')
      message.success(`"${file.name}" imported (${result.rows} rows, ${result.columns} columns)`)
      onSuccess()
      onClose()
    } catch (err: any) {
      clearInterval(interval)
      const detail = err?.response?.data?.error || err?.message || 'Unknown error'
      setError(detail)
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
      title="Import Data"
      open={open}
      onCancel={!uploading ? onClose : undefined}
      footer={null}
      width={600}
      closable={!uploading}
      maskClosable={!uploading}
    >
      <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key); setError(null) }}>
        <Tabs.TabPane
          tab={<span><UploadOutlined /> Upload File</span>}
          key="file"
        >
          <div style={{ padding: '20px 0' }}>
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
    </Modal>
  )
}

export default DataUpload
