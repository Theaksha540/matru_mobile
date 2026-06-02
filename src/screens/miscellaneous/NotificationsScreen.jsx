import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Check } from 'lucide-react-native';
import { useNotifications } from '../../contexts/NotificationContext';
import { secureStorage } from '../../utils/secureStorage';
import { pregnantWomenAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
import { useTranslation } from 'react-i18next';
const NotificationsScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const {
    unreadCount,
    notifications,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const allowedRoutes = new Set(['DistrictDashboard', 'DPDashboard', 'BlockDashboard', 'SubCentreDashboard', 'USGDashboard', 'MotherDashboard', 'PatientList', 'PendingApproval', 'PendingApprovalDetail', 'AppointmentDetail', 'USGAppointmentsList', 'AllReports', 'CompletedReports', 'DistrictReports', 'BlockReports', 'PerformanceTrends', 'HighRiskCases', 'GrievanceHandling', 'GrievanceDetail', 'ANCTracking', 'ANCTrackingBlock', 'RegisterPregnancy', 'DeliveryReferrals', 'PendingReferrals', 'ReferralDetail', 'ReReferredCases']);
  useEffect(() => {
    loadNotifications();
  }, [filter]);
  const loadNotifications = async () => {
    try {
      const params = filter === 'unread' ? {
        is_read: false
      } : {};
      await fetchNotifications(params);
    } catch (error) {} finally {
      setRefreshing(false);
    }
  };
  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
    fetchUnreadCount();
  };
  const handleMarkAsRead = async id => {
    await markAsRead(id);
    loadNotifications();
    fetchUnreadCount();
  };
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    loadNotifications();
    fetchUnreadCount();
  };
  const toNumber = value => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const parseObjectIfJson = value => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  };
  const pickNumberFromObject = (obj, keys = []) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
      const direct = toNumber(obj?.[key]);
      if (direct !== null) return direct;
    }
    return null;
  };
  const normalizeMobile = value => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return null;
  };
  const findMobileInObject = (obj, depth = 0) => {
    if (!obj || typeof obj !== 'object' || depth > 4) return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const nested = findMobileInObject(item, depth + 1);
        if (nested) return nested;
      }
      return null;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' || typeof value === 'number') {
        if (/mobile|phone|contact/i.test(key)) {
          const normalized = normalizeMobile(value);
          if (normalized) return normalized;
        }
      }
      if (typeof value === 'object') {
        const nested = findMobileInObject(value, depth + 1);
        if (nested) return nested;
      }
    }
    return null;
  };
  const extractMobileFromText = text => {
    const raw = String(text || '');
    const segments = raw.match(/[\d+\-\s()]{10,}/g) || [];
    for (const segment of segments) {
      const normalized = normalizeMobile(segment);
      if (normalized) return normalized;
    }
    const compact = normalizeMobile(raw);
    return compact || null;
  };
  const extractPatientNameFromMessage = message => {
    if (!message) return null;

    // Pattern: "NAME has been marked as high-risk"
    const pattern1 = /^([A-Z\s]+)\s+has been marked as high-risk/i;
    const match1 = message.match(pattern1);
    if (match1 && match1[1]) {
      return match1[1].trim();
    }

    // Pattern: "Patient NAME needs attention"
    const pattern2 = /Patient\s+([A-Z\s]+)\s+needs/i;
    const match2 = message.match(pattern2);
    if (match2 && match2[1]) {
      return match2[1].trim();
    }

    // Pattern: "Check patient NAME"
    const pattern3 = /Check patient\s+([A-Z\s]+)/i;
    const match3 = message.match(pattern3);
    if (match3 && match3[1]) {
      return match3[1].trim();
    }
    return null;
  };
  const resolvePendingApprovalPatientId = async (notification, candidateId = null) => {
    try {
      const data = await syncService.getPendingApprovals();
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      if (!list.length) {
        return {
          patientId: null,
          matched: false
        };
      }
      const payload = parseObjectIfJson(notification?.payload) || parseObjectIfJson(notification?.metadata) || parseObjectIfJson(notification?.data) || null;
      const normalizedCandidateId = toNumber(candidateId);
      if (normalizedCandidateId !== null) {
        const directMatch = list.find(item => toNumber(item?.id) === normalizedCandidateId);
        if (directMatch?.id) {
          return {
            patientId: directMatch.id,
            matched: true
          };
        }
        const alternateMatch = list.find(item => {
          const possibleIds = [item?.pregnant_woman_id, item?.patient_id, item?.beneficiary_id, item?.reference_id, item?.entity_id].map(toNumber).filter(value => value !== null);
          return possibleIds.includes(normalizedCandidateId);
        });
        if (alternateMatch?.id) {
          return {
            patientId: alternateMatch.id,
            matched: true
          };
        }
      }
      const mobileHint = normalizeMobile(notification?.mobile_number || notification?.patient_mobile || notification?.beneficiary_mobile || payload?.mobile_number || payload?.patient_mobile || payload?.beneficiary_mobile || payload?.phone || payload?.contact_number || findMobileInObject(payload) || extractMobileFromText(notification?.title) || extractMobileFromText(notification?.message));
      if (mobileHint) {
        const mobileMatch = list.find(item => normalizeMobile(item?.mobile_number) === mobileHint);
        if (mobileMatch?.id) {
          return {
            patientId: mobileMatch.id,
            matched: true
          };
        }
      }
      const nameHint = String(notification?.full_name || notification?.patient_name || payload?.full_name || payload?.patient_name || '').trim().toLowerCase();
      if (nameHint) {
        const nameMatch = list.find(item => String(item?.full_name || '').trim().toLowerCase() === nameHint);
        if (nameMatch?.id) {
          return {
            patientId: nameMatch.id,
            matched: true
          };
        }
      }
      return {
        patientId: null,
        matched: false
      };
    } catch (error) {
      return {
        patientId: null,
        matched: false
      };
    }
  };
  const resolveReferralIdFromNotification = async (notification, candidateId = null) => {
    try {
      const data = await syncService.getDeliveryReferrals();
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const payload = parseObjectIfJson(notification?.payload) || parseObjectIfJson(notification?.metadata) || parseObjectIfJson(notification?.data) || null;
      const normalizedCandidateId = toNumber(candidateId);
      if (!list.length) {
        return {
          referralId: null,
          matched: false
        };
      }
      if (normalizedCandidateId !== null) {
        const directMatch = list.find(item => toNumber(item?.id) === normalizedCandidateId);
        if (directMatch?.id) {
          return {
            referralId: directMatch.id,
            matched: true
          };
        }
        const alternateMatch = list.find(item => {
          const possibleIds = [item?.reference_id, item?.delivery_referral_id, item?.referral_id, item?.previous_referral_id, item?.pregnant_woman_id, item?.patient_id].map(toNumber).filter(value => value !== null);
          return possibleIds.includes(normalizedCandidateId);
        });
        if (alternateMatch?.id) {
          return {
            referralId: alternateMatch.id,
            matched: true
          };
        }
        const chainMatch = list.find(item => {
          const chain = Array.isArray(item?.referral_chain) ? item.referral_chain : [];
          return chain.some(step => {
            const chainIds = [step?.referral_id, step?.previous_referral_id, step?.reference_id].map(toNumber).filter(value => value !== null);
            return chainIds.includes(normalizedCandidateId);
          });
        });
        if (chainMatch?.id) {
          return {
            referralId: chainMatch.id,
            matched: true
          };
        }
      }
      const mobileHint = normalizeMobile(notification?.mobile_number || notification?.patient_mobile || notification?.beneficiary_mobile || payload?.mobile_number || payload?.patient_mobile || payload?.beneficiary_mobile || payload?.phone || payload?.contact_number || findMobileInObject(payload) || extractMobileFromText(notification?.title) || extractMobileFromText(notification?.message));
      if (mobileHint) {
        const mobileMatch = list.find(item => {
          const referralMobile = normalizeMobile(item?.mobile_number || item?.patient_mobile || item?.beneficiary_mobile || item?.pregnant_woman_mobile);
          return referralMobile === mobileHint;
        });
        if (mobileMatch?.id) {
          return {
            referralId: mobileMatch.id,
            matched: true
          };
        }
      }
      const nameHint = String(notification?.full_name || notification?.patient_name || payload?.full_name || payload?.patient_name || '').trim().toLowerCase();
      if (nameHint) {
        const nameMatch = list.find(item => [item?.full_name, item?.patient_name, item?.pregnant_woman_name, item?.beneficiary_name].filter(Boolean).map(value => String(value).trim().toLowerCase()).includes(nameHint));
        if (nameMatch?.id) {
          return {
            referralId: nameMatch.id,
            matched: true
          };
        }
      }
      return {
        referralId: null,
        matched: false
      };
    } catch (error) {
      return {
        referralId: null,
        matched: false
      };
    }
  };
  const getDashboardRouteByRole = async () => {
    const userInfo = await secureStorage.getItem('user_info');
    const roleNavigation = {
      district: 'DistrictDashboard',
      dp: 'DPDashboard',
      block: 'BlockDashboard',
      sub_centre: 'SubCentreDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    return roleNavigation[userInfo?.role] || 'DistrictDashboard';
  };
  const extractAppointmentIdFromActionUrl = actionUrl => {
    if (!actionUrl || typeof actionUrl !== 'string') return null;

    // Match patterns like /usg-appointments/96 or /appointments/96
    const match = actionUrl.match(/\/(?:usg-)?appointments?\/([0-9]+)/i);
    if (match && match[1]) {
      const id = toNumber(match[1]);
      return id !== null ? id : null;
    }
    return null;
  };
  const extractReferralIdFromActionUrl = actionUrl => {
    if (!actionUrl || typeof actionUrl !== 'string') return null;

    // Match patterns like /delivery-referrals/48 or /referrals/48
    const match = actionUrl.match(/\/(?:delivery-)?referrals?\/([0-9]+)/i);
    if (match && match[1]) {
      const id = toNumber(match[1]);
      return id !== null ? id : null;
    }
    return null;
  };
  const extractReferralIdFromExtraData = notification => {
    const payload = parseObjectIfJson(notification?.payload) || parseObjectIfJson(notification?.metadata) || parseObjectIfJson(notification?.data) || parseObjectIfJson(notification?.extra_data) || null;
    if (!payload) return null;

    // Try to find referral_id in extra_data/payload
    const referralId = pickNumberFromObject(payload, ['referral_id', 'delivery_referral_id', 'deliveryReferralId']);
    return referralId;
  };
  const resolveNotificationNavigation = (notification, userRole = null) => {
    const notificationText = [notification?.category, notification?.type, notification?.title, notification?.message, notification?.module, notification?.notification_type, notification?.reference_type, notification?.entity_type].filter(Boolean).join(' ').toLowerCase();
    const directAppointmentId = toNumber(notification?.appointment_id) ?? toNumber(notification?.usg_appointment_id);

    // Extract appointment ID from action_url
    const actionUrlAppointmentId = extractAppointmentIdFromActionUrl(notification?.action_url);

    // Enhanced grievance ID extraction
    const grievanceId = toNumber(notification?.grievance_id) ?? toNumber(notification?.ticket_id) ?? toNumber(notification?.complaint_id) ?? pickNumberFromObject(payload, ['grievance_id', 'ticket_id', 'complaint_id', 'id']);

    // Extract referral ID from action_url if available
    const actionUrlReferralId = extractReferralIdFromActionUrl(notification?.action_url);

    // Extract referral ID from extra_data if available
    const extraDataReferralId = extractReferralIdFromExtraData(notification);
    const referralId = toNumber(notification?.delivery_referral_id) ?? toNumber(notification?.referral_id) ?? toNumber(notification?.deliveryReferralId) ?? toNumber(notification?.referral?.id) ?? extraDataReferralId ?? actionUrlReferralId;
    const referenceId = toNumber(notification?.reference_id);
    const referralReferenceId = referralId ?? pickNumberFromObject(payload, ['referral_id', 'delivery_referral_id']);
    const payload = parseObjectIfJson(notification?.payload) || parseObjectIfJson(notification?.metadata) || parseObjectIfJson(notification?.data) || null;
    const payloadPatientId = pickNumberFromObject(payload, ['patient_id', 'pregnant_woman_id', 'beneficiary_id', 'id', 'reference_id', 'entity_id']);
    const patientId = toNumber(notification?.pregnant_woman_id) ?? toNumber(notification?.patient_id) ?? toNumber(notification?.beneficiary_id) ?? toNumber(notification?.entity_id) ?? toNumber(notification?.subject_id) ?? toNumber(notification?.target_id) ?? toNumber(notification?.pregnant_woman?.id) ?? toNumber(notification?.patient?.id) ?? payloadPatientId;
    const explicitRoute = notification?.screen_name || notification?.screen || notification?.route || notification?.target_screen;
    const category = String(notification?.category || '').toLowerCase();
    const type = String(notification?.type || '').toLowerCase();
    const appointmentCategories = new Set(['appointment', 'usg_appointment', 'appointment_status', 'appointment_update', 'usg_appointment_status']);
    const isAppointmentSignal = appointmentCategories.has(category) || appointmentCategories.has(type) || /appointment|usg|scan|reschedule/.test(notificationText);
    const notificationSearchHint = String(notification?.mobile_number || notification?.patient_mobile || notification?.beneficiary_mobile || notification?.full_name || notification?.patient_name || '').trim();
    const patientSearchHintRaw = String(notification?.mobile_number || notification?.patient_mobile || notification?.beneficiary_mobile || payload?.mobile_number || payload?.patient_mobile || payload?.beneficiary_mobile || payload?.phone || payload?.contact_number || findMobileInObject(payload) || extractMobileFromText(notificationText) || extractMobileFromText(notification?.title) || extractMobileFromText(notification?.message) || '').trim();
    const patientSearchHint = normalizeMobile(patientSearchHintRaw) || '';
    const referralMobileFilter = patientSearchHint || undefined;
    const referralSearchHint = String(patientSearchHint || notification?.mobile_number || notification?.patient_mobile || notification?.beneficiary_mobile || notification?.patient_name || notification?.full_name || payload?.mobile_number || payload?.patient_mobile || payload?.beneficiary_mobile || payload?.patient_name || payload?.full_name || '').trim();
    const isScheduledAppointmentSignal = /scheduled|schedule|booking request|new booking|new appointment|appointment booked|appointment scheduled/.test(notificationText) || category === 'scheduled' || type === 'scheduled' || category === 'appointment_scheduled' || type === 'appointment_scheduled';
    const appointmentId = actionUrlAppointmentId ??
    // Priority 1: Extract from action_url
    directAppointmentId ?? (
    // Priority 2: Direct appointment_id field
    isAppointmentSignal ? toNumber(notification?.reference_id) : null); // Priority 3: reference_id if appointment signal
    const isGrievanceSignal = grievanceId !== null || /grievance|complaint|ticket|issue|problem|feedback/.test(notificationText) || category === 'grievance' || type === 'grievance' || notification?.module === 'grievance' || notification?.entity_type === 'grievance';
    const isApprovalSignal = /approval|approve|register|registration|beneficiar|pregnan/.test(notificationText);
    const isPendingApprovalSignal = /(pending|awaiting).*(approval|approve|registration|register)/.test(notificationText) || /(approval|approve|registration|register).*(pending|awaiting)/.test(notificationText);
    const isApprovedSignal = /(approved|approval completed|registration approved|successfully approved)/.test(notificationText);
    const isNotApprovedSignal = /(not approved|unapproved|approval failed|approval rejected|rejected)/.test(notificationText);
    const approvalPatientId = patientId ?? referenceId;
    const isANCSignal = /anc|antenatal|visit/.test(notificationText);
    const isHighRiskSignal = /high[_\s-]?risk/.test(notificationText) || notification?.notification_type === 'high_risk_alert' || notification?.notification_type === 'high_risk' || category === 'high_risk' || type === 'high_risk' || /high.risk.alert|high.risk.case|high.risk.identified/.test(notificationText);
    const isReportSignal = /report|result|scan report/.test(notificationText);
    const isReferralOutcomeSignal = /outcome|recorded outcome|delivery outcome|outcome recorded|maternal outcome|newborn outcome/.test(notificationText) || /outcome/.test(category) || /outcome/.test(type);
    const hasReferralField = referralId !== null || pickNumberFromObject(payload, ['referral_id', 'delivery_referral_id']) !== null || Boolean(notification?.referral) || isReferralOutcomeSignal || /referral|delivery_referral|re_referr/.test([notification?.category, notification?.type, notification?.module, notification?.notification_type, notification?.reference_type, notification?.entity_type].filter(Boolean).join(' ').toLowerCase());
    const isReferralSignal = hasReferralField || /referral|re-referral|re referred|re_referred|delivery referral|delivery outcome|recorded outcome|outcome recorded/.test(notificationText);
    const isPendingReferralSignal = /pending referral|referral pending|awaiting referral|new referral/.test(notificationText);
    const isReReferredSignal = /re-referral|re referred|re_referred|re-referred/.test(notificationText);
    if (isReferralSignal) {
      // Priority order: explicit referral ID > extra_data ID > action_url ID > reference_id
      const directReferralId = referralReferenceId ?? extraDataReferralId ?? actionUrlReferralId ?? (hasReferralField ? referenceId : null);
      if (directReferralId !== null) {
        return {
          route: 'ReferralDetail',
          params: {
            referralId: directReferralId
          }
        };
      }
      if (isReReferredSignal) {
        return {
          route: 'ReReferredCases',
          params: {
            referenceId: referenceId || undefined,
            mobileNumber: referralMobileFilter,
            initialSearchQuery: referralSearchHint || undefined
          }
        };
      }
      if (isPendingReferralSignal) {
        return {
          route: 'PendingReferrals',
          params: {
            referenceId: referenceId || undefined,
            mobileNumber: referralMobileFilter,
            initialSearchQuery: referralSearchHint || undefined
          }
        };
      }
      return {
        route: 'DeliveryReferrals',
        params: {
          referenceId: referenceId || undefined,
          mobileNumber: referralMobileFilter,
          initialSearchQuery: referralSearchHint || undefined
        }
      };
    }
    if (isGrievanceSignal) {
      // Try to get grievance ID from multiple sources
      const resolvedGrievanceId = grievanceId ?? (category === 'grievance' || type === 'grievance' ? referenceId : null);
      return resolvedGrievanceId ? {
        route: 'GrievanceDetail',
        params: {
          grievanceId: resolvedGrievanceId
        }
      } : {
        route: 'GrievanceHandling',
        params: {}
      };
    }

    // Check high-risk BEFORE approval to avoid false matches
    if (isHighRiskSignal) {
      // Extract patient information for filtering
      const highRiskPatientId = patientId ?? referenceId;

      // Extract patient name from extra_data or other fields
      const extraData = parseObjectIfJson(notification?.extra_data) || {};
      const patientNameFromExtra = extraData?.pregnant_woman_name || extraData?.patient_name || extraData?.full_name || extraData?.name;

      // Extract patient name from message as fallback
      const patientNameFromMessage = extractPatientNameFromMessage(notification?.message);
      const highRiskMobile = normalizeMobile(notification?.mobile_number || notification?.patient_mobile || notification?.beneficiary_mobile || payload?.mobile_number || payload?.patient_mobile || payload?.beneficiary_mobile || payload?.phone || payload?.contact_number || extraData?.mobile_number || extraData?.phone || findMobileInObject(payload) || findMobileInObject(extraData) || extractMobileFromText(notification?.title) || extractMobileFromText(notification?.message));
      const highRiskSearchHint = String(highRiskMobile || patientNameFromExtra || patientNameFromMessage || notification?.full_name || notification?.patient_name || payload?.full_name || payload?.patient_name || '').trim();
      return {
        route: 'HighRiskCases',
        params: {
          patientId: highRiskPatientId || undefined,
          initialSearchQuery: highRiskSearchHint || undefined,
          fromNotification: true
        }
      };
    }
    if (isApprovalSignal && isPendingApprovalSignal) {
      return approvalPatientId ? {
        route: 'PendingApprovalDetail',
        params: {
          patientId: approvalPatientId
        }
      } : {
        route: 'PendingApproval',
        params: {}
      };
    }
    if (isApprovalSignal && isNotApprovedSignal) {
      return approvalPatientId ? {
        route: 'PendingApprovalDetail',
        params: {
          patientId: approvalPatientId
        }
      } : {
        route: 'PendingApproval',
        params: {}
      };
    }
    if (isApprovalSignal && isApprovedSignal) {
      const approvedPatientId = patientId ?? referenceId;
      return approvedPatientId ? {
        route: 'ANCTracking',
        params: {
          patientId: approvedPatientId
        }
      } : {
        route: 'ANCTracking',
        params: {}
      };
    }

    // If approval + ANC visit appears together, prefer ANC tracking as the next actionable module.
    if (isApprovalSignal && isANCSignal) {
      const ancPatientId = patientId ?? referenceId;
      return {
        route: 'PatientList',
        params: {
          mode: 'anc',
          initialSearchQuery: patientSearchHint || undefined,
          patientIdForSearch: ancPatientId || undefined
        }
      };
    }
    if (isApprovalSignal) {
      return approvalPatientId ? {
        route: 'PendingApprovalDetail',
        params: {
          patientId: approvalPatientId
        }
      } : {
        route: 'PendingApproval',
        params: {}
      };
    }
    if (isANCSignal) {
      const ancPatientId = patientId ?? referenceId;
      return {
        route: 'PatientList',
        params: {
          mode: 'anc',
          initialSearchQuery: patientSearchHint || undefined,
          patientIdForSearch: ancPatientId || undefined
        }
      };
    }
    if (isReportSignal) {
      return {
        route: 'AllReports',
        params: {}
      };
    }
    if (isAppointmentSignal) {
      // When the backend gives a direct appointment action URL, honor it first.
      if (actionUrlAppointmentId !== null) {
        return {
          route: 'AppointmentDetail',
          params: {
            appointmentId: actionUrlAppointmentId
          }
        };
      }

      // For USG centre users
      if (userRole === 'usg_centre') {
        // Use the appointmentId extracted from action_url or other sources
        const usgAppointmentId = appointmentId;

        // Extract patient name from extra_data for search
        const extraData = parseObjectIfJson(notification?.extra_data) || {};
        const patientNameFromExtra = extraData?.pregnant_woman_name || extraData?.patient_name || extraData?.full_name || extraData?.name;

        // Build search query from patient name or mobile
        const usgSearchQuery = String(patientNameFromExtra || notificationSearchHint || '').trim();

        // Route to USG Dashboard with booking filter

        return {
          route: 'USGDashboard',
          params: {
            bookingAppointmentId: usgAppointmentId || undefined,
            bookingSearchQuery: usgSearchQuery || undefined,
            fromNotification: true
          }
        };
      }

      // For non-USG centre users (sub_centre, block, district)
      // Extract patient information from extra_data or notification fields
      const extraData = parseObjectIfJson(notification?.extra_data) || {};
      const patientNameFromExtra = extraData?.pregnant_woman_name || extraData?.patient_name || extraData?.full_name || extraData?.name;

      // Try to get patient ID (only if reference_type is pregnant_woman)
      const appointmentPatientId = notification?.reference_type === 'pregnant_woman' ? referenceId : notification?.pregnant_woman_id ?? notification?.patient_id;

      // Build search hint from available data
      const appointmentSearchHint = String(patientSearchHint || patientNameFromExtra || notification?.full_name || notification?.patient_name || payload?.full_name || payload?.patient_name || '').trim();
      if (appointmentPatientId) {
        return {
          route: 'ANCTracking',
          params: {
            patientId: appointmentPatientId
          }
        };
      }

      // If no patient ID but have search hint, go to patient list
      if (appointmentSearchHint) {
        return {
          route: 'PatientList',
          params: {
            mode: 'anc',
            initialSearchQuery: appointmentSearchHint
          }
        };
      }

      // Fallback to ANC Tracking without patient ID

      return {
        route: 'ANCTracking',
        params: {}
      };
    }
    if (explicitRoute && allowedRoutes.has(explicitRoute)) {
      const params = {};
      if (explicitRoute === 'AppointmentDetail') {
        if (!appointmentId) return null;
        params.appointmentId = appointmentId;
      }
      if (explicitRoute === 'GrievanceDetail' && grievanceId) params.grievanceId = grievanceId;
      if (explicitRoute === 'PendingApprovalDetail' && approvalPatientId) params.patientId = approvalPatientId;
      if (explicitRoute === 'ANCTracking') {
        const ancExplicitId = patientId ?? referenceId;
        if (ancExplicitId) params.patientId = ancExplicitId;
      }
      return {
        route: explicitRoute,
        params
      };
    }
    return null;
  };
  const handleNotificationPress = async notification => {
    try {
      if (!notification?.is_read) {
        await markAsRead(notification.id);
      }
      const userInfo = await secureStorage.getItem('user_info');
      const target = resolveNotificationNavigation(notification, userInfo?.role);
      if (target?.route === 'PendingApprovalDetail') {
        const resolution = await resolvePendingApprovalPatientId(notification, target?.params?.patientId);
        if (resolution?.matched && resolution?.patientId) {
          target.params = {
            ...(target.params || {}),
            patientId: resolution.patientId
          };
        } else {
          target.route = 'PendingApproval';
          target.params = {};
        }
      }
      if (target?.route === 'ReferralDetail' || target?.route === 'DeliveryReferrals' || target?.route === 'PendingReferrals' || target?.route === 'ReReferredCases') {
        const resolution = await resolveReferralIdFromNotification(notification, target?.params?.referralId ?? notification?.delivery_referral_id ?? notification?.referral_id ?? notification?.reference_id);
        if (resolution?.matched && resolution?.referralId) {
          target.route = 'ReferralDetail';
          target.params = {
            referralId: resolution.referralId
          };
        } else {
          const payload = parseObjectIfJson(notification?.payload) || parseObjectIfJson(notification?.metadata) || parseObjectIfJson(notification?.data) || null;
          const fallbackSearchHint = String(notification?.patient_name || notification?.full_name || payload?.patient_name || payload?.full_name || '').trim();
          const fallbackReferenceId = String(notification?.delivery_referral_id ?? notification?.referral_id ?? notification?.reference_id ?? '').trim();
          target.route = 'DeliveryReferrals';
          target.params = {
            ...(fallbackSearchHint ? {
              initialSearchQuery: fallbackSearchHint
            } : {}),
            ...(fallbackReferenceId ? {
              referenceId: fallbackReferenceId
            } : {})
          };
        }
      }
      if (target?.route === 'PatientList' && target?.params?.mode === 'anc' && !target?.params?.initialSearchQuery && target?.params?.patientIdForSearch) {
        try {
          let fallbackMobile = '';
          const lookupPatientId = target.params.patientIdForSearch;
          try {
            const patientData = await pregnantWomenAPI.getById(lookupPatientId);
            fallbackMobile = normalizeMobile(patientData?.mobile_number) || '';
          } catch (apiLookupError) {}
          if (!fallbackMobile) {
            const offlinePatient = await syncService.getPatientById(lookupPatientId);
            fallbackMobile = normalizeMobile(offlinePatient?.mobile_number) || '';
          }
          if (!fallbackMobile) {
            const cachedPatients = await syncService.getPatients();
            const patientItems = Array.isArray(cachedPatients) ? cachedPatients : cachedPatients?.items || [];
            const matchedPatient = patientItems.find(p => Number(p?.id) === Number(lookupPatientId));
            fallbackMobile = normalizeMobile(matchedPatient?.mobile_number) || '';
          }
          if (fallbackMobile) {
            target.params.initialSearchQuery = fallbackMobile;
          } else {}
        } catch (fallbackError) {}
      }
      if (target?.route) {
        navigation.navigate(target.route, target.params || {});
        return;
      }
      const fallbackRoute = await getDashboardRouteByRole();
      navigation.navigate(fallbackRoute);
    } catch (error) {}
  };
  const getPriorityColor = priority => {
    switch (priority) {
      case 'urgent':
        return '#dc2626';
      case 'high':
        return '#f59e0b';
      case 'normal':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };
  const formatTime = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return t('minutesAgo', {
      count: minutes
    });
    if (hours < 24) return t('hoursAgo', {
      count: hours
    });
    return t('daysAgo', {
      count: days
    });
  };
  const getScopeText = notification => {
    const parts = [];
    if (notification.target_role || notification.role) {
      parts.push(`${t('role')}: ${notification.target_role || notification.role}`);
    }
    if (notification.block_name || notification.block_id) {
      parts.push(`${t('block')}: ${notification.block_name || notification.block_id}`);
    }
    if (notification.sub_centre_name || notification.sub_centre_id) {
      parts.push(`${t('subCentre')}: ${notification.sub_centre_name || notification.sub_centre_id}`);
    }
    if (notification.usg_centre_name || notification.usg_centre_id) {
      parts.push(`${t('usgCentre')}: ${notification.usg_centre_name || notification.usg_centre_id}`);
    }
    return parts.join(' • ');
  };
  return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications')}</Text>
        {unreadCount > 0 && <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Check size={20} color="white" />
          </TouchableOpacity>}
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>{t('all')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]} onPress={() => setFilter('unread')}>
          <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
            {t('unread')} ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {notifications.length === 0 ? <View style={styles.emptyState}>
            <Bell size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>{t('noNotifications')}</Text>
          </View> : notifications.map(notification => <TouchableOpacity key={notification.id} style={[styles.notificationCard, !notification.is_read && styles.unreadCard]} onPress={() => handleNotificationPress(notification)}>
              <View style={[styles.priorityIndicator, {
          backgroundColor: getPriorityColor(notification.priority)
        }]} />
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                {!!getScopeText(notification) && <Text style={styles.notificationScope}>{getScopeText(notification)}</Text>}
                <Text style={styles.notificationTime}>{formatTime(notification.created_at)}</Text>
              </View>
              {!notification.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>)}
      </ScrollView>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    marginRight: 12
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white'
  },
  markAllButton: {
    padding: 8
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'white'
  },
  filterButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center'
  },
  filterButtonActive: {
    backgroundColor: '#8B4513'
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280'
  },
  filterTextActive: {
    color: 'white'
  },
  content: {
    flex: 1,
    padding: 12
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  unreadCard: {
    backgroundColor: '#eff6ff'
  },
  priorityIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12
  },
  notificationContent: {
    flex: 1
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4
  },
  notificationMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4
  },
  notificationScope: {
    fontSize: 11,
    color: '#8B4513',
    marginBottom: 4,
    fontWeight: '500'
  },
  notificationTime: {
    fontSize: 11,
    color: '#9ca3af'
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginLeft: 8
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12
  }
});
export default NotificationsScreen;
