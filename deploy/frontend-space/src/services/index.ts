import api from './api'

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password })
    return response.data
  },
  
  register: async (data: { username: string; email: string; password: string; first_name?: string; last_name?: string }) => {
    const response = await api.post('/auth/register', data)
    return response.data
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
  
  getUsers: async () => {
    const response = await api.get('/auth/users')
    return response.data
  },
  
  assignRoles: async (userId: number, roles: string[]) => {
    const response = await api.put(`/auth/users/${userId}/roles`, { roles })
    return response.data
  },
}

export const chartService = {
  list: async (params?: { page?: number; per_page?: number; datasource_id?: number; owner_id?: number }) => {
    const response = await api.get('/charts', { params })
    return response.data
  },
  
  get: async (id: number) => {
    const response = await api.get(`/charts/${id}`)
    return response.data
  },
  
  create: async (data: any) => {
    const response = await api.post('/charts', data)
    return response.data
  },
  
  update: async (id: number, data: any) => {
    const response = await api.put(`/charts/${id}`, data)
    return response.data
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/charts/${id}`)
    return response.data
  },
  
  getData: async (id: number) => {
    const response = await api.post(`/charts/${id}/data`)
    return response.data
  },
}

export const dashboardService = {
  list: async (params?: { page?: number; per_page?: number; owner_id?: number }) => {
    const response = await api.get('/dashboards', { params })
    return response.data
  },
  
  get: async (id: number) => {
    const response = await api.get(`/dashboards/${id}`)
    return response.data
  },
  
  create: async (data: any) => {
    const response = await api.post('/dashboards', data)
    return response.data
  },
  
  update: async (id: number, data: any) => {
    const response = await api.put(`/dashboards/${id}`, data)
    return response.data
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/dashboards/${id}`)
    return response.data
  },
  
  addChart: async (dashboardId: number, chartId: number, position: any) => {
    const response = await api.post(`/dashboards/${dashboardId}/charts`, { chart_id: chartId, position })
    return response.data
  },
}

export const sqlLabService = {
  getDatabases: async () => {
    const response = await api.get('/sql_lab/databases')
    return response.data
  },
  
  createDatabase: async (data: any) => {
    const response = await api.post('/sql_lab/databases', data)
    return response.data
  },
  
  getTables: async (dbId: number) => {
    const response = await api.get(`/sql_lab/databases/${dbId}/tables`)
    return response.data
  },
  
  executeQuery: async (data: { database_id: number; sql: string; schema?: string; limit?: number }) => {
    const response = await api.post('/sql_lab/query', data)
    return response.data
  },
  
  getQueryStatus: async (queryId: number) => {
    const response = await api.get(`/sql_lab/query/${queryId}`)
    return response.data
  },
  
  getQueryResults: async (queryId: number) => {
    const response = await api.get(`/sql_lab/query/${queryId}/results`)
    return response.data
  },
}

export const datasetService = {
  list: async () => {
    const response = await api.get('/datasets')
    return response.data
  },
  
  get: async (id: number) => {
    const response = await api.get(`/datasets/${id}`)
    return response.data
  },
  
  upload: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  
  importFromKaggle: async (url: string) => {
    const response = await api.post('/datasets/import/kaggle', { url })
    return response.data
  },
  
  delete: async (id: number) => {
    const response = await api.delete(`/datasets/${id}`)
    return response.data
  },
  
  getColumns: async (id: number) => {
    const response = await api.get(`/datasets/${id}/columns`)
    return response.data
  },
  
  preview: async (id: number, limit: number = 100) => {
    const response = await api.get(`/datasets/${id}/preview`, { params: { limit } })
    return response.data
  },
}

export const aiService = {
  analyze: async (data: { message: string; dataset_id?: number; columns?: string[] }) => {
    const response = await api.post('/ai/analyze', data)
    return response.data
  },
  
  createMetric: async (config: any) => {
    const response = await api.post('/ai/metric', config)
    return response.data
  },
  
  createChart: async (config: any) => {
    const response = await api.post('/ai/chart', config)
    return response.data
  },
}

export const metabaseService = {
  status: async () => {
    const response = await api.get('/metabase/status')
    return response.data
  },
  
  sync: async () => {
    const response = await api.post('/metabase/sync')
    return response.data
  },
}
