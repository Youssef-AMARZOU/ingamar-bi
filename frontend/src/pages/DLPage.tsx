import React, { useState, useEffect } from 'react'
import { Card, Select, Button, Space, message, Spin, Table, Tag, Typography, Row, Col, Divider, InputNumber, Radio, Tabs, Statistic, Alert, Tooltip, Input, Modal } from 'antd'
import {
  ExperimentOutlined, ArrowLeftOutlined, RocketOutlined, AimOutlined,
  HeatMapOutlined, BarChartOutlined, DeleteOutlined, NodeIndexOutlined,
  ThunderboltOutlined, EditOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import api from '../services/api'
import { useThemeStore } from '../store/theme'

const { Text, Title } = Typography

const DLPage: React.FC = () => {
  const navigate = useNavigate()
  const { darkMode } = useThemeStore()
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [datasetInfo, setDatasetInfo] = useState<any>(null)
  const [target, setTarget] = useState<string>('')
  const [features, setFeatures] = useState<string[]>([])
  const [hiddenLayers, setHiddenLayers] = useState('64,32')
  const [activation, setActivation] = useState('relu')
  const [epochs, setEpochs] = useState(50)
  const [batchSize, setBatchSize] = useState(32)
  const [learningRate, setLearningRate] = useState(0.001)
  const [testSize, setTestSize] = useState(0.2)
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('train')
  const [models, setModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [predictInput, setPredictInput] = useState<Record<string, string>>({})
  const [prediction, setPrediction] = useState<any>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameModelId, setRenameModelId] = useState('')
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => { fetchDatasets(); fetchModels() }, [])

  const fetchDatasets = async () => {
    try {
      const res = await api.get('/dl/datasets')
      setDatasets(res.data)
    } catch (e) { console.error(e) }
  }

  const fetchModels = async () => {
    try {
      const res = await api.get('/dl/models')
      setModels(res.data)
    } catch (e) { console.error(e) }
  }

  const handleDatasetChange = (val: string) => {
    setSelectedDataset(val)
    const ds = datasets.find(d => d.table_name === val)
    setDatasetInfo(ds)
    setTarget('')
    setFeatures([])
    setResult(null)
    setPrediction(null)
  }

  const handleTrain = async () => {
    if (!selectedDataset || !target) {
      message.error('Select dataset and target column')
      return
    }
    setTraining(true)
    setResult(null)
    try {
      const layers = hiddenLayers.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0)
      if (layers.length === 0) {
        message.error('Enter valid hidden layer sizes (e.g. 64,32)')
        setTraining(false)
        return
      }
      const res = await api.post('/dl/train', {
        dataset: selectedDataset,
        target,
        features,
        hidden_layers: layers,
        activation,
        epochs,
        batch_size: batchSize,
        learning_rate: learningRate,
        test_size: testSize,
      })
      setResult(res.data)
      message.success('Neural network trained successfully!')
      fetchModels()
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Training failed')
    } finally { setTraining(false) }
  }

  const handlePredict = async () => {
    if (!selectedModel) {
      message.error('Select a trained model')
      return
    }
    setTraining(true)
    try {
      const res = await api.post('/dl/predict', {
        model_id: selectedModel,
        input_data: predictInput,
      })
      setPrediction(res.data)
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Prediction failed')
    } finally { setTraining(false) }
  }

  const handleDeleteModel = async (modelId: string) => {
    try {
      await api.delete(`/dl/models/${modelId}`)
      message.success('Model deleted')
      fetchModels()
      if (selectedModel === modelId) setSelectedModel('')
    } catch (e: any) {
      message.error('Failed to delete model')
    }
  }

  const handleSelectModel = (model: any) => {
    setSelectedModel(model.model_id)
    setActiveTab('predict')
    setPredictInput({})
    setPrediction(null)
    const ds = datasets.find(d => d.table_name === model.table_name)
    if (ds) {
      setSelectedDataset(model.table_name)
      setDatasetInfo(ds)
      setTarget(model.target)
      setFeatures(model.features)
    }
  }

  const handleRename = async () => {
    if (!renameValue.trim()) { message.error('Enter a name'); return }
    try {
      await api.put(`/dl/models/${renameModelId}/name`, { name: renameValue.trim() })
      message.success('Model renamed')
      setRenameModalOpen(false)
      fetchModels()
    } catch (e: any) {
      message.error('Failed to rename')
    }
  }

  const getMetricColor = (key: string, val: number) => {
    if (key === 'r2_score' || key === 'accuracy' || key === 'f1_score') {
      if (val >= 0.8) return '#52c41a'
      if (val >= 0.6) return '#faad14'
      return '#ff4d4f'
    }
    return '#1890ff'
  }

  const numericColumns = datasetInfo?.numeric_columns || []
  const allColumns = datasetInfo?.columns || []

  const renderLossCurve = () => {
    if (!result?.loss_curve || result.loss_curve.length === 0) return null
    return (
      <Card size="small" title="Training Loss Curve" style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', name: 'Epoch', axisLabel: { color: darkMode ? '#e5e7eb' : '#374151' } },
            yAxis: { type: 'value', name: 'Loss', axisLabel: { color: darkMode ? '#e5e7eb' : '#374151' } },
            series: [{
              type: 'line', data: result.loss_curve, smooth: true,
              areaStyle: { opacity: 0.15 }, lineStyle: { width: 2 },
              itemStyle: { color: '#1890ff' },
            }],
            grid: { left: 60, right: 20, top: 10, bottom: 30 },
          }}
          style={{ height: 250 }}
        />
      </Card>
    )
  }

  const renderMetrics = () => {
    if (!result?.metrics) return null
    return (
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {Object.entries(result.metrics).filter(([k]) => !['confusion_matrix'].includes(k)).map(([key, val]) => (
          <Col span={6} key={key}>
            <Card size="small" bodyStyle={{ padding: 12 }}>
              <Statistic
                title={<Text style={{ fontSize: 11, textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}</Text>}
                value={typeof val === 'number' ? val : String(val)}
                valueStyle={{ color: getMetricColor(key, Number(val)), fontSize: 20, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>
    )
  }

  const renderConfusionMatrix = () => {
    if (!result?.metrics?.confusion_matrix) return null
    const cm = result.metrics.confusion_matrix
    const data: number[][] = []
    cm.forEach((row: number[], i: number) => {
      row.forEach((val: number, j: number) => {
        data.push([j, i, val])
      })
    })
    const maxVal = Math.max(...data.map(d => d[2]), 1)
    return (
      <Card size="small" title="Confusion Matrix" style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'item' },
            xAxis: { type: 'category', data: cm.map((_: any, i: number) => `Pred ${i}`) },
            yAxis: { type: 'category', data: cm.map((_: any, i: number) => `Actual ${i}`) },
            visualMap: { min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
            series: [{ type: 'heatmap', data, label: { show: true }, emphasis: { itemStyle: { shadowBlur: 6 } } }],
            grid: { left: 80, right: 20, top: 10, bottom: 60 },
          }}
          style={{ height: 300 }}
        />
      </Card>
    )
  }

  const renderSamplePredictions = () => {
    if (!result?.sample_predictions || result.sample_predictions.length === 0) return null
    const hasLabels = result.sample_predictions.some((p: any) => p.actual_label && p.actual_label !== String(p.actual))
    return (
      <Card size="small" title="Sample Predictions (Actual vs Predicted)" style={{ marginBottom: 16 }}>
        {hasLabels && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Labels shown below the numeric values. Hover for details.
            </Text>
          </div>
        )}
        <ReactECharts
          option={{
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const idx = params[0]?.dataIndex
                const p = result.sample_predictions[idx]
                if (!p) return ''
                let s = `<b>Sample ${idx + 1}</b><br/>`
                s += `Actual: ${p.actual_label || p.actual}<br/>`
                s += `Predicted: ${p.predicted_label || p.predicted}`
                return s
              }
            },
            legend: { data: ['Actual', 'Predicted'], bottom: 0 },
            xAxis: {
              type: 'category',
              data: hasLabels
                ? result.sample_predictions.map((p: any) => p.actual_label || String(p.actual))
                : result.sample_predictions.map((_: any, i: number) => i + 1),
              axisLabel: { rotate: 45, fontSize: 9 }
            },
            yAxis: { type: 'value' },
            series: [
              { name: 'Actual', type: 'scatter', data: result.sample_predictions.map((p: any) => p.actual), itemStyle: { color: '#1890ff' } },
              { name: 'Predicted', type: 'scatter', data: result.sample_predictions.map((p: any) => p.predicted), itemStyle: { color: '#ff4d4f' } },
            ],
            grid: { left: 60, right: 20, top: 10, bottom: hasLabels ? 80 : 50 },
          }}
          style={{ height: 300 }}
        />
      </Card>
    )
  }

  const currentModelFeatures = selectedModel
    ? models.find(m => m.model_id === selectedModel)?.features || []
    : (features.length > 0 ? features : allColumns.filter((c: any) => c.name !== target).map((c: any) => c.name))

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingTop: 8 }}>
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Back</Button>
        <NodeIndexOutlined style={{ fontSize: 20, color: '#722ed1' }} />
        <Title level={4} style={{ margin: 0 }}>Deep Learning Studio</Title>
      </div>

      <Row gutter={16}>
        <Col span={7}>
          <Card size="small" title="Neural Network Configuration" bodyStyle={{ padding: 12 }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12 }}>Dataset</Text>
              <Select
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Select dataset"
                value={selectedDataset || undefined}
                onChange={handleDatasetChange}
                showSearch
              >
                {datasets.map(d => (
                  <Select.Option key={d.table_name} value={d.table_name}>
                    {d.table_name} ({d.row_count} rows, {d.column_count} cols)
                  </Select.Option>
                ))}
              </Select>
            </div>

            {datasetInfo && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Target Column</Text>
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Select target"
                    value={target || undefined}
                    onChange={setTarget}
                    showSearch
                  >
                    {allColumns.map((c: any) => (
                      <Select.Option key={c.name} value={c.name}>
                        <Tag color={numericColumns.includes(c.name) ? 'blue' : 'orange'} style={{ fontSize: 10 }}>{numericColumns.includes(c.name) ? 'num' : 'cat'}</Tag>
                        {c.name}
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Features</Text>
                  <Select
                    mode="multiple"
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="All columns (default)"
                    value={features}
                    onChange={setFeatures}
                    allowClear
                    showSearch
                  >
                    {allColumns.filter((c: any) => c.name !== target).map((c: any) => (
                      <Select.Option key={c.name} value={c.name}>{c.name}</Select.Option>
                    ))}
                  </Select>
                </div>

                <Divider style={{ margin: '8px 0' }} />
                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Hidden Layers</Text>
                  <Input
                    size="small"
                    value={hiddenLayers}
                    onChange={e => setHiddenLayers(e.target.value)}
                    placeholder="e.g. 64,32,16"
                    style={{ marginTop: 4 }}
                  />
                  <Text style={{ fontSize: 10, color: '#888' }}>Comma-separated neurons per layer</Text>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Activation</Text>
                  <Select value={activation} onChange={setActivation} style={{ width: '100%', marginTop: 4 }} size="small">
                    <Select.Option value="relu">ReLU</Select.Option>
                    <Select.Option value="tanh">Tanh</Select.Option>
                    <Select.Option value="logistic">Logistic (Sigmoid)</Select.Option>
                    <Select.Option value="identity">Identity</Select.Option>
                  </Select>
                </div>

                <Row gutter={8}>
                  <Col span={12}>
                    <div style={{ marginBottom: 10 }}>
                      <Text strong style={{ fontSize: 12 }}>Epochs</Text>
                      <InputNumber min={10} max={1000} step={10} value={epochs} onChange={v => setEpochs(v || 50)} style={{ width: '100%', marginTop: 4 }} size="small" />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 10 }}>
                      <Text strong style={{ fontSize: 12 }}>Batch Size</Text>
                      <InputNumber min={8} max={512} step={8} value={batchSize} onChange={v => setBatchSize(v || 32)} style={{ width: '100%', marginTop: 4 }} size="small" />
                    </div>
                  </Col>
                </Row>

                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Learning Rate</Text>
                  <InputNumber min={0.0001} max={0.1} step={0.0001} value={learningRate} onChange={v => setLearningRate(v || 0.001)} style={{ width: '100%', marginTop: 4 }} size="small" stringMode={false} />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12 }}>Test Size: {Math.round(testSize * 100)}%</Text>
                  <input type="range" min={0.1} max={0.5} step={0.05} value={testSize} onChange={e => setTestSize(Number(e.target.value))} style={{ width: '100%', marginTop: 4 }} />
                </div>

                <Divider style={{ margin: '8px 0' }} />
                <Button type="primary" icon={<RocketOutlined />} block onClick={handleTrain} loading={training}>
                  Train Neural Network
                </Button>
              </>
            )}
          </Card>

          {models.length > 0 && (
            <Card size="small" title="Saved Models" bodyStyle={{ padding: 8 }} style={{ marginTop: 12 }}>
              {models.map(m => (
                <div
                  key={m.model_id}
                  onClick={() => handleSelectModel(m)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderBottom: '1px solid ' + (darkMode ? '#303030' : '#f0f0f0'),
                    cursor: 'pointer', borderRadius: 4,
                    background: selectedModel === m.model_id ? (darkMode ? '#177ddc22' : '#e6f7ff') : 'transparent',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => { if (selectedModel !== m.model_id) e.currentTarget.style.background = darkMode ? '#ffffff08' : '#fafafa' }}
                  onMouseLeave={e => { if (selectedModel !== m.model_id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, display: 'block' }} ellipsis>{m.name || `${m.table_name} → ${m.target}`}</Text>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      <Tag style={{ fontSize: 9 }} color={m.is_classification ? 'blue' : 'green'}>{m.is_classification ? 'clf' : 'reg'}</Tag>
                      <Tag style={{ fontSize: 9 }}>{m.model_id}</Tag>
                    </div>
                  </div>
                  <Space size={0}>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); setRenameModelId(m.model_id); setRenameValue(m.name || ''); setRenameModalOpen(true) }} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => { e.stopPropagation(); handleDeleteModel(m.model_id) }} />
                  </Space>
                </div>
              ))}
            </Card>
          )}
        </Col>

        <Col span={17}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: 'train',
              label: <span><ExperimentOutlined /> Training Results</span>,
              children: (
                <div style={{ maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
                  {training && <Spin tip="Training neural network..." style={{ width: '100%', padding: 40 }} />}
                  {!training && !result && (
                    <Card style={{ textAlign: 'center', padding: 60 }}>
                      <NodeIndexOutlined style={{ fontSize: 64, color: '#d1d5db', marginBottom: 16 }} />
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Deep Learning Studio Ready</div>
                      <div style={{ color: '#9ca3af' }}>
                        Configure and train neural networks for regression or classification.<br />
                        Supports configurable architectures, activation functions, and hyperparameters.
                      </div>
                    </Card>
                  )}
                  {!training && result && (
                    <>
                      <Alert
                        message={`${result.task.toUpperCase()} — ${result.architecture.hidden_layers.join('-')} NN — ${result.n_features} features — ${result.architecture.epochs_trained} epochs`}
                        type="info" showIcon style={{ marginBottom: 16 }}
                      />
                      {renderLossCurve()}
                      {renderMetrics()}
                      {renderConfusionMatrix()}
                      {renderSamplePredictions()}
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'predict',
              label: <span><AimOutlined /> Predict</span>,
              children: (
                <div style={{ maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
                  {models.length === 0 ? (
                    <Card style={{ textAlign: 'center', padding: 60 }}>
                      <AimOutlined style={{ fontSize: 64, color: '#d1d5db', marginBottom: 16 }} />
                      <div style={{ fontSize: 18, fontWeight: 600 }}>No trained models</div>
                      <div style={{ color: '#9ca3af' }}>Train a neural network first, then make predictions.</div>
                    </Card>
                  ) : (
                    <Card size="small" title="Make Predictions">
                      <div style={{ marginBottom: 12 }}>
                        <Text strong>Model: </Text>
                        <Select value={selectedModel || undefined} onChange={setSelectedModel} style={{ width: 300 }} placeholder="Select a trained model">
                          {models.map(m => (
                            <Select.Option key={m.model_id} value={m.model_id}>
                              {m.table_name} → {m.target}
                            </Select.Option>
                          ))}
                        </Select>
                      </div>
                      <Divider style={{ margin: '8px 0' }} />
                      {selectedModel && (
                        <>
                          <Row gutter={[8, 8]}>
                            {currentModelFeatures.map((col: string) => (
                              <Col span={8} key={col}>
                                <div style={{ marginBottom: 4 }}>
                                  <Text style={{ fontSize: 11 }}>{col}</Text>
                                </div>
                                <Input
                                  size="small"
                                  placeholder={`Enter ${col} value`}
                                  value={predictInput[col] || ''}
                                  onChange={e => setPredictInput({ ...predictInput, [col]: e.target.value })}
                                />
                              </Col>
                            ))}
                          </Row>
                          <Button type="primary" icon={<ThunderboltOutlined />} style={{ marginTop: 12 }} onClick={handlePredict} loading={training}>
                            Predict
                          </Button>
                          {prediction && (
                            <Alert
                              style={{ marginTop: 12 }}
                              type="success" showIcon
                              message={prediction.prediction_label
                                ? `Prediction: ${prediction.prediction_label}`
                                : `Prediction: ${prediction.prediction}`}
                              description={
                                <>
                                  {prediction.is_classification && prediction.prediction_label && (
                                    <div style={{ marginBottom: 4 }}>
                                      <Text type="secondary">Raw value: {prediction.prediction}</Text>
                                    </div>
                                  )}
                                  {prediction.probabilities && (
                                    <div>
                                      <Text strong style={{ fontSize: 11 }}>Probabilities: </Text>
                                      {prediction.probabilities.map((p: any, i: number) => (
                                        <Tag key={i} style={{ fontSize: 10, margin: '2px' }}>
                                          {p.class || `Class ${i}`}: {(p.probability * 100).toFixed(1)}%
                                        </Tag>
                                      ))}
                                    </div>
                                  )}
                                </>
                              }
                            />
                          )}
                        </>
                      )}
                    </Card>
                  )}
                </div>
              ),
            },
            {
              key: 'models',
              label: <span><BarChartOutlined /> Saved Models</span>,
              children: (
                <div style={{ maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
                  <Card size="small" title={`Trained Models (${models.length})`}>
                    {models.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                        <NodeIndexOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 12 }} />
                        <div>No trained models yet. Train a neural network first.</div>
                      </div>
                    ) : (
                      <Table
                        size="small"
                        dataSource={models}
                        rowKey="model_id"
                        pagination={false}
                        onRow={(record) => ({ onClick: () => handleSelectModel(record), style: { cursor: 'pointer' } })}
                        columns={[
                          { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string, r: any) => <Text strong>{v || `${r.table_name} → ${r.target}`}</Text> },
                          { title: 'Dataset', dataIndex: 'table_name', key: 'table_name' },
                          { title: 'Target', dataIndex: 'target', key: 'target', render: (v: string) => <Tag color="blue">{v}</Tag> },
                          { title: 'Features', dataIndex: 'features', key: 'features', render: (f: string[]) => <Tag>{f.length} cols</Tag> },
                          { title: 'Type', dataIndex: 'is_classification', key: 'type', render: (v: boolean) => <Tag color={v ? 'blue' : 'green'}>{v ? 'Classification' : 'Regression'}</Tag> },
                          {
                            title: 'Actions', key: 'actions',
                            render: (_: any, record: any) => (
                              <Space size={0}>
                                <Button size="small" type="text" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); setRenameModelId(record.model_id); setRenameValue(record.name || ''); setRenameModalOpen(true) }} />
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => { e.stopPropagation(); handleDeleteModel(record.model_id) }} />
                              </Space>
                            ),
                          },
                        ]}
                      />
                    )}
                  </Card>
                </div>
              ),
            },
          ]} />
        </Col>
      </Row>

      <Modal
        title="Rename Model"
        open={renameModalOpen}
        onOk={handleRename}
        onCancel={() => setRenameModalOpen(false)}
        okText="Rename"
      >
        <Input
          placeholder="Model name"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onPressEnter={handleRename}
        />
      </Modal>
    </div>
  )
}

export default DLPage
