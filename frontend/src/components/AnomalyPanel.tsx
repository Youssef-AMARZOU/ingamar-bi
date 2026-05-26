import { useState } from 'react'
import { Button, Select, Card, Alert, Row, Col, Slider, Tag, Table, Spin, Statistic } from 'antd'
import { AlertOutlined, ExperimentOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

interface Anomaly {
  date: string
  actual: number
  expected: number
  expected_lower: number
  expected_upper: number
  deviation: number
  severity: 'low' | 'medium' | 'high'
}

interface Forecast {
  date: string
  yhat: number
  yhat_lower: number
  yhat_upper: number
}

interface AnomalyResult {
  total_rows: number
  anomaly_count: number
  anomaly_rate: number
  anomalies: Anomaly[]
  forecast: Forecast[]
}

interface TableInfo {
  name: string
  columns: { name: string; kind: string }[]
}

interface Props {
  tables: TableInfo[]
  token: string
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#ff4d4f',
  medium: '#faad14',
  low: '#1890ff',
}

export default function AnomalyPanel({ tables, token }: Props) {
  const [table, setTable] = useState<string>('')
  const [dateCol, setDateCol] = useState<string>('')
  const [valueCol, setValueCol] = useState<string>('')
  const [sensitivity, setSens] = useState(0.95)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnomalyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedTable = tables.find(t => t.name === table)
  const cols = selectedTable?.columns || []
  const dateCols = cols.filter(c => c.kind === 'date' || c.kind === 'timestamp' || c.name.toLowerCase().includes('date'))
  const valueCols = cols.filter(c => c.kind === 'measure' || c.kind === 'numeric' || c.name.toLowerCase().includes('sales') || c.name.toLowerCase().includes('profit') || c.name.toLowerCase().includes('quantity'))

  const detect = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/v1/ml/anomalies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ table, date_column: dateCol, value_column: valueCol, sensitivity }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setResult(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const chartOption = result
    ? {
        tooltip: { trigger: 'axis' as const },
        legend: { data: ['Actual', 'Expected', 'Anomaly'] },
        grid: { left: 60, right: 20, bottom: 40, top: 20 },
        xAxis: {
          type: 'category' as const,
          data: result.forecast.map((f) => f.date.slice(0, 10)),
          axisLabel: { rotate: 45, fontSize: 10 },
        },
        yAxis: { type: 'value' as const },
        series: [
          {
            name: 'Confidence Band',
            type: 'line' as const,
            data: result.forecast.map((f) => [f.yhat_upper, f.yhat_lower]),
            lineStyle: { opacity: 0 },
            areaStyle: { color: 'rgba(84,112,198,0.1)' },
            stack: 'confidence',
            symbol: 'none',
          },
          {
            name: 'Expected',
            type: 'line' as const,
            data: result.forecast.map((f) => f.yhat),
            lineStyle: { type: 'dashed' as const, color: '#5470c6' },
            symbol: 'none',
            smooth: true,
          },
          {
            name: 'Actual',
            type: 'line' as const,
            data: result.forecast.map((f) => {
              const anomaly = result.anomalies.find(
                (a) => a.date.slice(0, 10) === f.date.slice(0, 10)
              )
              if (anomaly) {
                return {
                  value: anomaly.actual,
                  itemStyle: { color: SEVERITY_COLOR[anomaly.severity] },
                  symbolSize: 12,
                }
              }
              const original = result.forecast.find(
                (fo) => fo.date.slice(0, 10) === f.date.slice(0, 10)
              )
              return original ? original.yhat : null
            }),
            lineStyle: { color: '#91cc75' },
            smooth: true,
          },
        ],
      }
    : null

  const anomalyColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => v.slice(0, 10) },
    {
      title: 'Actual',
      dataIndex: 'actual',
      key: 'actual',
      render: (v: number) => v?.toLocaleString(),
    },
    {
      title: 'Expected',
      dataIndex: 'expected',
      key: 'expected',
      render: (v: number) => v?.toLocaleString(),
    },
    {
      title: 'Deviation',
      dataIndex: 'deviation',
      key: 'deviation',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#ff4d4f' : '#52c41a' }}>
          {v > 0 ? '+' : ''}
          {v}%
        </span>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (v: string) => (
        <Tag color={SEVERITY_COLOR[v] || 'default'}>{v.toUpperCase()}</Tag>
      ),
    },
  ]

  return (
    <div>
      <Card
        title={
          <>
            <ExperimentOutlined style={{ marginRight: 8 }} />
            Anomaly Detection
          </>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={6}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Dataset</p>
            <Select
              style={{ width: '100%' }}
              placeholder="Select table"
              onChange={(v) => {
                setTable(v)
                setDateCol('')
                setValueCol('')
              }}
              options={tables.map((t) => ({ label: t.name, value: t.name }))}
            />
          </Col>
          <Col span={6}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Date Column</p>
            <Select
              style={{ width: '100%' }}
              placeholder="Date column"
              value={dateCol || undefined}
              onChange={setDateCol}
              options={dateCols.map((c) => ({ label: c.name, value: c.name }))}
            />
          </Col>
          <Col span={6}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Value Column</p>
            <Select
              style={{ width: '100%' }}
              placeholder="Metric to analyze"
              value={valueCol || undefined}
              onChange={setValueCol}
              options={valueCols.map((c) => ({ label: c.name, value: c.name }))}
            />
          </Col>
          <Col span={6}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Sensitivity: {(sensitivity * 100).toFixed(0)}%
            </p>
            <Slider
              min={0.8}
              max={0.99}
              step={0.01}
              value={sensitivity}
              onChange={setSens}
            />
          </Col>
        </Row>
        <Button
          type="primary"
          icon={<AlertOutlined />}
          loading={loading}
          onClick={detect}
          disabled={!table || !dateCol || !valueCol}
          style={{ marginTop: 16 }}
        >
          Detect Anomalies
        </Button>
        {error && (
          <Alert type="error" message={error} style={{ marginTop: 12 }} showIcon />
        )}
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" tip="Analyzing with Prophet..." />
        </div>
      )}

      {result && !loading && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {[
              { label: 'Total Rows', value: result.total_rows, color: '#1890ff' },
              { label: 'Anomalies Found', value: result.anomaly_count, color: '#ff4d4f' },
              { label: 'Anomaly Rate', value: `${result.anomaly_rate}%`, color: '#faad14' },
              {
                label: 'High Severity',
                value: result.anomalies.filter((a) => a.severity === 'high').length,
                color: '#ff4d4f',
              },
            ].map((s) => (
              <Col span={6} key={s.label}>
                <Card
                  size="small"
                  style={{
                    textAlign: 'center',
                    borderTop: `3px solid ${s.color}`,
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>{s.label}</div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card title="Time Series with Anomalies" style={{ marginBottom: 16 }}>
            <ReactECharts option={chartOption} style={{ height: 350 }} notMerge />
          </Card>

          <Card title={`Anomaly Details (${result.anomaly_count} found)`}>
            <Table
              dataSource={result.anomalies}
              columns={anomalyColumns}
              rowKey="date"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </>
      )}
    </div>
  )
}
