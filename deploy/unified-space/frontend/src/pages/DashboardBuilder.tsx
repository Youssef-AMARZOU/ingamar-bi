import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Card, Space, Modal, Form, Input, message, Spin, Empty,
  Select, Typography, Tag, Popconfirm, Tooltip, Badge, Divider
} from 'antd'
import {
  PlusOutlined, SaveOutlined, ArrowLeftOutlined, DeleteOutlined,
  BarChartOutlined, LineChartOutlined, PieChartOutlined,
  AreaChartOutlined, DotChartOutlined, TableOutlined,
  FullscreenOutlined, FullscreenExitOutlined, ReloadOutlined
} from '@ant-design/icons'
import { ResponsiveGridLayout as RGL } from 'react-grid-layout'
const ResponsiveGridLayout = RGL as any
import ReactECharts from 'echarts-for-react'
import { dashboardService, chartService } from '../services'
import api from '../services/api'
import { useThemeStore } from '../store/theme'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const { Title, Text } = Typography

const CHART_ICONS: Record<string, any> = {
  bar: <BarChartOutlined />,
  line: <LineChartOutlined />,
  pie: <PieChartOutlined />,
  area: <AreaChartOutlined />,
  scatter: <DotChartOutlined />,
  table: <TableOutlined />,
}

const DEFAULT_LAYOUT = [
  { i: 'new-1', x: 0, y: 0, w: 6, h: 8 },
  { i: 'new-2', x: 6, y: 0, w: 6, h: 8 },
  { i: 'new-3', x: 0, y: 8, w: 6, h: 8 },
  { i: 'new-4', x: 6, y: 8, w: 6, h: 8 },
]

const DashboardBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<any>(null)
  const [charts, setCharts] = useState<any[]>([])
  const [chartDataMap, setChartDataMap] = useState<Record<number, any>>({})
  const [layout, setLayout] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [availableCharts, setAvailableCharts] = useState<any[]>([])
  const [fullscreen, setFullscreen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const { darkMode } = useThemeStore()

  useEffect(() => {
    if (id) fetchDashboard()
  }, [id])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const data = await dashboardService.get(Number(id))
      setDashboard(data)
      setTitleValue(data.dashboard_title || '')

      const dashboardCharts = data.charts || []
      setCharts(dashboardCharts)

      const savedLayout = data.json_metadata?.layout || []
      if (savedLayout.length > 0) {
        setLayout(savedLayout)
      } else {
        const autoLayout = dashboardCharts.map((c: any, i: number) => ({
          i: String(c.id),
          x: (i % 2) * 6,
          y: Math.floor(i / 2) * 8,
          w: 6,
          h: 8,
        }))
        setLayout(autoLayout)
      }

      for (const chart of dashboardCharts) {
        try {
          const result = await chartService.getData(chart.id)
          setChartDataMap(prev => ({ ...prev, [chart.id]: result }))
        } catch (e) {
          console.error(`Failed to load data for chart ${chart.id}`)
        }
      }
    } catch (error: any) {
      message.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableCharts = async () => {
    try {
      const data = await chartService.list()
      const allCharts = data.charts || []
      const existingIds = new Set(charts.map(c => c.id))
      setAvailableCharts(allCharts.filter((c: any) => !existingIds.has(c.id)))
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddChart = async (chartId: number) => {
    try {
      await api.post(`/dashboards/${id}/charts`, { chart_id: chartId, position: {} })
      message.success('Chart added')
      setAddModalOpen(false)
      fetchDashboard()
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Failed to add chart')
    }
  }

  const handleRemoveChart = async (chartId: number) => {
    try {
      await api.delete(`/dashboards/${id}/charts/${chartId}`)
      message.success('Chart removed')
      setCharts(prev => prev.filter(c => c.id !== chartId))
      setLayout(prev => prev.filter(l => l.i !== String(chartId)))
    } catch (e: any) {
      message.error('Failed to remove chart')
    }
  }

  const handleLayoutChange = (_layout: any, _layouts: any) => {
    setLayout(_layouts.lg || _layout)
  }

  const handleSaveLayout = async () => {
    setSaving(true)
    try {
      const layoutData = layout.map(l => ({ i: l.i, pos: { x: l.x, y: l.y, w: l.w, h: l.h } }))
      await api.put(`/dashboards/${id}/layout`, { layout: layoutData })

      if (editTitle && titleValue !== dashboard?.dashboard_title) {
        await dashboardService.update(Number(id), { dashboard_title: titleValue })
        setEditTitle(false)
      }

      message.success('Dashboard saved')
      fetchDashboard()
    } catch (e: any) {
      message.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const getChartOption = (chart: any) => {
    const data = chartDataMap[chart.id]
    const cols = data?.columns || []
    const rows = data?.data || []
    const hasData = rows.length > 0

    if (!hasData) {
      return {
        title: { text: chart.chart_name, left: 'center', textStyle: { fontSize: 12 } },
        grid: { top: 30 },
      }
    }

    const firstCol = cols[0] || 'category'
    const numCol = cols.find((c: string) => !isNaN(Number(rows[0]?.[c]))) || cols[1] || cols[0]

    const baseOption: any = {
      title: { text: chart.chart_name, left: 'center', textStyle: { fontSize: 12, fontWeight: 600 } },
      tooltip: { trigger: chart.viz_type === 'pie' ? 'item' : 'axis' },
      grid: { left: '8%', right: '4%', top: 35, bottom: 30, containLabel: true },
      color: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'],
      animation: false,
    }

    const categories = rows.map((r: any) => String(r[firstCol] || '')).slice(0, 20)
    const values = rows.map((r: any) => Number(r[numCol]) || 0).slice(0, 20)

    switch (chart.viz_type) {
      case 'bar':
        return { ...baseOption, xAxis: { type: 'category', data: categories, axisLabel: { rotate: categories.length > 8 ? 45 : 0 } }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [3, 3, 0, 0] } }] }
      case 'line':
        return { ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.2 } }] }
      case 'pie':
        return { ...baseOption, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['35%', '60%'], data: rows.slice(0, 10).map((r: any) => ({ name: String(r[firstCol] || ''), value: Number(r[numCol]) || 0 })) }] }
      case 'area':
        return { ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.4 } }] }
      case 'scatter':
        return { ...baseOption, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: rows.slice(0, 50).map((r: any) => [Number(r[cols[0]] || 0), Number(r[cols[1] || cols[0]] || 0)]), symbolSize: 8 }] }
      default:
        return { ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: values }] }
    }
  }

  const renderChartContent = (chart: any) => {
    const data = chartDataMap[chart.id]
    const hasData = (data?.rowcount || 0) > 0

    if (!hasData) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '20px 0' }} />
        </div>
      )
    }

    return (
      <ReactECharts
        option={getChartOption(chart)}
        style={{ height: '100%', width: '100%' }}
        theme={darkMode ? 'dark' : undefined}
      />
    )
  }

  const gridItems = charts.map(chart => {
    const layoutItem = layout.find(l => l.i === String(chart.id))
    return {
      chart,
      layout: layoutItem || { i: String(chart.id), x: 0, y: 0, w: 6, h: 8 },
    }
  })

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  return (
    <div style={{ background: darkMode ? '#141414' : '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px',
        background: darkMode ? '#1f1f1f' : '#fff',
        borderBottom: '1px solid ' + (darkMode ? '#303030' : '#f0f0f0'),
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboards')} />
          {editTitle ? (
            <Input
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onPressEnter={() => setEditTitle(false)}
              onBlur={() => setEditTitle(false)}
              autoFocus
              style={{ width: 300, fontWeight: 600, fontSize: 16 }}
            />
          ) : (
            <Title level={4} style={{ margin: 0, cursor: 'pointer' }} onClick={() => setEditTitle(true)}>
              {dashboard?.dashboard_title}
            </Title>
          )}
          <Tag color="blue">{charts.length} charts</Tag>
        </Space>
        <Space>
          <Tooltip title="Refresh data">
            <Button icon={<ReloadOutlined />} onClick={fetchDashboard} loading={refreshing} />
          </Tooltip>
          <Tooltip title="Add chart">
            <Button icon={<PlusOutlined />} onClick={() => { fetchAvailableCharts(); setAddModalOpen(true) }} />
          </Tooltip>
          <Tooltip title="Toggle fullscreen">
            <Button icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={() => setFullscreen(!fullscreen)} />
          </Tooltip>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLayout} loading={saving}>
            Save
          </Button>
        </Space>
      </div>

      {/* Grid */}
      <div style={{ padding: fullscreen ? 0 : 16 }}>
        {charts.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 80, marginTop: 40 }}>
            <BarChartOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No charts yet</div>
            <div style={{ color: '#9ca3af', marginBottom: 24 }}>Add charts to build your dashboard</div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { fetchAvailableCharts(); setAddModalOpen(true) }}>
              Add Chart
            </Button>
          </Card>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={40}
            margin={[12, 12]}
            containerPadding={[0, 0]}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".drag-handle"
          >
            {gridItems.map(({ chart, layout: l }) => (
              <div key={String(chart.id)} data-grid={l}>
                <Card
                  size="small"
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 8 }}
                  bodyStyle={{ flex: 1, padding: 0, overflow: 'hidden' }}
                  title={
                    <div className="drag-handle" style={{ cursor: 'move', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {CHART_ICONS[chart.viz_type] || <BarChartOutlined />}
                      <Text style={{ fontSize: 12, fontWeight: 500 }}>{chart.chart_name}</Text>
                      <Tag style={{ fontSize: 10, margin: 0 }}>{chart.viz_type}</Tag>
                    </div>
                  }
                  extra={
                    <Popconfirm title="Remove this chart?" onConfirm={() => handleRemoveChart(chart.id)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: '0 4px' }} />
                    </Popconfirm>
                  }
                >
                  {renderChartContent(chart)}
                </Card>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Add Chart Modal */}
      <Modal
        title="Add Chart to Dashboard"
        open={addModalOpen}
        onCancel={() => setAddModalOpen(false)}
        footer={null}
        width={600}
      >
        {availableCharts.length === 0 ? (
          <Empty description="No available charts. Create charts first." />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {availableCharts.map(chart => (
              <Card
                key={chart.id}
                size="small"
                hoverable
                style={{ cursor: 'pointer' }}
                onClick={() => handleAddChart(chart.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    {CHART_ICONS[chart.viz_type] || <BarChartOutlined />}
                    <div>
                      <Text strong>{chart.chart_name}</Text>
                      <div><Tag style={{ fontSize: 10 }}>{chart.viz_type}</Tag></div>
                    </div>
                  </Space>
                  <Button size="small" type="primary" icon={<PlusOutlined />}>Add</Button>
                </div>
              </Card>
            ))}
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default DashboardBuilder
