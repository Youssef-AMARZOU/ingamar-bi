import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Form, Input, Select, Button, Card, Row, Col, message, Space,
  Typography, Tag, Divider, InputNumber, Tooltip, Spin, Empty, Badge
} from 'antd'
import ReactECharts from 'echarts-for-react'
import { chartService, datasetService } from '../services'
import {
  BarChartOutlined, LineChartOutlined, PieChartOutlined,
  AreaChartOutlined, DotChartOutlined, TableOutlined,
  HeatMapOutlined, PlusOutlined, DeleteOutlined,
  ThunderboltOutlined, ArrowRightOutlined, EyeOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../store/theme'

const { Text } = Typography

const CHART_TYPES = [
  { value: 'bar', label: 'Bar', icon: <BarChartOutlined />, desc: 'Compare categories' },
  { value: 'line', label: 'Line', icon: <LineChartOutlined />, desc: 'Trends over time' },
  { value: 'pie', label: 'Pie', icon: <PieChartOutlined />, desc: 'Proportions' },
  { value: 'area', label: 'Area', icon: <AreaChartOutlined />, desc: 'Volume over time' },
  { value: 'scatter', label: 'Scatter', icon: <DotChartOutlined />, desc: 'Correlations' },
  { value: 'table', label: 'Table', icon: <TableOutlined />, desc: 'Raw data' },
]

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
  const [previewOption, setPreviewOption] = useState<any>(null)
  const [chartType, setChartType] = useState('bar')
  const [xCol, setXCol] = useState<string>('')
  const [yCol, setYCol] = useState<string>('')
  const [aggFunc, setAggFunc] = useState('SUM')
  const [rowLimit, setRowLimit] = useState(500)
  const [hasData, setHasData] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
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
      setXCol(data.params?.xCol || '')
      setYCol(data.params?.yCol || '')
      setAggFunc(data.params?.aggFunc || 'SUM')
      setRowLimit(data.params?.rowLimit || 500)
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
    setYCol('')
    setDatasetData([])
    setHasData(false)

    if (ds?.table_name) {
      setDataLoading(true)
      try {
        const resp = await datasetService.preview(ds.table_name, Math.min(rowLimit, 1000))
        setDatasetData(resp.data || [])
        setHasData((resp.data?.length || 0) > 0)
        autoSelectColumns(ds.columns || [], resp.data || [])
      } catch (e) {
        console.error(e)
      } finally {
        setDataLoading(false)
      }
    }
  }

  const autoSelectColumns = (cols: any[], data: any[]) => {
    const numericCols = cols.filter(c => isNumericType(c.type)).map(c => c.name)
    const stringCols = cols.filter(c => !isNumericType(c.type)).map(c => c.name)
    const dateCols = cols.filter(c => isDateType(c.type)).map(c => c.name)

    if (dateCols.length > 0 && numericCols.length > 0) {
      setXCol(dateCols[0])
      setYCol(numericCols[0])
    } else if (stringCols.length > 0 && numericCols.length > 0) {
      setXCol(stringCols[0])
      setYCol(numericCols[0])
    } else if (numericCols.length >= 2) {
      setXCol(numericCols[0])
      setYCol(numericCols[1])
    } else if (stringCols.length > 0 && numericCols.length > 0) {
      setXCol(stringCols[0])
      setYCol(numericCols[0])
    }
  }

  const isNumericType = (type: string) => {
    const t = (type || '').toLowerCase()
    return ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real', 'int64', 'float64', 'int', 'number'].some(n => t.includes(n))
  }

  const isDateType = (type: string) => {
    const t = (type || '').toLowerCase()
    return ['date', 'time', 'timestamp', 'datetime'].some(n => t.includes(n))
  }

  const numericColumns = useMemo(() => datasetCols.filter(c => isNumericType(c.type)).map(c => c.name), [datasetCols])
  const stringColumns = useMemo(() => datasetCols.filter(c => !isNumericType(c.type)).map(c => c.name), [datasetCols])
  const dateColumns = useMemo(() => datasetCols.filter(c => isDateType(c.type)).map(c => c.name), [datasetCols])

  const buildPreview = useCallback(() => {
    if (!xCol || !yCol || datasetData.length === 0) {
      setPreviewOption(null)
      return
    }

    const grouped: Record<string, number[]> = {}
    datasetData.forEach((row: any) => {
      const key = String(row[xCol] ?? 'null')
      const val = Number(row[yCol]) || 0
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(val)
    })

    const aggMap: Record<string, (vals: number[]) => number> = {
      SUM: v => v.reduce((a, b) => a + b, 0),
      AVG: v => v.reduce((a, b) => a + b, 0) / v.length,
      COUNT: v => v.length,
      MAX: v => Math.max(...v),
      MIN: v => Math.min(...v),
    }

    const keys = Object.keys(grouped).slice(0, 50)
    const values = keys.map(k => aggMap[aggFunc]?.(grouped[k]) || 0)

    const baseOption: any = {
      title: { text: form.getFieldValue('chart_name') || 'Preview', left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: { trigger: chartType === 'pie' ? 'item' : 'axis', formatter: chartType === 'pie' ? '{b}: {c} ({d}%)' : '{b}: {c}' },
      legend: { show: chartType !== 'pie' && chartType !== 'table' && chartType !== 'scatter', bottom: 0, type: 'scroll' },
      grid: { left: '8%', right: '4%', top: 50, bottom: chartType === 'pie' ? 20 : 50, containLabel: true },
      color: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#f5222d', '#eb2f96'],
      animationDuration: 300,
    }

    switch (chartType) {
      case 'bar':
        setPreviewOption({
          ...baseOption,
          xAxis: { type: 'category', data: keys, axisLabel: { rotate: keys.length > 10 ? 45 : 0, interval: 0 }, name: xCol, nameLocation: 'middle', nameGap: 30 },
          yAxis: { type: 'value', name: `${aggFunc}(${yCol})` },
          series: [{ name: `${aggFunc}(${yCol})`, type: 'bar', data: values, itemStyle: { borderRadius: [4, 4, 0, 0] }, barMaxWidth: 60 }],
        })
        break
      case 'line':
        setPreviewOption({
          ...baseOption,
          xAxis: { type: 'category', data: keys, axisLabel: { rotate: keys.length > 10 ? 45 : 0, interval: 0 }, name: xCol, nameLocation: 'middle', nameGap: 30 },
          yAxis: { type: 'value', name: `${aggFunc}(${yCol})` },
          series: [{ name: `${aggFunc}(${yCol})`, type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.15 }, symbolSize: 6 }],
        })
        break
      case 'pie':
        setPreviewOption({
          ...baseOption,
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          legend: { orient: 'vertical', right: 10, top: 'center', type: 'scroll' },
          series: [{
            type: 'pie', radius: ['35%', '65%'], center: ['40%', '50%'],
            data: keys.map((k, i) => ({ value: values[i], name: k })),
            emphasis: { itemStyle: { shadowBlur: 10 } },
            label: { show: keys.length <= 10 }
          }],
        })
        break
      case 'area':
        setPreviewOption({
          ...baseOption,
          xAxis: { type: 'category', data: keys, axisLabel: { rotate: keys.length > 10 ? 45 : 0, interval: 0 }, name: xCol, nameLocation: 'middle', nameGap: 30 },
          yAxis: { type: 'value', name: `${aggFunc}(${yCol})` },
          series: [{ name: `${aggFunc}(${yCol})`, type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.4 }, symbolSize: 4 }],
        })
        break
      case 'scatter':
        const scatterData = datasetData.slice(0, 200).map(r => [Number(r[xCol]) || 0, Number(r[yCol]) || 0])
        setPreviewOption({
          ...baseOption,
          xAxis: { type: 'value', name: xCol },
          yAxis: { type: 'value', name: yCol },
          series: [{ name: `${xCol} vs ${yCol}`, type: 'scatter', data: scatterData, symbolSize: 8, itemStyle: { opacity: 0.6 } }],
        })
        break
      case 'table':
        setPreviewOption({
          ...baseOption,
          grid: { top: 40, bottom: 20, left: 20, right: 20 },
          xAxis: { show: false },
          yAxis: { show: false },
          series: [{
            type: 'custom',
            renderItem: () => null,
            data: [],
          }],
        })
        break
      default:
        setPreviewOption(baseOption)
    }
  }, [xCol, yCol, aggFunc, chartType, datasetData, form])

  useEffect(() => { buildPreview() }, [buildPreview])

  const handleSubmit = async () => {
    const values = form.getFieldsValue()
    if (!values.chart_name) { message.error('Enter a chart name'); return }
    if (!selectedDs) { message.error('Select a dataset'); return }
    if (!xCol || !yCol) { message.error('Select X and Y columns'); return }

    setSaving(true)
    try {
      const payload = {
        chart_name: values.chart_name,
        viz_type: chartType,
        datasource_id: selectedDs.table_name,
        datasource_type: 'table',
        description: values.description || '',
        params: { xCol, yCol, aggFunc, rowLimit, groupby: [xCol], metrics: [{ label: yCol, aggregate: aggFunc, column: { column_name: yCol } }] },
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

  return (
    <div style={{ height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      <Row gutter={16} style={{ height: '100%' }}>
        <Col span={8} style={{ height: '100%', overflow: 'auto' }}>
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
                  <div style={{ marginBottom: 8 }}>
                    <Select
                      style={{ width: '100%' }}
                      value={xCol}
                      onChange={setXCol}
                      placeholder="Select dimension column"
                      options={[
                        { label: '— String columns —', value: '__header__', disabled: true },
                        ...stringColumns.map(c => ({ label: c, value: c })),
                        ...(dateColumns.length > 0 ? [{ label: '— Date columns —', value: '__header2__', disabled: true }, ...dateColumns.map(c => ({ label: c, value: c }))] : []),
                      ]}
                    />
                  </div>

                  <Text strong style={{ fontSize: 12 }}>Y Axis (Metric)</Text>
                  <div style={{ marginBottom: 8 }}>
                    <Select
                      style={{ width: '100%' }}
                      value={yCol}
                      onChange={setYCol}
                      placeholder="Select metric column"
                      options={numericColumns.map(c => ({ label: c, value: c }))}
                    />
                  </div>

                  <Text strong style={{ fontSize: 12 }}>Aggregation</Text>
                  <div style={{ marginBottom: 8 }}>
                    <Select
                      style={{ width: '100%' }}
                      value={aggFunc}
                      onChange={setAggFunc}
                      options={[
                        { label: 'SUM', value: 'SUM' },
                        { label: 'AVG', value: 'AVG' },
                        { label: 'COUNT', value: 'COUNT' },
                        { label: 'MAX', value: 'MAX' },
                        { label: 'MIN', value: 'MIN' },
                      ]}
                    />
                  </div>
                </>
              )}

              <Divider style={{ margin: '8px 0' }} />
              <Text strong style={{ fontSize: 12 }}>Chart Type</Text>
              <Row gutter={[4, 4]} style={{ marginTop: 4, marginBottom: 12 }}>
                {CHART_TYPES.map(ct => (
                  <Col span={8} key={ct.value}>
                    <Tooltip title={ct.desc}>
                      <div
                        onClick={() => setChartType(ct.value)}
                        style={{
                          textAlign: 'center', padding: '8px 4px', cursor: 'pointer', borderRadius: 6,
                          border: chartType === ct.value ? '2px solid #1890ff' : '2px solid transparent',
                          background: chartType === ct.value ? '#e6f7ff' : darkMode ? '#1f1f1f' : '#fafafa',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ fontSize: 18 }}>{ct.icon}</div>
                        <Text style={{ fontSize: 10 }}>{ct.label}</Text>
                      </div>
                    </Tooltip>
                  </Col>
                ))}
              </Row>

              <Form.Item label="Row Limit">
                <InputNumber min={10} max={10000} value={rowLimit} onChange={v => setRowLimit(v || 500)} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="Description" name="description">
                <Input.TextArea rows={2} placeholder="What does this chart show?" />
              </Form.Item>

              <Button type="primary" onClick={handleSubmit} loading={saving} block size="middle">
                {id ? 'Update Chart' : 'Save Chart'}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col span={16} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card
            title={
              <Space>
                <EyeOutlined /> Preview
                {hasData && <Badge count={`${datasetData.length} rows`} style={{ backgroundColor: '#52c41a' }} />}
              </Space>
            }
            size="small"
            style={{ flex: 1 }}
            bodyStyle={{ height: 'calc(100% - 38px)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            {dataLoading ? (
              <Spin tip="Loading data..." />
            ) : !selectedDs ? (
              <Empty description="Select a dataset to start" />
            ) : !xCol || !yCol ? (
              <Empty description="Select X and Y columns to preview" />
            ) : !hasData ? (
              <Empty description="No data in dataset" />
            ) : previewOption ? (
              <ReactECharts
                option={previewOption}
                style={{ height: '100%', width: '100%' }}
                theme={darkMode ? 'dark' : undefined}
              />
            ) : (
              <Empty description="No preview available" />
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
                      if (isNumericType(col.type) && !yCol) setYCol(col.name)
                      else if (!isNumericType(col.type) && !xCol) setXCol(col.name)
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
