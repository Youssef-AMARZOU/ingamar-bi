import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Table, Button, Space, Card, Tabs, Tag, Statistic, Row, Col,
  Modal, Form, Input, Select, message, Tooltip, Badge, Progress,
  Popconfirm, Divider, Typography, InputNumber, Switch, Alert
} from 'antd'
import {
  DatabaseOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  ReloadOutlined, FilterOutlined, FunctionOutlined, CopyOutlined,
  SortAscendingOutlined, CheckCircleOutlined, WarningOutlined,
  InfoCircleOutlined, ThunderboltOutlined, BarChartOutlined
} from '@ant-design/icons'
import { datasetService } from '../services'
import api from '../services/api'

const { Text, Title } = Typography

const TYPE_COLORS: Record<string, string> = {
  'integer': 'blue',
  'bigint': 'blue',
  'float': 'green',
  'double': 'green',
  'string': 'orange',
  'text': 'orange',
  'boolean': 'purple',
  'datetime': 'cyan',
  'date': 'cyan',
  'timestamp': 'cyan',
}

const ETLPage: React.FC = () => {
  const { tableName } = useParams<{ tableName: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [modalType, setModalType] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    if (tableName) {
      fetchProfile()
      fetchPreview()
    }
  }, [tableName])

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const resp = await api.get(`/datasets/${tableName}/profile`)
      setProfile(resp.data)
    } catch (e: any) {
      message.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchPreview = async () => {
    try {
      const resp = await datasetService.preview(tableName || '', 50)
      setPreview(resp)
    } catch (e: any) {
      message.error('Failed to load preview')
    }
  }

  const handleModal = (type: string) => {
    setModalType(type)
    form.resetFields()
  }

  const handleTransform = async () => {
    try {
      const values = form.getFieldsValue()
      let resp

      switch (modalType) {
        case 'rename':
          resp = await api.post(`/datasets/${tableName}/rename-column`, {
            old_name: values.old_name,
            new_name: values.new_name,
          })
          break
        case 'drop':
          resp = await api.post(`/datasets/${tableName}/drop-columns`, {
            columns: values.columns,
          })
          break
        case 'cast':
          resp = await api.post(`/datasets/${tableName}/cast-column`, {
            column: values.column,
            type: values.type,
          })
          break
        case 'fill':
          resp = await api.post(`/datasets/${tableName}/fill-nulls`, {
            fills: [{ column: values.column, strategy: values.strategy, value: values.value }],
          })
          break
        case 'derive':
          resp = await api.post(`/datasets/${tableName}/derive`, {
            name: values.name,
            expression: values.expression,
          })
          break
        case 'deduplicate':
          resp = await api.post(`/datasets/${tableName}/deduplicate`, {
            subset: values.subset || undefined,
          })
          break
        case 'duplicate':
          resp = await api.post(`/datasets/${tableName}/duplicate`, {
            name: values.name,
          })
          break
        case 'filter':
          resp = await api.post(`/datasets/${tableName}/filter`, {
            filters: [{ column: values.column, operator: values.operator, value: values.value }],
            save_as: values.save_as || undefined,
          })
          break
      }

      if (resp?.data) {
        message.success(resp.data.message || 'Transform applied')
        setModalType(null)
        fetchProfile()
        fetchPreview()
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Transform failed')
    }
  }

  const profileColumns = [
    {
      title: 'Column',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: any) => (
        <Tag color={TYPE_COLORS[type.toLowerCase()] || 'default'}>{type}</Tag>
      ),
    },
    {
      title: 'Nulls',
      key: 'nulls',
      render: (_: any, record: any) => (
        <Space>
          <Progress
            percent={record.null_pct}
            size="small"
            strokeColor={record.null_pct > 50 ? '#ff4d4f' : record.null_pct > 10 ? '#faad14' : '#52c41a'}
            style={{ width: 80 }}
          />
          <Text type="secondary">{record.null_count}</Text>
        </Space>
      ),
    },
    {
      title: 'Unique',
      key: 'unique',
      render: (_: any, record: any) => (
        <Text>{record.unique_count} ({record.unique_pct}%)</Text>
      ),
    },
    {
      title: 'Stats',
      key: 'stats',
      render: (_: any, record: any) => {
        if (record.is_numeric && record.mean !== null) {
          return (
            <Space size={4}>
              <Tag>min: {record.min}</Tag>
              <Tag>max: {record.max}</Tag>
              <Tag>μ: {record.mean}</Tag>
            </Space>
          )
        }
        if (record.top_values) {
          return (
            <Space wrap size={2}>
              {record.top_values.slice(0, 3).map((v: any, i: number) => (
                <Tag key={i} style={{ fontSize: 10 }}>{v.value} ({v.count})</Tag>
              ))}
            </Space>
          )
        }
        return <Text type="secondary">-</Text>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_: any, record: any) => (
        <Space size={2}>
          <Tooltip title="Rename">
            <Button size="small" icon={<EditOutlined />} onClick={() => { handleModal('rename'); form.setFieldsValue({ old_name: record.name }) }} />
          </Tooltip>
          <Tooltip title="Cast Type">
            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => { handleModal('cast'); form.setFieldsValue({ column: record.name }) }} />
          </Tooltip>
          <Tooltip title="Fill Nulls">
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => { handleModal('fill'); form.setFieldsValue({ column: record.name }) }} />
          </Tooltip>
          <Popconfirm title="Drop this column?" onConfirm={async () => {
            try {
              const resp = await api.post(`/datasets/${tableName}/drop-columns`, { columns: [record.name] })
              message.success(resp.data.message)
              fetchProfile()
              fetchPreview()
            } catch (e: any) { message.error(e?.response?.data?.error || 'Failed') }
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const previewColumns = preview?.columns?.map((col: string) => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    render: (val: any) => val === null ? <Text type="secondary">null</Text> : String(val),
  })) || []

  const totalNulls = profile?.columns?.reduce((sum: number, c: any) => sum + c.null_count, 0) || 0
  const totalCells = (profile?.row_count || 0) * (profile?.column_count || 0)
  const dataQuality = totalCells > 0 ? Math.round((1 - totalNulls / totalCells) * 100) : 100

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DatabaseOutlined /> {tableName}
          </Title>
          <Text type="secondary">
            {profile?.row_count?.toLocaleString()} rows × {profile?.column_count} columns
            {profile?.duplicate_rows > 0 && ` • ${profile.duplicate_rows} duplicates`}
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchProfile(); fetchPreview() }}>Refresh</Button>
          <Button icon={<BarChartOutlined />} type="primary" onClick={() => navigate(`/charts/new?dataset=${tableName}`)}>
            Visualize
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => handleModal('duplicate')}>Duplicate</Button>
          <Button icon={<FilterOutlined />} onClick={() => handleModal('filter')}>Filter</Button>
          <Button icon={<FunctionOutlined />} onClick={() => handleModal('derive')}>Derive Column</Button>
          <Button icon={<CheckCircleOutlined />} onClick={() => handleModal('deduplicate')}>Deduplicate</Button>
          <Popconfirm title="Delete this dataset?" onConfirm={async () => {
            try {
              await datasetService.delete(tableName || '')
              message.success('Dataset deleted')
              navigate('/datasets')
            } catch (e: any) { message.error('Failed') }
          }}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Data Quality" value={dataQuality} suffix="%" valueStyle={{ color: dataQuality > 90 ? '#52c41a' : dataQuality > 70 ? '#faad14' : '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Total Nulls" value={totalNulls} valueStyle={{ color: totalNulls > 0 ? '#ff4d4f' : '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Duplicates" value={profile?.duplicate_rows || 0} valueStyle={{ color: (profile?.duplicate_rows || 0) > 0 ? '#faad14' : '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Memory" value={profile?.memory_mb || 0} suffix="MB" precision={2} />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} size="small">
        <Tabs.TabPane tab={<span><InfoCircleOutlined /> Profile</span>} key="profile">
          <Card size="small" bodyStyle={{ padding: 0 }}>
            <Table
              columns={profileColumns}
              dataSource={profile?.columns || []}
              rowKey="name"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><DatabaseOutlined /> Preview</span>} key="preview">
          <Card size="small" bodyStyle={{ padding: 0 }}>
            <Table
              columns={previewColumns}
              dataSource={preview?.data || []}
              rowKey={(_, i) => String(i)}
              loading={!preview}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={{
          rename: 'Rename Column',
          drop: 'Drop Columns',
          cast: 'Cast Column Type',
          fill: 'Fill Null Values',
          derive: 'Derive New Column',
          deduplicate: 'Remove Duplicates',
          duplicate: 'Duplicate Dataset',
          filter: 'Filter Rows',
        }[modalType || '']}
        open={!!modalType}
        onCancel={() => setModalType(null)}
        onOk={handleTransform}
      >
        <Form form={form} layout="vertical" size="small">
          {modalType === 'rename' && (
            <>
              <Form.Item name="old_name" label="Current Name" rules={[{ required: true }]}>
                <Input disabled />
              </Form.Item>
              <Form.Item name="new_name" label="New Name" rules={[{ required: true }]}>
                <Input placeholder="new_column_name" />
              </Form.Item>
            </>
          )}

          {modalType === 'drop' && (
            <Form.Item name="columns" label="Columns to Drop" rules={[{ required: true }]}>
              <Select mode="multiple" options={profile?.columns?.map((c: any) => ({ label: c.name, value: c.name }))} />
            </Form.Item>
          )}

          {modalType === 'cast' && (
            <>
              <Form.Item name="column" label="Column" rules={[{ required: true }]}>
                <Select options={profile?.columns?.map((c: any) => ({ label: c.name, value: c.name }))} />
              </Form.Item>
              <Form.Item name="type" label="Target Type" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Integer', value: 'integer' },
                  { label: 'Float', value: 'float' },
                  { label: 'String', value: 'string' },
                  { label: 'Boolean', value: 'boolean' },
                  { label: 'Datetime', value: 'datetime' },
                ]} />
              </Form.Item>
            </>
          )}

          {modalType === 'fill' && (
            <>
              <Form.Item name="column" label="Column" rules={[{ required: true }]}>
                <Select options={profile?.columns?.map((c: any) => ({ label: c.name, value: c.name }))} />
              </Form.Item>
              <Form.Item name="strategy" label="Strategy" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Fixed Value', value: 'value' },
                  { label: 'Mean', value: 'mean' },
                  { label: 'Median', value: 'median' },
                  { label: 'Mode', value: 'mode' },
                  { label: 'Forward Fill', value: 'forward' },
                  { label: 'Backward Fill', value: 'backward' },
                  { label: 'Drop Rows', value: 'drop' },
                ]} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.strategy !== curr.strategy}>
                {({ getFieldValue }) =>
                  getFieldValue('strategy') === 'value' && (
                    <Form.Item name="value" label="Fill Value" rules={[{ required: true }]}>
                      <Input placeholder="e.g. 0, unknown, N/A" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </>
          )}

          {modalType === 'derive' && (
            <>
              <Form.Item name="name" label="New Column Name" rules={[{ required: true }]}>
                <Input placeholder="new_column" />
              </Form.Item>
              <Form.Item name="expression" label="Expression" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="e.g. {col1} + {col2} or {col1} * 1.1" />
              </Form.Item>
              <Alert message="Use {column_name} to reference columns. Supports math operations." type="info" showIcon style={{ fontSize: 12 }} />
            </>
          )}

          {modalType === 'deduplicate' && (
            <>
              <Form.Item name="subset" label="Check Duplicates On (leave empty for all columns)">
                <Select mode="multiple" options={profile?.columns?.map((c: any) => ({ label: c.name, value: c.name }))} />
              </Form.Item>
            </>
          )}

          {modalType === 'duplicate' && (
            <Form.Item name="name" label="New Dataset Name" rules={[{ required: true }]}>
              <Input placeholder={`${tableName}_copy`} />
            </Form.Item>
          )}

          {modalType === 'filter' && (
            <>
              <Form.Item name="column" label="Column" rules={[{ required: true }]}>
                <Select options={profile?.columns?.map((c: any) => ({ label: c.name, value: c.name }))} />
              </Form.Item>
              <Form.Item name="operator" label="Operator" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Equals', value: '==' },
                  { label: 'Not Equals', value: '!=' },
                  { label: 'Greater Than', value: '>' },
                  { label: 'Less Than', value: '<' },
                  { label: 'Contains', value: 'contains' },
                  { label: 'Is Not Null', value: 'notnull' },
                  { label: 'Is Null', value: 'isnull' },
                ]} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.operator !== curr.operator}>
                {({ getFieldValue }) =>
                  !['notnull', 'isnull'].includes(getFieldValue('operator')) && (
                    <Form.Item name="value" label="Value" rules={[{ required: true }]}>
                      <Input placeholder="Filter value" />
                    </Form.Item>
                  )
                }
              </Form.Item>
              <Form.Item name="save_as" label="Save as new dataset (leave empty to overwrite)">
                <Input placeholder="filtered_dataset_name" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default ETLPage
