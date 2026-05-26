import React, { useState, useEffect, useMemo } from 'react'
import { Modal, Select, Button, Card, Row, Col, Space, Typography, Tag, Divider, message, Spin, Empty, Tooltip } from 'antd'
import { BarChartOutlined, LineChartOutlined, PieChartOutlined, AreaChartOutlined, DotChartOutlined, TableOutlined, HeatMapOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { datasetService, chartService } from '../services'
import api from '../services/api'
import { useThemeStore } from '../store/theme'
import { buildChartOption, isNumericType, isDateType, autoSelectColumns, suggestChartType } from '../utils/chartUtils'

const { Text } = Typography

const CHART_TYPES = [
  { value: 'bar', label: 'Bar', icon: <BarChartOutlined /> },
  { value: 'line', label: 'Line', icon: <LineChartOutlined /> },
  { value: 'pie', label: 'Pie', icon: <PieChartOutlined /> },
  { value: 'area', label: 'Area', icon: <AreaChartOutlined /> },
  { value: 'scatter', label: 'Scatter', icon: <DotChartOutlined /> },
  { value: 'heatmap', label: 'Heatmap', icon: <HeatMapOutlined /> },
  { value: 'table', label: 'Table', icon: <TableOutlined /> },
]

interface InlineChartCreatorProps {
  open: boolean
  onClose: () => void
  dashboardId: string | number
  onChartAdded: () => void
}

const InlineChartCreator: React.FC<InlineChartCreatorProps> = ({ open, onClose, dashboardId, onChartAdded }) => {
  const { darkMode } = useThemeStore()
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDs, setSelectedDs] = useState<any>(null)
  const [datasetCols, setDatasetCols] = useState<any[]>([])
  const [datasetData, setDatasetData] = useState<any[]>([])
  const [chartName, setChartName] = useState('')
  const [chartType, setChartType] = useState('bar')
  const [xCol, setXCol] = useState<string>('')
  const [yCol, setYCol] = useState<string>('')
  const [aggregation, setAggregation] = useState('SUM')
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) fetchDatasets()
  }, [open])

  const fetchDatasets = async () => {
    try {
      const data = await datasetService.list()
      setDatasets(data.datasets || [])
    } catch (e) { console.error(e) }
  }

  const handleDatasetChange = async (value: string) => {
    const ds = datasets.find(d => d.table_name === value || d.id === value)
    setSelectedDs(ds)
    setDatasetCols(ds?.columns || [])
    setXCol('')
    setYCol('')
    setDatasetData([])
    setChartName(ds?.table_name ? `${ds.table_name} Analysis` : '')

    if (ds?.table_name) {
      setDataLoading(true)
      try {
        const resp = await datasetService.preview(ds.table_name, 10000)
        const data = resp.data || []
        setDatasetData(data)
        if (data.length > 0) {
          const cols = ds.columns || []
          const { xCol: bestX, yCol: bestY } = autoSelectColumns(cols, data)
          setXCol(bestX)
          setYCol(bestY || '')
          const suggested = suggestChartType(cols, data)
          setChartType(suggested)
          if (bestY) {
            const isNum = cols.find((c: any) => c.name === bestY && isNumericType(c.type))
            setAggregation(isNum ? 'SUM' : 'COUNT')
          }
        }
      } catch (e) { console.error(e) } finally { setDataLoading(false) }
    }
  }

  const numericColumns = useMemo(() => datasetCols.filter(c => isNumericType(c.type)).map(c => c.name), [datasetCols])
  const stringColumns = useMemo(() => datasetCols.filter(c => !isNumericType(c.type)).map(c => c.name), [datasetCols])
  const allColumns = useMemo(() => datasetCols.map(c => c.name), [datasetCols])

  const previewOption = useMemo(() => {
    if (!xCol || !yCol || datasetData.length === 0) return null
    return buildChartOption({
      chartType,
      xCol,
      metrics: [{ column: yCol, aggregation, label: `${aggregation}(${yCol})` }],
      data: datasetData,
      title: chartName || undefined,
      darkMode,
    })
  }, [xCol, yCol, chartType, aggregation, datasetData, chartName, darkMode])

  const handleCreate = async () => {
    if (!chartName.trim()) { message.error('Enter a chart name'); return }
    if (!selectedDs) { message.error('Select a dataset'); return }
    if (!xCol || !yCol) { message.error('Select X and Y columns'); return }

    setSaving(true)
    try {
      const payload = {
        chart_name: chartName.trim(),
        viz_type: chartType,
        datasource_id: selectedDs.table_name,
        datasource_type: 'table',
        params: {
          xCol,
          yCol,
          aggFunc: aggregation,
          groupby: [xCol],
          metrics: [{ label: `${aggregation}(${yCol})`, aggregate: aggregation, column: { column_name: yCol } }],
        },
      }
      const created = await chartService.create(payload)
      await api.post(`/dashboards/${dashboardId}/charts`, { chart_id: created.id, position: {} })
      message.success('Chart created and added to dashboard!')
      onChartAdded()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Failed to create chart')
    } finally { setSaving(false) }
  }

  const colTag = (name: string) => {
    const col = datasetCols.find(c => c.name === name)
    const type = col?.type || ''
    const isNum = isNumericType(type)
    const isDate = isDateType(type)
    return <Tag color={isDate ? 'cyan' : isNum ? 'blue' : 'orange'} style={{ fontSize: 10 }}>{isDate ? 'date' : isNum ? 'num' : 'str'}</Tag>
  }

  return (
    <Modal
      title={<span><PlusOutlined /> Create Chart for Dashboard</span>}
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate} loading={saving} disabled={!xCol || !yCol || !chartName}>
          Create & Add to Dashboard
        </Button>,
      ]}
    >
      <Row gutter={16}>
        <Col span={10}>
          <div style={{ marginBottom: 12 }}>
            <Text strong style={{ fontSize: 12 }}>Dataset</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Select dataset"
              showSearch
              onChange={handleDatasetChange}
              value={selectedDs?.table_name}
              optionFilterProp="label"
              options={datasets.map(d => ({ label: `${d.table_name} (${d.row_count?.toLocaleString()} rows)`, value: d.table_name }))}
            />
          </div>

          {selectedDs && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ marginBottom: 10 }}>
                <Text strong style={{ fontSize: 12 }}>Chart Name</Text>
                <input
                  style={{ width: '100%', marginTop: 4, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13, background: darkMode ? '#1f1f1f' : '#fff', color: darkMode ? '#e5e7eb' : '#374151' }}
                  value={chartName}
                  onChange={e => setChartName(e.target.value)}
                  placeholder="My Chart"
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <Text strong style={{ fontSize: 12 }}>X Axis (Dimension)</Text>
                <Select
                  style={{ width: '100%', marginTop: 4 }}
                  value={xCol || undefined}
                  onChange={setXCol}
                  placeholder="Select dimension"
                  showSearch
                >
                  {allColumns.map(c => (
                    <Select.Option key={c} value={c}>
                      <Space size={4}>{colTag(c)}{c}</Space>
                    </Select.Option>
                  ))}
                </Select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <Text strong style={{ fontSize: 12 }}>Y Axis (Metric)</Text>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <Select
                    style={{ flex: 1 }}
                    value={yCol || undefined}
                    onChange={setYCol}
                    placeholder="Select column"
                    showSearch
                  >
                    {allColumns.filter(c => c !== xCol).map(c => (
                      <Select.Option key={c} value={c}>
                        <Space size={4}>{colTag(c)}{c}</Space>
                      </Select.Option>
                    ))}
                  </Select>
                  <Select
                    style={{ width: 90 }}
                    value={aggregation}
                    onChange={setAggregation}
                    options={[
                      { label: 'SUM', value: 'SUM' },
                      { label: 'AVG', value: 'AVG' },
                      { label: 'COUNT', value: 'COUNT' },
                      { label: 'MAX', value: 'MAX' },
                      { label: 'MIN', value: 'MIN' },
                    ]}
                  />
                </div>
              </div>

              <Divider style={{ margin: '8px 0' }} />
              <Text strong style={{ fontSize: 12 }}>Chart Type</Text>
              <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CHART_TYPES.map(ct => (
                  <Tooltip title={ct.label} key={ct.value}>
                    <div
                      onClick={() => setChartType(ct.value)}
                      style={{
                        flex: 1, minWidth: 40, textAlign: 'center', padding: '6px 2px', cursor: 'pointer', borderRadius: 6,
                        border: chartType === ct.value ? '2px solid #1890ff' : '2px solid transparent',
                        background: chartType === ct.value ? '#e6f7ff' : darkMode ? '#1f1f1f' : '#fafafa',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 14 }}>{ct.icon}</div>
                      <Text style={{ fontSize: 8 }}>{ct.label}</Text>
                    </div>
                  </Tooltip>
                ))}
              </div>

              <Text style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 8 }}>
                {datasetData.length.toLocaleString()} rows available
              </Text>
            </>
          )}
        </Col>

        <Col span={14}>
          <Card
            title="Preview"
            size="small"
            bodyStyle={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            {dataLoading ? (
              <Spin tip="Loading data..." />
            ) : !selectedDs ? (
              <Empty description="Select a dataset" />
            ) : !xCol || !yCol ? (
              <Empty description="Select X and Y columns" />
            ) : datasetData.length === 0 ? (
              <Empty description="No data" />
            ) : previewOption ? (
              chartType === 'table' ? (
                <div style={{ height: '100%', width: '100%', overflow: 'auto', padding: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#2d2d2d' : '#fafafa', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '4px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb') }}>{xCol}</th>
                        <th style={{ padding: '4px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), textAlign: 'right' }}>{aggregation}({yCol})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasetData.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? (darkMode ? '#1f1f1f' : '#fff') : (darkMode ? '#2d2d2d' : '#f9fafb') }}>
                          <td style={{ padding: '2px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), color: darkMode ? '#e5e7eb' : '#374151' }}>{String(row[xCol] ?? '')}</td>
                          <td style={{ padding: '2px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), textAlign: 'right', color: darkMode ? '#e5e7eb' : '#374151' }}>{Number(row[yCol]) || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <ReactECharts option={previewOption} style={{ height: '100%', width: '100%' }} theme={darkMode ? 'dark' : undefined} notMerge />
              )
            ) : (
              <Empty description="Configure chart" />
            )}
          </Card>
        </Col>
      </Row>
    </Modal>
  )
}

export default InlineChartCreator
