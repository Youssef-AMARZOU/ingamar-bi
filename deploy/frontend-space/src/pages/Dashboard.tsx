import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Spin, message, Card, Row, Col, Typography, Button, Space } from 'antd'
import ReactECharts from 'echarts-for-react'
import { dashboardService, chartService } from '../services'
import {
  DashboardOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  TableOutlined,
  ThunderboltOutlined,
  MoonOutlined,
  SunOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useThemeStore } from '../store/theme'

const { Title, Text } = Typography

const Dashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [dashboard, setDashboard] = useState<any>(null)
  const [charts, setCharts] = useState<any[]>([])
  const [chartDataMap, setChartDataMap] = useState<Record<number, any>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { darkMode, toggleDarkMode } = useThemeStore()

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const data = await dashboardService.get(Number(id))
      setDashboard(data)

      const chartsData = await chartService.list()
      const dashboardCharts = chartsData.charts || []
      setCharts(dashboardCharts)

      for (const chart of dashboardCharts) {
        try {
          const result = await chartService.getData(chart.id)
          setChartDataMap(prev => ({ ...prev, [chart.id]: result }))
        } catch (e) {
          console.error(`Failed to load data for chart ${chart.id}`)
        }
      }
    } catch (error) {
      message.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [id])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDashboard()
    setRefreshing(false)
  }

  const getChartOption = (chart: any) => {
    const data = chartDataMap[chart.id]
    const cols = data?.columns || []
    const rows = data?.data || []
    const hasData = rows.length > 0
    const firstCol = cols[0] || 'category'
    const secondCol = cols[1] || 'value'
    const numCol = cols.find((c: string) => !isNaN(Number(rows[0]?.[c]))) || secondCol

    const baseOption: any = {
      title: { text: chart.chart_name, left: 'center', textStyle: { fontSize: 13, fontWeight: 'bold' } },
      tooltip: { trigger: chart.viz_type === 'pie' ? 'item' : 'axis' },
      legend: { show: chart.viz_type === 'pie', bottom: 0, type: 'scroll' },
      grid: { left: '10%', right: '5%', top: 50, bottom: 40 },
      animation: false,
      color: ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#f5222d'],
    }

    const categories = hasData ? rows.map((r: any) => String(r[firstCol] || '')).slice(0, 20) : ['A', 'B', 'C', 'D', 'E']
    const values = hasData ? rows.map((r: any) => Number(r[numCol]) || 0).slice(0, 20) : [100, 80, 60, 40, 20]

    switch (chart.viz_type) {
      case 'bar':
        return { ...baseOption, xAxis: { type: 'category', data: categories, axisLabel: { rotate: 45 } }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: values, itemStyle: { borderRadius: [4, 4, 0, 0] } }] }
      case 'line':
        return { ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.3 } }] }
      case 'pie':
        const pieData = hasData ? rows.slice(0, 10).map((r: any) => ({ name: String(r[firstCol] || ''), value: Number(r[numCol]) || 0 })) : [{ value: 335, name: 'A' }, { value: 310, name: 'B' }, { value: 180, name: 'C' }]
        return { ...baseOption, tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['40%', '70%'], data: pieData }] }
      case 'area':
        return { ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'line', data: values, smooth: true, areaStyle: { opacity: 0.5 } }] }
      case 'scatter':
        const scatterData = hasData ? rows.slice(0, 50).map((r: any) => [Number(r[cols[0]] || 0), Number(r[cols[1] || cols[0]] || 0)]) : [[10, 20], [30, 40], [50, 60]]
        return { ...baseOption, xAxis: { type: 'value' }, yAxis: { type: 'value' }, series: [{ type: 'scatter', data: scatterData, symbolSize: 10 }] }
      case 'heatmap':
        const hData = hasData ? rows.slice(0, 30).map((r: any, i: number) => [i % 5, Math.floor(i / 5), Number(r[numCol]) || 0]) : []
        return { ...baseOption, xAxis: { type: 'category', data: [...new Set(hData.map((d: number[]) => String(d[0])))] }, yAxis: { type: 'category', data: [...new Set(hData.map((d: number[]) => String(d[1])))] }, visualMap: { min: 0, max: Math.max(...hData.map((d: number[]) => d[2]), 100), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 }, series: [{ type: 'heatmap', data: hData }] }
      default:
        return { ...baseOption, xAxis: { type: 'category', data: categories }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: values }] }
    }
  }

  const getChartIcon = (vizType: string) => {
    switch (vizType) {
      case 'bar': return <BarChartOutlined />
      case 'line': return <LineChartOutlined />
      case 'pie': return <PieChartOutlined />
      case 'area': return <LineChartOutlined />
      case 'heatmap': return <TableOutlined />
      case 'table': return <TableOutlined />
      default: return <DashboardOutlined />
    }
  }

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  }

  return (
    <div style={{ background: darkMode ? '#141414' : '#f0f2f5', minHeight: '100vh', padding: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
        background: darkMode ? '#1f1f1f' : '#fff', padding: '16px 24px', borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>
          <Title level={3} style={{ margin: 0, color: darkMode ? '#fff' : '#000' }}>{dashboard?.dashboard_title}</Title>
          <Text type="secondary">{dashboard?.description}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing}>Refresh</Button>
          <Button icon={darkMode ? <SunOutlined /> : <MoonOutlined />} onClick={toggleDarkMode}>
            {darkMode ? 'Light' : 'Dark'}
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {charts.map((chart, i) => {
          const data = chartDataMap[chart.id]
          const rowCount = data?.rowcount || 0
          const hasData = rowCount > 0

          return (
            <Col span={chart.viz_type === 'table' || chart.viz_type === 'heatmap' ? 24 : 8} key={chart.id}>
              <Card
                style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', background: darkMode ? '#1f1f1f' : '#fff' }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getChartIcon(chart.viz_type)}
                    <span style={{ color: darkMode ? '#fff' : '#000', fontSize: 13 }}>{chart.chart_name}</span>
                    {hasData && (
                      <span style={{ background: '#1890ff', color: '#fff', padding: '0 6px', borderRadius: 4, fontSize: 11, lineHeight: '18px' }}>
                        {rowCount}
                      </span>
                    )}
                    {!hasData && (
                      <span style={{ background: '#faad14', color: '#fff', padding: '0 6px', borderRadius: 4, fontSize: 11, lineHeight: '18px' }}>
                        Mock
                      </span>
                    )}
                  </div>
                }
              >
                <ReactECharts
                  option={getChartOption(chart)}
                  style={{ height: 320 }}
                  theme={darkMode ? 'dark' : undefined}
                />
                {chart.description && (
                  <div style={{
                    marginTop: 8, padding: '4px 0', borderTop: '1px solid ' + (darkMode ? '#303030' : '#f0f0f0'),
                    fontSize: 12, color: darkMode ? '#999' : '#666', lineHeight: 1.5
                  }}>
                    {chart.description}
                  </div>
                )}
              </Card>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}

export default Dashboard
