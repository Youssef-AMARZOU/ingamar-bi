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
  FullscreenOutlined, FullscreenExitOutlined, ReloadOutlined,
  EditOutlined, RocketOutlined
} from '@ant-design/icons'
import { ResponsiveGridLayout as _RGL } from 'react-grid-layout'
const ResponsiveGridLayout = _RGL as any
import ReactECharts from 'echarts-for-react'
import { dashboardService, chartService } from '../services'
import api from '../services/api'
import { useThemeStore } from '../store/theme'
import { buildChartOption, TABLEAU_COLORS, formatNumber } from '../utils/chartUtils'
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
        setLayout(dashboardCharts.map((c: any, i: number) => ({
          i: String(c.id), x: (i % 2) * 6, y: Math.floor(i / 2) * 8, w: 6, h: 8,
        })))
      }
      await Promise.all(dashboardCharts.map(async (chart: any) => {
        try {
          const result = await chartService.getData(chart.id)
          setChartDataMap(prev => ({ ...prev, [chart.id]: result }))
        } catch (e) { console.error(`Failed to load data for chart ${chart.id}`) }
      }))
    } catch (error: any) {
      message.error('Failed to load dashboard')
    } finally { setLoading(false) }
  }

  const fetchAvailableCharts = async () => {
    try {
      const data = await chartService.list()
      const allCharts = data.charts || []
      const existingIds = new Set(charts.map(c => c.id))
      setAvailableCharts(allCharts.filter((c: any) => !existingIds.has(c.id)))
    } catch (e) { console.error(e) }
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
    } catch (e: any) { message.error('Failed to remove chart') }
  }

  const handleLayoutChange = (_layout: any, _layouts: any) => {
    setLayout(_layouts.lg || _layout)
  }

  const handleSaveLayout = async () => {
    setSaving(true)
    try {
      const layoutData = layout.map(l => ({ i: l.i, pos: { x: l.x, y: l.y, w: l.w, h: l.h } }))
      await api.put(`/dashboards/${id}/layout`, { layout: layoutData })
      if (titleValue !== dashboard?.dashboard_title) {
        await dashboardService.update(Number(id), { dashboard_title: titleValue })
      }
      setEditTitle(false)
      message.success('Dashboard saved')
      fetchDashboard()
    } catch (e: any) { message.error('Failed to save') } finally { setSaving(false) }
  }

  const getChartOption = (chart: any) => {
    const data = chartDataMap[chart.id]
    const rows = data?.data || []
    const cols = data?.columns || []
    if (!rows?.length || !cols?.length) return null

    const params = chart.params || {}
    const xCol = params.xCol || params.groupby?.[0]
    const metrics = params.metrics?.length > 0
      ? params.metrics.map((m: any) => ({
          column: m.column?.column_name || m.column || '',
          aggregation: m.aggregate || 'SUM',
          label: m.label || `${m.aggregate || 'SUM'}(${m.column?.column_name || m.column || ''})`,
        }))
      : (params.yCol
          ? [{ column: params.yCol, aggregation: params.aggFunc || 'SUM', label: `${params.aggFunc || 'SUM'}(${params.yCol})` }]
          : [])

    return buildChartOption({
      chartType: chart.viz_type || 'bar',
      xCol: xCol || cols[0],
      metrics,
      data: rows,
      title: chart.chart_name,
      darkMode,
      stackMode: params.stackMode || 'none',
      sortBy: params.sortBy || 'none',
      showLabels: params.showLabels || false,
    })
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

    const option = getChartOption(chart)
    if (!option) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Empty description="No preview available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )
    }

    const isTable = chart.viz_type === 'table'
    if (isTable) {
      return (
        <div style={{ height: '100%', overflow: 'auto', padding: 4 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: darkMode ? '#2d2d2d' : '#fafafa', position: 'sticky', top: 0 }}>
                {(data?.columns || []).map((col: string) => (
                  <th key={col} style={{ padding: '3px 6px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), textAlign: 'left', fontWeight: 600 }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).slice(0, 50).map((row: any, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? (darkMode ? '#1f1f1f' : '#fff') : (darkMode ? '#2d2d2d' : '#f9fafb') }}>
                  {(data?.columns || []).map((col: string) => (
                    <td key={col} style={{ padding: '2px 6px', border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'), color: darkMode ? '#e5e7eb' : '#374151' }}>
                      {isNaN(Number(row[col])) ? String(row[col] ?? '') : formatNumber(Number(row[col]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        theme={darkMode ? 'dark' : undefined}
        notMerge
      />
    )
  }

  const gridItems = charts.map(chart => {
    const layoutItem = layout.find(l => l.i === String(chart.id))
    return { chart, layout: layoutItem || { i: String(chart.id), x: 0, y: 0, w: 6, h: 8 } }
  })

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  return (
    <div style={{ background: darkMode ? '#141414' : '#f0f2f5', minHeight: '100vh' }}>
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
          <Tag color="blue">{charts.length} chart{charts.length !== 1 ? 's' : ''}</Tag>
        </Space>
        <Space>
          <Tooltip title="Refresh data">
            <Button icon={<ReloadOutlined />} onClick={fetchDashboard} loading={refreshing} />
          </Tooltip>
          <Tooltip title="Create new chart">
            <Button icon={<RocketOutlined />} onClick={() => navigate('/charts/new')}>New Chart</Button>
          </Tooltip>
          <Tooltip title="Add existing chart">
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
