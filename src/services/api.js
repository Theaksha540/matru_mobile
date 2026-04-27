import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../utils/secureStorage';
import { logger } from '../utils/secureLogger';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const api = axios.create({
  baseURL: BASE_URL,
});

export const buildApiUrl = (path, params = {}) => {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value);
    }
  });

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${normalizedPath}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
};

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await secureStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Log all API requests
  logger.log('API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL: `${config.baseURL}${config.url}`,
    headers: config.headers,
    params: config.params,
    data: config.data
  });
  
  return config;
});

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => {
    // Log successful responses
    logger.log('API Response Success:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      dataType: typeof response.data,
      dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'not object'
    });
    return response;
  },
  (error) => {
    // Log error responses
    logger.error('API Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      message: error.message,
      responseData: error.response?.data
    });
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('grant_type', 'password');
    
    const response = await api.post('/api/v1/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    // Store tokens in secure storage
    if (response.data.access_token) {
      await secureStorage.setItem('access_token', response.data.access_token);
    }
    if (response.data.refresh_token) {
      await secureStorage.setItem('refresh_token', response.data.refresh_token);
    }
    
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  },
  
  getAbnormalFindingsOptions: async () => {
    const response = await api.get('/api/v1/auth/abnormal-findings-options');
    return response.data;
  },
  
  getScanTypesOptions: async () => {
    const response = await api.get('/api/v1/auth/scan-types-options');
    return response.data;
  },
  
  getBulkUploadTemplate: async () => {
    const response = await api.get('/api/v1/auth/bulk-upload-template');
    return response.data;
  },
  
  downloadBulkUploadTemplate: async () => {
    const response = await api.get('/api/v1/auth/download-bulk-upload-template', {
      responseType: 'blob'
    });
    return response.data;
  },
  
  getDeliveryTypes: async () => {
    const response = await api.get('/api/v1/auth/delivery-types');
    return response.data;
  },
  
  forgotPassword: async (identifier) => {
    const response = await api.post('/api/v1/auth/forgot-password', {
      identifier
    });
    return response.data;
  },
  
  resetPassword: async (identifier, otp, newPassword) => {
    const response = await api.post('/api/v1/auth/reset-password', {
      identifier,
      otp,
      new_password: newPassword
    });
    return response.data;
  },
  
  changePassword: async (oldPassword, newPassword) => {
    const response = await api.post('/api/v1/auth/change-password', null, {
      params: {
        old_password: oldPassword,
        new_password: newPassword
      }
    });
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/api/v1/auth/logout');
    return response.data;
  }
};

export const adminAPI = {
  getDistricts: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    
    const url = `/api/v1/admin/districts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    logger.log('API Call - getDistricts:', url);
    const response = await api.get(url);
    logger.log('API Response - getDistricts received');
    return response.data;
  },
  
  getBlocks: async (districtId = null) => {
    const url = districtId ? `/api/v1/admin/blocks?district_id=${districtId}` : '/api/v1/admin/blocks';
    logger.log('API Call - getBlocks:', url);
    const response = await api.get(url);
    logger.log('API Response - getBlocks received');
    return response.data;
  },
  
  getWards: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    
    const url = `/api/v1/admin/wards${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    logger.log('API Call - getWards:', url);
    const response = await api.get(url);
    logger.log('API Response - getWards received');
    return response.data;
  },
  
  getSubCentres: async (blockId = null) => {
    const url = blockId ? `/api/v1/admin/sub-centres?block_id=${blockId}` : '/api/v1/admin/sub-centres';
    const response = await api.get(url);
    return response.data;
  },
  
  getUSGCentres: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.ward_id) queryParams.append('ward_id', params.ward_id);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    if (params.is_private !== undefined) queryParams.append('is_private', params.is_private);
    
    const url = `/api/v1/admin/usg-centres${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  getDeliveryPoints: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    
    const url = `/api/v1/admin/delivery-points${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    logger.log('API Call - getDeliveryPoints:', url);
    const response = await api.get(url);
    logger.log('API Response - getDeliveryPoints received');
    return response.data;
  }
};

export const dashboardAPI = {
  getStats: async () => {
    const response = await api.get('/api/v1/dashboard/stats');
    return response.data;
  },
  
  getDistrictOverview: async () => {
    const response = await api.get('/api/v1/dashboard/district-overview');
    return response.data;
  },
  
  getBlockStats: async (blockId) => {
    const url = blockId ? `/api/v1/dashboard/block-stats?block_id=${blockId}` : '/api/v1/dashboard/block-stats';
    const response = await api.get(url);
    return response.data;
  },
  
  getSubCentreStats: async () => {
    const response = await api.get('/api/v1/dashboard/sub-centre-stats');
    return response.data;
  }
};

