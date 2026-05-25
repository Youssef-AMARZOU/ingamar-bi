import React, { useState, useEffect } from 'react'
import { Card, Select, Button, Space, message, Spin, Table, Tag, Typography, Row, Col, Divider, InputNumber, Radio, Tabs, Statistic, Progress, Alert, Tooltip, Input } from 'antd'
import {
  ExperimentOutlined, BarChartOutlined, LineChartOutlined, DotChartOutlined,
  ThunderboltOutlined, ArrowLeftOutlined, RocketOutlined, CheckCircleOutlined,
  WarningOutlined, InfoCircleOutlined, AimOutlined, NodeIndexOutlined,
  BranchesOutlined, HeatMapOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import api from '../services/api'
import { useThemeStore } from '../store/theme'

const { Text, Title } = Typography
const { Option } = Select

const ML_MODELS = {
  regression: [
    { value: 'linear_regression', label: 'Linear Regression', icon: '📈' },
    { value: 'lasso', label: 'Lasso (L1)', icon: '🔒' },
    { value: 'ridge', label: 'Ridge (L2)', icon: '🏔️' },
    { value: 'elasticnet', label: 'ElasticNet', icon: '🔗' },
    { value: 'random_forest_regressor', label: 'Random Forest', icon: '🌲' },
    { value: 'gradient_boosting_regressor', label: 'Gradient Boosting', icon: '🚀' },
    { value: 'svr', label: 'SVR', icon: '🎯' },
    { value: 'knn_regressor', label: 'KNN', icon: '👥' },
    { value: 'decision_tree_regressor', label: 'Decision Tree', icon: '🌳' },
  ],
  classification: [
    { value: 'logistic_regression', label: 'Logistic Regression', icon: '📊' },
    { value: 'random_forest_classifier', label: 'Random Forest', icon: '🌲' },
    { value: 'gradient_boosting_classifier', label: 'Gradient Boosting', icon: '🚀' },
    { value: 'svc', label: 'SVM', icon: '🎯' },
    { value: 'knn_classifier', label: 'KNN', icon: '👥' },
    { value: 'decision_tree_classifier', label: 'Decision Tree', icon: '🌳' },
  ],
  clustering: [
    { value: 'kmeans', label: 'K-Means', icon: '🔵' },
    { value: 'dbscan', label: 'DBSCAN', icon: '🔍' },
    { value: 'agglomerative', label: 'Agglomerative', icon: '🌿' },
  ],
}

const MLPage: React.FC = () => {
  const navigate = useNavigate()
  const { darkMode } = useThemeStore()
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [datasetInfo, setDatasetInfo] = useState<any>(null)
  const [target, setTarget] = useState<string>('')
  const [features, setFeatures] = useState<string[]>([])
  const [modelType, setModelType] = useState<string>('auto')
  const [task, setTask] = useState<string>('auto')
  const [testSize, setTestSize] = useState<number>(0.2)
  const [nClusters, setNClusters] = useState<number>(3)
  const [alpha, setAlpha] = useState<number>(1.0)
  const [training, setTraining] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('train')
  const [compareResults, setCompareResults] = useState<any>(null)
  const [correlationData, setCorrelationData] = useState<any>(null)
  const [featureImpData, setFeatureImpData] = useState<any>(null)
  const [predictInput, setPredictInput] = useState<Record<string, string>>({})
  const [prediction, setPrediction] = useState<any>(null)

  useEffect(() => { fetchDatasets() }, [])

  const fetchDatasets = async () => {
    try {
      const res = await api.get('/ml/datasets')
      setDatasets(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDatasetChange = (val: string) => {
    setSelectedDataset(val)
    const ds = datasets.find(d => d.table_name === val)
    setDatasetInfo(ds)
    setTarget('')
    setFeatures([])
    setResult(null)
    setCompareResults(null)
    setCorrelationData(null)
    setFeatureImpData(null)
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
      const res = await api.post('/ml/train', {
        dataset: selectedDataset,
        target,
        features,
        model_type: modelType,
        test_size: testSize,
        n_clusters: nClusters,
        alpha,
        task: task === 'auto' ? undefined : task,
      })
      setResult(res.data)
      message.success('Model trained successfully!')
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Training failed')
    } finally {
      setTraining(false)
    }
  }

  const handleCompare = async () => {
    if (!selectedDataset || !target) {
      message.error('Select dataset and target column')
      return
    }
    setTraining(true)
    setCompareResults(null)
    try {
      const res = await api.post('/ml/evaluate', {
        dataset: selectedDataset,
        target,
        features,
        model_types: ['linear', 'random_forest', 'gradient_boosting', 'knn'],
      })
      setCompareResults(res.data)
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Comparison failed')
    } finally {
      setTraining(false)
    }
  }

  const handleCorrelation = async () => {
    if (!selectedDataset) {
      message.error('Select a dataset')
      return
    }
    setTraining(true)
    try {
      const res = await api.post('/ml/correlation', {
        dataset: selectedDataset,
        columns: features.length > 0 ? features : undefined,
      })
      setCorrelationData(res.data)
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Correlation analysis failed')
    } finally {
      setTraining(false)
    }
  }

  const handleFeatureImportance = async () => {
    if (!selectedDataset || !target) {
      message.error('Select dataset and target')
      return
    }
    setTraining(true)
    try {
      const res = await api.post('/ml/feature-importance', {
        dataset: selectedDataset,
        target,
        features,
      })
      setFeatureImpData(res.data)
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Feature importance failed')
    } finally {
      setTraining(false)
    }
  }

  const handlePredict = async () => {
    if (!selectedDataset || !target || !modelType) {
      message.error('Select dataset, target, and model')
      return
    }
    setTraining(true)
    try {
      const res = await api.post('/ml/predict', {
        dataset: selectedDataset,
        target,
        features,
        model_type: modelType,
        input_data: predictInput,
      })
      setPrediction(res.data)
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Prediction failed')
    } finally {
      setTraining(false)
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

  const renderFeatureImportanceChart = () => {
    if (!result?.feature_importance || Object.keys(result.feature_importance).length === 0) return null
    const entries = Object.entries(result.feature_importance).slice(0, 15)
    return (
      <Card size="small" title="Feature Importance" style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'value', axisLabel: { color: darkMode ? '#e5e7eb' : '#374151' } },
            yAxis: {
              type: 'category',
              data: entries.map(([k]) => k).reverse(),
              axisLabel: { color: darkMode ? '#e5e7eb' : '#374151', fontSize: 11 },
            },
            series: [{
              type: 'bar',
              data: entries.map(([, v]) => Math.abs(Number(v))).reverse(),
              itemStyle: { color: '#1890ff', borderRadius: [0, 4, 4, 0] },
            }],
            grid: { left: '30%', right: '5%', top: 5, bottom: 5 },
          }}
          style={{ height: Math.max(200, entries.length * 30) }}
        />
      </Card>
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
            series: [{
              type: 'heatmap',
              data,
              label: { show: true },
              emphasis: { itemStyle: { shadowBlur: 6 } },
            }],
            grid: { left: 80, right: 20, top: 10, bottom: 60 },
          }}
          style={{ height: 300 }}
        />
      </Card>
    )
  }

  const renderSamplePredictions = () => {
    if (!result?.sample_predictions || result.sample_predictions.length === 0) return null
    return (
      <Card size="small" title="Sample Predictions (Actual vs Predicted)" style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['Actual', 'Predicted'], bottom: 0 },
            xAxis: { type: 'category', data: result.sample_predictions.map((_: any, i: number) => i + 1) },
            yAxis: { type: 'value' },
            series: [
              { name: 'Actual', type: 'scatter', data: result.sample_predictions.map((p: any) => p.actual), itemStyle: { color: '#1890ff' } },
              { name: 'Predicted', type: 'scatter', data: result.sample_predictions.map((p: any) => p.predicted), itemStyle: { color: '#ff4d4f' } },
            ],
            grid: { left: 60, right: 20, top: 10, bottom: 50 },
          }}
          style={{ height: 300 }}
        />
      </Card>
    )
  }

  const renderCompareChart = () => {
    if (!compareResults?.results) return null
    const models = compareResults.results.filter((r: any) => !r.error)
    return (
      <Card size="small" title={`Model Comparison (${compareResults.scoring_metric})`} style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: models.map((m: any) => m.model), axisLabel: { rotate: 30 } },
            yAxis: { type: 'value', name: compareResults.scoring_metric },
            series: [{
              type: 'bar',
              data: models.map((m: any) => m.mean_score),
              itemStyle: { color: '#1890ff', borderRadius: [4, 4, 0, 0] },
              label: { show: true, position: 'top', formatter: '{c}', fontSize: 11 },
            }],
            grid: { left: 60, right: 20, top: 30, bottom: 60 },
          }}
          style={{ height: 300 }}
        />
        {compareResults.best_model && (
          <Alert
            message={`Best model: ${compareResults.best_model}`}
            type="success"
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </Card>
    )
  }

  const renderCorrelationHeatmap = () => {
    if (!correlationData?.correlation_matrix) return null
    const cols = correlationData.columns
    const data = correlationData.correlation_matrix.map((d: any) => [
      cols.indexOf(d.x),
      cols.indexOf(d.y),
      d.value,
    ])
    return (
      <Card size="small" title="Correlation Matrix" style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'item' },
            xAxis: { type: 'category', data: cols, axisLabel: { rotate: 45, fontSize: 10 } },
            yAxis: { type: 'category', data: cols, axisLabel: { fontSize: 10 } },
            visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027'] } },
            series: [{
              type: 'heatmap',
              data,
              label: { show: cols.length <= 10, fontSize: 9, formatter: (p: any) => p.value[2]?.toFixed(2) },
              emphasis: { itemStyle: { shadowBlur: 6 } },
            }],
            grid: { left: 100, right: 20, top: 10, bottom: 80 },
          }}
          style={{ height: 400 }}
        />
      </Card>
    )
  }

  const renderCorrelationStats = () => {
    if (!correlationData?.statistics) return null
    const stats = correlationData.statistics
    const cols = Object.keys(stats)
    return (
      <Card size="small" title="Descriptive Statistics" style={{ marginBottom: 16 }}>
        <Table
          size="small"
          pagination={false}
          scroll={{ x: true }}
          dataSource={cols.map(c => ({ key: c, column: c, ...stats[c] }))}
          columns={[
            { title: 'Column', dataIndex: 'column', fixed: 'left', width: 120 },
            { title: 'Mean', dataIndex: 'mean', render: (v: number) => v?.toFixed(4) },
            { title: 'Std', dataIndex: 'std', render: (v: number) => v?.toFixed(4) },
            { title: 'Min', dataIndex: 'min', render: (v: number) => v?.toFixed(4) },
            { title: 'Max', dataIndex: 'max', render: (v: number) => v?.toFixed(4) },
            { title: 'Median', dataIndex: 'median', render: (v: number) => v?.toFixed(4) },
            { title: 'Skew', dataIndex: 'skew', render: (v: number) => v?.toFixed(4) },
            { title: 'Kurtosis', dataIndex: 'kurtosis', render: (v: number) => v?.toFixed(4) },
          ]}
        />
      </Card>
    )
  }

  const renderFeatureImpChart = () => {
    if (!featureImpData?.feature_importance) return null
    const entries = featureImpData.feature_importance.slice(0, 15)
    return (
      <Card size="small" title="Feature Importance Analysis" style={{ marginBottom: 16 }}>
        <ReactECharts
          option={{
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'value' },
            yAxis: { type: 'category', data: entries.map((e: any) => e.feature).reverse(), axisLabel: { fontSize: 11 } },
            series: [{
              type: 'bar',
              data: entries.map((e: any) => e.importance).reverse(),
              itemStyle: { color: '#52c41a', borderRadius: [0, 4, 4, 0] },
            }],
            grid: { left: '30%', right: '5%', top: 5, bottom: 5 },
          }}
          style={{ height: Math.max(200, entries.length * 30) }}
        />
      </Card>
    )
  }

  const numericColumns = datasetInfo?.numeric_columns || []
  const allColumns = datasetInfo?.columns || []

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingTop: 8 }}>
        <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>Back</Button>
        <ExperimentOutlined style={{ fontSize: 20, color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0 }}>Machine Learning Studio</Title>
      </div>

      <Row gutter={16}>
        <Col span={7}>
          <Card size="small" title="Configuration" bodyStyle={{ padding: 12 }}>
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
                  <Option key={d.table_name} value={d.table_name}>
                    {d.table_name} ({d.row_count} rows, {d.column_count} cols)
                  </Option>
                ))}
              </Select>
            </div>

            {datasetInfo && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Target Column</Text>
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Select target"
                    value={target || undefined}
                    onChange={setTarget}
                    showSearch
                  >
                    {allColumns.map((c: any) => (
                      <Option key={c.name} value={c.name}>
                        <Tag color={numericColumns.includes(c.name) ? 'blue' : 'orange'} style={{ fontSize: 10 }}>{numericColumns.includes(c.name) ? 'num' : 'cat'}</Tag>
                        {c.name}
                      </Option>
                    ))}
                  </Select>
                </div>

                <div style={{ marginBottom: 12 }}>
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
                      <Option key={c.name} value={c.name}>{c.name}</Option>
                    ))}
                  </Select>
                </div>

                <Divider style={{ margin: '8px 0' }} />
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Task</Text>
                  <Radio.Group value={task} onChange={e => { setTask(e.target.value); setModelType('auto') }} style={{ width: '100%', marginTop: 4 }}>
                    <Radio.Button value="auto" style={{ width: '33%', textAlign: 'center' }}>Auto</Radio.Button>
                    <Radio.Button value="regression" style={{ width: '33%', textAlign: 'center' }}>Regression</Radio.Button>
                    <Radio.Button value="classification" style={{ width: '34%', textAlign: 'center' }}>Classification</Radio.Button>
                  </Radio.Group>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Model</Text>
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    value={modelType}
                    onChange={setModelType}
                  >
                    <Option value="auto">Auto Select</Option>
                    {(task === 'regression' ? ML_MODELS.regression :
                      task === 'classification' ? ML_MODELS.classification :
                      task === 'clustering' ? ML_MODELS.clustering :
                      [...ML_MODELS.regression, ...ML_MODELS.classification]
                    ).map(m => (
                      <Option key={m.value} value={m.value}>{m.icon} {m.label}</Option>
                    ))}
                    {task !== 'regression' && task !== 'classification' && (
                      <>
                        <Option value="kmeans">🔵 K-Means</Option>
                        <Option value="dbscan">🔍 DBSCAN</Option>
                        <Option value="agglomerative">🌿 Agglomerative</Option>
                      </>
                    )}
                  </Select>
                </div>

                {modelType === 'lasso' || modelType === 'ridge' || modelType === 'elasticnet' ? (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 12 }}>Alpha (Regularization)</Text>
                    <InputNumber min={0.01} max={100} step={0.1} value={alpha} onChange={v => setAlpha(v || 1)} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                ) : null}

                {modelType === 'kmeans' || modelType === 'agglomerative' ? (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 12 }}>Number of Clusters</Text>
                    <InputNumber min={2} max={20} value={nClusters} onChange={v => setNClusters(v || 3)} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                ) : null}

                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 12 }}>Test Size: {Math.round(testSize * 100)}%</Text>
                  <input
                    type="range"
                    min={0.1}
                    max={0.5}
                    step={0.05}
                    value={testSize}
                    onChange={e => setTestSize(Number(e.target.value))}
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>

                <Divider style={{ margin: '8px 0' }} />
                <Button type="primary" icon={<RocketOutlined />} block onClick={handleTrain} loading={training}>
                  Train Model
                </Button>
                <Button icon={<BarChartOutlined />} block style={{ marginTop: 8 }} onClick={handleCompare} loading={training}>
                  Compare Models
                </Button>
                <Button icon={<HeatMapOutlined />} block style={{ marginTop: 8 }} onClick={handleCorrelation} loading={training}>
                  Correlation Analysis
                </Button>
                <Button icon={<AimOutlined />} block style={{ marginTop: 8 }} onClick={handleFeatureImportance} loading={training}>
                  Feature Importance
                </Button>
              </>
            )}
          </Card>
        </Col>

        <Col span={17}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            {
              key: 'train',
              label: <span><RocketOutlined /> Training Results</span>,
              children: (
                <div style={{ maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
                  {training && <Spin tip="Processing..." style={{ width: '100%', padding: 40 }} />}
                  {!training && !result && !compareResults && (
                    <Card style={{ textAlign: 'center', padding: 60 }}>
                      <ExperimentOutlined style={{ fontSize: 64, color: '#d1d5db', marginBottom: 16 }} />
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>ML Studio Ready</div>
                      <div style={{ color: '#9ca3af' }}>
                        Select a dataset, choose a target column, and train your model.<br />
                        Supports regression, classification, clustering, and model comparison.
                      </div>
                    </Card>
                  )}
                  {!training && result && (
                    <>
                      <Alert
                        message={`${result.task.toUpperCase()} — ${result.model_type.replace(/_/g, ' ')} — ${result.n_features} features — Train: ${result.train_size} / Test: ${result.test_size}`}
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                      {renderMetrics()}
                      {renderFeatureImportanceChart()}
                      {renderConfusionMatrix()}
                      {renderSamplePredictions()}
                    </>
                  )}
                  {!training && compareResults && renderCompareChart()}
                </div>
              ),
            },
            {
              key: 'correlation',
              label: <span><HeatMapOutlined /> Correlation</span>,
              children: (
                <div style={{ maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
                  {training && <Spin tip="Analyzing..." style={{ width: '100%', padding: 40 }} />}
                  {!training && !correlationData && !featureImpData && (
                    <Card style={{ textAlign: 'center', padding: 60 }}>
                      <HeatMapOutlined style={{ fontSize: 64, color: '#d1d5db', marginBottom: 16 }} />
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Correlation & Statistics</div>
                      <div style={{ color: '#9ca3af' }}>Click "Correlation Analysis" or "Feature Importance" in the sidebar.</div>
                    </Card>
                  )}
                  {!training && correlationData && (
                    <>
                      {renderCorrelationHeatmap()}
                      {renderCorrelationStats()}
                    </>
                  )}
                  {!training && featureImpData && renderFeatureImpChart()}
                </div>
              ),
            },
            {
              key: 'predict',
              label: <span><AimOutlined /> Predict</span>,
              children: (
                <div style={{ maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
                  {!datasetInfo ? (
                    <Card style={{ textAlign: 'center', padding: 60 }}>
                      <AimOutlined style={{ fontSize: 64, color: '#d1d5db', marginBottom: 16 }} />
                      <div style={{ fontSize: 18, fontWeight: 600 }}>Predict</div>
                      <div style={{ color: '#9ca3af' }}>Select a dataset first.</div>
                    </Card>
                  ) : (
                    <Card size="small" title="Make Predictions">
                      <div style={{ marginBottom: 12 }}>
                        <Text strong>Model: </Text>
                        <Select value={modelType} onChange={setModelType} style={{ width: 200 }}>
                          {ML_MODELS.regression.concat(ML_MODELS.classification).map(m => (
                            <Option key={m.value} value={m.value}>{m.icon} {m.label}</Option>
                          ))}
                        </Select>
                      </div>
                      <Divider style={{ margin: '8px 0' }} />
                      <Row gutter={[8, 8]}>
                        {(features.length > 0 ? features : allColumns.filter((c: any) => c.name !== target).map((c: any) => c.name)).map((col: string) => (
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
                      <Button type="primary" icon={<AimOutlined />} style={{ marginTop: 12 }} onClick={handlePredict} loading={training}>
                        Predict
                      </Button>
                      {prediction && (
                        <Alert
                          style={{ marginTop: 12 }}
                          type="success"
                          showIcon
                          message={`Prediction: ${prediction.prediction}`}
                          description={
                            prediction.probabilities
                              ? `Probabilities: ${prediction.probabilities.map((p: number, i: number) => `Class ${i}: ${(p * 100).toFixed(1)}%`).join(', ')}`
                              : undefined
                          }
                        />
                      )}
                    </Card>
                  )}
                </div>
              ),
            },
          ]} />
        </Col>
      </Row>
    </div>
  )
}

export default MLPage
