// src/screens/ANCTrackingScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Linking } from 'react-native';
import { SafeAreaView , SafeAreaProvider } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import { 
  ArrowLeft,
  FileText,
  Calendar,
  Phone,
  Weight,
  Droplets,
  Heart,
  FileCheck,
  CheckCircle2,
  Circle,
  Ambulance,
  X,
  Search,
  Home
} from 'lucide-react-native';

const ANCTrackingScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const patientData = route?.params?.patient || {};
  const patientId = route?.params?.patientId;
  const [patient, setPatient] = useState(patientData);
  const [loading, setLoading] = useState(!patientData.id && patientId);
  const [ancVisits, setAncVisits] = useState([]);
  const [usgAppointments, setUsgAppointments] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [deliveryPoints, setDeliveryPoints] = useState([]);
  const [usgCentresMap, setUsgCentresMap] = useState({});
  const [cachedFiles, setCachedFiles] = useState({});
  const [selectedDP, setSelectedDP] = useState(null);
  const [observationNotes, setObservationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [syncingOfflineChanges, setSyncingOfflineChanges] = useState(false);
  const [hasActiveReferral, setHasActiveReferral] = useState(false);
  const [activeReferralInfo, setActiveReferralInfo] = useState(null);
  const [dpSearchQuery, setDpSearchQuery] = useState('');
  const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

  const isPatientApproved = (patientData) => {
    if (patientData?.is_self_registered === false) {
      return true;
    }

    const approvalValue = patientData?.registration_approved ?? patientData?.is_registration_approved;

    if (typeof approvalValue === 'boolean') return approvalValue;
    if (typeof approvalValue === 'number') return approvalValue === 1;
    if (typeof approvalValue === 'string') {
      const normalized = approvalValue.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'approved';
    }
    return false;
  };

  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg: 'USGDashboard',
      mother: 'MotherDashboard',
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };

  useEffect(() => {
    loadUserInfo();
    if (patientId && !patientData.id) {
      loadPatient();
    }
    if (patientId || patientData.id) {
      loadAncVisits();
      loadUSGAppointments();
      checkActiveReferral();
    }
    
    // Listen for network changes to refresh data
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        // Refresh data when coming online
        setTimeout(async () => {
          try {
            setSyncingOfflineChanges(true);
            await syncService.syncOfflineData();
            await loadAncVisits();
            await loadUSGAppointments();
            await checkActiveReferral();
          } finally {
            setSyncingOfflineChanges(false);
          }
        }, 2000); // Wait 2 seconds for sync to complete
      }
    });
    
    return () => unsubscribe();
  }, [patientId]);

  useFocusEffect(
    React.useCallback(() => {
      const refreshData = async () => {
        await loadUserInfo();
        await loadPatient();
        await loadAncVisits();
        await loadUSGAppointments();
        await checkActiveReferral();
      };

      refreshData();
    }, [patientId, patientData?.id])
  );

  useEffect(() => {
    checkCachedFiles();
  }, [usgAppointments]);

  useEffect(() => {
    if (patientData?.id && !isPatientApproved(patientData)) {
      Alert.alert(
        t('notApproved'),
        t('approveBeforeANC'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }, [patientData?.id]);

  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
        await loadUSGCentres(userData);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadUSGCentres = async (userData) => {
    try {
      const districtId = userData?.district_id;
      const blockId = userData?.block_id;

      const centres = districtId
        ? await syncService.getUSGCentres({ district_id: districtId })
        : blockId
          ? await syncService.getUSGCentres({ block_id: blockId })
          : await syncService.getUSGCentres();

      const centresList = Array.isArray(centres) ? centres : [];
      const centresLookup = {};

      centresList.forEach((centre) => {
        if (centre?.id !== undefined && centre?.id !== null) {
          centresLookup[String(centre.id)] = centre.name || centre.centre_name || centre.usg_centre_name;
        }
      });

      setUsgCentresMap(centresLookup);
    } catch (error) {
      console.error('Error loading USG centres:', error);
      setUsgCentresMap({});
    }
  };

  const loadPatient = async () => {
    try {
      const id = patientId || patientData?.id;
      if (!id) return;

      const data = await syncService.getPatientById(id);
      if (data) {
        if (!isPatientApproved(data)) {
          Alert.alert(
            t('notApproved'),
            t('approveBeforeANC'),
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        setPatient(data);
      }
    } catch (error) {
      console.error('Error loading patient:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAncVisits = async () => {
    try {
      const id = patientId || patientData.id;
      if (!id) {
        setAncVisits([]);
        return;
      }
      
      const onlineVisits = await syncService.getANCVisits(id);
      const offlineVisits = await syncService.getOfflineANCVisits(id);

      const allVisits = [...onlineVisits, ...offlineVisits]
        .filter(Boolean)
        .reduce((visits, visit) => {
          const dedupeKey = [
            String(visit?.pregnant_woman_id || id),
            String(visit?.visit_number || ''),
            String(visit?.visit_date || ''),
            String(visit?.id || ''),
          ].join('_');

          const looseDedupeKey = [
            String(visit?.pregnant_woman_id || id),
            String(visit?.visit_number || ''),
            String(visit?.visit_date || ''),
          ].join('_');

          if (!visits.some((existingVisit) => existingVisit._dedupeKey === dedupeKey)) {
            if (!visits.some((existingVisit) => existingVisit._looseDedupeKey === looseDedupeKey)) {
              visits.push({ ...visit, _dedupeKey: dedupeKey, _looseDedupeKey: looseDedupeKey });
            }
          }
          return visits;
        }, [])
        .sort((a, b) => (a.visit_number || 0) - (b.visit_number || 0));
      
      setAncVisits(allVisits.map(({ _dedupeKey, _looseDedupeKey, ...visit }) => visit));
    } catch (error) {
      console.error('Error loading ANC visits:', error);
      setAncVisits([]);
    }
  };

  const loadUSGAppointments = async () => {
    try {
      const id = patientId || patientData.id;
      if (!id) {
        setUsgAppointments([]);
        return;
      }

      const [appointmentsData, offlineAppointments] = await Promise.all([
        syncService.getAppointments(),
        syncService.getOfflineUSGAppointments(id),
      ]);

      const allAppointments = [
        ...(Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData?.items || [])),
        ...(Array.isArray(offlineAppointments) ? offlineAppointments : []),
      ]
        .filter(Boolean)
        .reduce((appointments, appointment) => {
          const dedupeKey = [
            String(appointment?.pregnant_woman_id || id),
            String(appointment?.scheduled_date || ''),
            String(appointment?.usg_centre_id || ''),
            String(appointment?.id || ''),
          ].join('_');

          const looseDedupeKey = [
            String(appointment?.pregnant_woman_id || id),
            String(appointment?.scheduled_date || ''),
            String(appointment?.usg_centre_id || ''),
          ].join('_');

          if (!appointments.some((existingAppointment) => existingAppointment._dedupeKey === dedupeKey)) {
            if (!appointments.some((existingAppointment) => existingAppointment._looseDedupeKey === looseDedupeKey)) {
              appointments.push({
                ...appointment,
                _dedupeKey: dedupeKey,
                _looseDedupeKey: looseDedupeKey,
              });
            }
          }

          return appointments;
        }, []);

      const patientAppointments = allAppointments
        .filter((appointment) => String(appointment?.pregnant_woman_id) === String(id))
        .sort((a, b) => {
          const dateA = new Date(a?.scheduled_date || a?.created_at || 0).getTime();
          const dateB = new Date(b?.scheduled_date || b?.created_at || 0).getTime();
          return dateB - dateA;
        });

      setUsgAppointments(patientAppointments.map(({ _dedupeKey, _looseDedupeKey, ...appointment }) => appointment));
    } catch (error) {
      console.error('Error loading USG appointments:', error);
      setUsgAppointments([]);
    }
  };

  const checkActiveReferral = async () => {
    try {
      const id = patientId || patientData?.id || patient?.id;
      if (!id) return;

      const existingReferrals = await syncService.getDeliveryReferrals();
      const activeReferrals = Array.isArray(existingReferrals) 
        ? existingReferrals 
        : existingReferrals?.items || [];

      const patientReferrals = activeReferrals.filter(ref => 
        String(ref?.pregnant_woman_id) === String(id)
      );

      const activeStatuses = ['pending', 'accepted', 're_referred'];
      const activeRef = patientReferrals.find(ref => 
        activeStatuses.includes(ref.status?.toLowerCase())
      );

      setHasActiveReferral(!!activeRef);
      setActiveReferralInfo(activeRef || null);
    } catch (error) {
      console.error('Error checking active referral:', error);
      setHasActiveReferral(false);
      setActiveReferralInfo(null);
    }
  };

  

  const handleBack = () => {
    navigation.goBack();
  };

  const handleUpdateUSGReport = () => {
  // Navigation removed
  console.log('Update USG Report clicked - Navigation disabled');
};

  const handleCallPatient = () => {
    const phoneNumber = patient?.mobile_number || patientData?.mobile_number;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'Phone number not available for this patient');
    }
  };

  const handleVisitPress = (visit) => {
    if (userInfo?.role !== 'sub_centre') {
      return;
    }

    navigation.navigate('ANCUpdateForm', { 
      patient: patient,
      visitData: visit,
      onSuccess: loadAncVisits 
    });
  };

  const handleUSGAppointmentPress = (appointment) => {
    if (userInfo?.role === 'sub_centre' || userInfo?.role === 'usg_centre') {
      navigation.navigate('AppointmentDetail', { appointmentId: appointment.id });
    }
  };

  const handleEditBeneficiary = () => {
    if (!patient?.id) return;
    navigation.navigate('BeneficiaryEdit', { patientId: patient.id });
  };

  const loadDeliveryPoints = async () => {
    try {
      const resolvedUserInfo = userInfo || await secureStorage.getItem('user_info');
      const resolvedPatient = patient?.id ? patient : (patientData || {});
      const isSubCentreUser = resolvedUserInfo?.role === 'sub_centre';

      const blockId =
        resolvedUserInfo?.block_id ||
        resolvedUserInfo?.block?.id ||
        resolvedPatient?.block_id ||
        resolvedPatient?.block?.id;

      const districtId =
        resolvedUserInfo?.district_id ||
        resolvedUserInfo?.district?.id ||
        resolvedPatient?.district_id ||
        resolvedPatient?.district?.id;

      let data = [];

      if (isSubCentreUser) {
        data = await syncService.getDeliveryPoints();
      } else if (blockId) {
        data = await syncService.getDeliveryPoints({ block_id: blockId });
      }

      if ((!Array.isArray(data) || data.length === 0) && !isSubCentreUser && districtId) {
        data = await syncService.getDeliveryPoints({ district_id: districtId });
      }

      if (!Array.isArray(data) || data.length === 0) {
        data = await syncService.getDeliveryPoints();
      }

      setDeliveryPoints(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading delivery points:', error);
      setDeliveryPoints([]);
    }
  };

  const handleOpenReferralModal = async () => {
    try {
      setLoading(true);
      const currentPatientId = patient?.id || patientId || patientData?.id;
      if (!currentPatientId) {
        Alert.alert(t('error'), 'Patient information not available. Please refresh.');
        return;
      }
      
      const existingReferrals = await syncService.getDeliveryReferrals();
      const activeReferrals = Array.isArray(existingReferrals) 
        ? existingReferrals 
        : existingReferrals?.items || [];
      
      // CRITICAL FIX: Filter by pregnant_woman_id on frontend since backend doesn't filter properly
      const patientReferrals = activeReferrals.filter(ref => 
        String(ref?.pregnant_woman_id) === String(currentPatientId)
      );
      
      console.log('Patient referrals in modal:', patientReferrals);
      
      // Filter for active statuses (pending, accepted, re_referred)
      const activeStatuses = ['pending', 'accepted', 're_referred'];
      const hasActiveReferral = patientReferrals.find(ref => 
        activeStatuses.includes(ref.status?.toLowerCase())
      );
      
      if (hasActiveReferral) {
        const statusText = hasActiveReferral.status === 're_referred' 
          ? 're-referred' 
          : hasActiveReferral.status;
        
        const dpName = hasActiveReferral.dp_name || hasActiveReferral.delivery_point?.name || 'Unknown DP';
        const referralDate = hasActiveReferral.created_at 
          ? formatDateDDMMYYYY(hasActiveReferral.created_at)
          : 'N/A';
        
        Alert.alert(
          '⚠️ Active Referral Exists',
          `This patient already has an active ${statusText} referral:\n\n` +
          `📍 Delivery Point: ${dpName}\n` +
          `📅 Referred on: ${referralDate}\n\n` +
          `Please complete or cancel the existing referral before creating a new one.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'View Referral', 
              style: 'default',
              onPress: () => {
                console.log('Navigating to ReferralDetail with ID:', hasActiveReferral.id);
                navigation.navigate('ReferralDetail', { 
                  referralId: hasActiveReferral.id,
                  referralData: hasActiveReferral,
                });
              }
            }
          ]
        );
        return;
      }
      
      // No active referral, proceed to open modal
      await loadDeliveryPoints();
      setShowReferralModal(true);
    } catch (error) {
      console.error('Error checking existing referrals:', error);
      
      // Show warning but allow proceeding
      Alert.alert(
        'Warning',
        'Could not verify existing referrals. Do you want to proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Proceed Anyway', 
            style: 'default',
            onPress: async () => {
              await loadDeliveryPoints();
              setShowReferralModal(true);
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReferralModal = () => {
    setShowReferralModal(false);
    setSelectedDP(null);
    setObservationNotes('');
    setDpSearchQuery('');
  };

  const handleSubmitReferral = async () => {
    if (!selectedDP) {
      Alert.alert(t('error'), 'Please select a delivery point');
      return;
    }

    if (!observationNotes.trim()) {
      Alert.alert(t('error'), 'Please enter observation notes');
      return;
    }

    try {
      setSubmitting(true);
      const currentPatientId = patient?.id || patientId || patientData?.id;

      if (!currentPatientId) {
        Alert.alert(t('error'), 'Patient information not available. Please refresh.');
        return;
      }
      
      // Double-check for active referrals before creating
      const existingReferrals = await syncService.getDeliveryReferrals();
      
      const activeReferrals = Array.isArray(existingReferrals) 
        ? existingReferrals 
        : existingReferrals?.items || [];
      
      // CRITICAL FIX: Filter by pregnant_woman_id on frontend since backend doesn't filter properly
      const patientReferrals = activeReferrals.filter(ref => 
        String(ref?.pregnant_woman_id) === String(currentPatientId)
      );
      
      const activeStatuses = ['pending', 'accepted', 're_referred'];
      const hasActiveReferral = patientReferrals.find(ref => 
        activeStatuses.includes(ref.status?.toLowerCase())
      );
      
      if (hasActiveReferral) {
        Alert.alert(
          t('error'),
          'An active referral was created while you were filling the form. Please refresh and try again.',
          [{ text: 'OK', onPress: handleCloseReferralModal }]
        );
        return;
      }
      
      const referralData = {
        pregnant_woman_id: currentPatientId,
        dp_id: selectedDP,
        observation_notes: observationNotes.trim()
      };

      const currentlyOnline = await syncService.isOnline();

      if (currentlyOnline) {
        const { deliveryReferralAPI } = await import('../../services/api');
        await deliveryReferralAPI.create(referralData);
      } else {
        await syncService.saveOfflineDeliveryReferral({
          ...referralData,
          id: `offline_delivery_referral_${Date.now()}`,
          status: 'pending',
          sync_status: 'pending',
          created_offline: true,
          created_at: new Date().toISOString(),
          dp_name: deliveryPoints.find((dp) => String(dp.id) === String(selectedDP))?.name || null,
        });
      }
      await checkActiveReferral();
      await loadPatient();
      
      Alert.alert(
        'Success',
        currentlyOnline
          ? 'Delivery referral created successfully!'
          : 'Delivery referral saved offline and will sync when online.',
        [{ text: 'OK', onPress: handleCloseReferralModal }]
      );
    } catch (error) {
      console.error('Error creating referral:', error);
      
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message ||
                          'Failed to create delivery referral. Please try again.';
      
      Alert.alert(t('error'), errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDeliveryPoints = deliveryPoints.filter(dp =>
    dp.name.toLowerCase().includes(dpSearchQuery.toLowerCase()) ||
    (dp.address && dp.address.toLowerCase().includes(dpSearchQuery.toLowerCase()))
  );

  const formatAppointmentStatus = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) return 'N/A';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const formatAppointmentType = (type) => {
    const normalized = String(type || '').trim().toLowerCase();
    if (!normalized) return 'Regular';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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

  const getCachePath = (type, appointmentIdValue, extension) =>
    `${FileSystem.cacheDirectory}${type}_${appointmentIdValue}.${extension}`;

  const findCachedPath = async (type, appointmentIdValue, preferredExtension, strictExtension = false) => {
    const orderedExtensions = [
      preferredExtension,
      ...(strictExtension ? [] : supportedExtensions.filter((ext) => ext !== preferredExtension)),
    ].filter(Boolean);

    for (const extension of orderedExtensions) {
      const path = getCachePath(type, appointmentIdValue, extension);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) return path;
    }

    return null;
  };

  const checkCachedFiles = async () => {
    try {
      const nextCachedFiles = {};

      for (const appointment of usgAppointments) {
        if (!appointment?.id) continue;

        if (appointment?.report_file_url) {
          const reportExtension = getFileExtensionFromUrl(appointment.report_file_url);
          const reportPath = await findCachedPath(
            'report',
            appointment.id,
            reportExtension,
            hasExplicitSupportedExtension(appointment.report_file_url)
          );
          if (reportPath) {
            nextCachedFiles[`report_${appointment.id}`] = reportPath;
          }
        }

        if (appointment?.prescription_file_url) {
          const prescriptionExtension = getFileExtensionFromUrl(appointment.prescription_file_url);
          const prescriptionPath = await findCachedPath(
            'prescription',
            appointment.id,
            prescriptionExtension,
            hasExplicitSupportedExtension(appointment.prescription_file_url)
          );
          if (prescriptionPath) {
            nextCachedFiles[`prescription_${appointment.id}`] = prescriptionPath;
          }
        }
      }

      setCachedFiles(nextCachedFiles);
    } catch (error) {
      console.error('Error checking cached files:', error);
    }
  };

  const downloadFile = async (fileUrl, type, appointmentIdValue, extension = null) => {
    try {
      if (!isOnline) {
        Alert.alert('Offline Mode', 'Cannot download files while offline.');
        return null;
      }

      const detectedExtension = extension || getFileExtensionFromUrl(fileUrl);
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const downloadPath = getCachePath(type, appointmentIdValue, detectedExtension);

      await FileSystem.downloadAsync(fullUrl, downloadPath);
      await checkCachedFiles();
      return downloadPath;
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
      return null;
    }
  };

  const openAppointmentFile = async (appointment, type) => {
    try {
      const fileUrl = type === 'report' ? appointment?.report_file_url : appointment?.prescription_file_url;
      if (!fileUrl || !appointment?.id) {
        Alert.alert('Error', 'File not available');
        return;
      }

      const cacheKey = `${type}_${appointment.id}`;
      let cachedPath = cachedFiles[cacheKey];
      const detectedExtension = getFileExtensionFromUrl(fileUrl);
      const strictExtension = hasExplicitSupportedExtension(fileUrl);

      if (!cachedPath) {
        cachedPath = await findCachedPath(type, appointment.id, detectedExtension, strictExtension);
      }

      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromPath(cachedPath);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      }

      if (!isOnline) {
        Alert.alert('Offline Mode', 'File not cached. Please open it once while online.');
        return;
      }

      cachedPath = await downloadFile(fileUrl, type, appointment.id, detectedExtension);
      if (cachedPath) {
        const contentUri = await FileSystem.getContentUriAsync(cachedPath);
        const mimeType = getMimeTypeFromPath(cachedPath);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      }

      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const canOpen = await Linking.canOpenURL(fullUrl);
      if (canOpen) {
        await Linking.openURL(fullUrl);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Unable to open file. Please try again.');
    }
  };

  const getFileActionLabel = (appointment, type) => {
    const cacheKey = `${type}_${appointment?.id}`;
    return !isOnline && cachedFiles[cacheKey] ? 'View (Offline)' : 'View';
  };

  const getUSGCentreDisplayName = (appointment) => {
    return (
      appointment?.usg_centre_name ||
      appointment?.usg_center_name ||
      appointment?.centre_name ||
      usgCentresMap[String(appointment?.usg_centre_id)] ||
      (appointment?.usg_centre_id ? `USG Centre ${appointment.usg_centre_id}` : 'N/A')
    );
  };

  const getTimelineDateLabel = (dateValue) => {
    if (!dateValue) return 'Pending';
    return formatDateDDMMYYYY(dateValue);
  };

  const buildUSGTimelineItems = (appointment) => {
    const status = String(appointment?.status || '').toLowerCase();
    const items = [
      {
        key: 'requested',
        label: t('usgTimelineRequested'),
        date: appointment?.created_at,
        completed: !!appointment?.created_at,
      },
      {
        key: 'scheduled',
        label: appointment?.reschedule_count > 0 ? t('usgTimelineRescheduled') : t('usgTimelineScheduled'),
        date: appointment?.scheduled_date,
        completed: !!appointment?.scheduled_date,
      },
    ];

    if (status === 'accepted' || status === 'completed') {
      items.push({
        key: 'accepted',
        label: t('usgTimelineAccepted'),
        date: appointment?.accepted_at || appointment?.updated_at,
        completed: true,
      });
    }

    if (status === 'completed') {
      items.push({
        key: 'completed',
        label: t('usgTimelineCompleted'),
        date: appointment?.completed_date || appointment?.scan_date,
        completed: true,
      });
    } else {
      items.push({
        key: 'completed',
        label: t('usgTimelineCompleted'),
        date: appointment?.completed_date || appointment?.scan_date,
        completed: false,
      });
    }

    return items;
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('loadingPatientData')}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={handleBack}
                >
                  <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>{t('deliveryReferralHeader')}</Text>
                  <Text style={styles.headerSubtitle}>{t('deliveryReferralHeader')}</Text>
                </View>
               <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
                <Home size={20} color="white" />
              </TouchableOpacity>
              </View>
              {syncingOfflineChanges && (
                <View style={styles.syncBanner}>
                  <ActivityIndicator size="small" color="#8B4513" />
                  <Text style={styles.syncBannerText}>
                    Syncing offline ANC and appointment updates...
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Patient Info Card */}
              <View style={styles.patientCard}>
                <Text style={styles.patientName}>{patient?.full_name || t('noPatientSelected')}</Text>
                <View style={styles.patientInfoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>{t('age')}</Text>
                    <Text style={styles.infoValue}>{String(patient?.age || 'N/A')}</Text>
                  </View>
                  <TouchableOpacity style={styles.infoItem} onPress={handleCallPatient} activeOpacity={0.7}>
                    <Text style={styles.infoLabel}>{t('mobile')}</Text>
                    <View style={styles.callRow}>
                      <Phone size={14} color="#059669" />
                      <Text style={styles.callValue}>{String(patient?.mobile_number || 'N/A')}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>{t('village')}</Text>
                    <Text style={styles.infoValue}>{String(patient?.address || 'N/A')}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>LMP</Text>
                    <Text style={styles.infoValue}>{formatDateDDMMYYYY(patient?.lmp_date)}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>EDD</Text>
                    <Text style={styles.infoValue}>{formatDateDDMMYYYY(patient?.edd_date)}</Text>
                  </View>
                </View>
                {userInfo?.role === 'sub_centre' && (
                  <View style={styles.patientActionRow}>
                    <TouchableOpacity
                      style={styles.editBeneficiaryButton}
                      onPress={handleEditBeneficiary}
                    >
                      <Text style={styles.editBeneficiaryButtonText}>{t('editBeneficiaryDetails')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ANC Visit Timeline */}
              <Text style={styles.sectionTitle}>{t('ancVisitTimeline')}</Text>
              
              {userInfo?.role === 'sub_centre' && (
                <TouchableOpacity
                  style={styles.addVisitButton}
                  onPress={() => navigation.navigate('ANCUpdateForm', { 
                    patient: patient,
                    onSuccess: loadAncVisits 
                  })}
                >
                  <Text style={styles.addVisitText}>{t('addANCVisit')}</Text>
                </TouchableOpacity>
              )}

              {ancVisits.length > 0 ? (
                <ScrollView 
                  style={styles.visitsScrollContainer}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.visitsContainer}>
                    {ancVisits.map((visit, index) => {
                    console.log(`Rendering visit ${index}:`, JSON.stringify(visit, null, 2));
                    return (
                    <View
                      key={visit.id || index}
                      style={styles.visitCard}
                    >
                      <View style={styles.visitHeader}>
                        <View style={styles.visitNameContainer}>
                          <View style={[
                            styles.visitIcon, 
                            visit.sync_status === 'pending' ? styles.visitIconPending : styles.visitIconCompleted
                          ]}>
                            {visit.sync_status === 'pending' ? (
                              <Circle size={20} color="#3b82f6" />
                            ) : (
                              <CheckCircle2 size={20} color="white" />
                            )}
                          </View>
                          <View>
                            <Text style={styles.visitName}>{t('visit')} {visit.visit_number || 'N/A'}</Text>
                            <Text style={styles.visitDueDate}>
                              {formatDateDDMMYYYY(visit.visit_date)}
                              {visit.sync_status === 'pending' && ` ${t('offlineTag')}`}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.visitDetails}>
                        <View style={styles.visitDetailsGrid}>{[1,2,3].map((item, idx) => {
                          const configs = [
                            { icon: Weight, label: t('weight'), value: `${String(visit.weight || 'N/A')} kg` },
                            { icon: Heart, label: 'BP', value: String(visit.blood_pressure || 'N/A') },
                            { icon: Droplets, label: t('hemoglobin'), value: `${String(visit.hemoglobin || 'N/A')} g/dL` }
                          ];
                          const config = configs[idx];
                          const IconComponent = config.icon;
                          return (
                            <View key={idx} style={styles.detailItem}>
                              <IconComponent size={16} color="#6b7280" style={styles.detailIcon} />
                              <View>
                                <Text style={styles.detailLabel}>{config.label}</Text>
                                <Text style={styles.detailValue}>{config.value}</Text>
                              </View>
                            </View>
                          );
                        })}</View>
                        {visit.doctor_notes ? (
                          <View style={styles.notesContainer}>
                            <Text style={styles.notesLabel}>{t('notesLabel')}</Text>
                            <Text style={styles.notesText}>{String(visit.doctor_notes)}</Text>
                          </View>
                        ) : null}
                        {userInfo?.role === 'sub_centre' && (
                          <TouchableOpacity
                            style={styles.editBeneficiaryButton}
                            onPress={() => handleVisitPress(visit)}
                          >
                            <Text style={styles.editBeneficiaryButtonText}>{t('update')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )})}
                </View>
                </ScrollView>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('noANCVisitsRecorded')}</Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>{t('usgTimeline')}</Text>
              {usgAppointments.length > 0 ? (
                <ScrollView
                  style={styles.usgScrollContainer}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View style={styles.visitsContainer}>
                    {usgAppointments.map((appointment, index) => {
                      const isPressable = userInfo?.role === 'sub_centre' || userInfo?.role === 'usg_centre';
                      const CardComponent = isPressable ? TouchableOpacity : View;
                      const timelineItems = buildUSGTimelineItems(appointment);

                      return (
                        <CardComponent
                          key={appointment.id || index}
                          style={styles.usgCard}
                          {...(isPressable ? { onPress: () => handleUSGAppointmentPress(appointment), activeOpacity: 0.7 } : {})}
                        >
                          <View style={styles.visitHeader}>
                            <View style={styles.visitNameContainer}>
                              <View style={styles.usgTimelineIcon}>
                                <Calendar size={20} color="#8B4513" />
                              </View>
                              <View>
                                <Text style={styles.visitName}>
                                  USG Appointment {index + 1}
                                </Text>
                                <Text style={styles.visitDueDate}>
                                  {formatDateDDMMYYYY(appointment.scheduled_date || appointment.scan_date)}
                                </Text>
                              </View>
                            </View>
                            <View
                              style={[
                                styles.visitStatus,
                                appointment.status === 'completed' ? styles.statusCompleted : styles.statusPending,
                              ]}
                            >
                              <Text style={styles.statusText}>{formatAppointmentStatus(appointment.status)}</Text>
                            </View>
                          </View>

                          <View style={styles.visitDetails}>
                            <View style={styles.visitDetailsGrid}>
                              <View style={styles.detailItem}>
                                <View>
                                  <Text style={styles.detailLabel}>{t('appointmentTypeLabel')}</Text>
                                  <Text style={styles.detailValue}>{formatAppointmentType(appointment.appointment_type)}</Text>
                                </View>
                              </View>
                              <View style={styles.detailItem}>
                                <View>
                                  <Text style={styles.detailLabel}>{t('trimesterLabel')}</Text>
                                  <Text style={styles.detailValue}>{appointment.trimester || 'N/A'}</Text>
                                </View>
                              </View>
                              <View style={styles.detailItem}>
                                <View>
                                  <Text style={styles.detailLabel}>{t('centreLabel')}</Text>
                                  <Text style={styles.detailValue}>
                                    {getUSGCentreDisplayName(appointment)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.detailItem}>
                                <View>
                                  <Text style={styles.detailLabel}>{t('doctorLabel')}</Text>
                                  <Text style={styles.detailValue}>{appointment.doctor_name || 'N/A'}</Text>
                                </View>
                              </View>
                            </View>

                            <View style={styles.usgTimelineContainer}>
                              {timelineItems.map((item, timelineIndex) => {
                                const isLast = timelineIndex === timelineItems.length - 1;
                                return (
                                  <View key={`${appointment.id || index}_${item.key}`} style={styles.usgTimelineRow}>
                                    <View style={styles.usgTimelineMarkerColumn}>
                                      <View
                                        style={[
                                          styles.usgTimelineMarker,
                                          item.completed ? styles.usgTimelineMarkerDone : styles.usgTimelineMarkerPending,
                                        ]}
                                      />
                                      {!isLast && (
                                        <View
                                          style={[
                                            styles.usgTimelineLine,
                                            item.completed ? styles.usgTimelineLineDone : styles.usgTimelineLinePending,
                                          ]}
                                        />
                                      )}
                                    </View>
                                    <View style={styles.usgTimelineTextBlock}>
                                      <Text style={styles.usgTimelineStepLabel}>{item.label}</Text>
                                      <Text style={styles.usgTimelineStepDate}>
                                        {getTimelineDateLabel(item.date)}
                                      </Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>

                            {appointment.reschedule_count > 0 && (
                              <View style={styles.infoPillRow}>
                                <View style={styles.infoPill}>
                                  <Text style={styles.infoPillText}>
                                    {t('usgTimelineRescheduled')} {appointment.reschedule_count} time{appointment.reschedule_count > 1 ? 's' : ''}
                                  </Text>
                                </View>
                              </View>
                            )}

                            {appointment.reschedule_reason ? (
                              <View style={styles.notesContainer}>
                                <Text style={styles.notesLabel}>{t('rescheduleReasonLabel')}</Text>
                                <Text style={styles.notesText}>{appointment.reschedule_reason}</Text>
                              </View>
                            ) : null}

                            {(appointment.report_file_url || appointment.prescription_file_url) && (
                              <View style={styles.fileActionsContainer}>
                                {appointment.prescription_file_url ? (
                                  <TouchableOpacity
                                    style={styles.fileActionRow}
                                    onPress={() => openAppointmentFile(appointment, 'prescription')}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.fileActionLabel}>{t('prescriptionFileLabel')}</Text>
                                    <Text style={styles.fileActionValue}>
                                      {getFileActionLabel(appointment, 'prescription')}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}

                                {appointment.report_file_url ? (
                                  <TouchableOpacity
                                    style={styles.fileActionRow}
                                    onPress={() => openAppointmentFile(appointment, 'report')}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.fileActionLabel}>{t('reportFileLabel')}</Text>
                                    <Text style={styles.fileActionValue}>
                                      {getFileActionLabel(appointment, 'report')}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            )}

                            {(appointment.findings || appointment.usg_findings) && (
                              <View style={styles.notesContainer}>
                                <Text style={styles.notesLabel}>{t('findingsLabel')}</Text>
                                <Text style={styles.notesText}>
                                  {appointment.findings || appointment.usg_findings}
                                </Text>
                              </View>
                            )}
                          </View>
                        </CardComponent>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('noUSGAppointmentsFound')}</Text>
                </View>
              )}

              {(userInfo?.role === 'sub_centre' || userInfo?.role === 'dp') && (
                <View style={styles.actionButtonsContainer}>
                  {userInfo?.role === 'sub_centre' && !hasActiveReferral && (
                    <TouchableOpacity
                      style={styles.scheduleUSGButtonHalf}
                      onPress={() => navigation.navigate('USGAppointmentForm', { 
                        patientId: patient?.id,
                        patientName: patient?.full_name,
                        patient: patient
                      })}
                    >
                      <Calendar size={18} color="white" style={styles.buttonIcon} />
                      <Text style={styles.buttonTextSmall}>{t('scheduleUSGLabel')}</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={[
                      userInfo?.role === 'dp' || hasActiveReferral ? styles.deliveryReferralButtonFull : styles.deliveryReferralButtonHalf,
                      hasActiveReferral && styles.deliveryReferralButtonActive
                    ]}
                    onPress={hasActiveReferral ? () => {
                      if (activeReferralInfo) {
                        console.log('View Referral button clicked - Referral ID:', activeReferralInfo.id);
                        navigation.navigate('ReferralDetail', { 
                          referralId: activeReferralInfo.id,
                          referralData: activeReferralInfo,
                        });
                      } else {
                        console.error('activeReferralInfo is null but hasActiveReferral is true');
                        Alert.alert('Error', 'Referral information not available. Please refresh.');
                      }
                    } : handleOpenReferralModal}
                  >
                    <Ambulance size={18} color="white" style={styles.buttonIcon} />
                    <View style={styles.buttonTextContainer}>
                      <Text style={styles.buttonTextSmall}>
                        {hasActiveReferral ? t('viewReferral') : t('deliveryReferrals')}
                      </Text>
                      {hasActiveReferral && activeReferralInfo && (
                        <Text style={styles.buttonSubtext}>
                          {activeReferralInfo.status?.toUpperCase()}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Active Referral Info Banner */}
              {hasActiveReferral && activeReferralInfo && (
                <View style={styles.activeReferralBanner}>
                  <View style={styles.bannerIconContainer}>
                    <Ambulance size={20} color="#f59e0b" />
                  </View>
                  <View style={styles.bannerContent}>
                    <Text style={styles.bannerTitle}>{t('activeDeliveryReferral')}</Text>
                    <Text style={styles.bannerText}>
                      {t('referralStatusLabel')}: <Text style={styles.bannerTextBold}>{activeReferralInfo.status?.toUpperCase()}</Text>
                    </Text>
                    <Text style={styles.bannerText}>
                      DP: {activeReferralInfo.dp_name || activeReferralInfo.delivery_point?.name || 'N/A'}
                    </Text>
                    {activeReferralInfo.created_at && (
                      <Text style={styles.bannerText}>
                        {t('referredLabel')}: {formatDateDDMMYYYY(activeReferralInfo.created_at)}
                      </Text>
                    )}
                  </View>
                </View>
              )}

            </View>
          </View>
        </ScrollView>

        {/* Delivery Referral Modal */}
        <KeyboardSafeModal
          visible={showReferralModal}
          position="center"
          onRequestClose={handleCloseReferralModal}
          closeOnBackdropPress={false}
        >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('createDeliveryReferral')}</Text>
                <TouchableOpacity onPress={handleCloseReferralModal} style={styles.closeButton}>
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalBody} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {/* Patient Info */}
                <View style={styles.patientInfoSection}>
                  <Text style={styles.sectionLabel}>Patient Information</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabelModal}>Name:</Text>
                    <Text style={styles.infoValueModal}>{patient?.full_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabelModal}>Age:</Text>
                    <Text style={styles.infoValueModal}>{patient?.age} years</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabelModal}>Mobile:</Text>
                    <Text style={styles.infoValueModal}>{patient?.mobile_number}</Text>
                  </View>
                </View>

                {/* Delivery Point Selection */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Select Delivery Point *</Text>
                  
                  {/* Search Input */}
                  <View style={styles.searchInputContainer}>
                    <Search size={18} color="#6b7280" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search delivery points..."
                      placeholderTextColor="#9ca3af"
                      value={dpSearchQuery}
                      onChangeText={setDpSearchQuery}
                    />
                  </View>
                  
                  <ScrollView style={styles.dpList} nestedScrollEnabled={true} contentContainerStyle={styles.dpListContent} keyboardShouldPersistTaps="handled">
                    {filteredDeliveryPoints.length === 0 ? (
                      <Text style={styles.noDPText}>
                        {dpSearchQuery ? 'No delivery points found matching your search' : 'No delivery points available'}
                      </Text>
                    ) : (
                      filteredDeliveryPoints.map((dp) => (
                        <TouchableOpacity
                          key={dp.id}
                          style={[
                            styles.dpItem,
                            selectedDP === dp.id && styles.dpItemSelected
                          ]}
                          onPress={() => setSelectedDP(dp.id)}
                        >
                          <View style={[
                            styles.radioButton,
                            selectedDP === dp.id && styles.radioButtonSelected
                          ]}>
                            {selectedDP === dp.id && <View style={styles.radioButtonInner} />}
                          </View>
                          <View style={styles.dpInfo}>
                            <Text style={styles.dpName}>{dp.name}</Text>
                            {dp.address && (
                              <Text style={styles.dpAddress}>{dp.address}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>

                {/* Observation Notes */}
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Observation Notes *</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter observation notes, reason for referral, and any important medical information..."
                    placeholderTextColor="#9ca3af"
                    value={observationNotes}
                    onChangeText={setObservationNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </ScrollView>

              {/* Modal Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCloseReferralModal}
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    submitting && styles.submitButtonDisabled
                  ]}
                  onPress={handleSubmitReferral}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>Create Referral</Text>
                  )}
                </TouchableOpacity>
              </View>
        </KeyboardSafeModal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fad5a5',
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  syncBannerText: {
    flex: 1,
    color: '#9a3412',
    fontSize: 13,
    fontWeight: '600',
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  homeButton: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 24,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  patientInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  patientActionRow: {
    marginTop: 14,
    alignItems: 'flex-end',
  },
  editBeneficiaryButton: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editBeneficiaryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
  },
  infoItem: {
    width: '47%',
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  callValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  visitsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  visitsScrollContainer: {
    maxHeight: 400,
    marginBottom: 16,
  },
  usgScrollContainer: {
    maxHeight: 400,
    marginBottom: 16,
  },
  visitCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  usgCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  visitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  visitNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  visitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  visitIconCompleted: {
    backgroundColor: '#10b981',
  },
  visitIconPending: {
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  usgTimelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 69, 19, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  visitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  visitDueDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  visitStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  visitDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  visitDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  notesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  usgTimelineContainer: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  usgTimelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 42,
  },
  usgTimelineMarkerColumn: {
    width: 20,
    alignItems: 'center',
  },
  usgTimelineMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  usgTimelineMarkerDone: {
    backgroundColor: '#8B4513',
  },
  usgTimelineMarkerPending: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  usgTimelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  usgTimelineLineDone: {
    backgroundColor: '#d6b38c',
  },
  usgTimelineLinePending: {
    backgroundColor: '#e5e7eb',
  },
  usgTimelineTextBlock: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 10,
  },
  usgTimelineStepLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  usgTimelineStepDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoPillRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoPill: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9a3412',
  },
  fileActionsContainer: {
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  fileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
  },
  fileActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9a3412',
  },
  fileActionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B4513',
  },
  pendingVisitContent: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  markCompleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markCompleteIcon: {
    marginRight: 8,
  },
  markCompleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
  updateUsgContainer: {
    marginTop: 8,
  },
  updateUsgButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#8B4513',
    borderRadius: 12,
    padding: 16,
  },
  updateUsgContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usgIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  usgTextContainer: {
    flex: 1,
  },
  usgTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  usgSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  addVisitButton: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  addVisitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  scheduleUSGButtonHalf: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  deliveryReferralButtonHalf: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  deliveryReferralButtonFull: {
    width: '100%',
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  deliveryReferralButtonActive: {
    backgroundColor: '#f59e0b', // Orange color for active referral
  },
  buttonTextSmall: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  buttonTextContainer: {
    marginLeft: 6,
    alignItems: 'center',
  },
  buttonSubtext: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  buttonIcon: {
    marginRight: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  patientInfoSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabelModal: {
    fontSize: 14,
    color: '#6b7280',
    width: 80,
  },
  infoValueModal: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  dpList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 8,
  },
  dpListContent: {
    paddingBottom: 8,
  },
  noDPText: {
    textAlign: 'center',
    color: '#6b7280',
    padding: 20,
  },
  dpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ebe7e5',
  },
  dpItemSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: '#3b82f6',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  dpInfo: {
    flex: 1,
  },
  dpName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    
  },
  dpAddress: {
    fontSize: 12,
    color: '#6b7280',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    backgroundColor: 'white',
    marginBottom:4
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  activeReferralBanner: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bannerIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6,
  },
  bannerText: {
    fontSize: 12,
    color: '#78350f',
    marginBottom: 2,
  },
  bannerTextBold: {
    fontWeight: '700',
  },
});

export default ANCTrackingScreen;
