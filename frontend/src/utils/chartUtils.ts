export const TABLEAU_COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
]

export const DARK_TABLEAU_COLORS = [
  '#6BA3D6', '#F8B347', '#F57A7C', '#8FD7C7', '#6ABF5A',
  '#F5D95A', '#C895B8', '#FFB0B8', '#B28A70', '#C8C4C0',
]

export function formatNumber(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return '0'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

export function isNumericType(type: string): boolean {
  const t = (type || '').toLowerCase()
  return ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'float', 'double', 'real', 'int64', 'float64', 'int', 'number'].some(n => t.includes(n))
}

export function isDateType(type: string): boolean {
  const t = (type || '').toLowerCase()
  return ['date', 'time', 'timestamp', 'datetime'].some(n => t.includes(n))
}

export function suggestChartType(cols: any[], data: any[]): string {
  try {
    const numericCols = cols.filter(c => isNumericType(c.type))
    const dateCols = cols.filter(c => isDateType(c.type))
    const stringCols = cols.filter(c => !isNumericType(c.type) && !isDateType(c.type))
    const rowCount = data?.length || 0

    if (numericCols.length >= 2 && rowCount > 20 && rowCount < 500) return 'scatter'
    if (dateCols.length > 0 && numericCols.length > 0) return 'line'
    if (stringCols.length > 0 && numericCols.length > 0) {
      const uniqueCount = new Set(data?.map(r => r[stringCols[0]])).size
      if (uniqueCount <= 10 && rowCount <= 50) return 'pie'
      return 'bar'
    }
    if (numericCols.length >= 1) return 'bar'
    return 'table'
  } catch { return 'bar' }
}

export function autoSelectColumns(cols: any[], data: any[]) {
  try {
    const numericCols = cols.filter(c => isNumericType(c.type)).map(c => c.name)
    const stringCols = cols.filter(c => !isNumericType(c.type)).map(c => c.name)
    const dateCols = cols.filter(c => isDateType(c.type)).map(c => c.name)
    let xCol = ''
    let yCol = ''

    if (dateCols.length > 0 && numericCols.length > 0) {
      xCol = dateCols[0]; yCol = numericCols[0]
    } else if (stringCols.length > 0 && numericCols.length > 0) {
      xCol = stringCols[0]; yCol = numericCols[0]
    } else if (numericCols.length >= 2) {
      xCol = numericCols[0]; yCol = numericCols[1]
    } else if (numericCols.length === 1) {
      xCol = stringCols[0] || dateCols[0] || numericCols[0]
      yCol = numericCols[0]
    }

    return { xCol, yCol }
  } catch { return { xCol: '', yCol: '' } }
}

