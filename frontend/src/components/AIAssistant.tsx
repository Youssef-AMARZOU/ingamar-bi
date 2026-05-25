import React, { useState, useEffect } from 'react'
import { Drawer, Button, Input, message, Typography, Space, Card, List, Spin, Tag, Alert, Segmented } from 'antd'
import { SendOutlined, RobotOutlined, BarChartOutlined, CalculatorOutlined, CheckCircleOutlined, LoadingOutlined, ThunderboltOutlined, CodeOutlined } from '@ant-design/icons'
import { aiService, datasetService } from '../services'
import api from '../services/api'
import ReactECharts from 'echarts-for-react'
import { buildChartOption } from '../utils/chartUtils'

const { Text } = Typography
const { TextArea } = Input

interface AIAssistantProps {
  open: boolean
  onClose: () => void
  datasetId?: string
  datasetName?: string
  columns?: string[]
  onSuccess?: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  suggestions?: Array<{ type: 'metric' | 'chart'; title: string; description: string; config?: any }>
  createdItems?: Array<{ type: 'metric' | 'chart'; title: string; id?: number; status: 'success' | 'error' | 'loading' }>
}

const SYSTEM_PROMPT = `You are an EXPERT DATA ANALYST for a BI platform. Given a dataset schema with statistics and a user request, suggest the MOST INSIGHTFUL charts and metrics.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences.

ANALYSIS FRAMEWORK:
1. UNDERSTAND the data
2. FIND PATTERNS: distributions, outliers, correlations, trends, segments
3. SUGGEST 2-4 impactful visualizations and KPIs
4. Every description must read like a chart LEGEND/CAPTION that helps users interpret the visualization

CRITICAL: The "description" field will be shown as a legend/explanation below the chart. Write it like: "This bar chart compares... Group A has X, Group B has Y, suggesting that..."

CHART TYPES & WHEN TO USE THEM:
- bar: Compare categories, rankings
- line: Trends over time
- pie: Composition, proportions (<5 categories)
- scatter: Correlation between 2 numeric variables
- area: Volume trends, stacked comparisons
- heatmap: Cross-tabulation, density
- table: Detailed breakdowns

JSON format:
{
  "message": "Analysis summary",
  "suggestions": [
    {
      "type": "chart",
      "title": "Short insight-driven title",
      "description": "Chart legend/explanation (1-3 sentences with specific values)",
      "config": {
        "chart_name": "Title",
        "viz_type": "bar",
        "datasource_id": "<table_name>",
        "datasource_type": "table",
        "description": "Same detailed legend text",
        "params": {
          "groupby": ["category_column"],
          "metrics": [{"label":"Metric","expressionType":"SIMPLE","aggregate":"AVG","column":{"column_name":"numeric_col"}}],
          "rowLimit": 20
        }
      }
    }
  ]
}

CRITICAL RULES:
- groupby MUST be an array of strings
- metrics MUST be an array of objects
- Use actual column names from the schema
- description must be a readable chart caption/legend`

