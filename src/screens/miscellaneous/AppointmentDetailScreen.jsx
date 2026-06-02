import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, User, Phone, MapPin, Upload, CheckCircle, Eye, Clock, Home, Activity } from 'lucide-react-native';
import { Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import DateTimePicker from '@react-native-community/datetimepicker';
import { secureStorage } from '../../utils/secureStorage';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usgAppointmentAPI, pregnantWomenAPI } from '../../services/api';
import { syncService } from '../../utils/syncService';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import '../../i18n';
const AppointmentDetailScreen = ({
  route,
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const {
    appointmentId
  } = route.params;
  const [appointment, setAppointment] = useState(null);
  const [patient, setPatient] = useState(null);
  const [ancVisits, setAncVisits] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cachedFiles, setCachedFiles] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [rescheduleTime, setRescheduleTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
  const logFileDebug = (...args) => {};
  const normalizeAncVisits = (visits, currentPatientId) => {
    if (!Array.isArray(visits)) {
      return [];
    }
    return visits.reduce((dedupedVisits, visit) => {
      const dedupeKey = [String(visit?.pregnant_woman_id || currentPatientId || ''), String(visit?.visit_number || ''), String(visit?.visit_date || ''), String(visit?.id || '')].join('_');
      const looseDedupeKey = [String(visit?.pregnant_woman_id || currentPatientId || ''), String(visit?.visit_number || ''), String(visit?.visit_date || '')].join('_');
      if (!dedupedVisits.some(existingVisit => existingVisit._dedupeKey === dedupeKey || existingVisit._looseDedupeKey === looseDedupeKey)) {
        dedupedVisits.push({
          ...visit,
          _dedupeKey: dedupeKey,
          _looseDedupeKey: looseDedupeKey
        });
      }
      return dedupedVisits;
    }, []).sort((firstVisit, secondVisit) => (firstVisit?.visit_number || 0) - (secondVisit?.visit_number || 0)).map(({
      _dedupeKey,
      _looseDedupeKey,
      ...visit
    }) => visit);
  };
  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };
  const handleCallPatient = () => {
    const phoneNumber = patient?.mobile_number;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert(t('noPhoneNumber'), t('phoneNumberUnavailableForPatient'));
    }
  };
  useEffect(() => {
    checkAccess();
    loadAppointmentDetails();
  }, [appointmentId]);
  useEffect(() => {
    checkCachedFiles();
  }, [appointmentId, appointment?.report_file_url, appointment?.report_file_urls, appointment?.prescription_file_url, appointment?.prescription_file_urls]);
  useFocusEffect(useCallback(() => {
    loadAppointmentDetails();
    checkCachedFiles();
  }, [appointmentId, isOnline]));
  const checkAccess = async () => {
    const storedUserInfo = await secureStorage.getItem('user_info');
    if (storedUserInfo?.role !== 'sub_centre' && storedUserInfo?.role !== 'usg_centre') {
      Alert.alert(t('accessDenied'), t('appointmentDetailAccessDenied'));
      navigation.goBack();
    }
  };
  const loadAppointmentDetails = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
      if (isOnline) {
        const aptData = await usgAppointmentAPI.getById(appointmentId);
        setAppointment(aptData);
        const patientData = await pregnantWomenAPI.getById(aptData.pregnant_woman_id);
        setPatient(patientData);
        const visitData = await syncService.getANCVisits(aptData.pregnant_woman_id);
        setAncVisits(normalizeAncVisits(visitData, aptData.pregnant_woman_id));
      } else {
        await loadFromOfflineDB();
      }
    } catch (error) {
      await loadFromOfflineDB();
    } finally {
      setLoading(false);
    }
  };
  const loadFromOfflineDB = async () => {
    try {
      const aptData = await syncService.getAppointmentById(appointmentId);
      if (aptData) {
        setAppointment(aptData);
        const patientData = await syncService.getPatientById(aptData.pregnant_woman_id);
        if (patientData) {
          setPatient(patientData);
        }
        const visitData = await syncService.getANCVisits(aptData.pregnant_woman_id);
        setAncVisits(normalizeAncVisits(visitData, aptData.pregnant_woman_id));
      } else {
        Alert.alert(t('error'), t('appointmentDetailsUnavailableOffline'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadAppointmentDetails'));
    }
  };
  const refreshDetails = async () => {
    setLoading(true);
    await loadAppointmentDetails();
  };
  const formatDate = dateString => formatDateTimeDDMMYYYY(dateString);
  const isSameCalendarDay = (firstDate, secondDate) => firstDate.getFullYear() === secondDate.getFullYear() && firstDate.getMonth() === secondDate.getMonth() && firstDate.getDate() === secondDate.getDate();
  const buildRescheduleDateTime = (date, time) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes(), 0, 0);
  const formatDisplayValue = value => {
    if (!value) return '';
    return String(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };
  const formatAppointmentStatus = status => {
    const normalized = String(status || '').trim().toLowerCase();
    const statusMap = {
      scheduled: t('scheduled'),
      accepted: t('accepted'),
      completed: t('completed'),
      rescheduled: t('rescheduled'),
      cancelled: t('cancelled'),
      rejected: t('rejected'),
      pending: t('pending'),
      no_show: t('noShow')
    };
    return statusMap[normalized] || formatDisplayValue(status) || t('notAvailable');
  };
  const getRequestedByDisplayName = appointmentData => {
    const candidates = [appointmentData?.requested_by_name, appointmentData?.requested_by_user_name, appointmentData?.requested_by_full_name, appointmentData?.created_by_name, appointmentData?.scheduled_by_name, appointmentData?.sub_centre_user_name, appointmentData?.anm_name, appointmentData?.requested_by];
    for (const value of candidates) {
      const normalized = String(value || '').trim();
      if (normalized && normalized.toLowerCase() !== 'null' && normalized.toLowerCase() !== 'undefined') {
        return normalized;
      }
    }
    return t('anm');
  };
  const getFileExtensionFromUrl = fileUrl => {
    if (!fileUrl) return 'pdf';
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match?.[1]?.toLowerCase();
    return supportedExtensions.includes(ext) ? ext : 'pdf';
  };
  const hasExplicitSupportedExtension = fileUrl => {
    if (!fileUrl) return false;
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match?.[1]?.toLowerCase();
    return supportedExtensions.includes(ext);
  };
  const getMimeTypeFromExtension = extension => {
    const normalized = String(extension || '').toLowerCase();
    if (normalized === 'pdf') return 'application/pdf';
    if (normalized === 'png') return 'image/png';
    if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
    return 'application/octet-stream';
  };
  const getMimeTypeFromPath = path => {
    if (!path) return 'application/pdf';
    const ext = String(path).split('.').pop()?.toLowerCase();
    return getMimeTypeFromExtension(ext);
  };
  const getPrescriptionUrls = appointmentData => {
    const multipleUrls = Array.isArray(appointmentData?.prescription_file_urls) ? appointmentData.prescription_file_urls.filter(Boolean) : [];
    if (multipleUrls.length > 1) {
      return multipleUrls;
    }
    if (appointmentData?.prescription_file_url) {
      return [appointmentData.prescription_file_url];
    }
    return multipleUrls;
  };
  const getReportUrls = appointmentData => {
    const multipleUrls = Array.isArray(appointmentData?.report_file_urls) ? appointmentData.report_file_urls.filter(Boolean) : [];
    if (multipleUrls.length > 1) {
      return multipleUrls;
    }
    if (appointmentData?.report_file_url) {
      return [appointmentData.report_file_url];
    }
    return multipleUrls;
  };
  const getCachePath = (type, extension, variant = null) => `${FileSystem.cacheDirectory}${type}_${appointmentId}${variant !== null && variant !== undefined ? `_${variant}` : ''}.${extension}`;
  const findCachedPath = async (type, preferredExtension, strictExtension = false, variant = null) => {
    const orderedExtensions = [preferredExtension, ...(strictExtension ? [] : supportedExtensions.filter(ext => ext !== preferredExtension))].filter(Boolean);
    for (const extension of orderedExtensions) {
      const path = getCachePath(type, extension, variant);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) return path;
    }
    return null;
  };
  const checkCachedFiles = async () => {
    try {
      const nextCachedFiles = {};
      const reportUrls = getReportUrls(appointment);
      for (let index = 0; index < reportUrls.length; index++) {
        const reportUrl = reportUrls[index];
        const reportExtension = getFileExtensionFromUrl(reportUrl);
        const reportPath = await findCachedPath('report', reportExtension, hasExplicitSupportedExtension(reportUrl), index);
        if (reportPath) {
          nextCachedFiles[`report_${index}`] = reportPath;
        }
      }
      const prescriptionUrls = getPrescriptionUrls(appointment);
      for (let index = 0; index < prescriptionUrls.length; index++) {
        const prescriptionUrl = prescriptionUrls[index];
        const prescriptionExtension = getFileExtensionFromUrl(prescriptionUrl);
        const prescriptionPath = await findCachedPath('prescription', prescriptionExtension, hasExplicitSupportedExtension(prescriptionUrl), index);
        if (prescriptionPath) {
          nextCachedFiles[`prescription_${index}`] = prescriptionPath;
        }
      }
      setCachedFiles(nextCachedFiles);
    } catch (error) {}
  };
  const openFile = async (fileUrl, type, fileIndex = null) => {
    try {
      if (!fileUrl) {
        logFileDebug('openFile missing fileUrl', {
          fileUrl,
          type
        });
        Alert.alert(t('error'), t('fileNotAvailable'));
        return;
      }
      const cacheKey = `${type}_${fileIndex ?? 0}`;
      let cachedPath = cachedFiles[cacheKey];
      const detectedExtension = getFileExtensionFromUrl(fileUrl);
      const strictExtension = hasExplicitSupportedExtension(fileUrl);
      if (!cachedPath) {
        cachedPath = await findCachedPath(type, detectedExtension, strictExtension, fileIndex ?? 0);
      }
      logFileDebug('openFile start', {
        fileUrl,
        type,
        detectedExtension,
        strictExtension,
        cachedPath,
        isOnline
      });
      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromPath(cachedPath);
        logFileDebug('openFile opening cached', {
          cachedPath,
          contentUri,
          mimeType
        });
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType
        });
        return;
      }
      if (!isOnline) {
        logFileDebug('openFile offline and not cached', {
          type
        });
        Alert.alert(t('offlineMode'), t('fileNotCachedViewOnline'));
        return;
      }
      cachedPath = await downloadFile(fileUrl, type, detectedExtension, false, fileIndex ?? 0);
      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromPath(cachedPath);
        logFileDebug('openFile opening downloaded cache', {
          cachedPath,
          contentUri,
          mimeType
        });
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType
        });
        return;
      }
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const canOpen = await Linking.canOpenURL(fullUrl);
      logFileDebug('openFile fallback linking', {
        fullUrl,
        canOpen
      });
      if (canOpen) await Linking.openURL(fullUrl);
    } catch (error) {
      logFileDebug('openFile error details', {
        message: error?.message,
        stack: error?.stack
      });
      Alert.alert(t('error'), t('unableToOpenFileTryAgain'));
    }
  };
  const downloadFile = async (fileUrl, type, extension = null, showSuccess = true, fileIndex = null) => {
    try {
      if (!isOnline) {
        Alert.alert(t('offlineMode'), t('cannotDownloadFilesOffline'));
        return null;
      }
      const detectedExtension = extension || getFileExtensionFromUrl(fileUrl);
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const downloadPath = getCachePath(type, detectedExtension, type === 'report' ? null : fileIndex);
      const result = await FileSystem.downloadAsync(fullUrl, downloadPath);
      if (showSuccess) {
        Alert.alert(t('success'), t('fileDownloadedOfflineViewing'));
      }
      await checkCachedFiles();
      return result?.uri || downloadPath;
    } catch (error) {
      Alert.alert(t('error'), t('failedToDownloadFile'));
      return null;
    }
  };
  const getPriorityInfo = patientData => {
    if (patientData?.is_high_risk) {
      return {
        label: t('highRisk'),
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)'
      };
    }
    return {
      label: t('normal'),
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.1)'
    };
  };
  const handleAcceptAppointment = async () => {
    if (!appointment?.id) return;
    if (!isOnline) {
      Alert.alert(t('offlineMode'), t('cannotAcceptAppointmentsOffline'));
      return;
    }
    try {
      setActionLoading(true);
      await usgAppointmentAPI.accept(appointment.id);
      Alert.alert(t('success'), t('appointmentAcceptedSuccessfully'));
      await refreshDetails();
    } catch (error) {
      const errorMsg = error?.response?.data?.detail || error?.response?.data?.message || error?.message || t('failedToAcceptAppointment');
      Alert.alert(t('error'), errorMsg);
    } finally {
      setActionLoading(false);
    }
  };
  const openRescheduleModal = () => {
    const scheduledDate = appointment?.scheduled_date ? new Date(appointment.scheduled_date) : null;
    if (scheduledDate && !Number.isNaN(scheduledDate.getTime())) {
      setRescheduleDate(scheduledDate);
      setRescheduleTime(scheduledDate);
    } else {
      setRescheduleDate(new Date());
      setRescheduleTime(new Date());
    }
    setRescheduleReason('');
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowRescheduleModal(true);
  };
  const closeRescheduleModal = () => {
    setShowRescheduleModal(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setRescheduleReason('');
  };
  const handleSubmitReschedule = async () => {
    if (!appointment?.id) return;
    if (!rescheduleReason.trim()) {
      Alert.alert(t('error'), t('pleaseEnterReasonForReschedule'));
      return;
    }
    if (!isOnline) {
      Alert.alert(t('offlineMode'), t('cannotRescheduleAppointmentsOffline'));
      return;
    }
    const selectedDateTime = buildRescheduleDateTime(rescheduleDate, rescheduleTime);
    if (selectedDateTime <= new Date()) {
      Alert.alert(t('error'), t('appointmentDateTimeMustBeFuture'));
      return;
    }
    const originalScheduledDate = appointment?.scheduled_date ? new Date(appointment.scheduled_date) : null;
    if (originalScheduledDate && !Number.isNaN(originalScheduledDate.getTime())) {
      const maxAllowedRescheduleDate = new Date(originalScheduledDate);
      maxAllowedRescheduleDate.setDate(maxAllowedRescheduleDate.getDate() + 7);
      if (selectedDateTime > maxAllowedRescheduleDate) {
        Alert.alert(t('error'), t('rescheduleWithinSevenDays', {
          date: formatDateDDMMYYYY(originalScheduledDate)
        }));
        return;
      }
    }
    try {
      setActionLoading(true);
      const year = rescheduleDate.getFullYear();
      const month = String(rescheduleDate.getMonth() + 1).padStart(2, '0');
      const day = String(rescheduleDate.getDate()).padStart(2, '0');
      const hours = String(rescheduleTime.getHours()).padStart(2, '0');
      const minutes = String(rescheduleTime.getMinutes()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}:00`;
      await usgAppointmentAPI.reschedule(appointment.id, formattedDate, rescheduleReason.trim());
      Alert.alert(t('success'), t('appointmentRescheduledSuccessfully'));
      closeRescheduleModal();
      await syncService.syncAppointments();
      await refreshDetails();
    } catch (error) {
      const errorMsg = error?.response?.data?.detail || t('failedToRescheduleAppointment');
      Alert.alert(t('error'), errorMsg);
    } finally {
      setActionLoading(false);
    }
  };
  if (loading) {
    return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text>{t('loading')}</Text>
        </View>
      </SafeAreaView>;
  }
  const priority = getPriorityInfo(patient);
  const showAcceptButton = userInfo?.role === 'usg_centre' && appointment?.status === 'scheduled';
  const showRescheduleButton = userInfo?.role === 'usg_centre' && ['scheduled', 'accepted'].includes(String(appointment?.status || '').toLowerCase()) && appointment?.appointment_type !== 'emergency';
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('appointmentDetails')}</Text>
          <Text style={styles.headerSubtitle}>USG {t('appointment')} #{appointment?.id}</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Home size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, {
          backgroundColor: priority.bgColor
        }]}>
            <Text style={[styles.statusText, {
            color: priority.color
          }]}>{priority.label}</Text>
          </View>
          <View style={styles.appointmentStatus}>
            <Text style={styles.statusLabel}>
              {t('status')}: {formatAppointmentStatus(appointment?.status)}
              {appointment?.appointment_type === 'emergency' && ' • ' + t('emergency')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('patientInformation')}</Text>
          <View style={styles.infoRow}>
            <User size={16} color="#6b7280" />
            <Text style={styles.infoText}>{patient?.full_name || t('notAvailable')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={16} color="#6b7280" />
            <TouchableOpacity onPress={handleCallPatient} activeOpacity={0.7} style={styles.phonePressable}>
              <Text style={styles.phoneText}>{patient?.mobile_number || 'N/A'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={16} color="#6b7280" />
            <Text style={styles.infoText}>{patient?.address || t('notAvailable')}</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>{t('age')}</Text>
              <Text style={styles.gridValue}>{patient?.age || t('notAvailable')} {t('years')}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>{t('eddDate')}</Text>
              <Text style={styles.gridValue}>{formatDateDDMMYYYY(patient?.edd_date)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>{t('lmpDate')}</Text>
              <Text style={styles.gridValue}>{formatDateDDMMYYYY(patient?.lmp_date)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
            <View style={styles.visitsHeader}>
              <Activity size={20} color="#D2691E" />
              <Text style={styles.cardTitle}>{ancVisits.length > 0 ? t('ancVisitsCount', {
              count: ancVisits.length
            }) : t('ancVisits')}</Text>
            </View>
            {ancVisits.length === 0 ? <Text style={styles.emptyAncText}>{t('noAncDataCompletedVisit')}</Text> : ancVisits.map((visit, index) => <View key={visit?.id || `${visit?.visit_number || index}_${visit?.visit_date || index}`} style={styles.visitItem}>
                <View style={styles.visitTopRow}>
                  <Text style={styles.visitNumber}>{t('visitNumberLabel', {
                  count: visit?.visit_number || index + 1
                })}</Text>
                  <Text style={styles.visitDate}>{formatDateDDMMYYYY(visit?.visit_date)}</Text>
                </View>

                <View style={styles.visitDetailsGrid}>
                  {visit?.weight ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('weight')}:</Text>
                      <Text style={styles.visitDetailValue}>{visit.weight} kg</Text>
                    </View> : null}
                  {visit?.blood_pressure ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('bloodPressure')}:</Text>
                      <Text style={styles.visitDetailValue}>{visit.blood_pressure}</Text>
                    </View> : null}
                  {visit?.hemoglobin ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('hemoglobin')}:</Text>
                      <Text style={styles.visitDetailValue}>{visit.hemoglobin} g/dL</Text>
                    </View> : null}
                  {visit?.fundal_height ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('fundalHeight')}:</Text>
                      <Text style={styles.visitDetailValue}>{visit.fundal_height} cm</Text>
                    </View> : null}
                  {visit?.fetal_heart_rate ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('fetalHeartRate')}:</Text>
                      <Text style={styles.visitDetailValue}>{visit.fetal_heart_rate} bpm</Text>
                    </View> : null}
                  {visit?.next_visit_date ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('nextVisitDate')}:</Text>
                      <Text style={styles.visitDetailValue}>{formatDateDDMMYYYY(visit.next_visit_date)}</Text>
                    </View> : null}
                  {visit?.referred_for_usg !== undefined ? <View style={styles.visitDetailRow}>
                      <Text style={styles.visitDetailLabel}>{t('referredForUSG')}:</Text>
                      <Text style={styles.visitDetailValue}>{visit.referred_for_usg ? t('yes') : t('no')}</Text>
                    </View> : null}
                </View>

                {visit?.doctor_notes ? <View style={styles.visitNotesSection}>
                    <Text style={styles.visitDetailLabel}>{t('doctorNotes')}:</Text>
                    <Text style={styles.visitNotes}>{visit.doctor_notes}</Text>
                  </View> : null}
              </View>)}
          </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('appointmentInformation')}</Text>
          <View style={styles.infoRow}>
            <Calendar size={16} color="#6b7280" />
            <Text style={styles.infoText}>{t('requestedOn')}: {formatDate(appointment?.created_at)}</Text>
          </View>
          <View style={styles.infoRow}>
            <User size={16} color="#6b7280" />
            <Text style={styles.infoText}>{t('requestedBy')}: {getRequestedByDisplayName(appointment)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Calendar size={16} color="#6b7280" />
            <Text style={styles.infoText}>{t('scheduled')}: {formatDate(appointment?.scheduled_date)}</Text>
          </View>
          {appointment?.completed_date && appointment?.status === 'completed' && <View style={styles.infoRow}>
              <CheckCircle size={16} color="#22c55e" />
              <Text style={styles.infoText}>{t('completedOn')}: {formatDate(appointment?.completed_date)}</Text>
            </View>}
          <View style={styles.infoGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>{t('type')}</Text>
              <Text style={styles.gridValue}>{formatDisplayValue(appointment?.appointment_type) || t('regular')}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>{t('rescheduleCount')}</Text>
              <Text style={styles.gridValue}>{appointment?.reschedule_count || 0}</Text>
            </View>
          </View>

          {getPrescriptionUrls(appointment).map((fileUrl, index) => <TouchableOpacity key={`${fileUrl}_${index}`} style={[styles.fileRow, styles.fileRowCompact]} onPress={() => openFile(fileUrl, 'prescription', index)}>
              <Text style={styles.fileLabel}>{t('prescriptionLabel', {
              count: index + 1
            })}:</Text>
              <View style={styles.fileLink}>
                <Text style={styles.fileText}>
                  {!isOnline && cachedFiles[`prescription_${index}`] ? t('viewOffline') : t('view')}
                </Text>
                <Eye size={16} color="#8B4513" />
              </View>
            </TouchableOpacity>)}
        </View>

        {appointment?.status === 'completed' && <View style={styles.completionCard}>
            <Text style={styles.cardTitle}>{t('completionDetails')}</Text>
            {getReportUrls(appointment).map((fileUrl, index) => <TouchableOpacity key={`${fileUrl}_${index}`} style={styles.fileRow} onPress={() => openFile(fileUrl, 'report', index)}>
                <Text style={styles.fileLabel}>{`${t('usgReportLabel')}${getReportUrls(appointment).length > 1 ? ` ${index + 1}` : ''}:`}</Text>
                <View style={styles.fileLink}>
                  <Text style={styles.fileText}>
                    {!isOnline && cachedFiles[`report_${index}`] ? t('viewOffline') : t('view')}
                  </Text>
                  <Eye size={16} color="#8B4513" />
                </View>
              </TouchableOpacity>)}
            {appointment?.sms_sent && <View style={styles.smsRow}>
                <Text style={styles.fileLabel}>{t('smsNotification')}:</Text>
                <Text style={styles.sentText}>{t('sent')}</Text>
              </View>}
          </View>}

        {(showAcceptButton || showRescheduleButton) && <View style={styles.primaryActionsRow}>
            {showAcceptButton && <TouchableOpacity style={[styles.primaryActionButton, actionLoading && styles.disabledActionButton]} onPress={handleAcceptAppointment} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="white" /> : <>
                    <CheckCircle size={16} color="white" />
                    <Text style={styles.primaryActionText}>{t('accept')}</Text>
                  </>}
              </TouchableOpacity>}

            {showRescheduleButton && <TouchableOpacity style={[styles.secondaryActionButton, showAcceptButton ? null : styles.singleActionButton, actionLoading && styles.disabledActionButton]} onPress={openRescheduleModal} disabled={actionLoading}>
                <Clock size={16} color="white" />
                <Text style={styles.primaryActionText}>{t('reschedule')}</Text>
              </TouchableOpacity>}
          </View>}

        {(appointment?.status === 'accepted' || appointment?.status === 'rescheduled') && userInfo?.role === 'usg_centre' && <TouchableOpacity style={styles.uploadButton} onPress={() => navigation.navigate('USGReportUpload', {
        appointmentId: appointment.id,
        patientId: patient.id
      })}>
            <Upload size={16} color="white" />
            <Text style={styles.uploadButtonText}>{t('uploadReport')}</Text>
          </TouchableOpacity>}

        {appointment?.status === 'completed' && <View style={styles.completedBadge}>
            <CheckCircle size={16} color="#22c55e" />
            <Text style={styles.completedText}>{t('reportCompleted')}</Text>
          </View>}
      </ScrollView>

      <Modal visible={showRescheduleModal} transparent animationType="slide" onRequestClose={closeRescheduleModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('rescheduleAppointment')}</Text>

            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.datePickerText}>{formatDateDDMMYYYY(rescheduleDate)}</Text>
            </TouchableOpacity>

            {showDatePicker && <DateTimePicker value={rescheduleDate} mode="date" display="default" onChange={(event, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) {
              setRescheduleDate(date);
              const now = new Date();
              if (isSameCalendarDay(date, now)) {
                const selectedDateTime = buildRescheduleDateTime(date, rescheduleTime);
                if (selectedDateTime <= now) {
                  setRescheduleTime(now);
                }
              }
            }
          }} minimumDate={new Date()} />}

            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.datePickerText}>
                {rescheduleTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
              </Text>
            </TouchableOpacity>

            {showTimePicker && <DateTimePicker value={rescheduleTime} mode="time" display="default" onChange={(event, time) => {
            setShowTimePicker(Platform.OS === 'ios');
            if (time) {
              const now = new Date();
              const selectedDateTime = buildRescheduleDateTime(rescheduleDate, time);
              if (isSameCalendarDay(rescheduleDate, now) && selectedDateTime <= now) {
                Alert.alert(t('error'), t('selectFutureTimeForToday'));
                return;
              }
              setRescheduleTime(time);
            }
          }} />}

            <TextInput style={styles.modalInput} placeholder={t('reasonForReschedule')} placeholderTextColor="#9ca3af" value={rescheduleReason} onChangeText={setRescheduleReason} multiline />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeRescheduleModal}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitButton, actionLoading && styles.disabledActionButton]} onPress={handleSubmitReschedule} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.modalSubmitText}>{t('reschedule')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white'
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)'
  },
  content: {
    flex: 1,
    padding: 16
  },
  scrollContent: {
    paddingBottom: 24
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  appointmentStatus: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16
  },
  visitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1
  },
  phonePressable: {
    flex: 1,
    marginLeft: 12
  },
  phoneText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600'
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8
  },
  gridItem: {
    flex: 1
  },
  gridLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4
  },
  gridValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600'
  },
  visitItem: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12
  },
  visitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12
  },
  visitNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B4513'
  },
  visitDate: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600'
  },
  visitDetailsGrid: {
    gap: 6
  },
  visitDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  visitDetailLabel: {
    width: 130,
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600'
  },
  visitDetailValue: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '500'
  },
  visitNotesSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa'
  },
  visitNotes: {
    marginTop: 4,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18
  },
  emptyAncText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20
  },
  primaryActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8
  },
  singleActionButton: {
    marginTop: 8
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  disabledActionButton: {
    opacity: 0.7
  },
  uploadButton: {
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  completedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#22c55e'
  },
  completedText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600'
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa'
  },
  fileRowCompact: {
    marginTop: 16,
    marginBottom: 0
  },
  fileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  completionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#8B4513'
  },
  fileLabel: {
    fontSize: 14,
    color: '#8B4513',
    fontWeight: '600'
  },
  fileText: {
    color: '#8B4513',
    fontSize: 14,
    fontWeight: '500'
  },
  sentText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '500'
  },
  smsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937'
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 92,
    textAlignVertical: 'top'
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'white'
  },
  datePickerText: {
    fontSize: 14,
    color: '#1f2937'
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center'
  },
  modalCancelText: {
    color: '#6b7280',
    fontWeight: '600'
  },
  modalSubmitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center'
  },
  modalSubmitText: {
    color: 'white',
    fontWeight: '600'
  }
});
export default AppointmentDetailScreen;
