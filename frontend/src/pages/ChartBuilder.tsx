import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Card, Row, Col, message, Space,
  Typography, Tag, Divider, InputNumber, Tooltip, Spin, Empty, Badge, Popover
} from 'antd'
import {
  BarChartOutlined, LineChartOutlined, PieChartOutlined,
  AreaChartOutlined, DotChartOutlined, TableOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined,
  ArrowRightOutlined, CloseOutlined, HeatMapOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { chartService, datasetService } from '../services'
import { useThemeStore } from '../store/theme'
import {
  TABLEAU_COLORS, formatNumber, isNumericType, isDateType,
  suggestChartType, autoSelectColumns, buildChartOption
} from '../utils/chartUtils'

const { Text } = Typography

const CHART_TYPES = [
  { value: 'bar', label: 'Bar', icon: <BarChartOutlined />, desc: 'Compare categories' },
  { value: 'line', label: 'Line', icon: <LineChartOutlined />, desc: 'Trends over time' },
  { value: 'pie', label: 'Pie', icon: <PieChartOutlined />, desc: 'Proportions' },
  { value: 'area', label: 'Area', icon: <AreaChartOutlined />, desc: 'Volume over time' },
  { value: 'scatter', label: 'Scatter', icon: <DotChartOutlined />, desc: 'Correlations' },
  { value: 'heatmap', label: 'Heatmap', icon: <HeatMapOutlined />, desc: 'Density matrix' },
  { value: 'table', label: 'Table', icon: <TableOutlined />, desc: 'Raw data' },
]

interface MetricDef {
  key: string
  column: string
  aggregation: string
}

let metricKeyCounter = 0
const newMetricKey = () => `m_${++metricKeyCounter}_${Date.now()}`

const ChartBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDs, setSelectedDs] = useState<any>(null)
  const [datasetData, setDatasetData] = useState<any[]>([])
  const [datasetCols, setDatasetCols] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [chartType, setChartType] = useState('bar')
  const [xCol, setXCol] = useState<string>('')
  const [metrics, setMetrics] = useState<MetricDef[]>(() => [{ key: newMetricKey(), column: '', aggregation: 'SUM' }])
  const [useAllRows, setUseAllRows] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [stackMode, setStackMode] = useState<'none' | 'stack' | 'normalize'>('none')
  const [sortBy, setSortBy] = useState<'none' | 'x' | 'y' | 'y_desc'>('none')
  const [showLabels, setShowLabels] = useState(false)
  const { darkMode } = useThemeStore()

  const preselectDs = searchParams.get('dataset')

  useEffect(() => {
    fetchDatasets()
    if (id) fetchChart()
  }, [id])

  useEffect(() => {
    if (preselectDs && datasets.length > 0) {
      const ds = datasets.find(d => d.table_name === preselectDs)
      if (ds) {
        form.setFieldsValue({ datasource_id: ds.table_name, chart_name: `${ds.table_name} Analysis` })
        handleDatasetChange(ds.table_name)
      }
    }
  }, [preselectDs, datasets])

  const fetchDatasets = async () => {
    try {
      const data = await datasetService.list()
      setDatasets(data.datasets || [])
    } catch (e) { console.error(e) }
  }

  const fetchChart = async () => {
    if (!id) return
    try {
      const data = await chartService.get(Number(id))
      form.setFieldsValue(data)
      setChartType(data.viz_type || 'bar')
      const p = data.params || {}
      setXCol(p.xCol || p.groupby?.[0] || '')
      const savedMetrics = p.metrics?.length > 0
        ? p.metrics.map((m: any) => ({ key: newMetricKey(), column: m.column?.column_name || m.column || '', aggregation: m.aggregate || 'SUM' }))
        : (p.yCol ? [{ key: newMetricKey(), column: p.yCol, aggregation: p.aggFunc || 'SUM' }] : [])
      if (savedMetrics.length > 0) setMetrics(savedMetrics)
      if (data.datasource_id) handleDatasetChange(data.datasource_id)
    } catch (e: any) {
      message.error('Failed to load chart')
    }
  }

  const handleDatasetChange = async (value: string) => {
    const ds = datasets.find(d => d.table_name === value || d.id === value)
    setSelectedDs(ds)
    setDatasetCols(ds?.columns || [])
    setXCol('')
    setMetrics([{ key: newMetricKey(), column: '', aggregation: 'SUM' }])
    setDatasetData([])
    setHasData(false)

    if (ds?.table_name) {
      setDataLoading(true)
      try {
        const resp = await datasetService.preview(ds.table_name, useAllRows ? 10000 : 1000)
        const data = resp.data || []
        setDatasetData(data)
        setHasData(data.length > 0)
        if (data.length > 0) {
          const cols = ds.columns || []
          const { xCol: bestX, yCol: bestY } = autoSelectColumns(cols, data)
          setXCol(bestX)
          if (bestY) {
            const isNum = cols.find((c: any) => c.name === bestY && isNumericType(c.type))
            setMetrics([{ key: newMetricKey(), column: bestY, aggregation: isNum ? 'SUM' : 'COUNT' }])
          }
          const suggested = suggestChartType(cols, data)
          setChartType(suggested)
        }
      } catch (e) { console.error(e) } finally { setDataLoading(false) }
    }
  }

  const numericColumns = useMemo(() => datasetCols.filter(c => isNumericType(c.type)).map(c => c.name), [datasetCols])
  const stringColumns = useMemo(() => datasetCols.filter(c => !isNumericType(c.type)).map(c => c.name), [datasetCols])
  const dateColumns = useMemo(() => datasetCols.filter(c => isDateType(c.type)).map(c => c.name), [datasetCols])

  const allColumns = useMemo(() => datasetCols.map(c => c.name), [datasetCols])

  const addMetric = () => {
    const unused = allColumns.filter(c => !metrics.some(m => m.column === c))
    setMetrics([...metrics, { key: newMetricKey(), column: unused[0] || '', aggregation: 'COUNT' }])
  }

  const removeMetric = (key: string) => {
    if (metrics.length <= 1) return
    setMetrics(metrics.filter(m => m.key !== key))
  }

  const updateMetric = (key: string, field: 'column' | 'aggregation', value: string) => {
    setMetrics(metrics.map(m => m.key === key ? { ...m, [field]: value } : m))
  }

  const previewOption = useMemo(() => {
    const activeMetrics = metrics.filter(m => m.column)
    if (!xCol || activeMetrics.length === 0 || datasetData.length === 0) return null
    return buildChartOption({
      chartType,
      xCol,
      metrics: activeMetrics.map(m => ({ column: m.column, aggregation: m.aggregation, label: `${m.aggregation}(${m.column})` })),
      data: datasetData,
      title: form.getFieldValue('chart_name') || undefined,
      darkMode,
      colors: darkMode ? undefined : TABLEAU_COLORS,
      stackMode,
      sortBy,
      showLabels,
    })
  }, [xCol, metrics, chartType, datasetData, form, darkMode, stackMode, sortBy, showLabels])

  const handleSubmit = async () => {
    const values = form.getFieldsValue()
    if (!values.chart_name) { message.error('Enter a chart name'); return }
    if (!selectedDs) { message.error('Select a dataset'); return }
    if (!xCol) { message.error('Select X axis column'); return }
    const activeMetrics = metrics.filter(m => m.column)
    if (activeMetrics.length === 0) { message.error('Add at least one metric'); return }

    setSaving(true)
    try {
      const payload = {
        chart_name: values.chart_name,
        viz_type: chartType,
        datasource_id: selectedDs.table_name,
        datasource_type: 'table',
        description: values.description || '',
        params: {
          xCol,
        yCol: activeMetrics[0].column,
        aggFunc: activeMetrics[0].aggregation,
        groupby: [xCol],
          metrics: activeMetrics.map(m => ({
            label: `${m.aggregation}(${m.column})`,
            aggregate: m.aggregation,
            column: { column_name: m.column },
          })),
          stackMode,
          sortBy,
          showLabels,
        },
      }

      if (id) {
        await chartService.update(Number(id), payload)
        message.success('Chart updated')
      } else {
        await chartService.create(payload)
        message.success('Chart created')
      }
      navigate('/charts')
    } catch (err: any) {
      message.error(err?.response?.data?.error || 'Failed to save chart')
    } finally { setSaving(false) }
  }

  const chartDesc = (name: string) => {
    const ct = CHART_TYPES.find(c => c.value === name)
    return ct?.desc || ''
  }

  const colTag = (name: string) => {
    const col = datasetCols.find(c => c.name === name)
    const type = col?.type || ''
    const isNum = isNumericType(type)
    const isDate = isDateType(type)
    return (
      <Space size={4}>
        <Tag color={isDate ? 'cyan' : isNum ? 'blue' : 'orange'} style={{ fontSize: 10, margin: 0 }}>
          {isDate ? 'date' : isNum ? 'num' : 'str'}
        </Tag>
        <Text style={{ fontSize: 12 }}>{name}</Text>
      </Space>
    )
  }

  const suggestions = useMemo(() => {
    if (!hasData || !xCol) return []
    const activeMetrics = metrics.filter(m => m.column)
    if (activeMetrics.length === 0) return []
    const s = []
    if (dateColumns.length > 0 && xCol && dateColumns.includes(xCol)) {
      s.push({ type: 'line', label: 'Line Chart (time trend)', icon: <LineChartOutlined /> })
    }
    const uniqueCount = xCol ? new Set(datasetData.map(r => String(r[xCol]))).size : 0
    if (uniqueCount <= 10 && uniqueCount > 0) {
      s.push({ type: 'pie', label: 'Pie Chart (proportions)', icon: <PieChartOutlined /> })
      s.push({ type: 'bar', label: 'Bar Chart (compare)', icon: <BarChartOutlined /> })
    } else {
      s.push({ type: 'bar', label: 'Bar Chart (categories)', icon: <BarChartOutlined /> })
    }
    if (numericColumns.length >= 2) {
      s.push({ type: 'scatter', label: 'Scatter Plot (correlation)', icon: <DotChartOutlined /> })
    }
    s.push({ type: 'area', label: 'Area Chart (volume)', icon: <AreaChartOutlined /> })
    return s.filter((v, i, a) => a.findIndex(t => t.type === v.type) === i)
  }, [hasData, xCol, metrics, datasetData, dateColumns, numericColumns])

  return (
    <div style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/charts')}>Back</Button>
        <Text strong style={{ fontSize: 14 }}>{id ? 'Edit Chart' : 'Create Chart'}</Text>
      </div>
      <Row gutter={16} style={{ height: 'calc(100% - 40px)' }}>
        <Col span={7} style={{ height: '100%', overflow: 'auto' }}>
          <Card title="Chart Configuration" size="small" bodyStyle={{ padding: 12 }}>
            <Form form={form} layout="vertical" size="small">
              <Form.Item label="Chart Name" name="chart_name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Revenue by Category" />
              </Form.Item>

              <Form.Item label="Dataset" name="datasource_id" rules={[{ required: true }]}>
                <Select
                  placeholder="Select dataset"
                  showSearch
                  onChange={handleDatasetChange}
                  optionFilterProp="label"
                  options={datasets.map(d => ({ label: `${d.table_name} (${d.row_count?.toLocaleString()} rows)`, value: d.table_name }))}
                />
              </Form.Item>

              {selectedDs && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text strong style={{ fontSize: 12 }}>X Axis (Dimension)</Text>
                  <div style={{ marginBottom: 10 }}>
                    <Select
                      style={{ width: '100%' }}
                      value={xCol}
                      onChange={setXCol}
                      placeholder="Select dimension"
                      options={[
                        ...(stringColumns.length > 0 ? [{ label: '— String —', value: '__hdr_s__', disabled: true } as any, ...stringColumns.map(c => ({ label: c, value: c }))] : []),
                        ...(dateColumns.length > 0 ? [{ label: '— Date —', value: '__hdr_d__', disabled: true } as any, ...dateColumns.map(c => ({ label: c, value: c }))] : []),
                        ...(numericColumns.length > 0 ? [{ label: '— Numeric —', value: '__hdr_n__', disabled: true } as any, ...numericColumns.map(c => ({ label: c, value: c }))] : []),
                      ]}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 12 }}>Y Axis (Metrics)</Text>
                    <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addMetric} disabled={allColumns.length === 0}>
                      Add
                    </Button>
                  </div>

                  {metrics.map((m, idx) => (
                    <div key={m.key} style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
                      <Tag style={{ fontSize: 10, flexShrink: 0, margin: 0 }}>{idx + 1}</Tag>
                      <Select
                        style={{ flex: 1, minWidth: 0 }}
                        size="small"
                        value={m.column}
                        onChange={v => updateMetric(m.key, 'column', v)}
                        placeholder="Column"
                        options={[
                          ...(numericColumns.length > 0 ? [{ label: '— Numeric —', value: '__hdr_n__', disabled: true } as any, ...numericColumns.map(c => ({ label: c, value: c }))] : []),
                          ...(stringColumns.length > 0 ? [{ label: '— String —', value: '__hdr_s__', disabled: true } as any, ...stringColumns.map(c => ({ label: c, value: c }))] : []),
                          ...(dateColumns.length > 0 ? [{ label: '— Date —', value: '__hdr_d__', disabled: true } as any, ...dateColumns.map(c => ({ label: c, value: c }))] : []),
                        ]}
                      />
                      <Select
                        style={{ width: 80, flexShrink: 0 }}
                        size="small"
                        value={m.aggregation}
                        onChange={v => updateMetric(m.key, 'aggregation', v)}
                        options={[
                          { label: 'SUM', value: 'SUM' },
                          { label: 'AVG', value: 'AVG' },
                          { label: 'COUNT', value: 'COUNT' },
                          { label: 'MAX', value: 'MAX' },
                          { label: 'MIN', value: 'MIN' },
                        ]}
                      />
                      {metrics.length > 1 && (
                        <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={() => removeMetric(m.key)} style={{ flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </>
              )}

              <Divider style={{ margin: '8px 0' }} />
              <Text strong style={{ fontSize: 12 }}>Chart Type</Text>
              <div style={{ marginTop: 4, marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CHART_TYPES.map(ct => (
                  <Tooltip title={ct.desc} key={ct.value}>
                    <div
                      onClick={() => setChartType(ct.value)}
                      style={{
                        flex: 1, minWidth: 50, textAlign: 'center', padding: '6px 2px', cursor: 'pointer', borderRadius: 6,
                        border: chartType === ct.value ? '2px solid #1890ff' : '2px solid transparent',
                        background: chartType === ct.value ? '#e6f7ff' : darkMode ? '#1f1f1f' : '#fafafa',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 16 }}>{ct.icon}</div>
                      <Text style={{ fontSize: 9 }}>{ct.label}</Text>
                    </div>
                  </Tooltip>
                ))}
              </div>

              {/* Smart suggestions */}
              {hasData && suggestions.length > 1 && (
                <div style={{ marginBottom: 8 }}>
                  <Popover
                    content={
                      <div style={{ width: 200 }}>
                        <Text strong style={{ fontSize: 11 }}>Recommended for this data:</Text>
                        <div style={{ marginTop: 6 }}>
                          {suggestions.filter(s => s.type !== chartType).map(s => (
                            <div
                              key={s.type}
                              onClick={() => setChartType(s.type)}
                              style={{ padding: '4px 8px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {s.icon} {s.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    }
                    trigger="click"
                    open={showSuggestions}
                    onOpenChange={setShowSuggestions}
                  >
                    <Button size="small" icon={<ThunderboltOutlined />} type="link" style={{ fontSize: 11 }}>
                      Suggestions
                    </Button>
                  </Popover>
                </div>
              )}

              {['bar', 'line', 'area'].includes(chartType) && (
                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Options</Text>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {chartType !== 'line' && (
                      <Select size="small" value={stackMode} onChange={setStackMode} style={{ width: 110 }}
                        options={[
                          { label: 'Grouped', value: 'none' },
                          { label: 'Stacked', value: 'stack' },
                          { label: 'Normalize', value: 'normalize' },
                        ]}
                      />
                    )}
                    <Select size="small" value={sortBy} onChange={setSortBy} style={{ width: 120 }}
                      options={[
                        { label: 'Default order', value: 'none' },
                        { label: 'Sort by X', value: 'x' },
                        { label: 'Sort by Y asc', value: 'y' },
                        { label: 'Sort by Y desc', value: 'y_desc' },
                      ]}
                    />
                    <Select size="small" value={showLabels ? 'yes' : 'no'} onChange={v => setShowLabels(v === 'yes')} style={{ width: 100 }}
                      options={[{ label: 'Labels: off', value: 'no' }, { label: 'Labels: on', value: 'yes' }]}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 12 }}>Use All Rows</Text>
                <Select size="small" value={useAllRows ? 'all' : 'sample'} onChange={v => setUseAllRows(v === 'all')} style={{ width: 100 }}
                  options={[{ label: 'All rows', value: 'all' }, { label: 'Sample 1K', value: 'sample' }]} />
              </div>

              <Form.Item label="Description" name="description">
                <Input.TextArea rows={2} placeholder="What does this chart show?" />
              </Form.Item>

              <Button type="primary" onClick={handleSubmit} loading={saving} block size="middle">
                {id ? 'Update Chart' : 'Save Chart'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={17} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card
            title={
              <Space>
                <EyeOutlined /> Preview
                {hasData && <Badge count={`${datasetData.length} rows`} style={{ backgroundColor: '#52c41a' }} />}
                {chartType && <Tag style={{ fontSize: 10 }}>{chartDesc(chartType)}</Tag>}
              </Space>
            }
            size="small"
            style={{ flex: 1 }}
            bodyStyle={{ height: 'calc(100% - 38px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: 0 }}
          >
            {dataLoading ? (
              <Spin tip="Loading data..." />
            ) : !selectedDs ? (
              <Empty description="Select a dataset to start" />
            ) : !xCol ? (
              <Empty description="Select X axis dimension" />
            ) : metrics.filter(m => m.column).length === 0 ? (
              <Empty description="Add at least one Y axis metric" />
            ) : !hasData ? (
              <Empty description="No data in dataset" />
            ) : previewOption ? (
              <div style={{ width: '100%', height: '100%', padding: 8 }}>
                {chartType === 'table' ? (
                  <div style={{ height: '100%', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: darkMode ? '#2d2d2d' : '#fafafa', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '6px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), textAlign: 'left', fontWeight: 600 }}>{xCol}</th>
                          {metrics.filter(m => m.column).map(m => (
                            <th key={m.key} style={{ padding: '6px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), textAlign: 'right', fontWeight: 600 }}>
                              {m.aggregation}({m.column})
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {datasetData.slice(0, 100).map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? (darkMode ? '#1f1f1f' : '#fff') : (darkMode ? '#2d2d2d' : '#f9fafb') }}>
                            <td style={{ padding: '4px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), color: darkMode ? '#e5e7eb' : '#374151' }}>
                              {String(row[xCol] ?? '')}
                            </td>
                            {metrics.filter(m => m.column).map(m => (
                              <td key={m.key} style={{ padding: '4px 8px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: darkMode ? '#e5e7eb' : '#374151' }}>
                                {formatNumber(Number(row[m.column]) || 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ReactECharts
                    option={previewOption}
                    style={{ height: '100%', width: '100%' }}
                    theme={darkMode ? 'dark' : undefined}
                    notMerge
                  />
                )}
              </div>
            ) : (
              <Empty description="Configure chart to see preview" />
            )}
          </Card>

          {datasetCols.length > 0 && (
            <Card size="small" title="Available Columns" style={{ marginTop: 8, flex: '0 0 auto' }} bodyStyle={{ padding: '6px 12px' }}>
              <Space wrap>
                {datasetCols.map(col => (
                  <Tag
                    key={col.name}
                    color={isNumericType(col.type) ? 'blue' : isDateType(col.type) ? 'cyan' : 'orange'}
                    style={{ cursor: 'pointer', fontSize: 11 }}
                    onClick={() => {
                      if (isNumericType(col.type)) {
                        if (!metrics.some(m => m.column === col.name))
                          setMetrics([...metrics, { key: newMetricKey(), column: col.name, aggregation: 'SUM' }])
                      } else {
                        if (!metrics.some(m => m.column === col.name))
                          setMetrics([...metrics, { key: newMetricKey(), column: col.name, aggregation: 'COUNT' }])
                        else if (!xCol) setXCol(col.name)
                      }
                    }}
                  >
                    {col.name}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default ChartBuilder
