import React, { useState, useEffect, useCallback } from 'react'
import { Row, Col, Select, Button, Input, Table, Card, message, Tabs, Tree, Typography, Badge, Space, Tooltip, Tag } from 'antd'
import { PlayCircleOutlined, SaveOutlined, ClearOutlined, DatabaseOutlined, TableOutlined, ColumnHeightOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import { sqlLabService } from '../services'

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
  const [databases, setDatabases] = useState<any[]>([])
  const [selectedDb, setSelectedDb] = useState<number | null>(null)
  const [dbSchema, setDbSchema] = useState<any[]>([])
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([
    { key: '1', title: 'Query 1', sql: '', results: [], columns: [], status: null, rowcount: 0, error: null }
  ])
  const [activeTab, setActiveTab] = useState('1')
  const [running, setRunning] = useState(false)

  const currentTab = queryTabs.find(t => t.key === activeTab) || queryTabs[0]

  useEffect(() => {
    fetchDatabases()
  }, [])

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
      const result = await sqlLabService.executeQuery({ database_id: selectedDb, sql, limit: 5000 })
      
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
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
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
                  title: <Space size={4}><TableOutlined /><Text style={{ fontSize: 12 }}>{t.name}</Text></Space>,
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
              placeholder="Enter SQL query here (Ctrl+Enter to run)..."
              rows={8}
              style={{ fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 13, borderRadius: 0, border: 'none', resize: 'vertical' }}
            />
          </Card>

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
    </div>
  )
}

export default SQLLab
