import React, { useState, useEffect, useRef } from 'react'
import { Drawer, Button, Input, message, Typography, Space, Card, List, Spin, Tag, Alert, Tooltip } from 'antd'
import {
  SendOutlined, RobotOutlined, BarChartOutlined, CalculatorOutlined,
  CheckCircleOutlined, LoadingOutlined, ThunderboltOutlined, CodeOutlined,
  UserOutlined, BulbOutlined, QuestionCircleOutlined, ClearOutlined,
  MessageOutlined
} from '@ant-design/icons'
import { aiService, datasetService } from '../services'
import api from '../services/api'
import ReactECharts from 'echarts-for-react'
import { buildChartOption } from '../utils/chartUtils'
import { useThemeStore } from '../store/theme'

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
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'chart' | 'sql' | 'insight' | 'error'
  chartConfig?: {
    chartType: string
    xCol: string
    metrics: { column: string; aggregation: string; label: string }[]
    data: any[]
    title?: string
  }
  sql?: string
  suggestions?: Array<{ type: 'metric' | 'chart'; title: string; description: string; config?: any }>
  createdItems?: Array<{ type: 'metric' | 'chart'; title: string; id?: number; status: 'success' | 'error' | 'loading' }>
}

const SYSTEM_PROMPT = `You are an EXPERT DATA ANALYST assistant for a BI platform. Your job is to help users understand their data through conversation.

RESPONSE FORMAT: Respond with ONLY valid JSON. No markdown, no code fences.

CAPABILITIES:
1. Answer questions about the data (find patterns, outliers, trends, distributions)
2. Suggest insightful charts and metrics
3. Explain what the data shows in plain language
4. Recommend further analysis

JSON format:
{
  "message": "Your conversational response explaining insights in plain language (2-4 sentences). Use specific numbers and values from the data.",
  "type": "text",
  "suggestions": [
    {
      "type": "chart",
      "title": "Short insight-driven title",
      "description": "What this chart shows (1-2 sentences with specific values)",
      "config": {
        "chart_name": "Title",
        "viz_type": "bar|line|pie|scatter|area|heatmap|table",
        "datasource_id": "<table_name>",
        "datasource_type": "table",
        "params": {
          "groupby": ["category_column"],
          "metrics": [{"label":"Metric","expressionType":"SIMPLE","aggregate":"SUM|AVG|COUNT","column":{"column_name":"numeric_col"}}],
          "rowLimit": 20
        }
      }
    }
  ]
}

RESPONSE TYPE RULES:
- For general questions/insights: type "text" with a helpful plain-language answer
- For chart suggestions: include type "text" message + suggestions array
- For questions about specific values: mention the actual numbers and what they mean
- If the user asks "why" or "explain": give deeper analytical context

CHART TYPE GUIDE:
- bar: Compare categories, rankings
- line: Trends over time
- pie: Composition, proportions (<5 categories)
- scatter: Correlation between 2 numeric variables
- area: Volume trends, stacked comparisons
- heatmap: Cross-tabulation, density

CRITICAL RULES:
- groupby MUST be an array of strings
- metrics MUST be an array of objects
- Use actual column names from the schema
- message must be conversational and insightful
- Suggest 0-3 relevant charts per response`