export function buildChartOption(params: {
  chartType: string
  xCol: string
  metrics: { column: string; aggregation: string; label: string }[]
  data: any[]
  title?: string
  darkMode?: boolean
  colors?: string[]
  stackMode?: 'none' | 'stack' | 'normalize'
  showLabels?: boolean
  sortBy?: 'none' | 'x' | 'y' | 'y_desc'
}) {
  try {
    const { chartType, xCol, metrics, data, title, darkMode, colors, stackMode, showLabels, sortBy } = params
    const palette = colors || (darkMode ? DARK_TABLEAU_COLORS : TABLEAU_COLORS)

    if (!xCol || metrics.length === 0 || !data?.length) return null

    const isDark = darkMode || false
    const textColor = isDark ? '#e5e7eb' : '#374151'
    const axisColor = isDark ? '#4b5563' : '#e5e7eb'

    const grouped: Record<string, number[][]> = {}
    data.forEach((row: any) => {
      const key = String(row[xCol] ?? 'null')
      if (!grouped[key]) grouped[key] = metrics.map(() => [])
      metrics.forEach((m, i) => {
        const val = Number(row[m.column]) || 0
        grouped[key][i].push(val)
      })
    })

    const aggMap: Record<string, (vals: number[]) => number> = {
      SUM: v => v.reduce((a, b) => a + b, 0),
      AVG: v => v.reduce((a, b) => a + b, 0) / (v.length || 1),
      COUNT: v => v.length,
      MAX: v => Math.max(...v),
      MIN: v => Math.min(...v),
    }

    let keys = Object.keys(grouped)
    const isPie = chartType === 'pie'
    const isScatter = chartType === 'scatter'
    const isTable = chartType === 'table'
    const hasDateX = keys.length > 0 && keys.some(k => !isNaN(Date.parse(k)))

    if (sortBy === 'x') keys.sort()
    else if (sortBy === 'y' || sortBy === 'y_desc') {
      const keyScores = keys.map(k => {
        const total = metrics.reduce((s, m, mi) => s + (aggMap[m.aggregation]?.(grouped[k][mi]) || 0), 0)
        return { k, total }
      })
      keyScores.sort((a, b) => sortBy === 'y_desc' ? b.total - a.total : a.total - b.total)
      keys = keyScores.map(x => x.k)
    }

    const isStack = stackMode === 'stack' || stackMode === 'normalize'
    const noStack = !isStack

    const baseOption: any = {
      backgroundColor: 'transparent',
      title: title ? {
        text: title,
        left: 'center',
        textStyle: { fontSize: 13, fontWeight: 600, color: textColor },
      } : undefined,
      tooltip: {
        trigger: isPie ? 'item' : 'axis',
        backgroundColor: isDark ? '#2d2d2d' : '#ffffff',
        borderColor: isDark ? '#4b5563' : '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: textColor, fontSize: 12 },
        formatter: isPie
          ? '{b}: {c} ({d}%)'
          : (p: any) => {
              if (!Array.isArray(p)) p = [p]
              let html = `<div style="font-weight:600;margin-bottom:4px">${p[0]?.axisValue || ''}</div>`
              p.forEach((s: any) => {
                const c = s.color || '#1890ff'
                const v = typeof s.value === 'number' ? s.value : (Array.isArray(s.value) ? s.value[1] : s.value)
                html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c}"></span>
                  <span>${s.seriesName}: <strong>${formatNumber(Number(v) || 0)}</strong></span>
                </div>`
              })
              return html
            },
      },
      legend: {
        show: !isPie && !isTable && !isScatter && metrics.length > 1,
        type: 'scroll',
        bottom: 0,
        textStyle: { color: textColor, fontSize: 11 },
      },
      grid: {
        left: '8%',
        right: '4%',
        top: title ? 45 : 20,
        bottom: metrics.length > 1 ? 40 : 30,
        containLabel: true,
      },
      color: palette,
      animationDuration: 400,
      animationEasing: 'cubicOut',
    }

    if (isPie) {
      const pieData = keys.map(k => {
        const total = metrics.reduce((s, m, mi) => s + (aggMap[m.aggregation]?.(grouped[k][mi]) || 0), 0)
        return { value: total, name: k }
      })
      return {
        ...baseOption,
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)', backgroundColor: isDark ? '#2d2d2d' : '#fff', borderColor: axisColor, textStyle: { color: textColor } },
        legend: { orient: 'vertical', right: 10, top: 'center', type: 'scroll', textStyle: { color: textColor } },
        series: [{
          type: 'pie', radius: ['35%', '65%'], center: ['40%', '50%'],
          data: pieData,
          emphasis: { itemStyle: { shadowBlur: 10 } },
          label: { show: keys.length <= 12, color: textColor, formatter: '{b}: {d}%' },
          itemStyle: { borderRadius: 4 },
        }],
      }
    }

    if (isScatter) {
      const scatterData = data.slice(0, 500).map(r => [Number(r[xCol]) || 0, ...metrics.map(m => Number(r[m.column]) || 0)])
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          backgroundColor: isDark ? '#2d2d2d' : '#fff', borderColor: axisColor, textStyle: { color: textColor },
          formatter: (p: any) => {
            const vals = p.value || []
            let html = `<div style="font-weight:600;margin-bottom:4px">${xCol}: ${vals[0]}</div>`
            metrics.forEach((m, i) => { html += `<div>${m.label}: <strong>${formatNumber(vals[i + 1])}</strong></div>` })
            return html
          },
        },
        legend: { show: false },
        xAxis: { type: 'value', name: xCol, nameTextStyle: { color: textColor }, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: axisColor } } },
        yAxis: { type: 'value', name: metrics[0]?.label || '', nameTextStyle: { color: textColor }, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: axisColor } } },
        series: metrics.map((m, mi) => ({
          name: m.label, type: 'scatter',
          data: scatterData.map(d => [d[0], d[mi + 1]]),
          symbolSize: (val: number[]) => Math.max(4, Math.min(20, Math.abs(val[1]) / 10)),
          itemStyle: { opacity: 0.7 },
        })),
      }
    }

    if (isTable) {
      return {
        ...baseOption,
        grid: { top: 10, bottom: 10, left: 10, right: 10 },
        xAxis: { show: false }, yAxis: { show: false },
        series: [{ type: 'custom', renderItem: () => null, data: [] }],
      }
    }

    const isBar = chartType === 'bar'
    const isLine = chartType === 'line'
    const isArea = chartType === 'area'

    const displayKeys = keys.length > 100 ? keys.slice(0, 100) : keys

    const series = metrics.map((m, mi) => {
      const values = displayKeys.map(k => aggMap[m.aggregation]?.(grouped[k][mi]) || 0)
      const s: any = {
        name: m.label,
        type: isArea ? 'line' : chartType,
        data: hasDateX ? displayKeys.map((k, i) => [new Date(k).getTime(), values[i]]) : values,
        smooth: isLine || isArea,
        symbolSize: isLine ? 5 : 0,
        barMaxWidth: 50,
      }
      if (isArea) s.areaStyle = { opacity: 0.25 }
      if (isBar) {
        s.itemStyle = { borderRadius: [3, 3, 0, 0] }
        s.emphasis = { itemStyle: { shadowBlur: 4, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.15)' } }
      }
      if (metrics.length === 1 && isLine) s.areaStyle = { opacity: 0.1 }
      if (showLabels) {
        s.label = {
          show: true,
          position: isBar ? 'top' : 'top',
          color: textColor,
          fontSize: 10,
          formatter: (v: any) => formatNumber(typeof v.value === 'number' ? v.value : (Array.isArray(v.value) ? v.value[1] : 0)),
        }
      }
      return s
    })

    if (isStack) {
      if (stackMode === 'normalize') {
        series.forEach(s => { s.stack = 'total'; s.label = s.label ? { ...s.label, formatter: (v: any) => { return '' } } : undefined })
        return {
          ...baseOption,
          xAxis: {
            type: hasDateX ? 'time' : 'category', data: hasDateX ? undefined : displayKeys,
            axisLabel: { rotate: !hasDateX && displayKeys.length > 10 ? 45 : 0, interval: 0, color: textColor, fontSize: 11 },
            name: xCol, nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: textColor, fontSize: 11 },
            axisLine: { lineStyle: { color: axisColor } },
          },
          yAxis: {
            type: 'value', max: 100, name: '%',
            axisLabel: { color: textColor, fontSize: 11, formatter: '{value}%' },
            splitLine: { lineStyle: { color: axisColor, type: 'dashed' as const } },
          },
          series: series.map(s => ({ ...s, type: 'bar' })),
        }
      }
      series.forEach(s => { s.stack = 'total' })
    }

    return {
      ...baseOption,
      xAxis: {
        type: hasDateX ? 'time' : 'category', data: hasDateX ? undefined : displayKeys,
        axisLabel: {
          rotate: !hasDateX && displayKeys.length > 10 ? 45 : 0, interval: 0, color: textColor, fontSize: 11,
          formatter: hasDateX ? (v: number) => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}` } : undefined,
        },
        name: xCol, nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: axisColor } }, splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: metrics.length === 1 ? `${metrics[0].aggregation}(${metrics[0].column})` : '',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => formatNumber(v) },
        splitLine: { lineStyle: { color: axisColor, type: 'dashed' as const } },
      },
      series,
    }
  } catch (e) {
    console.error('buildChartOption error', e)
    return null
  }
}
