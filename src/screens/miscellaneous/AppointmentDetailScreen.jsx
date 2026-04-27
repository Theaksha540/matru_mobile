import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  User,
  Phone,
  MapPin,
  Upload,
  CheckCircle,
  Eye,
  Clock,
  Home,
} from 'lucide-react-native';
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

const AppointmentDetailScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const { appointmentId } = route.params;
  const [appointment, setAppointment] = useState(null);
  const [patient, setPatient] = useState(null);
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
  const logFileDebug = (...args) => console.log('[AppointmentDetailScreen:file-debug]', ...args);

  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard',
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };

  const handleCallPatient = () => {
    const phoneNumber = patient?.mobile_number;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'Phone number not available for this patient');
    }
  };

  useEffect(() => {
    checkAccess();
    loadAppointmentDetails();
  }, [appointmentId]);

  useEffect(() => {
    checkCachedFiles();
  }, [appointmentId, appointment?.report_file_url, appointment?.prescription_file_url]);

  useFocusEffect(
    useCallback(() => {
      loadAppointmentDetails();
      checkCachedFiles();
    }, [appointmentId, isOnline])
  );

  const checkAccess = async () => {
    const storedUserInfo = await secureStorage.getItem('user_info');
    if (storedUserInfo?.role !== 'sub_centre' && storedUserInfo?.role !== 'usg_centre') {
      Alert.alert('Access Denied', 'This screen is only accessible to Sub-Centre and USG Centre users.');
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
      } else {
        await loadFromOfflineDB();
      }
    } catch (error) {
      console.error('Error loading appointment details:', error);
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
      } else {
        Alert.alert(t('error'), 'Appointment details not available offline');
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadAppointmentDetails'));
    }
  };

  const refreshDetails = async () => {
    setLoading(true);
    await loadAppointmentDetails();
  };

  const formatDate = (dateString) => formatDateTimeDDMMYYYY(dateString);

  const isSameCalendarDay = (firstDate, secondDate) => (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );

  const buildRescheduleDateTime = (date, time) => new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0
  );

  const formatDisplayValue = (value) => {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatAppointmentStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    const statusMap = {
      scheduled: 'Scheduled',
      accepted: 'Accepted',
      completed: 'Completed',
      rescheduled: 'Rescheduled',
      cancelled: 'Cancelled',
      rejected: 'Rejected',
      pending: 'Pending',
      no_show: 'No Show',
    };
    return statusMap[normalized] || formatDisplayValue(status) || 'N/A';
  };

  const getRequestedByDisplayName = (appointmentData) => {
    const candidates = [
      appointmentData?.requested_by_name,
      appointmentData?.requested_by_user_name,
      appointmentData?.requested_by_full_name,
      appointmentData?.created_by_name,
      appointmentData?.scheduled_by_name,
      appointmentData?.sub_centre_user_name,
      appointmentData?.anm_name,
      appointmentData?.requested_by,
    ];

    for (const value of candidates) {
      const normalized = String(value || '').trim();
      if (normalized && normalized.toLowerCase() !== 'null' && normalized.toLowerCase() !== 'undefined') {
        return normalized;
      }
    }

    return 'ANM';
  };

  const getFileExtensionFromUrl = (fileUrl) => {
    if (!fileUrl) return 'pdf';
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match?.[1]?.toLowerCase();
    return supportedExtensions.includes(ext) ? ext : 'pdf';
  };

  const hasExplicitSupportedExtension = (fileUrl) => {
    if (!fileUrl) return false;
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match?.[1]?.toLowerCase();
    return supportedExtensions.includes(ext);
  };

  const getMimeTypeFromExtension = (extension) => {
    const normalized = String(extension || '').toLowerCase();
    if (normalized === 'pdf') return 'application/pdf';
    if (normalized === 'png') return 'image/png';
    if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
    return 'application/octet-stream';
  };

  const getMimeTypeFromPath = (path) => {
    if (!path) return 'application/pdf';
    const ext = String(path).split('.').pop()?.toLowerCase();
    return getMimeTypeFromExtension(ext);
  };

  const getCachePath = (type, extension) => `${FileSystem.cacheDirectory}${type}_${appointmentId}.${extension}`;

  const findCachedPath = async (type, preferredExtension, strictExtension = false) => {
    const orderedExtensions = [
      preferredExtension,
      ...(strictExtension ? [] : supportedExtensions.filter((ext) => ext !== preferredExtension)),
    ].filter(Boolean);

    for (const extension of orderedExtensions) {
      const path = getCachePath(type, extension);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) return path;
    }

    return null;
  };

  const checkCachedFiles = async () => {
    try {
      const reportExtension = getFileExtensionFromUrl(appointment?.report_file_url);
      const prescriptionExtension = getFileExtensionFromUrl(appointment?.prescription_file_url);
      const reportPath = await findCachedPath(
        'report',
        reportExtension,
        hasExplicitSupportedExtension(appointment?.report_file_url)
      );
      const prescriptionPath = await findCachedPath(
        'prescription',
        prescriptionExtension,
        hasExplicitSupportedExtension(appointment?.prescription_file_url)
      );
      logFileDebug('checkCachedFiles', {
        reportUrl: appointment?.report_file_url,
        prescriptionUrl: appointment?.prescription_file_url,
        reportExtension,
        prescriptionExtension,
        reportPath,
        prescriptionPath,
      });

      setCachedFiles({
        report: reportPath,
        prescription: prescriptionPath,
      });
    } catch (error) {
      console.error('Error checking cached files:', error);
    }
  };

  const downloadFile = async (fileUrl, type, extension = null, showSuccess = true) => {
    try {
      if (!isOnline) {
        logFileDebug('downloadFile blocked offline', { fileUrl, type, extension });
        Alert.alert('Offline Mode', 'Cannot download files while offline.');
        return null;
      }

      const detectedExtension = extension || getFileExtensionFromUrl(fileUrl);
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const downloadPath = getCachePath(type, detectedExtension);
      logFileDebug('downloadFile start', { fileUrl, fullUrl, type, detectedExtension, downloadPath });

      const result = await FileSystem.downloadAsync(fullUrl, downloadPath);
      logFileDebug('downloadFile success', { status: result?.status, uri: result?.uri });

      if (showSuccess) {
        Alert.alert('Success', 'File downloaded for offline viewing');
      }
      await checkCachedFiles();
      return downloadPath;
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
      return null;
    }
  };

  const openFile = async (fileUrl, type) => {
    try {
      if (!fileUrl) {
        logFileDebug('openFile missing fileUrl', { fileUrl, type });
        Alert.alert('Error', 'File not available');
        return;
      }

      let cachedPath = type === 'report' ? cachedFiles.report : cachedFiles.prescription;
      const detectedExtension = getFileExtensionFromUrl(fileUrl);
      const strictExtension = hasExplicitSupportedExtension(fileUrl);
      if (!cachedPath) {
        cachedPath = await findCachedPath(type, detectedExtension, strictExtension);
      }
      logFileDebug('openFile start', {
        fileUrl,
        type,
        detectedExtension,
        strictExtension,
        cachedPath,
        isOnline,
      });

      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromPath(cachedPath);
        logFileDebug('openFile opening cached', { cachedPath, contentUri, mimeType });
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      }

      if (!isOnline) {
        logFileDebug('openFile offline and not cached', { type });
        Alert.alert('Offline Mode', 'File not cached. Please view it once while online.');
        return;
      }

      cachedPath = await downloadFile(fileUrl, type, detectedExtension, false);
      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromPath(cachedPath);
        logFileDebug('openFile opening downloaded cache', { cachedPath, contentUri, mimeType });
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      }

      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const canOpen = await Linking.canOpenURL(fullUrl);
      logFileDebug('openFile fallback linking', { fullUrl, canOpen });
      if (canOpen) await Linking.openURL(fullUrl);
    } catch (error) {
      console.error('Error opening file:', error?.message || error);
      logFileDebug('openFile error details', {
        message: error?.message,
        stack: error?.stack,
      });
      Alert.alert('Error', 'Unable to open file. Please try again.');
    }
  };

  const getPriorityInfo = (patientData) => {
    if (patientData?.is_high_risk) {
      return { label: t('highRisk'), color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' };
    }
    return { label: t('normal'), color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)' };
  };

  const handleAcceptAppointment = async () => {
    if (!appointment?.id) return;

    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot accept appointments while offline. Please connect to the internet.');
      return;
    }

    try {
      setActionLoading(true);
      await usgAppointmentAPI.accept(appointment.id);
      Alert.alert('Success', 'Appointment accepted successfully!');
      await refreshDetails();
    } catch (error) {
      const errorMsg =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to accept appointment';
      Alert.alert('Error', errorMsg);
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
      Alert.alert('Error', 'Please enter reason for reschedule');
      return;
    }

    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot reschedule appointments while offline. Please connect to the internet.');
      return;
    }

    const selectedDateTime = buildRescheduleDateTime(rescheduleDate, rescheduleTime);
    if (selectedDateTime <= new Date()) {
      Alert.alert(t('error'), t('appointmentDateTimeMustBeFuture'));
      return;
    }

    const originalScheduledDate = appointment?.scheduled_date
      ? new Date(appointment.scheduled_date)
      : null;

    if (originalScheduledDate && !Number.isNaN(originalScheduledDate.getTime())) {
      const maxAllowedRescheduleDate = new Date(originalScheduledDate);
      maxAllowedRescheduleDate.setDate(maxAllowedRescheduleDate.getDate() + 7);

      if (selectedDateTime > maxAllowedRescheduleDate) {
        Alert.alert(
          'Error',
          `Reschedule date must be within 7 days of the current scheduled date (${formatDateDDMMYYYY(originalScheduledDate)}).`
        );
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
      Alert.alert('Success', 'Appointment rescheduled successfully!');
      closeRescheduleModal();
      await syncService.syncAppointments();
      await refreshDetails();
    } catch (error) {
      const errorMsg = error?.response?.data?.detail || 'Failed to reschedule appointment';
      Alert.alert('Error', errorMsg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const priority = getPriorityInfo(patient);
  const showAcceptButton = userInfo?.role === 'usg_centre' && appointment?.status === 'scheduled';
  const showRescheduleButton =
    userInfo?.role === 'usg_centre' &&
    ['scheduled', 'accepted'].includes(String(appointment?.status || '').toLowerCase()) &&
    appointment?.appointment_type !== 'emergency';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
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
          <View style={[styles.statusBadge, { backgroundColor: priority.bgColor }]}>
            <Text style={[styles.statusText, { color: priority.color }]}>{priority.label}</Text>
          </View>
          <View style={styles.appointmentStatus}>
            <Text style={styles.statusLabel}>
              {t('status')}: {formatAppointmentStatus(appointment?.status)}
              {appointment?.appointment_type === 'emergency' && (' • ' + t('emergency'))}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('patientInformation')}</Text>
          <View style={styles.infoRow}>
            <User size={16} color="#6b7280" />
            <Text style={styles.infoText}>{patient?.full_name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={16} color="#6b7280" />
            <TouchableOpacity onPress={handleCallPatient} activeOpacity={0.7} style={styles.phonePressable}>
              <Text style={styles.phoneText}>{patient?.mobile_number || 'N/A'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={16} color="#6b7280" />
            <Text style={styles.infoText}>{patient?.address || 'N/A'}</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>{t('age')}</Text>
              <Text style={styles.gridValue}>{patient?.age || 'N/A'} {t('years')}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>EDD</Text>
              <Text style={styles.gridValue}>{formatDateDDMMYYYY(patient?.edd_date)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>LMP</Text>
              <Text style={styles.gridValue}>{formatDateDDMMYYYY(patient?.lmp_date)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('appointmentInformation')}</Text>
          <View style={styles.infoRow}>
            <Calendar size={16} color="#6b7280" />
            <Text style={styles.infoText}>Requested: {formatDate(appointment?.created_at)}</Text>
          </View>
          <View style={styles.infoRow}>
            <User size={16} color="#6b7280" />
            <Text style={styles.infoText}>Requested by: {getRequestedByDisplayName(appointment)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Calendar size={16} color="#6b7280" />
            <Text style={styles.infoText}>{t('scheduled')}: {formatDate(appointment?.scheduled_date)}</Text>
          </View>
          {appointment?.completed_date && appointment?.status === 'completed' && (
            <View style={styles.infoRow}>
              <CheckCircle size={16} color="#22c55e" />
              <Text style={styles.infoText}>Completed: {formatDate(appointment?.completed_date)}</Text>
            </View>
          )}
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

          {appointment?.prescription_file_url && (
            <TouchableOpacity
              style={[styles.fileRow, styles.fileRowCompact]}
              onPress={() => openFile(appointment.prescription_file_url, 'prescription')}
            >
              <Text style={styles.fileLabel}>Prescription:</Text>
              <View style={styles.fileLink}>
                <Text style={styles.fileText}>
                  {!isOnline && cachedFiles.prescription ? 'View (Offline)' : 'View'}
                </Text>
                <Eye size={16} color="#8B4513" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {appointment?.status === 'completed' && (
          <View style={styles.completionCard}>
            <Text style={styles.cardTitle}>Completion Details</Text>
            {appointment?.report_file_url && (
              <TouchableOpacity
                style={styles.fileRow}
                onPress={() => openFile(appointment.report_file_url, 'report')}
              >
                <Text style={styles.fileLabel}>USG Report:</Text>
                <View style={styles.fileLink}>
                  <Text style={styles.fileText}>
                    {!isOnline && cachedFiles.report ? 'View (Offline)' : 'View'}
                  </Text>
                  <Eye size={16} color="#8B4513" />
                </View>
              </TouchableOpacity>
            )}
            {appointment?.sms_sent && (
              <View style={styles.smsRow}>
                <Text style={styles.fileLabel}>SMS Notification:</Text>
                <Text style={styles.sentText}>Sent</Text>
              </View>
            )}
          </View>
        )}

        {(showAcceptButton || showRescheduleButton) && (
          <View style={styles.primaryActionsRow}>
            {showAcceptButton && (
              <TouchableOpacity
                style={[styles.primaryActionButton, actionLoading && styles.disabledActionButton]}
                onPress={handleAcceptAppointment}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <CheckCircle size={16} color="white" />
                    <Text style={styles.primaryActionText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {showRescheduleButton && (
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  showAcceptButton ? null : styles.singleActionButton,
                  actionLoading && styles.disabledActionButton,
                ]}
                onPress={openRescheduleModal}
                disabled={actionLoading}
              >
                <Clock size={16} color="white" />
                <Text style={styles.primaryActionText}>Reschedule</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {(appointment?.status === 'accepted' || appointment?.status === 'rescheduled') && userInfo?.role === 'usg_centre' && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => navigation.navigate('USGReportUpload', {
              appointmentId: appointment.id,
              patientId: patient.id,
            })}
          >
            <Upload size={16} color="white" />
            <Text style={styles.uploadButtonText}>{t('uploadReport')}</Text>
          </TouchableOpacity>
        )}

        {appointment?.status === 'completed' && (
          <View style={styles.completedBadge}>
            <CheckCircle size={16} color="#22c55e" />
            <Text style={styles.completedText}>{t('reportCompleted')}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showRescheduleModal} transparent animationType="slide" onRequestClose={closeRescheduleModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reschedule Appointment</Text>

            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.datePickerText}>{formatDateDDMMYYYY(rescheduleDate)}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={rescheduleDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
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
                }}
                minimumDate={new Date()}
              />
            )}

            <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.datePickerText}>
                {rescheduleTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={rescheduleTime}
                mode="time"
                display="default"
                onChange={(event, time) => {
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
                }}
              />
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Reason for reschedule"
              placeholderTextColor="#9ca3af"
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={closeRescheduleModal}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, actionLoading && styles.disabledActionButton]}
                onPress={handleSubmitReschedule}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalSubmitText}>Reschedule</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5',
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentStatus: {
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  phonePressable: {
    flex: 1,
    marginLeft: 12,
  },
  phoneText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  primaryActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  singleActionButton: {
    marginTop: 8,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledActionButton: {
    opacity: 0.7,
  },
  uploadButton: {
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    borderColor: '#22c55e',
  },
  completedText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
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
    borderColor: '#fed7aa',
  },
  fileRowCompact: {
    marginTop: 16,
    marginBottom: 0,
  },
  fileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#8B4513',
  },
  fileLabel: {
    fontSize: 14,
    color: '#8B4513',
    fontWeight: '600',
  },
  fileText: {
    color: '#8B4513',
    fontSize: 14,
    fontWeight: '500',
  },
  sentText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '500',
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
    borderColor: '#bbf7d0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
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
    textAlignVertical: 'top',
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: 'white',
  },
  datePickerText: {
    fontSize: 14,
    color: '#1f2937',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center',
  },
  modalSubmitText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default AppointmentDetailScreen;