const AIAssistant: React.FC<AIAssistantProps> = ({ open, onClose, datasetId, datasetName, columns, onSuccess }) => {
  const { darkMode } = useThemeStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm your data assistant. Ask me anything about your data${datasetName ? ` in "${datasetName}"` : ''} — I can answer questions, find insights, and suggest charts.`,
      type: 'text',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiMode, setAiMode] = useState<'puter' | 'api_key' | 'none'>('none')
  const [checkingConfig, setCheckingConfig] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => {
    if (open) { checkAiConfig() }
    scrollToBottom()
  }, [open])

  useEffect(() => { scrollToBottom() }, [messages])

  const checkAiConfig = async () => {
    setCheckingConfig(true)
    try {
      const resp = await api.get('/auth/config', { params: { key: ['ai_api_key'] } })
      if (resp.data.ai_api_key) { setAiMode('api_key') }
      else if (window.puter) { setAiMode('puter') }
      else { setAiMode('none') }
    } catch {
      if (window.puter) { setAiMode('puter') }
      else { setAiMode('none') }
    } finally { setCheckingConfig(false) }
  }

  const getSchemaContext = async () => {
    if (!datasetId) return ''
    try {
      const preview = await datasetService.preview(datasetId as any, 5)
      if (!preview || !preview.columns) return ''
      const cols = preview.columns.map((c: string) => c)
      const sample = preview.data || []
      return JSON.stringify({ table_name: datasetId, columns: cols, sample_rows: sample.slice(0, 3) }, null, 2)
    } catch {
      return JSON.stringify({ table_name: datasetId, columns: columns || [] })
    }
  }

  const handleSend = async () => {
    const q = input.trim()
    if (!q) return

    const userMessage: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: q }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const schemaText = await getSchemaContext()
      const conversationContext = messages
        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.type === 'text'))
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')

      let responseText = ''

      if (aiMode === 'api_key') {
        const response = await aiService.analyze({
          message: `${conversationContext}\n\nUser: ${q}\n\nDataset schema:\n${schemaText}\n\nAvailable columns: ${(columns || []).join(', ')}`,
          dataset_id: datasetId as any,
          columns: columns,
        })
        responseText = JSON.stringify(response)
      } else if (aiMode === 'puter' && window.puter) {
        const userPrompt = `Previous conversation:\n${conversationContext}\n\nUser question: ${q}\n\nDataset schema:\n${schemaText}\n\nAvailable columns: ${(columns || []).join(', ')}\n\nRespond with ONLY valid JSON.`

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
          } else { throw puterErr }
        }
      } else {
        setMessages(prev => [...prev, {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: 'Set up an AI API key in Settings → AI API, or Puter.js will load automatically in your browser.',
          type: 'text',
        }])
        setLoading(false)
        return
      }

      let parsed: any
      try { parsed = JSON.parse(responseText) }
      catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) { parsed = JSON.parse(jsonMatch[0]) }
        else { throw new Error('Could not parse AI response') }
      }

      const assistantMessage: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: parsed.message || "Here's what I found:",
        type: parsed.type || 'text',
        suggestions: parsed.suggestions || [],
      }
      setMessages(prev => [...prev, assistantMessage])

    } catch (error: any) {
      const errMsg = error?.message || 'Failed to get AI response'
      setMessages(prev => [...prev, {
        id: `e_${Date.now()}`,
        role: 'assistant',
        content: errMsg,
        type: 'error',
      }])
    } finally {
      setLoading(false)
    }
  }

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
      const result = suggestion.type === 'metric'
        ? await aiService.createMetric(suggestion.config)
        : await aiService.createChart(suggestion.config)

      setMessages(prev => {
        const updated = [...prev]
        const msg = { ...updated[msgIndex] }
        msg.createdItems = msg.createdItems?.map(item =>
          item.title === suggestion.title ? { ...item, status: 'success' as const, id: result?.id } : item
        )
        updated[msgIndex] = msg
        return updated
      })

      message.success(`"${suggestion.title}" created!`)
      onSuccess?.()
    } catch (error) {
      const err: any = error
      const errMsg = err?.response?.data?.error || err?.message || 'Failed'
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
        if (suggestion.type === 'metric') { await aiService.createMetric(suggestion.config) }
        else { await aiService.createChart(suggestion.config) }
        successCount++
      } catch (e) { console.error('Create failed:', e) }
    }

    setMessages(prev => {
      const updated = [...prev]
      const msg = { ...updated[msgIndex] }
      msg.createdItems = msg.createdItems?.map(item => ({ ...item, status: 'success' as const }))
      msg.content = `Created ${successCount} item${successCount !== 1 ? 's' : ''} successfully`
      updated[msgIndex] = msg
      return updated
    })
    message.success(`${successCount} created!`)
    onSuccess?.()
  }

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hi! I'm your data assistant. Ask me anything about your data${datasetName ? ` in "${datasetName}"` : ''}!`,
      type: 'text',
    }])
  }

  const suggestionQuestions = [
    'What insights can you find in this data?',
    'Show me the top values and trends',
    'Are there any outliers or anomalies?',
    'What are the key patterns in this dataset?',
    'Create a chart showing the main metrics',
  ]

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <span>AI Data Assistant</span>
          {aiMode === 'puter' && <Tag color="green" style={{ fontSize: 10 }}>Puter</Tag>}
          {aiMode === 'api_key' && <Tag color="blue" style={{ fontSize: 10 }}>API</Tag>}
        </Space>
      }
      placement="right"
      width={520}
      onClose={onClose}
      open={open}
      extra={<Button size="small" icon={<ClearOutlined />} onClick={clearChat} type="text" title="Clear chat" />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {checkingConfig && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Checking AI...</Text>
          </div>
        )}

        {aiMode === 'none' && !checkingConfig && (
          <Alert
            message="AI not configured"
            description="Go to Settings → AI API to set up your AI provider. Puter.js works automatically in your browser."
            type="warning"
            showIcon
            closable
            style={{ marginBottom: 8, fontSize: 12 }}
          />
        )}

        {/* Quick suggestion chips */}
        {messages.length <= 1 && (
          <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestionQuestions.map(s => (
              <Tag
                key={s}
                style={{ cursor: 'pointer', padding: '2px 8px', fontSize: 11 }}
                onClick={() => setInput(s)}
              >
                <BulbOutlined /> {s}
              </Tag>
            ))}
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          {messages.map((msg, index) => (
            <div key={msg.id} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 8,
                alignItems: 'flex-start',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <RobotOutlined style={{ color: '#fff', fontSize: 13 }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  borderRadius: 12,
                  padding: '10px 14px',
                  background: msg.role === 'user'
                    ? '#1890ff'
                    : darkMode ? '#2d2d2d' : '#f0f2f5',
                  color: msg.role === 'user' ? '#fff' : (darkMode ? '#e5e7eb' : '#374151'),
                  border: msg.role === 'assistant' && !darkMode ? '1px solid #e5e7eb' : 'none',
                }}>
                  {msg.type === 'error' ? (
                    <Text style={{ color: '#ff4d4f', fontSize: 13 }}>{msg.content}</Text>
                  ) : (
                    <Text style={{ color: msg.role === 'user' ? '#fff' : undefined, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </Text>
                  )}

                  {/* SQL block */}
                  {msg.sql && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 11, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#888' }}>
                        <CodeOutlined /> View SQL
                      </summary>
                      <pre style={{
                        background: '#1e1e1e', color: '#d4d4d4',
                        padding: 8, borderRadius: 6, marginTop: 6,
                        fontSize: 11, overflow: 'auto', maxHeight: 150,
                      }}>
                        {msg.sql}
                      </pre>
                    </details>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text strong style={{ fontSize: 11, color: msg.role === 'user' ? '#fff' : '#666' }}>
                          Suggested actions:
                        </Text>
                        <Button size="small" type={msg.role === 'user' ? 'primary' : 'default'}
                          onClick={() => handleApplyAll(msg.suggestions!, index)}
                          style={{ fontSize: 10, height: 22 }}>
                          Apply All
                        </Button>
                      </div>
                      {msg.suggestions.map((s, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 8px', marginBottom: 4,
                          background: msg.role === 'user' ? 'rgba(255,255,255,0.1)' : (darkMode ? '#3d3d3d' : '#fff'),
                          borderRadius: 6, border: '1px solid ' + (darkMode ? '#4b5563' : '#e5e7eb'),
                        }}>
                          <Space size={4}>
                            {s.type === 'metric' ? <CalculatorOutlined style={{ fontSize: 12 }} /> : <BarChartOutlined style={{ fontSize: 12 }} />}
                            <div>
                              <Text style={{ fontSize: 11, fontWeight: 500, color: msg.role === 'user' ? '#fff' : undefined }}>{s.title}</Text>
                              <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#888' }}>{s.description}</div>
                            </div>
                          </Space>
                          <Button size="small" type="primary" style={{ fontSize: 10, height: 22 }}
                            onClick={() => handleApplySuggestion(s, index)}>
                            Apply
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Created items status */}
                  {msg.createdItems && msg.createdItems.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {msg.createdItems.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {item.status === 'loading' && <LoadingOutlined style={{ fontSize: 11 }} />}
                          {item.status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} />}
                          {item.status === 'error' && <Tag color="red" style={{ fontSize: 9 }}>Failed</Tag>}
                          <Text style={{ fontSize: 11, color: msg.role === 'user' ? '#fff' : undefined }}>{item.title}</Text>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: '#667eea',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <UserOutlined style={{ color: '#fff', fontSize: 13 }} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 13 }} />
              </div>
              <div style={{
                padding: '8px 14px', borderRadius: 12,
                background: darkMode ? '#2d2d2d' : '#f0f2f5',
                border: darkMode ? 'none' : '1px solid #e5e7eb',
              }}>
                <Space>
                  <Spin size="small" />
                  <Text type="secondary" style={{ fontSize: 12 }}>Thinking...</Text>
                </Space>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid ' + (darkMode ? '#303030' : '#f0f0f0'), paddingTop: 12 }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={e => {
                if (!e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder="Ask about your data..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading || checkingConfig}
              style={{ resize: 'none', fontSize: 13 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim() || checkingConfig}
            />
          </Space.Compact>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <Text style={{ fontSize: 10, color: '#888' }}>
              <MessageOutlined /> Ask questions, get insights, create charts
            </Text>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

export default AIAssistant