export const pregnantWomenAPI = {
  register: async (data) => {
    const response = await api.post('/api/v1/pregnant-women/', data);
    return response.data;
  },
  
  selfRegister: async (data) => {
    logger.log('Self-register request initiated');
    try {
      const response = await api.post('/api/v1/pregnant-women/self-register', data);
      logger.log('Self-register response received');
      return response.data;
    } catch (error) {
      logger.error('Self-register error:', error);
      throw error;
    }
  },
  
  bulkUpload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/v1/pregnant-women/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  getById: async (pwId) => {
    const response = await api.get(`/api/v1/pregnant-women/${pwId}`);
    return response.data;
  },
  
  update: async (pwId, data) => {
    const response = await api.put(`/api/v1/pregnant-women/${pwId}`, data);
    return response.data;
  },
  
  approve: async (pwId) => {
    const response = await api.post(`/api/v1/pregnant-women/${pwId}/approve`);
    return response.data;
  },
  
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.sub_centre_id) queryParams.append('sub_centre_id', params.sub_centre_id);
    if (params.is_high_risk !== undefined) queryParams.append('is_high_risk', params.is_high_risk);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    if (params.registration_approved !== undefined) queryParams.append('registration_approved', params.registration_approved);
    if (params.search) queryParams.append('search', params.search);
    
    const url = `/api/v1/pregnant-women/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  getPendingApproval: async () => {
    const response = await api.get('/api/v1/pregnant-women/pending-approval');
    return response.data;
  },
  
  searchByMobile: async (mobileNumber) => {
    const response = await api.get(`/api/v1/pregnant-women/search/by-mobile/${mobileNumber}`);
    return response.data;
  }
};

export const ancVisitAPI = {
  create: async (data) => {
    const response = await api.post('/api/v1/anc-visits/', data);
    return response.data;
  },
  
  getByPregnantWoman: async (pwId) => {
    const response = await api.get(`/api/v1/anc-visits/pregnant-woman/${pwId}`);
    return response.data;
  },
  
  update: async (visitId, data) => {
    const response = await api.put(`/api/v1/anc-visits/${visitId}`, data);
    return response.data;
  }
};

export const usgAppointmentAPI = {
  schedule: async (data) => {
    const formData = new FormData();
    formData.append('pregnant_woman_id', data.pregnant_woman_id);
    formData.append('usg_centre_id', data.usg_centre_id);
    formData.append('scheduled_date', data.scheduled_date);
    if (data.appointment_type) formData.append('appointment_type', data.appointment_type);
    if (data.prescription_file) formData.append('prescription_file', data.prescription_file);
    
    const response = await api.post('/api/v1/usg-appointments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    if (params.usg_centre_id) queryParams.append('usg_centre_id', params.usg_centre_id);
    if (params.appointment_type) queryParams.append('appointment_type', params.appointment_type);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    
    const url = `/api/v1/usg-appointments/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  getPending: async () => {
    const response = await api.get('/api/v1/usg-appointments/pending');
    return response.data;
  },
  
  accept: async (appointmentId) => {
    const response = await api.post(`/api/v1/usg-appointments/${appointmentId}/accept`);
    return response.data;
  },
  
  reschedule: async (appointmentId, newDate, reason) => {
    const response = await api.post(
      `/api/v1/usg-appointments/${appointmentId}/reschedule`,
      null,
      {
        params: {
          new_scheduled_date: newDate,
          reschedule_reason: reason
        }
      }
    );
    return response.data;
  },
  
  complete: async (appointmentId, data) => {
    const formData = new FormData();
    formData.append('completed_date', data.completed_date);
    formData.append('scan_date', data.scan_date);
    formData.append('trimester', data.trimester);
    formData.append('scan_type', data.scan_type);
    formData.append('findings', data.findings);
    formData.append('doctor_name', data.doctor_name);
    formData.append('technician_name', data.technician_name);
    if (data.gestational_age) formData.append('gestational_age', data.gestational_age);
    if (data.abnormal_findings) formData.append('abnormal_findings', data.abnormal_findings);
    if (data.additional_notes) formData.append('additional_notes', data.additional_notes);
    if (data.usg_findings) formData.append('usg_findings', data.usg_findings);
    if (data.is_high_risk !== undefined) formData.append('is_high_risk', data.is_high_risk);
    if (data.report_file) formData.append('report_file', data.report_file);
    
    const response = await api.post(`/api/v1/usg-appointments/${appointmentId}/complete`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  getOverdueEmergency: async () => {
    const response = await api.get('/api/v1/usg-appointments/overdue/emergency');
    return response.data;
  },
  
  getById: async (appointmentId) => {
    const response = await api.get(`/api/v1/usg-appointments/${appointmentId}`);
    return response.data;
  },
  
  update: async (appointmentId, data) => {
    const formData = new FormData();
    if (data.usg_centre_id) formData.append('usg_centre_id', data.usg_centre_id);
    if (data.scheduled_date) formData.append('scheduled_date', data.scheduled_date);
    if (data.appointment_type) formData.append('appointment_type', data.appointment_type);
    if (data.prescription_file) formData.append('prescription_file', data.prescription_file);
    
    const response = await api.put(`/api/v1/usg-appointments/${appointmentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const grievanceAPI = {
  submit: async (data) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('mobile_number', data.mobile_number);
    formData.append('grievance_note', data.grievance_note);
    formData.append('ward_id', data.ward_id);
    formData.append('block_id', data.block_id);
    if (data.district_id) formData.append('district_id', data.district_id);
    if (data.pregnant_woman_id) formData.append('pregnant_woman_id', data.pregnant_woman_id);
    if (data.rch_id) formData.append('rch_id', data.rch_id);
    if (data.attachment) formData.append('attachment', data.attachment);
    
    const response = await axios.post(`${BASE_URL}/api/v1/grievances/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.escalated_only !== undefined) queryParams.append('escalated_only', params.escalated_only);
    
    const url = `/api/v1/grievances/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  updateStatus: async (grievanceId, data) => {
    const response = await api.put(`/api/v1/grievances/${grievanceId}`, data);
    return response.data;
  },
  
  resolve: async (grievanceId, resolutionNote) => {
    const response = await api.post(`/api/v1/grievances/${grievanceId}/resolve?resolution_note=${encodeURIComponent(resolutionNote)}`);
    return response.data;
  },
  
  getById: async (grievanceId) => {
    const response = await api.get(`/api/v1/grievances/${grievanceId}`);
    return response.data;
  },
  
  getStatistics: async () => {
    const response = await api.get('/api/v1/grievances/statistics/summary');
    return response.data;
  }
};

export const deliveryReferralAPI = {
  create: async (data) => {
    try {
      const url = `/api/v1/delivery-referrals/`;
      logger.log('API Call - deliveryReferralAPI.create:', url);
      logger.log('API Call - deliveryReferralAPI.create data:', data);
      
      const response = await api.post(url, data);
      
      logger.log('API Response - deliveryReferralAPI.create status:', response.status);
      logger.log('API Response - deliveryReferralAPI.create data:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('API Error - deliveryReferralAPI.create:', error);
      logger.error('API Error - deliveryReferralAPI.create response:', error.response?.data);
      throw error;
    }
  },
  
  getAll: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.skip !== undefined) queryParams.append('skip', params.skip);
      if (params.limit !== undefined) queryParams.append('limit', params.limit);
      if (params.status) queryParams.append('status', params.status);
      if (params.dp_id) queryParams.append('dp_id', params.dp_id);
      if (params.pregnant_woman_id) queryParams.append('pregnant_woman_id', params.pregnant_woman_id);
      
      const url = `/api/v1/delivery-referrals/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      logger.log('API Call - deliveryReferralAPI.getAll:', url);
      logger.log('API Call - deliveryReferralAPI.getAll params:', params);
      
      const response = await api.get(url);
      
      logger.log('API Response - deliveryReferralAPI.getAll status:', response.status);
      logger.log('API Response - deliveryReferralAPI.getAll data type:', typeof response.data);
      logger.log('API Response - deliveryReferralAPI.getAll data length:', Array.isArray(response.data) ? response.data.length : 'not array');
      logger.log('API Response - deliveryReferralAPI.getAll first item:', Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : 'no items');
      
      return response.data;
    } catch (error) {
      logger.error('API Error - deliveryReferralAPI.getAll:', error);
      logger.error('API Error - deliveryReferralAPI.getAll response:', error.response?.data);
      throw error;
    }
  },
  
  getById: async (referralId) => {
    try {
      const url = `/api/v1/delivery-referrals/${referralId}`;
      logger.log('API Call - deliveryReferralAPI.getById:', url);
      logger.log('API Call - deliveryReferralAPI.getById referralId:', referralId);
      
      const response = await api.get(url);
      
      logger.log('API Response - deliveryReferralAPI.getById status:', response.status);
      logger.log('API Response - deliveryReferralAPI.getById data type:', typeof response.data);
      logger.log('API Response - deliveryReferralAPI.getById data keys:', response.data ? Object.keys(response.data) : 'no data');
      logger.log('API Response - deliveryReferralAPI.getById full data:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('API Error - deliveryReferralAPI.getById:', error);
      logger.error('API Error - deliveryReferralAPI.getById response:', error.response?.data);
      logger.error('API Error - deliveryReferralAPI.getById status:', error.response?.status);
      throw error;
    }
  },
  
  accept: async (referralId) => {
    try {
      const url = `/api/v1/delivery-referrals/${referralId}/accept`;
      logger.log('API Call - deliveryReferralAPI.accept:', url);
      logger.log('API Call - deliveryReferralAPI.accept referralId:', referralId);
      
      const response = await api.post(url);
      
      logger.log('API Response - deliveryReferralAPI.accept status:', response.status);
      logger.log('API Response - deliveryReferralAPI.accept data:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('API Error - deliveryReferralAPI.accept:', error);
      logger.error('API Error - deliveryReferralAPI.accept response:', error.response?.data);
      throw error;
    }
  },
  
  reRefer: async (referralId, data) => {
    try {
      const url = `/api/v1/delivery-referrals/${referralId}/re-refer`;
      logger.log('API Call - deliveryReferralAPI.reRefer:', url);
      logger.log('API Call - deliveryReferralAPI.reRefer referralId:', referralId);
      logger.log('API Call - deliveryReferralAPI.reRefer data:', data);
      
      const response = await api.post(url, data);
      
      logger.log('API Response - deliveryReferralAPI.reRefer status:', response.status);
      logger.log('API Response - deliveryReferralAPI.reRefer data:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('API Error - deliveryReferralAPI.reRefer:', error);
      logger.error('API Error - deliveryReferralAPI.reRefer response:', error.response?.data);
      throw error;
    }
  },
  
  recordOutcome: async (referralId, data) => {
    try {
      const url = `/api/v1/delivery-referrals/${referralId}/outcome`;
      logger.log('API Call - deliveryReferralAPI.recordOutcome:', url);
      logger.log('API Call - deliveryReferralAPI.recordOutcome referralId:', referralId);
      logger.log('API Call - deliveryReferralAPI.recordOutcome data:', data);
      
      const response = await api.post(url, data);
      
      logger.log('API Response - deliveryReferralAPI.recordOutcome status:', response.status);
      logger.log('API Response - deliveryReferralAPI.recordOutcome data:', response.data);
      
      return response.data;
    } catch (error) {
      logger.error('API Error - deliveryReferralAPI.recordOutcome:', error);
      logger.error('API Error - deliveryReferralAPI.recordOutcome response:', error.response?.data);
      throw error;
    }
  }
};

export const reportsAPI = {
  getDistrictPerformance: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    
    const url = `/api/v1/reports/district/performance${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  
  exportDistrictReport: async (format, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const url = `/api/v1/reports/district/export/${format}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url, { responseType: 'arraybuffer' });
    return response.data;
  },
  
  getBlockWiseTrends: async (year = 2026) => {
    const response = await api.get(`/api/v1/dashboard/analytics/block-wise-trends?year=${year}`);
    return response.data;
  },
  
  getWardWiseTrends: async (blockId, year = 2026) => {
    const response = await api.get(`/api/v1/dashboard/analytics/ward-wise-trends?block_id=${blockId}&year=${year}`);
    return response.data;
  },
  
  getBlockWardWiseReport: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.ward_id) queryParams.append('ward_id', params.ward_id);
    
    const url = `/api/v1/reports/block/ward-wise${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    logger.log('API Call - getBlockWardWiseReport:', url);
    const response = await api.get(url);
    logger.log('API Response - getBlockWardWiseReport received');
    return response.data;
  },
  
  exportBlockReport: async (format, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    
    const url = `/api/v1/reports/block/export/${format}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    logger.log('API Call - exportBlockReport:', url);
    const response = await api.get(url, { responseType: 'arraybuffer' });
    logger.log('API Response - exportBlockReport received');
    return response.data;
  },

  getDeliverySummary: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.dp_id) queryParams.append('dp_id', params.dp_id);

    const url = `/api/v1/reports/delivery/summary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  getDeliveryOutcomeBreakdown: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.dp_id) queryParams.append('dp_id', params.dp_id);

    const url = `/api/v1/reports/delivery/outcome-breakdown${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  getDeliveryPointPerformance: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.dp_id) queryParams.append('dp_id', params.dp_id);

    const url = `/api/v1/reports/delivery/point-performance${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  }
};

export default api;