const AIAssistant: React.FC<AIAssistantProps> = ({ open, onClose, datasetId, datasetName, columns, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'analyze' | 'query'>('analyze')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I'm your data assistant. I can help you create metrics and charts from your dataset${datasetName ? ` "${datasetName}"` : ''}. What would you like to analyze?`,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiMode, setAiMode] = useState<'puter' | 'api_key' | 'none'>('none')
  const [checkingConfig, setCheckingConfig] = useState(true)
  const [queryResult, setQueryResult] = useState<{
    sql: string; data: Record<string,any>[]; columns: string[]
    chart_type: string; x_column: string; y_columns: string[]
    title: string; explanation: string; total_rows: number
  } | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      checkAiConfig()
    }
  }, [open])

  const checkAiConfig = async () => {
    setCheckingConfig(true)
    try {
      const resp = await api.get('/auth/config', { params: { key: ['ai_api_key'] } })
      if (resp.data.ai_api_key) {
        setAiMode('api_key')
      } else if (window.puter) {
        setAiMode('puter')
      } else {
        setAiMode('none')
      }
    } catch {
      if (window.puter) {
        setAiMode('puter')
      } else {
        setAiMode('none')
      }
    } finally {
      setCheckingConfig(false)
    }
  }

  const getSchemaContext = async () => {
    if (!datasetId) return ''
    try {
      const preview = await datasetService.preview(datasetId as any, 5)
      if (!preview || !preview.columns) return ''
      const cols = preview.columns.map((c: string) => c)
      const sample = preview.data || []
      return JSON.stringify({
        table_name: datasetId,
        columns: cols,
        sample_rows: sample.slice(0, 3),
      }, null, 2)
    } catch {
      return JSON.stringify({ table_name: datasetId, columns: columns || [] })
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    if (activeTab === 'query') {
      setLoading(true)
      setQueryResult(null)
      setQueryError(null)
      const q = input
      setInput('')
      try {
        const res = await fetch('/api/v1/ai/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: q,
            dataset_id: datasetId,
            table_name: datasetName || datasetId,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setQueryResult(data)
      } catch (e: any) {
        setQueryError(e.message)
      } finally {
        setLoading(false)
      }
      return
    }

    const userMessage: ChatMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      if (aiMode === 'api_key') {
        const response = await aiService.analyze({
          message: input,
          dataset_id: datasetId as any,
          columns: columns,
        })
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.message,
          suggestions: response.suggestions,
        }
        setMessages(prev => [...prev, assistantMessage])
      } else if (aiMode === 'puter' && window.puter) {
        const schemaText = await getSchemaContext()
        const userPrompt = `User request: ${input}\n\nDataset schema:\n${schemaText}\n\nAvailable columns: ${(columns || []).join(', ')}\n\nRespond with ONLY valid JSON in the specified format.`

        let responseText = ''
        try {
          responseText = await window.puter.ai.chat(
            `${SYSTEM_PROMPT}\n\n${userPrompt}`,
            { model: 'qwen/qwen3.6-plus' }
          )
        } catch (puterErr: any) {
          if (puterErr?.message?.includes('sign') || puterErr?.message?.includes('auth')) {
            await window.puter.auth.signIn()
            responseText = await window.puter.ai.chat(
              `${SYSTEM_PROMPT}\n\n${userPrompt}`,
              { model: 'qwen/qwen3.6-plus' }
            )
          } else {
            throw puterErr
          }
        }

        let parsed
        try {
          parsed = JSON.parse(responseText)
        } catch {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('Could not parse AI response as JSON')
          }
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: parsed.message || "Here are my suggestions:",
          suggestions: parsed.suggestions || [],
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'To use the AI assistant, set up an API key in Settings (profile → Settings → AI API), or Puter.js will load automatically in your browser.',
          suggestions: [],
        }])
      }
    } catch (error: any) {
      const errMsg = error?.message || 'Failed to get AI response'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${errMsg}. Check your AI configuration in Settings.`,
        suggestions: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const chartOption = queryResult
    ? buildChartOption({
        chartType: queryResult.chart_type,
        xCol: queryResult.x_column,
        metrics: queryResult.y_columns.map(c => ({
          column: c,
          aggregation: 'SUM',
          label: c,
        })),
        data: queryResult.data,
        title: queryResult.title,
      })
    : null

  const handleApplySuggestion = async (suggestion: any, msgIndex: number) => {
    setMessages(prev => {
      const updated = [...prev]
      const msg = { ...updated[msgIndex] }
      if (!msg.createdItems) msg.createdItems = []
      msg.createdItems.push({ type: suggestion.type, title: suggestion.title, status: 'loading' as const })
      updated[msgIndex] = msg
      return updated
    })

    try {
      let result
      if (suggestion.type === 'metric') {
        result = await aiService.createMetric(suggestion.config)
      } else {
        result = await aiService.createChart(suggestion.config)
      }

      setMessages(prev => {
        const updated = [...prev]
        const msg = { ...updated[msgIndex] }
        msg.createdItems = msg.createdItems?.map(item =>
          item.title === suggestion.title ? { ...item, status: 'success' as const, id: result?.id } : item
        )
        msg.content = `Created: ${suggestion.title}`
        updated[msgIndex] = msg
        return updated
      })

      message.success(`${suggestion.type === 'metric' ? 'Metric' : 'Chart'} "${suggestion.title}" created!`)
      onSuccess?.()
    } catch (error) {
      const err: any = error
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to create'
      setMessages(prev => {
        const updated = [...prev]
        const msg = { ...updated[msgIndex] }
        msg.createdItems = msg.createdItems?.map(item =>
          item.title === suggestion.title ? { ...item, status: 'error' as const } : item
        )
        updated[msgIndex] = msg
        return updated
      })
      message.error(errMsg)
    }
  }

  const handleApplyAll = async (suggestions: any[], msgIndex: number) => {
    setMessages(prev => {
      const updated = [...prev]
      const msg = { ...updated[msgIndex] }
      msg.createdItems = suggestions.map((s: any) => ({ type: s.type, title: s.title, status: 'loading' as const }))
      msg.suggestions = []
      updated[msgIndex] = msg
      return updated
    })

    let successCount = 0
    for (const suggestion of suggestions) {
      try {
        if (suggestion.type === 'metric') {
          await aiService.createMetric(suggestion.config)
        } else {
          await aiService.createChart(suggestion.config)
        }
        successCount++
      } catch (e) {
        const err: any = e
        console.error('Create failed:', err?.response?.data || err)
      }
    }

    setMessages(prev => {
      const updated = [...prev]
      const msg = { ...updated[msgIndex] }
      msg.createdItems = msg.createdItems?.map(item => ({ ...item, status: 'success' as const }))
      msg.content = `Created ${successCount} item${successCount !== 1 ? 's' : ''} successfully`
      updated[msgIndex] = msg
      return updated
    })

    message.success(`${successCount} item${successCount !== 1 ? 's' : ''} created!`)
    onSuccess?.()
  }

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined />
          <span>AI Data Assistant</span>
          {aiMode === 'puter' && <Tag color="green" style={{ fontSize: 10 }}>Puter</Tag>}
          {aiMode === 'api_key' && <Tag color="blue" style={{ fontSize: 10 }}>API</Tag>}
        </Space>
      }
      placement="right"
      width={480}
      onClose={onClose}
      open={open}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Segmented
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'analyze' | 'query')}
          options={[
            { label: <><RobotOutlined /> Analyze</>, value: 'analyze' },
            { label: <><ThunderboltOutlined /> Quick Query</>, value: 'query' },
          ]}
          style={{ marginBottom: 12, alignSelf: 'center' }}
          block
        />

        {checkingConfig && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ marginLeft: 8 }}>Checking AI config...</Text>
          </div>
        )}

        {activeTab === 'query' ? (
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                'Show total sales by category',
                'Top 10 products by revenue',
                'Sales trend over time',
                'Average value by region',
              ].map(s => (
                <Tag
                  key={s}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setInput(s); }}
                >
                  {s}
                </Tag>
              ))}
            </div>

            {queryResult && (
              <Card title={queryResult.title} size="small" style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {queryResult.explanation}
                </Text>
                <Text style={{ fontSize: 12, color: '#888' }}>
                  {queryResult.total_rows} rows · {queryResult.columns.length} columns
                </Text>
                {chartOption && (
                  <ReactECharts option={chartOption} style={{ height: 300, marginTop: 8 }} />
                )}
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', color: '#888', fontSize: 12 }}>
                    <CodeOutlined /> View SQL
                  </summary>
                  <pre style={{
                    background: '#1e1e1e', color: '#d4d4d4',
                    padding: 12, borderRadius: 6, marginTop: 8,
                    fontSize: 12, overflow: 'auto', maxHeight: 200,
                  }}>
                    {queryResult.sql}
                  </pre>
                </details>
              </Card>
            )}

            {queryError && (
              <Alert type="error" message={queryError} showIcon style={{ marginBottom: 12 }} />
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin tip="Generating query..." />
              </div>
            )}
          </div>
        ) : (
          <>
            {aiMode === 'puter' && !checkingConfig && (
              <Alert
                message="Using Puter.js (browser AI)"
                description="AI runs in your browser via Puter.js — free, no API key needed. You may be asked to sign in to Puter."
                type="info"
                showIcon
                closable
                style={{ marginBottom: 8 }}
              />
            )}

            {aiMode === 'none' && !checkingConfig && (
              <Alert
                message="AI not configured"
                description="Go to Settings → AI API to set up your AI provider (Puter.js works automatically in your browser)."
                type="warning"
                showIcon
                style={{ marginBottom: 8 }}
              />
            )}

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
              <List
                dataSource={messages}
                renderItem={(msg, index) => (
                  <List.Item style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', border: 'none', padding: '8px 0' }}>
                    <Card
                      style={{
                        maxWidth: '85%',
                        background: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                        color: msg.role === 'user' ? '#fff' : '#000',
                        border: 'none',
                        borderRadius: 12,
                      }}
                      bodyStyle={{ padding: '12px 16px' }}
                    >
                      <Text style={{ color: msg.role === 'user' ? '#fff' : '#000' }}>{msg.content}</Text>

                      {msg.suggestions && msg.suggestions.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text strong style={{ color: msg.role === 'user' ? '#fff' : '#000', fontSize: 12 }}>
                              Suggested actions:
                            </Text>
                            <Button
                              size="small"
                              type={msg.role === 'user' ? 'primary' : 'default'}
                              onClick={() => handleApplyAll(msg.suggestions!, index)}
                            >
                              Apply All
                            </Button>
                          </div>
                          <List
                            size="small"
                            dataSource={msg.suggestions}
                            style={{ marginTop: 8 }}
                            renderItem={(suggestion) => (
                              <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                <Card
                                  size="small"
                                  style={{
                                    width: '100%',
                                    background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : '#fff',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.3)' : '#d9d9d9'}`,
                                  }}
                                  extra={
                                    <Button
                                      size="small"
                                      type="primary"
                                      onClick={() => handleApplySuggestion(suggestion, index)}
                                    >
                                      Apply
                                    </Button>
                                  }
                                >
                                  <Space>
                                    {suggestion.type === 'metric' ? <CalculatorOutlined /> : <BarChartOutlined />}
                                    <Text strong style={{ fontSize: 12 }}>{suggestion.title}</Text>
                                    <Tag color={suggestion.type === 'metric' ? 'blue' : 'green'}>
                                      {suggestion.type}
                                    </Tag>
                                  </Space>
                                  <Text style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                                    {suggestion.description}
                                  </Text>
                                </Card>
                              </List.Item>
                            )}
                          />
                        </div>
                      )}

                      {msg.createdItems && msg.createdItems.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          {msg.createdItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              {item.status === 'loading' && <LoadingOutlined style={{ fontSize: 12 }} />}
                              {item.status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
                              {item.status === 'error' && <Tag color="red">Failed</Tag>}
                              <Text style={{ fontSize: 12 }}>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </List.Item>
                )}
              />

              {loading && (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <Spin />
                  <Text type="secondary" style={{ marginLeft: 8 }}>AI is thinking...</Text>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={activeTab === 'query' ? 'Ask a question about your data...' : "Ask about your data, create metrics or charts..."}
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              style={{ resize: 'none' }}
            />
            <Button
              type="primary"
              icon={activeTab === 'query' ? <ThunderboltOutlined /> : <SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim()}
            />
          </Space.Compact>
        </div>
      </div>
    </Drawer>
  )
}

export default AIAssistant