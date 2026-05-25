import React, { useState, useEffect, useCallback } from 'react'
import { Row, Col, Select, Button, Input, Table, Card, message, Tabs, Tree, Typography, Badge, Space, Tooltip, Tag, Modal, Drawer, Descriptions, Form } from 'antd'
import { PlayCircleOutlined, SaveOutlined, ClearOutlined, DatabaseOutlined, TableOutlined, ColumnHeightOutlined, HistoryOutlined, ReloadOutlined, EyeOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { sqlLabService } from '../services'
import { useLocation } from 'react-router-dom'

const { Text, Title } = Typography
const { TextArea } = Input

interface QueryTab {
  key: string
  title: string
  sql: string
  results: any[]
  columns: any[]
  status: string | null
  rowcount: number
  error: string | null
}

const SQLLab: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [databases, setDatabases] = useState<any[]>([])
  const [selectedDb, setSelectedDb] = useState<number | null>(null)
  const [dbSchema, setDbSchema] = useState<any[]>([])
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([
    { key: '1', title: 'Query 1', sql: location.state?.sql || '', results: [], columns: [], status: null, rowcount: 0, error: null }
  ])
  const [activeTab, setActiveTab] = useState('1')
  const [running, setRunning] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [saveForm] = Form.useForm()
  const [params, setParams] = useState<Record<string, string>>({})
  const [paramFields, setParamFields] = useState<string[]>([])

  const currentTab = queryTabs.find(t => t.key === activeTab) || queryTabs[0]

  useEffect(() => {
    fetchDatabases()
    if (location.state?.databaseId) {
      setSelectedDb(location.state.databaseId)
    }
  }, [])

  useEffect(() => {
    if (selectedDb) {
      fetchSchema()
    }
  }, [selectedDb])

  useEffect(() => {
    if (selectedDb) {
      fetchSchema()
    }
  }, [selectedDb])

  const fetchDatabases = async () => {
    try {
      const data = await sqlLabService.getDatabases()
      setDatabases(data)
      if (data.length > 0 && !selectedDb) {
        setSelectedDb(data[0].id)
      }
    } catch (error: any) {
      console.error('[SQLLab] fetchDatabases error:', error?.response?.data, error?.message)
      message.error('Failed to load databases')
    }
  }

  const fetchSchema = async () => {
    if (!selectedDb) return
    setLoadingSchema(true)
    try {
      const result = await sqlLabService.executeQuery({
        database_id: selectedDb,
        sql: "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position",
        limit: 5000
      })
      
      if (result.status === 'success') {
        const tables: any = {}
        for (const row of result.data) {
          if (!tables[row.table_name]) {
            tables[row.table_name] = { name: row.table_name, columns: [] }
          }
          tables[row.table_name].columns.push({ name: row.column_name, type: row.data_type })
        }
        setDbSchema(Object.values(tables))
      } else {
        const tables_result = await sqlLabService.executeQuery({
          database_id: selectedDb,
          sql: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
          limit: 500
        })
        if (tables_result.status === 'success') {
          const tables = tables_result.data.map((r: any) => ({ name: r.table_name, columns: [] }))
          setDbSchema(tables)
        }
      }
    } catch (error) {
      console.error('Schema fetch error:', error)
    } finally {
      setLoadingSchema(false)
    }
  }

  const handlePreview = async (tableName: string) => {
    if (!selectedDb) return
    setPreviewLoading(true)
    setPreviewVisible(true)
    setPreviewData(null)
    try {
      const data = await sqlLabService.previewTable(selectedDb, tableName)
      setPreviewData(data)
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Preview failed')
      setPreviewVisible(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedDb) { message.error('Select a database first'); return }
    const sql = currentTab.sql.trim()
    if (!sql) { message.error('Enter a SQL query'); return }
    saveForm.setFieldsValue({
      name: currentTab.title,
      database_id: selectedDb,
      sql,
    })
    setSaveModalVisible(true)
  }

  const handleSaveSubmit = async (values: any) => {
    try {
      await sqlLabService.createSavedQuery(values)
      message.success('Query saved')
      setSaveModalVisible(false)
      saveForm.resetFields()
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Failed to save')
    }
  }

  const detectParams = (sql: string) => {
    const matches = sql.match(/\{\{(\w+)\}\}/g)
    if (matches) {
      const fields = matches.map(m => m.replace(/\{\{|\}\}/g, ''))
      setParamFields([...new Set(fields)])
    } else {
      setParamFields([])
    }
  }

  useEffect(() => {
    detectParams(currentTab.sql)
  }, [currentTab.sql])

  const addTab = () => {
    const newKey = String(queryTabs.length + 1)
    setQueryTabs([...queryTabs, { key: newKey, title: `Query ${newKey}`, sql: '', results: [], columns: [], status: null, rowcount: 0, error: null }])
    setActiveTab(newKey)
  }

  const closeTab = (key: string) => {
    if (queryTabs.length <= 1) return
    const remaining = queryTabs.filter(t => t.key !== key)
    setQueryTabs(remaining)
    if (activeTab === key) setActiveTab(remaining[remaining.length - 1].key)
  }

  const updateCurrentTab = useCallback((updates: Partial<QueryTab>) => {
    setQueryTabs(prev => prev.map(t => t.key === activeTab ? { ...t, ...updates } : t))
  }, [activeTab])

  const handleRun = async () => {
    if (!selectedDb) { message.error('Select a database'); return }
    const sql = currentTab.sql.trim()
    if (!sql) { message.error('Enter a SQL query'); return }

    setRunning(true)
    updateCurrentTab({ status: 'running', error: null })

    try {
      const result = await sqlLabService.executeQuery({ database_id: selectedDb, sql, limit: 100000, params: Object.keys(params).length > 0 ? params : undefined })
      
      if (result.status === 'success') {
        const cols = result.columns.map((c: string) => ({ title: c, dataIndex: c, key: c, ellipsis: true }))
        updateCurrentTab({ status: 'success', results: result.data, columns: cols, rowcount: result.rowcount })
        message.success(`${result.rowcount} rows returned`)
      } else if (result.status === 'failed') {
        updateCurrentTab({ status: 'failed', error: result.error })
        message.error(result.error)
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Query failed'
      updateCurrentTab({ status: 'failed', error: errMsg })
    } finally {
      setRunning(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Back</Button>
        <Text strong>SQL Lab</Text>
      </div>
      <Row gutter={16} style={{ flex: 1, overflow: 'hidden', paddingTop: 8 }}>
        <Col span={5} style={{ height: '100%' }}>
          <Card
            title={<Space><DatabaseOutlined /> Database</Space>}
            size="small"
            style={{ height: '100%', overflow: 'auto' }}
            bodyStyle={{ padding: 8 }}
          >
            <Select
              placeholder="Select database"
              style={{ width: '100%', marginBottom: 12 }}
              value={selectedDb}
              onChange={setSelectedDb}
              options={databases.map((db: any) => ({ label: db.database_name, value: db.id }))}
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
              <Text strong style={{ fontSize: 12 }}>SCHEMA</Text>
              <Button size="small" type="text" icon={<ReloadOutlined />} onClick={fetchSchema} loading={loadingSchema} />
            </div>

            {loadingSchema ? (
              <Text type="secondary" style={{ padding: '0 4px' }}>Loading...</Text>
            ) : (
              <Tree
                showIcon
                treeData={dbSchema.map((t: any) => ({
                  title: <Space size={4}>
                    <TableOutlined />
                    <Text style={{ fontSize: 12 }}>{t.name}</Text>
                    <Tooltip title="Preview data">
                      <Button size="small" type="text" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handlePreview(t.name) }} />
                    </Tooltip>
                  </Space>,
                  key: t.name,
                  selectable: false,
                  children: t.columns.map((c: any) => ({
                    title: <Space size={4} style={{ fontSize: 12 }}>
                      <ColumnHeightOutlined style={{ fontSize: 12 }} />
                      <Text style={{ fontSize: 12 }}>{c.name}</Text>
                      <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{c.type}</Tag>
                    </Space>,
                    key: `${t.name}.${c.name}`,
                    isLeaf: true,
                  }))
                }))}
                style={{ fontSize: 12 }}
              />
            )}
          </Card>
        </Col>

        <Col span={19} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Card
            size="small"
            bodyStyle={{ padding: 0 }}
            style={{ flex: '0 0 auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 8 }}>
              <Tabs
                type="editable-card"
                activeKey={activeTab}
                onChange={setActiveTab}
                onEdit={(e: any) => typeof e === 'string' ? closeTab(e) : addTab()}
                size="small"
                style={{ flex: 1, marginBottom: 0 }}
                tabBarStyle={{ marginBottom: 0 }}
                items={queryTabs.map(tab => ({
                  key: tab.key,
                  label: <Space size={4}>
                    {tab.status === 'running' && <Badge status="processing" />}
                    {tab.status === 'success' && <Badge status="success" />}
                    {tab.status === 'failed' && <Badge status="error" />}
                    {tab.title}
                  </Space>,
                  closable: queryTabs.length > 1,
                }))}
              />
              
              <Space>
                <Select
                  placeholder="Database"
                  size="small"
                  style={{ width: 140 }}
                  value={selectedDb}
                  onChange={setSelectedDb}
                  options={databases.map((db: any) => ({ label: db.database_name, value: db.id }))}
                />
                <Tooltip title="Save query">
                  <Button icon={<SaveOutlined />} onClick={handleSave}>Save</Button>
                </Tooltip>
                <Tooltip title="Run (Ctrl+Enter)">
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRun} loading={running}>
                    Run
                  </Button>
                </Tooltip>
              </Space>
            </div>
          </Card>

          <Card size="small" bodyStyle={{ padding: 0 }} style={{ flex: '0 0 auto', borderTop: 'none' }}>
            <TextArea
              value={currentTab.sql}
              onChange={e => updateCurrentTab({ sql: e.target.value })}
              onKeyDown={handleKeyDown}
              placeholder="Enter SQL query here (Ctrl+Enter to run)... Use {{variable}} for parameters"
              rows={8}
              style={{ fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 13, borderRadius: 0, border: 'none', resize: 'vertical' }}
            />
          </Card>

          {paramFields.length > 0 && (
            <Card size="small" title="Parameters" bodyStyle={{ padding: 8 }} style={{ flex: '0 0 auto', borderTop: 'none' }}>
              <Space wrap>
                {paramFields.map(p => (
                  <div key={p}>
                    <Text style={{ fontSize: 12, marginRight: 4 }}>{p}:</Text>
                    <Input
                      size="small"
                      style={{ width: 150 }}
                      placeholder={`Value for ${p}`}
                      value={params[p] || ''}
                      onChange={e => setParams(prev => ({ ...prev, [p]: e.target.value }))}
                    />
                  </div>
                ))}
              </Space>
            </Card>
          )}

          <Card
            size="small"
            title={
              <Space style={{ fontSize: 13 }}>
                <HistoryOutlined />
                Results
                {currentTab.status === 'success' && (
                  <Tag color="blue">{currentTab.rowcount} rows</Tag>
                )}
                {currentTab.status === 'failed' && (
                  <Tag color="red">Error</Tag>
                )}
              </Space>
            }
            bodyStyle={{ padding: 0 }}
            style={{ flex: 1, overflow: 'hidden', borderTop: 'none', borderRadius: '0 0 8px 8px' }}
          >
            {currentTab.status === 'failed' ? (
              <div style={{ padding: 16 }}>
                <Text type="danger">{currentTab.error}</Text>
              </div>
            ) : currentTab.status === 'success' ? (
              <div style={{ height: '100%', overflow: 'auto' }}>
                <Table
                  columns={currentTab.columns}
                  dataSource={currentTab.results.map((r, i) => ({ ...r, _key: i }))}
                  rowKey="_key"
                  size="small"
                  pagination={currentTab.results.length > 100 ? { pageSize: 100, size: 'small' } : false}
                  scroll={{ x: 'max-content', y: 300 }}
                  sticky
                />
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Text type="secondary">Run a query to see results</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={previewData ? `Preview: ${previewData.table_name}` : 'Preview'}
        open={previewVisible}
        onCancel={() => { setPreviewVisible(false); setPreviewData(null) }}
        footer={null}
        width={900}
      >
        {previewLoading ? (
          <Text>Loading preview...</Text>
        ) : previewData ? (
          <>
            <Space style={{ marginBottom: 8 }}>
              <Text type="secondary">{previewData.rowcount} rows | {previewData.columns?.length} columns</Text>
            </Space>
            <Table
              columns={previewData.columns?.map((c: any) => ({ title: `${c.name} (${c.type})`, dataIndex: c.name, key: c.name, ellipsis: true })) || []}
              dataSource={previewData.data?.map((r: any, i: number) => ({ ...r, _key: i })) || []}
              rowKey="_key"
              size="small"
              pagination={{ pageSize: 25 }}
              scroll={{ x: 'max-content' }}
            />
          </>
        ) : null}
      </Modal>

      <Modal
        title="Save Query"
        open={saveModalVisible}
        onCancel={() => { setSaveModalVisible(false); saveForm.resetFields() }}
        onOk={() => saveForm.submit()}
      >
        <Form form={saveForm} onFinish={handleSaveSubmit} layout="vertical">
          <Form.Item name="name" label="Query Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="database_id" label="Database" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="sql" label="SQL" hidden>
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SQLLab
