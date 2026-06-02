import api from './api';

export const notificationAPI = {
  getNotifications: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.is_read !== undefined) queryParams.append('is_read', params.is_read);
    if (params.category) queryParams.append('category', params.category);
    if (params.priority) queryParams.append('priority', params.priority);
    
    const url = `/api/v2/notifications/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  getUnreadCount: async () => {
    const response = await api.get('/api/v2/notifications/unread-count');
    return response.data.unread_count;
  },
  
  getStatistics: async () => {
    const response = await api.get('/api/v2/notifications/statistics');
    return response.data;
  },
  
  getById: async (notificationId) => {
    const response = await api.get(`/api/v2/notifications/${notificationId}`);
    return response.data;
  },
  
  markAsRead: async (notificationId) => {
    const response = await api.put(`/api/v2/notifications/${notificationId}/read`);
    return response.data;
  },
  
  markAllAsRead: async () => {
    const response = await api.put('/api/v2/notifications/mark-all-read');
    return response.data;
  },
  
  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/api/v2/notifications/${notificationId}`);
    return response.data;
  },
  
  clearAllRead: async () => {
    const response = await api.delete('/api/v2/notifications/clear-all');
    return response.data;
  }
};

