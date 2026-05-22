import React, { useState, useEffect, useCallback } from 'react'
import { Form, Input, Select, Button, Card, Row, Col, message, Space, Typography, Tag, Divider, InputNumber, Tooltip, Spin } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { chartService, datasetService } from '../services'
import { BarChartOutlined, LineChartOutlined, PieChartOutlined, AreaChartOutlined, DotChartOutlined, TableOutlined, HeatMapOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useThemeStore } from '../store/theme'

const { Text } = Typography

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: <BarChartOutlined /> },
  { value: 'line', label: 'Line Chart', icon: <LineChartOutlined /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChartOutlined /> },
  { value: 'area', label: 'Area Chart', icon: <AreaChartOutlined /> },
  { value: 'scatter', label: 'Scatter Plot', icon: <DotChartOutlined /> },
  { value: 'heatmap', label: 'Heatmap', icon: <HeatMapOutlined /> },
  { value: 'table', label: 'Table', icon: <TableOutlined /> },
]

const ChartBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDataSet, setSelectedDataSet] = useState<any>(null)
  const [datasetColumns, setDatasetColumns] = useState<string[]>([])
  const [numericColumns, setNumericColumns] = useState<string[]>([])
  const [stringColumns, setStringColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewOption, setPreviewOption] = useState<any>({})
  const [chartType, setChartType] = useState('bar')
  const { darkMode } = useThemeStore()

  const [metrics, setMetrics] = useState<string[]>([])
  const [groupby, setGroupby] = useState<string[]>([])
  const [rowLimit, setRowLimit] = useState(100)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedDsName, setSelectedDsName] = useState<string>('')
  const [hasRealData, setHasRealData] = useState(false)

  useEffect(() => {
    fetchDatasets()
    if (id) fetchChart()
  }, [id])

  const fetchDatasets = async () => {
    try {
      const data = await datasetService.list()
      setDatasets(data.datasets || [])
    } catch (e) {
      console.error(e)
    }
  }

  const fetchChart = async () => {
    if (!id) return
    try {
      const data = await chartService.get(Number(id))
      form.setFieldsValue(data)
      setChartType(data.viz_type || 'bar')
      setMetrics(data.params?.metrics?.map((m: any) => m.label || m.column?.column_name || '') || [])
      setGroupby(data.params?.groupby || [])
      setRowLimit(data.params?.rowLimit || 100)
      if (data.datasource_id) loadColumns(data.datasource_id)
    } catch (e: any) {
      console.error('[ChartBuilder] fetchChart error:', e?.response?.data, e?.message)
      message.error('Failed to load chart')
    }
  }

  const loadColumns = async (dsId: string | number) => {
    if (!dsId) return
    try {
      const ds = datasets.find((d: any) => d.id === dsId || d.table_name === dsId)
      let cols: { name: string; type: string }[] = []
      if (ds?.columns) {
        cols = ds.columns.map((c: any) => ({ name: c.name, type: (c.type || '').toLowerCase() }))
      } else {
        const data = await datasetService.getColumns(Number(dsId))
        cols = data.columns.map((c: any) => ({ name: c.name, type: (c.type || '').toLowerCase() }))
      }
      setDatasetColumns(cols.map(c => c.name))
      const numericTypes = ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real', 'int', 'int64', 'float64']
      setNumericColumns(cols.filter(c => numericTypes.some(t => c.type.startsWith(t)) || c.type === 'double precision').map(c => c.name))
      setStringColumns(cols.filter(c => !numericTypes.some(t => c.type.startsWith(t)) && c.type !== 'double precision').map(c => c.name))
      setSelectedDataSet(ds)
      setSelectedDsName(ds?.table_name || String(dsId))
    } catch (e) {
      console.error(e)
    }
  }

  const handleDatasetChange = (value: string) => {
    loadColumns(value)
    setMetrics([])
    setGroupby([])
  }

  const fetchPreviewData = useCallback(async () => {
    const dsId = form.getFieldValue('datasource_id') || selectedDataSet?.id
    if (!dsId) {
      setPreviewOption({})
      setHasRealData(false)
      return
    }
    setPreviewLoading(true)
    try {
      const resp = await datasetService.preview(dsId, rowLimit)
      const rows = resp.data || []
      const cols = resp.columns || []
      setHasRealData(rows.length > 0)
      if (rows.length === 0) {
        setPreviewOption({ title: { text: 'No data in dataset', left: 'center' } })
        return
      }
      const baseOption: any = {
        title: { text: form.getFieldValue('chart_name') || 'Preview', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: chartType === 'pie' ? 'item' : 'axis' },
        grid: { left: '10%', right: '5%', top: 50, bottom: 40 },
        color: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#f5222d'],
      }
      const cats = groupby.length > 0 ? groupby[0] : cols[0]
      const met = metrics.length > 0 ? metrics[0] : (cols.find((c: string) => !isNaN(Number(rows[0]?.[c]))) || cols[1] || cols[0])
      const categories = rows.map((r: any) => String(r[cats] || '')).slice(0, 50)
      const values = rows.map((r: any) => Number(r[met]) || 0).slice(0, 50)
      switch (chartType) {
        case 'bar':
          setPreviewOption({ ...baseOption, xAxis: { type: 'category', data: categories, axisLabel: { rotate: 45 } }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [4, 4, 0, 0] } }] })
          break
        case 'line':
          setPreviewOption({ ...baseOption, xAxis: { type: 'category', data: categories, axisLabel: { rotate: 45 } }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.3 } }] })
          break
        case 'pie':
          setPreviewOption({ ...baseOption, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['40%', '70%'], data: categories.map((l: string, i: number) => ({ value: values[i] || 0, name: l })), emphasis: { itemStyle: { shadowBlur: 10 } } }] })
          break
        case 'area':
          setPreviewOption({ ...baseOption, xAxis: { type: 'category', data: categories, axisLabel: { rotate: 45 } }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.5 } }] })
          break
        case 'scatter':
          setPreviewOption({ ...baseOption, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: rows.slice(0, 100).map((r: any) => [Number(r[cols[0]] || 0), Number(r[cols[1]] || 0)]), symbolSize: 10 }] })
          break
        case 'heatmap':
          const hData = rows.slice(0, 50).map((r: any, i: number) => [i % 5, Math.floor(i / 5), Number(r[met]) || 0])
          const xLabels = [...new Set(hData.map((d: number[]) => String(d[0])))]
          const yLabels = [...new Set(hData.map((d: number[]) => String(d[1])))]
          setPreviewOption({ ...baseOption, xAxis: { type: 'category', data: xLabels }, yAxis: { type: 'category', data: yLabels }, visualMap: { min: 0, max: Math.max(...hData.map((d: number[]) => d[2]), 1), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }, series: [{ type: 'heatmap', data: hData }] })
          break
        default:
          setPreviewOption({ ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: values }] })
      }
    } catch (e) {
      console.error('Preview fetch failed:', e)
      setPreviewOption({ title: { text: 'Failed to load preview', left: 'center' } })
      setHasRealData(false)
    } finally {
      setPreviewLoading(false)
    }
  }, [chartType, metrics, groupby, rowLimit, selectedDataSet, form])

  useEffect(() => { fetchPreviewData() }, [fetchPreviewData])

  const handleSubmit = async () => {
    const values = form.getFieldsValue()
    if (!values.chart_name) { message.error('Enter a chart name'); return }
    if (!selectedDataSet && !values.datasource_id) { message.error('Select a dataset'); return }

    setSaving(true)
    try {
      const payload = {
        chart_name: values.chart_name,
        viz_type: chartType,
        datasource_id: selectedDataSet?.id || values.datasource_id,
        datasource_type: 'table',
        description: values.description || '',
        params: { metrics: metrics.map(m => ({ label: m, expressionType: 'SIMPLE', aggregate: 'COUNT', column: { column_name: m } })), groupby, rowLimit },
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
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      <Row gutter={16} style={{ height: '100%' }}>
        <Col span={8} style={{ height: '100%', overflow: 'auto' }}>
          <Card title="Chart Configuration" size="small" bodyStyle={{ padding: 12 }}>
            <Form form={form} layout="vertical" size="small">
              <Form.Item label="Chart Name" name="chart_name" rules={[{ required: true }]}>
                <Input placeholder="My Chart" />
              </Form.Item>

              <Form.Item label="Dataset" name="datasource_id" rules={[{ required: true }]}>
                <Select
                  placeholder="Select dataset"
                  showSearch
                  onChange={handleDatasetChange}
                  optionFilterProp="label"
                  options={datasets.map((d: any) => ({ label: `${d.table_name} (${d.row_count} rows)`, value: d.table_name || d.id }))}
                />
              </Form.Item>

              <Text strong style={{ fontSize: 12 }}>Chart Type</Text>
              <Row gutter={[4, 4]} style={{ marginTop: 4, marginBottom: 12 }}>
                {CHART_TYPES.map(ct => (
                  <Col span={6} key={ct.value}>
                    <Tooltip title={ct.label}>
                      <div
                        onClick={() => setChartType(ct.value)}
                        style={{
                          textAlign: 'center', padding: '6px 0', cursor: 'pointer', borderRadius: 6,
                          border: chartType === ct.value ? '2px solid #1890ff' : '2px solid transparent',
                          background: chartType === ct.value ? '#e6f7ff' : darkMode ? '#1f1f1f' : '#fafafa',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 20 }}>{ct.icon}</div>
                        <Text style={{ fontSize: 10, display: 'block', marginTop: 2 }}>{ct.label}</Text>
                      </div>
                    </Tooltip>
                  </Col>
                ))}
              </Row>

              <Divider style={{ margin: '8px 0' }} />

              <Text strong style={{ fontSize: 12 }}>Metrics</Text>
              <div style={{ marginBottom: 12, marginTop: 4 }}>
                {metrics.map((m, i) => (
                  <Space key={i} style={{ display: 'flex', marginBottom: 4 }}>
                    <Select
                      size="small"
                      style={{ flex: 1, minWidth: 140 }}
                      value={m}
                      onChange={(v) => setMetrics(metrics.map((x, j) => j === i ? v : x))}
                      options={numericColumns.map(c => ({ label: c, value: c }))}
                      placeholder="Column"
                    />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setMetrics(metrics.filter((_, j) => j !== i))} />
                  </Space>
                ))}
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setMetrics([...metrics, numericColumns[0] || 'value'])} block>
                  Add Metric
                </Button>
              </div>

              <Text strong style={{ fontSize: 12 }}>Group By</Text>
              <div style={{ marginBottom: 12, marginTop: 4 }}>
                {groupby.map((g, i) => (
                  <Space key={i} style={{ display: 'flex', marginBottom: 4 }}>
                    <Select
                      size="small"
                      style={{ flex: 1, minWidth: 140 }}
                      value={g}
                      onChange={(v) => setGroupby(groupby.map((x, j) => j === i ? v : x))}
                      options={stringColumns.map(c => ({ label: c, value: c }))}
                      placeholder="Column"
                    />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setGroupby(groupby.filter((_, j) => j !== i))} />
                  </Space>
                ))}
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setGroupby([...groupby, stringColumns[0] || 'category'])} block>
                  Add Group By
                </Button>
              </div>

              <Form.Item label="Row Limit">
                <InputNumber min={1} max={10000} value={rowLimit} onChange={(v) => setRowLimit(v || 100)} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="Description" name="description">
                <Input.TextArea rows={2} />
              </Form.Item>

              <Button type="primary" onClick={handleSubmit} loading={saving} block>
                {id ? 'Update Chart' : 'Save Chart'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card
            title={<Space><BarChartOutlined /> Preview</Space>}
            size="small"
            style={{ flex: 1 }}
            bodyStyle={{ height: 'calc(100% - 38px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            extra={
              <Space size={4}>
                {datasetColumns.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Dataset: {selectedDataSet?.table_name || ''} ({datasetColumns.length} cols)
                  </Text>
                )}
                  {hasRealData && <Text type="secondary" style={{ fontSize: 12 }}>Real data</Text>}
                <Button size="small" onClick={fetchPreviewData} loading={previewLoading}>Refresh</Button>
              </Space>
            }
          >
            {previewLoading ? (
              <Spin style={{ display: 'block', margin: '100px auto' }} />
            ) : (
              <ReactECharts
                option={previewOption}
                style={{ height: 450, width: '100%' }}
                theme={darkMode ? 'dark' : undefined}
              />
            )}
          </Card>

          {datasetColumns.length > 0 && (
            <Card size="small" title="Columns" style={{ marginTop: 8, flex: '0 0 auto' }} bodyStyle={{ padding: '6px 12px' }}>
              <Space wrap>
                {datasetColumns.map((col, i) => (
                  <Tag key={i} style={{ cursor: 'pointer' }} onClick={() => { if (numericColumns.includes(col) && !metrics.includes(col)) setMetrics([...metrics, col]) }}>
                    {col}
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
