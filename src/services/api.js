import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from '../utils/secureStorage';
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const api = axios.create({
  baseURL: BASE_URL
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
api.interceptors.request.use(async config => {
  const token = await secureStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Log all API requests

  return config;
});

// Add response interceptor for logging
api.interceptors.response.use(response => {
  // Log successful responses

  return response;
}, error => {
  // Log error responses

  return Promise.reject(error);
});
export const authAPI = {
  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('grant_type', 'password');
    const response = await api.post('/api/v2/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
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
    const response = await api.get('/api/v2/auth/me');
    return response.data;
  },
  getAbnormalFindingsOptions: async () => {
    const response = await api.get('/api/v2/auth/abnormal-findings-options');
    return response.data;
  },
  getScanTypesOptions: async () => {
    const response = await api.get('/api/v2/auth/scan-types-options');
    return response.data;
  },
  getBulkUploadTemplate: async () => {
    const response = await api.get('/api/v2/auth/bulk-upload-template');
    return response.data;
  },
  downloadBulkUploadTemplate: async () => {
    const response = await api.get('/api/v2/auth/download-bulk-upload-template', {
      responseType: 'blob'
    });
    return response.data;
  },
  getDeliveryTypes: async () => {
    const response = await api.get('/api/v2/auth/delivery-types');
    return response.data;
  },
  forgotPassword: async identifier => {
    const response = await api.post('/api/v2/auth/forgot-password', {
      identifier
    });
    return response.data;
  },
  resetPassword: async (identifier, otp, newPassword) => {
    const response = await api.post('/api/v2/auth/reset-password', {
      identifier,
      otp,
      new_password: newPassword
    });
    return response.data;
  },
  changePassword: async (oldPassword, newPassword) => {
    const response = await api.post('/api/v2/auth/change-password', null, {
      params: {
        old_password: oldPassword,
        new_password: newPassword
      }
    });
    return response.data;
  },
  logout: async () => {
    const response = await api.post('/api/v2/auth/logout');
    return response.data;
  }
};
export const adminAPI = {
  getDistricts: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    const url = `/api/v2/admin/districts${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  getBlocks: async (districtId = null) => {
    const url = districtId ? `/api/v2/admin/blocks?district_id=${districtId}` : '/api/v2/admin/blocks';
    const response = await api.get(url);
    return response.data;
  },
  getWards: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
    const url = `/api/v2/admin/wards${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  getSubCentres: async (blockId = null) => {
    const url = blockId ? `/api/v2/admin/sub-centres?block_id=${blockId}` : '/api/v2/admin/sub-centres';
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
    const url = `/api/v2/admin/usg-centres${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
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
    const url = `/api/v2/admin/delivery-points${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  }
};
export const dashboardAPI = {
  getStats: async () => {
    const response = await api.get('/api/v2/dashboard/stats');
    return response.data;
  },
  getDistrictOverview: async () => {
    const response = await api.get('/api/v2/dashboard/district-overview');
    return response.data;
  },
  getBlockStats: async blockId => {
    const url = blockId ? `/api/v2/dashboard/block-stats?block_id=${blockId}` : '/api/v2/dashboard/block-stats';
    const response = await api.get(url);
    return response.data;
  },
  getSubCentreStats: async () => {
    const response = await api.get('/api/v2/dashboard/sub-centre-stats');
    return response.data;
  }
};
export const pregnantWomenAPI = {
  register: async data => {
    const response = await api.post('/api/v2/pregnant-women/', data);
    return response.data;
  },
  selfRegister: async data => {
    try {
      const response = await api.post('/api/v2/pregnant-women/self-register', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  bulkUpload: async file => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/v2/pregnant-women/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },
  getById: async pwId => {
    const response = await api.get(`/api/v2/pregnant-women/${pwId}`);
    return response.data;
  },
  update: async (pwId, data) => {
    const response = await api.put(`/api/v2/pregnant-women/${pwId}`, data);
    return response.data;
  },
  approve: async pwId => {
    const response = await api.post(`/api/v2/pregnant-women/${pwId}/approve`);
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
    const url = `/api/v2/pregnant-women/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  getPendingApproval: async () => {
    const response = await api.get('/api/v2/pregnant-women/pending-approval');
    return response.data;
  },
  searchByMobile: async mobileNumber => {
    const response = await api.get(`/api/v2/pregnant-women/search/by-mobile/${mobileNumber}`);
    return response.data;
  }
};
export const ancVisitAPI = {
  create: async data => {
    const response = await api.post('/api/v2/anc-visits/', data);
    return response.data;
  },
  getByPregnantWoman: async pwId => {
    const response = await api.get(`/api/v2/anc-visits/pregnant-woman/${pwId}`);
    return response.data;
  },
  update: async (visitId, data) => {
    const response = await api.put(`/api/v2/anc-visits/${visitId}`, data);
    return response.data;
  }
};
export const usgAppointmentAPI = {
  schedule: async data => {
    const buildScheduleFormData = (payload, fileFieldName = 'prescription_files') => {
      const formData = new FormData();
      formData.append('pregnant_woman_id', payload.pregnant_woman_id);
      formData.append('usg_centre_id', payload.usg_centre_id);
      formData.append('scheduled_date', payload.scheduled_date);
      if (payload.appointment_type) formData.append('appointment_type', payload.appointment_type);
      if (Array.isArray(payload.prescription_files) && payload.prescription_files.length > 0) {
        payload.prescription_files.forEach(file => {
          if (file) {
            formData.append(fileFieldName, file);
          }
        });
      } else if (payload.prescription_file) {
        formData.append(fileFieldName, payload.prescription_file);
      }
      return formData;
    };
    const buildMultipartConfig = () => ({
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    const shouldRetryWithBracketNotation = error => {
      const details = error?.response?.data?.detail;
      return Array.isArray(details) && details.some(detail => detail?.loc?.includes?.('prescription_files') && detail?.type === 'list_type');
    };
    try {
      const response = await api.post('/api/v2/usg-appointments/', buildScheduleFormData(data), buildMultipartConfig());
      return response.data;
    } catch (error) {
      if (shouldRetryWithBracketNotation(error)) {
        const retryResponse = await api.post('/api/v2/usg-appointments/', buildScheduleFormData(data, 'prescription_files[]'), buildMultipartConfig());
        return retryResponse.data;
      }
      throw error;
    }
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
    const url = `/api/v2/usg-appointments/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  getPending: async () => {
    const response = await api.get('/api/v2/usg-appointments/pending');
    return response.data;
  },
  accept: async appointmentId => {
    const response = await api.post(`/api/v2/usg-appointments/${appointmentId}/accept`);
    return response.data;
  },
  reschedule: async (appointmentId, newDate, reason) => {
    const response = await api.post(`/api/v2/usg-appointments/${appointmentId}/reschedule`, null, {
      params: {
        new_scheduled_date: newDate,
        reschedule_reason: reason
      }
    });
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
    if (Array.isArray(data.report_files) && data.report_files.length > 0) {
      data.report_files.forEach(file => {
        if (file) {
          formData.append('report_files', file);
        }
      });
    } else if (data.report_file) {
      // Backward compatibility with older callers
      formData.append('report_files', data.report_file);
    }

    try {
      const response = await api.post(`/api/v2/usg-appointments/${appointmentId}/complete`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getOverdueEmergency: async () => {
    const response = await api.get('/api/v2/usg-appointments/overdue/emergency');
    return response.data;
  },
  getById: async appointmentId => {
    const response = await api.get(`/api/v2/usg-appointments/${appointmentId}`);
    return response.data;
  },
  update: async (appointmentId, data) => {
    const formData = new FormData();
    if (data.usg_centre_id) formData.append('usg_centre_id', data.usg_centre_id);
    if (data.scheduled_date) formData.append('scheduled_date', data.scheduled_date);
    if (data.appointment_type) formData.append('appointment_type', data.appointment_type);
    if (data.prescription_file) formData.append('prescription_file', data.prescription_file);
    const response = await api.put(`/api/v2/usg-appointments/${appointmentId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};
export const grievanceAPI = {
  submit: async data => {
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
    const response = await axios.post(`${BASE_URL}/api/v2/grievances/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
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
    const url = `/api/v2/grievances/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  updateStatus: async (grievanceId, data) => {
    const response = await api.put(`/api/v2/grievances/${grievanceId}`, data);
    return response.data;
  },
  resolve: async (grievanceId, resolutionNote) => {
    const response = await api.post(`/api/v2/grievances/${grievanceId}/resolve?resolution_note=${encodeURIComponent(resolutionNote)}`);
    return response.data;
  },
  getById: async grievanceId => {
    const response = await api.get(`/api/v2/grievances/${grievanceId}`);
    return response.data;
  },
  getStatistics: async () => {
    const response = await api.get('/api/v2/grievances/statistics/summary');
    return response.data;
  }
};
export const deliveryReferralAPI = {
  create: async data => {
    try {
      const url = `/api/v2/delivery-referrals/`;
      const response = await api.post(url, data);
      return response.data;
    } catch (error) {
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
      const url = `/api/v2/delivery-referrals/${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getById: async referralId => {
    try {
      const url = `/api/v2/delivery-referrals/${referralId}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  accept: async referralId => {
    try {
      const url = `/api/v2/delivery-referrals/${referralId}/accept`;
      const response = await api.post(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  reRefer: async (referralId, data) => {
    try {
      const url = `/api/v2/delivery-referrals/${referralId}/re-refer`;
      const summarizeReReferPayload = payload => ({
        referralId,
        new_dp_id: payload?.new_dp_id,
        re_refer_reason: payload?.re_refer_reason,
        treatment_given: payload?.treatment_given || null,
        attachment_count: Array.isArray(payload?.attachment_files) ? payload.attachment_files.length : 0,
        attachments: Array.isArray(payload?.attachment_files) ? payload.attachment_files.map(file => ({
          name: file?.name || null,
          type: file?.type || file?.mimeType || null,
          uri: file?.uri || null
        })) : []
      });
      const buildReReferFormData = (payload, fileFieldName = 'attachment_files') => {
        const formData = new FormData();
        formData.append('new_dp_id', payload.new_dp_id);
        formData.append('re_refer_reason', payload.re_refer_reason);
        if (payload.treatment_given) formData.append('treatment_given', payload.treatment_given);
        if (Array.isArray(payload.attachment_files) && payload.attachment_files.length > 0) {
          payload.attachment_files.forEach(file => {
            if (file) {
              formData.append(fileFieldName, file);
            }
          });
        }
        return formData;
      };
      const logFormDataEntries = (formData, label) => {
        const parts = Array.isArray(formData?._parts) ? formData._parts.map(([key, value]) => ({
          key,
          value: value && typeof value === 'object' ? {
            uri: value.uri || null,
            name: value.name || null,
            type: value.type || null
          } : value
        })) : [];
        console.log(`[deliveryReferralAPI.reRefer] ${label}`, {
          url,
          summary: summarizeReReferPayload(data),
          multipart_parts: parts
        });
      };
      const logReReferError = (error, context) => {
        console.error(`[deliveryReferralAPI.reRefer] ${context}`, {
          url,
          referralId,
          summary: summarizeReReferPayload(data),
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          responseData: error?.response?.data,
          message: error?.message
        });
      };
      const multipartConfig = {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      };
      try {
        const formData = buildReReferFormData(data);
        logFormDataEntries(formData, 'Sending primary request');
        const response = await api.post(url, formData, multipartConfig);
        console.log('[deliveryReferralAPI.reRefer] Primary request success', {
          url,
          referralId,
          response: response.data
        });
        return response.data;
      } catch (error) {
        logReReferError(error, 'Primary request failed');
        const retryFieldNames = ['attachment_files[]', 'referral_files', 'referral_files[]'];
        for (const fieldName of retryFieldNames) {
          try {
            const retryFormData = buildReReferFormData(data, fieldName);
            logFormDataEntries(retryFormData, `Retrying with field name "${fieldName}"`);
            const retryResponse = await api.post(url, retryFormData, multipartConfig);
            console.log('[deliveryReferralAPI.reRefer] Retry request success', {
              url,
              referralId,
              fieldName,
              response: retryResponse.data
            });
            return retryResponse.data;
          } catch (retryError) {
            logReReferError(retryError, `Retry failed for field name "${fieldName}"`);
            error = retryError;
          }
        }
        throw error;
      }
    } catch (error) {
      throw error;
    }
  },
  recordOutcome: async (referralId, data) => {
    try {
      const url = `/api/v2/delivery-referrals/${referralId}/outcome`;
      const response = await api.post(url, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  recordOutcomeBySubCentre: async (referralId, data) => {
    try {
      const url = `/api/v2/delivery-referrals/${referralId}/outcome-by-subcentre`;
      const response = await api.post(url, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
export const ecgReportAPI = {
  getAll: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.result) queryParams.append('result', params.result);
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
      const url = `/api/v2/ecg-reports/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  getById: async ecgId => {
    try {
      const response = await api.get(`/api/v2/ecg-reports/${ecgId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  create: async data => {
    try {
      const formData = new FormData();
      formData.append('pregnant_woman_id', String(data.pregnant_woman_id));
      formData.append('ecg_date', data.ecg_date);
      formData.append('result', data.result);
      if (data.notes) formData.append('notes', data.notes);
      if (data.report_file) formData.append('report_file', data.report_file);
      const response = await api.post('/api/v2/ecg-reports/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
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
    const url = `/api/v2/reports/district/performance${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
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
    const url = `/api/v2/reports/district/export/${format}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url, {
      responseType: 'arraybuffer'
    });
    return response.data;
  },
  getBlockWiseTrends: async (year = 2026) => {
    const response = await api.get(`/api/v2/dashboard/analytics/block-wise-trends?year=${year}`);
    return response.data;
  },
  getWardWiseTrends: async (blockId, year = 2026) => {
    const response = await api.get(`/api/v2/dashboard/analytics/ward-wise-trends?block_id=${blockId}&year=${year}`);
    return response.data;
  },
  getBlockWardWiseReport: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.ward_id) queryParams.append('ward_id', params.ward_id);
    const url = `/api/v2/reports/block/ward-wise${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },
  exportBlockReport: async (format, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const url = `/api/v2/reports/block/export/${format}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url, {
      responseType: 'arraybuffer'
    });
    return response.data;
  },
  getDeliverySummary: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.block_id) queryParams.append('block_id', params.block_id);
    if (params.district_id) queryParams.append('district_id', params.district_id);
    if (params.dp_id) queryParams.append('dp_id', params.dp_id);
    const url = `/api/v2/reports/delivery/summary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
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
    const url = `/api/v2/reports/delivery/outcome-breakdown${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
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
    const url = `/api/v2/reports/delivery/point-performance${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  }
};
export default api;

