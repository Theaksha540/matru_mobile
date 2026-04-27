import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft, 
  UserCheck, 
  RefreshCw, 
  Clock,
  Phone,
  User,
  AlertCircle,
  MapPin,
  Calendar,
  FileText,
  Heart,
  Baby,
  Activity,
  Wifi,
  WifiOff,
  CheckCircle,
  Home
} from 'lucide-react-native';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import Footer from '../../components/Footer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const ReferralDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const { referralId } = route.params || {};
  const [referral, setReferral] = useState(null);
  const [usgCentreMap, setUsgCentreMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [cachedFiles, setCachedFiles] = useState({});
  const [offlineReferralActionCount, setOfflineReferralActionCount] = useState(0);
  const supportedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
  const notSpecifiedText = t('notSpecified');

  console.log('ReferralDetailScreen - referralId:', referralId);
  console.log('ReferralDetailScreen - route.params:', route.params);

  useEffect(() => {
    loadUserInfo();
    if (!referralId) {
      console.error('No referralId provided');
      Alert.alert('Error', 'No referral ID provided');
      setLoading(false);
    }
  }, [referralId]);

  useFocusEffect(
    React.useCallback(() => {
      if (referralId) {
        loadReferralDetails();
      }
    }, [referralId])
  );

  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        console.log('User info loaded:', userData);
        setUserInfo(userData);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
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

  const parseAppDate = (dateValue) => {
    if (!dateValue) return null;

    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      return dateValue;
    }

    const normalizedValue = String(dateValue).trim();
    if (!normalizedValue) return null;

    const isoLikeMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLikeMatch) {
      const [, year, month, day] = isoLikeMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsedDate = new Date(normalizedValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const calculateGestationalAge = (source) => {
    if (!source) return null;

    const currentGestationalAge = String(source?.gestational_age ?? '').trim();
    if (currentGestationalAge) {
      return currentGestationalAge;
    }

    const now = new Date();
    const lmpDate = parseAppDate(source?.lmp_date);
    if (lmpDate) {
      const diffInDays = Math.floor((now.getTime() - lmpDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffInDays >= 0) {
        const weeks = Math.floor(diffInDays / 7);
        const days = diffInDays % 7;
        return days > 0 ? `${weeks}w ${days}d` : `${weeks}w`;
      }
    }

    const eddDate = parseAppDate(source?.expected_delivery_date || source?.edd_date);
    if (eddDate) {
      const daysUntilEdd = Math.floor((eddDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const gestationalDays = 280 - daysUntilEdd;
      if (gestationalDays >= 0) {
        const weeks = Math.floor(gestationalDays / 7);
        const days = gestationalDays % 7;
        return days > 0 ? `${weeks}w ${days}d` : `${weeks}w`;
      }
    }

    return null;
  };

  const flattenReferralData = (data) => {
    if (!data) return null;

    const referralCore = data?.referral || data;
    const patient = data?.pregnant_woman || data?.patient || data;
    const lmpDate = patient?.lmp_date || data?.lmp_date;
    const eddDate = patient?.edd_date || data?.edd_date || data?.expected_delivery_date;
    const expectedDeliveryDate = patient?.edd_date || data?.expected_delivery_date || data?.edd_date;
    const gestationalAge =
      patient?.gestational_age ||
      referralCore?.gestational_age ||
      data?.gestational_age ||
      calculateGestationalAge({
        lmp_date: lmpDate,
        edd_date: eddDate,
        expected_delivery_date: expectedDeliveryDate,
      });

    return {
      ...referralCore,
      pregnant_woman_name:
        patient?.full_name ||
        data?.pregnant_woman_name ||
        data?.patient_name ||
        data?.full_name,
      patient_name:
        patient?.full_name ||
        data?.patient_name ||
        data?.pregnant_woman_name ||
        data?.full_name,
      mobile_number:
        patient?.mobile_number ||
        data?.mobile_number ||
        data?.patient_mobile ||
        data?.pregnant_woman_mobile,
      phone:
        patient?.mobile_number ||
        data?.mobile_number ||
        data?.patient_mobile ||
        data?.pregnant_woman_mobile,
      age: patient?.age || data?.age,
      address: patient?.address || data?.address,
      blood_group: patient?.blood_group || data?.blood_group,
      husband_name: patient?.husband_name || data?.husband_name,
      rch_id: patient?.rch_id || data?.rch_id,
      abha_id: patient?.abha_id || data?.abha_id,
      gravida: patient?.gravida || data?.gravida,
      para: patient?.para || data?.para,
      lmp_date: lmpDate,
      edd_date: eddDate,
      expected_delivery_date: expectedDeliveryDate,
      gestational_age: gestationalAge,
      is_high_risk:
        patient?.is_high_risk !== undefined ? patient?.is_high_risk : data?.is_high_risk,
      risk_factors: patient?.risk_factors || data?.risk_factors,
      anc_visits: data?.anc_visits || [],
      usg_appointments: data?.usg_appointments || [],
      outcome: data?.outcome || null,
      referral_chain: data?.referral_chain || [],
      referral_id: referralCore?.id || data?.referral_id || data?.id,
      dp_name: referralCore?.dp_name || data?.dp_name,
      dp_id: referralCore?.dp_id || data?.dp_id,
      status: referralCore?.status || data?.status,
      created_at: referralCore?.created_at || data?.created_at,
      updated_at: referralCore?.updated_at || data?.updated_at,
      accepted_at: referralCore?.accepted_at || data?.accepted_at,
      observation_notes: referralCore?.observation_notes || data?.observation_notes,
      re_refer_reason: referralCore?.re_refer_reason || data?.re_refer_reason,
      previous_referral_id:
        referralCore?.previous_referral_id || data?.previous_referral_id,
      _original: data,
    };
  };

  const findReferralSummaryById = async (targetReferralId) => {
    try {
      const referrals = await syncService.getDeliveryReferrals();
      const list = Array.isArray(referrals)
        ? referrals
        : Array.isArray(referrals?.items)
          ? referrals.items
          : [];
      const normalizedTargetId = Number(targetReferralId);
      const targetReferralIdString = String(targetReferralId);
      const matchedReferral = list.find((item) => {
        const stringCandidateIds = [
          item?.id,
          item?.referral_id,
          item?.delivery_referral_id,
          item?.reference_id,
          item?.previous_referral_id,
        ]
          .filter((value) => value !== undefined && value !== null)
          .map((value) => String(value));

        if (stringCandidateIds.includes(targetReferralIdString)) {
          return true;
        }

        const candidateIds = [
          item?.id,
          item?.referral_id,
          item?.delivery_referral_id,
          item?.reference_id,
          item?.previous_referral_id,
        ]
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        if (candidateIds.includes(normalizedTargetId)) {
          return true;
        }

        const chain = Array.isArray(item?.referral_chain) ? item.referral_chain : [];
        return chain.some((step) => {
          const chainStringIds = [
            step?.referral_id,
            step?.previous_referral_id,
            step?.reference_id,
          ]
            .filter((value) => value !== undefined && value !== null)
            .map((value) => String(value));

          if (chainStringIds.includes(targetReferralIdString)) {
            return true;
          }

          const chainIds = [
            step?.referral_id,
            step?.previous_referral_id,
            step?.reference_id,
          ]
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
          return chainIds.includes(normalizedTargetId);
        });
      });

      if (matchedReferral) {
        console.log('[REFERRAL-DETAIL] matched referral summary for fallback', {
          referralId: targetReferralId,
          matchedReferralId: matchedReferral.id,
          status: matchedReferral.status,
        });
      }

      return matchedReferral || null;
    } catch (error) {
      console.error('[REFERRAL-DETAIL] failed to load fallback referral summary:', error);
      return null;
    }
  };

  const loadReferralDetails = async () => {
    try {
      setLoading(true);
      console.log('=== LOADING REFERRAL DETAILS ===');
      console.log('Referral ID from params:', referralId);
      console.log('Referral ID type:', typeof referralId);

      let referralData = null;
      let usedFallbackSummary = false;

      try {
        referralData = await syncService.getDeliveryReferralById(referralId);
        if (!referralData) {
          throw new Error('Referral data not found');
        }
      } catch (error) {
        const status = error?.response?.status;
        console.log('[REFERRAL-DETAIL] primary detail fetch failed', {
          referralId,
          status,
          message: error?.message,
        });

        if (status === 403 || status === 404) {
          const fallbackReferral =
            route?.params?.referralData && Number(route.params.referralData?.id) === Number(referralId)
              ? route.params.referralData
              : await findReferralSummaryById(referralId);

          if (fallbackReferral) {
            referralData = fallbackReferral;
            usedFallbackSummary = true;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      console.log('=== API RESPONSE ===');
      console.log('Response type:', typeof referralData);
      console.log('Response keys:', referralData ? Object.keys(referralData) : 'null');
      console.log('Full API Response:', JSON.stringify(referralData, null, 2));
      console.log('Referral ID in response:', referralData?.referral?.id || referralData?.id);
      
      // Log referral chain data specifically
      if (referralData?.referral_chain) {
        console.log('=== REFERRAL CHAIN DATA ===');
        console.log('Referral chain length:', referralData.referral_chain.length);
        console.log('Referral chain full data:', JSON.stringify(referralData.referral_chain, null, 2));
        referralData.referral_chain.forEach((chain, index) => {
          console.log(`\n--- Chain Item ${index + 1} ---`);
          console.log('All keys in chain item:', Object.keys(chain));
          console.log('Chain item data:', JSON.stringify(chain, null, 2));
        });
      } else {
        console.log('=== NO REFERRAL CHAIN DATA ===');
      }
      
      // Handle different response structures
      const response = referralData;
      console.log('Processed referral data:', response);
      
      if (response) {
        const flattenedData = flattenReferralData(response);
        
        console.log('=== FLATTENED DATA ===');
        console.log('Flattened referral data:', JSON.stringify(flattenedData, null, 2));
        console.log('Referral chain in flattened data:', flattenedData.referral_chain);
        if (usedFallbackSummary) {
          console.log('[REFERRAL-DETAIL] using accessible referral summary fallback', {
            referralId,
            loadedReferralId: flattenedData?.referral_id || flattenedData?.id,
          });
        }
        setReferral(flattenedData);
        await loadUSGCentreNames(flattenedData.usg_appointments);
        const offlineReferralActions = await syncService.getOfflineReferralActions();
        setOfflineReferralActionCount(Array.isArray(offlineReferralActions) ? offlineReferralActions.length : 0);
      } else {
        console.error('No referral data found in response');
        Alert.alert('Error', 'Referral data not found');
      }
    } catch (error) {
      console.error('Error loading referral details:', error);
      console.error('Error details:', error.response?.data || error.message);
      Alert.alert('Error', `Failed to load referral details: ${error.message}`);
      setOfflineReferralActionCount(0);
    } finally {
      setLoading(false);
    }
  };

  const loadUSGCentreNames = async (appointments = []) => {
    try {
      const centreIds = [...new Set(
        (Array.isArray(appointments) ? appointments : [])
          .map(item => item?.usg_centre_id)
          .filter(Boolean)
      )];

      if (centreIds.length === 0) {
        setUsgCentreMap({});
        return;
      }

      const centres = await syncService.getUSGCentres();
      const centreList = Array.isArray(centres) ? centres : [];
      const centreMap = centreList.reduce((acc, centre) => {
        if (centre?.id) {
          acc[centre.id] = centre.name || centre.centre_name || centre.usg_centre_name || null;
        }
        return acc;
      }, {});

      setUsgCentreMap(centreMap);
    } catch (error) {
      console.error('Failed to load USG centre names:', error);
      setUsgCentreMap({});
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReferralDetails();
    setRefreshing(false);
  };

  const handleAcceptReferral = async () => {
    Alert.alert(
      t('acceptReferral'),
      t('acceptReferralConfirmation'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('acceptReferral'),
          onPress: async () => {
            try {
              const result = await syncService.acceptDeliveryReferral(referralId);
              Alert.alert(t('success'), result?.offline ? t('referralAcceptedOfflineSync') : t('referralAcceptedSuccessfully'), [
                {
                  text: t('ok'),
                  onPress: () => navigation.replace('ReferralDetail', { referralId })
                }
              ]);
            } catch (error) {
              Alert.alert(t('error'), t('failedToAcceptReferral'));
            }
          }
        }
      ]
    );
  };

  const handleReRefer = () => {
    navigation.navigate('ReReferScreen', { referralId });
  };

  const handleRecordOutcome = () => {
    navigation.navigate('RecordOutcomeScreen', { referralId });
  };

  const handleCallPatient = () => {
    const phoneNumber = referral?.mobile_number || referral?.phone;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      Alert.alert('No Phone Number', 'Phone number not available for this patient');
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return null;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    const baseUrl = process.env.EXPO_PUBLIC_API_URL || '';
    if (!baseUrl) return filePath;

    return `${baseUrl.replace(/\/$/, '')}/${filePath.replace(/^\//, '')}`;
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

  const getCachePath = (type, appointmentId, extension) => 
    `${FileSystem.cacheDirectory}${type}_${appointmentId}.${extension}`;

  const findCachedPath = async (type, appointmentId, preferredExtension, strictExtension = false) => {
    const orderedExtensions = [
      preferredExtension,
      ...(strictExtension ? [] : supportedExtensions.filter((ext) => ext !== preferredExtension)),
    ].filter(Boolean);

    for (const extension of orderedExtensions) {
      const path = getCachePath(type, appointmentId, extension);
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) return path;
    }

    return null;
  };

  const downloadFile = async (fileUrl, type, appointmentId, extension = null, showSuccess = true) => {
    try {
      if (!isOnline) {
        Alert.alert('Offline Mode', 'Cannot download files while offline.');
        return null;
      }

      const detectedExtension = extension || getFileExtensionFromUrl(fileUrl);
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${process.env.EXPO_PUBLIC_API_URL}${fileUrl}`;
      const downloadPath = getCachePath(type, appointmentId, detectedExtension);

      const result = await FileSystem.downloadAsync(fullUrl, downloadPath);

      if (showSuccess) {
        Alert.alert('Success', 'File downloaded for offline viewing');
      }
      return downloadPath;
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
      return null;
    }
  };

  const openFile = async (fileUrl, type, appointmentId) => {
    try {
      if (!fileUrl) {
        Alert.alert('Error', 'File not available');
        return;
      }

      const detectedExtension = getFileExtensionFromUrl(fileUrl);
      const strictExtension = hasExplicitSupportedExtension(fileUrl);
      let cachedPath = await findCachedPath(type, appointmentId, detectedExtension, strictExtension);

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
        Alert.alert('Offline Mode', 'File not cached. Please view it once while online.');
        return;
      }

      cachedPath = await downloadFile(fileUrl, type, appointmentId, detectedExtension, false);
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
      if (canOpen) await Linking.openURL(fullUrl);
    } catch (error) {
      console.error('Error opening file:', error?.message || error);
      Alert.alert('Error', 'Unable to open file. Please try again.');
    }
  };

  const getUSGCentreDisplayName = (usg) => {
    return (
      usg?.usg_centre_name ||
      usgCentreMap[usg?.usg_centre_id] ||
      (usg?.usg_centre_id ? `USG Centre ${usg.usg_centre_id}` : null)
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#10b981';
      case 're_referred':
      case 're-referred': return '#3b82f6';
      case 'completed': return '#059669';
      default: return '#6b7280';
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case 'pending': return '#fef3c7';
      case 'accepted': return '#d1fae5';
      case 're_referred':
      case 're-referred': return '#dbeafe';
      case 'completed': return '#dcfce7';
      default: return '#f3f4f6';
    }
  };

  const formatDate = (dateString) => formatDateDDMMYYYY(dateString);
  const formatDateTime = (dateString) => formatDateTimeDDMMYYYY(dateString);
  const formatDeliveryType = (deliveryType) => {
    if (!deliveryType) return notSpecifiedText;

    return String(deliveryType)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };
  const formatOutcomeValue = (value) => {
    if (!value) return notSpecifiedText;

    return String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getGestationalAgeDisplay = (referralData) => {
    if (!referralData) return notSpecifiedText;

    if (referralData.gestational_age !== undefined && referralData.gestational_age !== null && String(referralData.gestational_age).trim() !== '') {
      const rawValue = String(referralData.gestational_age).trim();
      const compactMatch = rawValue.match(/^(\d+)\s*w(?:\s+(\d+)\s*d)?$/i);
      if (compactMatch) {
        const [, weeksValue, daysValue] = compactMatch;
        return daysValue
          ? `${weeksValue} ${t('weeks') || 'weeks'} ${daysValue} ${t('days') || 'days'}`
          : `${weeksValue} ${t('weeks') || 'weeks'}`;
      }
      return /\bweek/i.test(rawValue) ? rawValue : `${rawValue} ${t('weeks') || 'weeks'}`;
    }

    const calculatedGestationalAge = calculateGestationalAge(referralData);
    if (!calculatedGestationalAge) return notSpecifiedText;

    const compactMatch = calculatedGestationalAge.match(/^(\d+)\s*w(?:\s+(\d+)\s*d)?$/i);
    if (compactMatch) {
      const [, weeksValue, daysValue] = compactMatch;
      return daysValue
        ? `${weeksValue} ${t('weeks') || 'weeks'} ${daysValue} ${t('days') || 'days'}`
        : `${weeksValue} ${t('weeks') || 'weeks'}`;
    }

    return calculatedGestationalAge;
  };

  const getFirstMeaningfulValue = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalizedValue = String(value).trim();
      if (normalizedValue) return normalizedValue;
    }
    return null;
  };

  const buildReferralFlow = (referralData) => {
    const chain = Array.isArray(referralData?.referral_chain)
      ? referralData.referral_chain.filter(Boolean)
      : [];

    return chain.map((chainItem, index) => {
      const previousStep = chain[index - 1];
      const fromLabel = getFirstMeaningfulValue(
        chainItem?.referred_by,
        previousStep?.dp_name,
        previousStep?.referred_to,
        index === 0 ? referralData?.sub_centre_name : null,
        index === 0 ? t('initialReferralSource') : t('previousDeliveryPoint')
      );

      const toLabel = getFirstMeaningfulValue(
        chainItem?.referred_to,
        chainItem?.dp_name,
        index === chain.length - 1 ? referralData?.dp_name : null,
        notSpecifiedText
      );

      return {
        ...chainItem,
        fromLabel,
        toLabel,
      };
    });
  };

  const referralFlow = buildReferralFlow(referral);
  const latestReferralFlow = referralFlow[referralFlow.length - 1] || null;

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Activity size={48} color="#D2691E" />
            <Text style={styles.loadingText}>{t('loadingReferralDetails')}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!referral) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#dc2626" />
            <Text style={styles.errorText}>{t('referralNotFound')}</Text>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>{t('goBack')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const outcome = referral.outcome || {};
  const babies = Array.isArray(outcome.babies) ? outcome.babies : [];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <LinearGradient
          colors={['#D2691E', '#B8860B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('referralDetails')}</Text>
            <Text style={styles.headerSubtitle}>ରେଫରାଲ ବିବରଣୀ</Text>
          </View>
          <TouchableOpacity 
            style={styles.homeButton}
            onPress={handleGoHome}
          >
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#8B4513']}
              tintColor="#8B4513"
            />
          }
        >
          {!isOnline && (
            <LinearGradient
              colors={['#e0f2fe', '#f8fafc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.offlineInfoBanner}
            >
              <WifiOff size={18} color="#0369a1" />
              <View style={styles.offlineInfoContent}>
                <Text style={styles.offlineInfoTitle}>{t('offlineModeTitle')}</Text>
                <Text style={styles.offlineInfoText}>{t('referralOfflineSyncInfo')}</Text>
                {offlineReferralActionCount > 0 && (
                  <Text style={styles.offlineInfoQueued}>
                    {t('offlineReferralActionsWaiting', { count: offlineReferralActionCount })}
                  </Text>
                )}
              </View>
            </LinearGradient>
          )}
          {/* Patient Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <User size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>{t('patientInformation')}</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('name')}:</Text>
                <Text style={styles.infoValue}>{referral.pregnant_woman_name || referral.patient_name || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('mobile')}:</Text>
                <TouchableOpacity onPress={handleCallPatient} style={styles.phoneContainer}>
                  <Phone size={16} color="#059669" />
                  <Text style={styles.phoneNumber}>{referral.mobile_number || referral.phone || notSpecifiedText}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('age')}:</Text>
                <Text style={styles.infoValue}>{referral.age || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('address')}:</Text>
                <Text style={styles.infoValue}>{referral.address || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>RCH ID:</Text>
                <Text style={styles.infoValue}>{referral.rch_id || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ABHA ID:</Text>
                <Text style={styles.infoValue}>{referral.abha_id || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('husbandName')}:</Text>
                <Text style={styles.infoValue}>{referral.husband_name || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('bloodGroup')}:</Text>
                <Text style={styles.infoValue}>{referral.blood_group || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('riskStatus')}:</Text>
                <View style={styles.riskContainer}>
                  <View style={[styles.riskDot, { backgroundColor: referral.is_high_risk ? '#dc2626' : '#10b981' }]} />
                  <Text style={[styles.riskText, { color: referral.is_high_risk ? '#dc2626' : '#10b981' }]}>
                    {referral.is_high_risk ? t('highRisk') : t('normal')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Pregnancy Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <User size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>{t('pregnancyInformation')}</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('gestationalAge')}:</Text>
                <Text style={styles.infoValue}>{getGestationalAgeDisplay(referral)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('lastMenstrualPeriod')}:</Text>
                <Text style={styles.infoValue}>
                  {referral.lmp_date ? formatDate(referral.lmp_date) : notSpecifiedText}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('expectedDeliveryDate')}:</Text>
                <Text style={styles.infoValue}>
                  {referral.expected_delivery_date || referral.edd_date ? formatDate(referral.expected_delivery_date || referral.edd_date) : notSpecifiedText}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('gravida')}:</Text>
                <Text style={styles.infoValue}>{referral.gravida || notSpecifiedText}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('para')}:</Text>
                <Text style={styles.infoValue}>{referral.para || notSpecifiedText}</Text>
              </View>
            </View>
          </View>

          {/* ANC Visits Card */}
          {referral.anc_visits && referral.anc_visits.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Activity size={24} color="#D2691E" />
                <Text style={styles.cardTitle}>{t('ancVisitsCount', { count: referral.anc_visits.length })}</Text>
              </View>
              <View style={styles.cardContent}>
                {referral.anc_visits.map((visit, index) => (
                  <View key={index} style={styles.visitItem}>
                    <View style={styles.visitHeader}>
                      <Text style={styles.visitNumber}>{t('visitNumberLabel', { count: visit.visit_number || index + 1 })}</Text>
                      <Text style={styles.visitDate}>{formatDate(visit.visit_date)}</Text>
                    </View>
                    <View style={styles.visitDetails}>
                      {visit.weight && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('weight')}:</Text>
                          <Text style={styles.visitDetailValue}>{visit.weight} kg</Text>
                        </View>
                      )}
                      {visit.blood_pressure && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('bloodPressure')}:</Text>
                          <Text style={styles.visitDetailValue}>{visit.blood_pressure} mmHg</Text>
                        </View>
                      )}
                      {visit.hemoglobin && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('hemoglobin')}:</Text>
                          <Text style={styles.visitDetailValue}>{visit.hemoglobin} g/dL</Text>
                        </View>
                      )}
                      {visit.fundal_height && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('fundalHeight')}:</Text>
                          <Text style={styles.visitDetailValue}>{visit.fundal_height} cm</Text>
                        </View>
                      )}
                      {visit.fetal_heart_rate && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('fetalHeartRate')}:</Text>
                          <Text style={styles.visitDetailValue}>{visit.fetal_heart_rate} bpm</Text>
                        </View>
                      )}
                      {visit.referred_for_usg !== undefined && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('referredForUSG')}:</Text>
                          <Text style={[styles.visitDetailValue, visit.referred_for_usg ? styles.yesText : styles.noText]}>
                            {visit.referred_for_usg ? t('yes') : t('no')}
                          </Text>
                        </View>
                      )}
                      {visit.is_emergency !== undefined && visit.is_emergency && (
                        <View style={styles.emergencyBadge}>
                          <AlertCircle size={14} color="#dc2626" />
                          <Text style={styles.emergencyBadgeText}>{t('emergencyVisit')}</Text>
                        </View>
                      )}
                      {visit.doctor_notes && visit.doctor_notes.trim() !== '' && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('doctorNotes')}:</Text>
                          <Text style={styles.visitNotes}>{visit.doctor_notes}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* USG Appointments Card */}
          {referral.usg_appointments && referral.usg_appointments.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <FileText size={24} color="#D2691E" />
                <Text style={styles.cardTitle}>{t('usgAppointmentsCount', { count: referral.usg_appointments.length })}</Text>
              </View>
              <View style={styles.cardContent}>
                {referral.usg_appointments.map((usg, index) => (
                  <View key={index} style={styles.visitItem}>
                    <View style={styles.visitHeader}>
                      <Text style={styles.visitNumber}>{t('usgLabel', { count: index + 1 })}</Text>
                      <View style={styles.usgHeaderRight}>
                        {usg.status && (
                          <View style={[styles.usgStatusBadge, { backgroundColor: getStatusBgColor(usg.status) }]}>
                            <Text style={[styles.usgStatusText, { color: getStatusColor(usg.status) }]}>
                              {usg.status.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.visitDate}>
                          {formatDate(usg.scheduled_date || usg.appointment_date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.visitDetails}>
                      {usg.usg_centre_name && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('centreLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.usg_centre_name}</Text>
                        </View>
                      )}
                      {usg.appointment_type && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('appointmentTypeLabel')}:</Text>
                          <Text style={[styles.visitDetailValue, usg.appointment_type === 'emergency' && styles.emergencyText]}>
                            {usg.appointment_type === 'emergency' ? t('emergency') : t('regular')}
                          </Text>
                        </View>
                      )}
                      {usg.scan_date && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('scanDateLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{formatDate(usg.scan_date)}</Text>
                        </View>
                      )}
                      {usg.completed_date && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('completedDateLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{formatDate(usg.completed_date)}</Text>
                        </View>
                      )}
                      {usg.created_at && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('createdAtLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{formatDateTime(usg.created_at)}</Text>
                        </View>
                      )}
                      {usg.trimester && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('trimesterLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.trimester}</Text>
                        </View>
                      )}
                      {usg.scan_type && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('scanTypeLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.scan_type}</Text>
                        </View>
                      )}
                      {usg.gestational_age && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('gestationalAge')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.gestational_age} weeks</Text>
                        </View>
                      )}
                      {usg.doctor_name && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('doctorLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.doctor_name}</Text>
                        </View>
                      )}
                      {usg.technician_name && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('technicianLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.technician_name}</Text>
                        </View>
                      )}
                      {getUSGCentreDisplayName(usg) && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('usgCentreLabel')}:</Text>
                          <Text style={styles.visitDetailValue}>{getUSGCentreDisplayName(usg)}</Text>
                        </View>
                      )}
                      {usg.reschedule_count !== undefined && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('rescheduleCount')}:</Text>
                          <Text style={styles.visitDetailValue}>{usg.reschedule_count}</Text>
                        </View>
                      )}
                      {usg.is_high_risk !== undefined && (
                        <View style={styles.visitDetailRow}>
                          <Text style={styles.visitDetailLabel}>{t('highRisk')}:</Text>
                          <Text style={[styles.visitDetailValue, usg.is_high_risk ? styles.highRiskText : styles.normalRiskText]}>
                            {usg.is_high_risk ? t('yes') : t('no')}
                          </Text>
                        </View>
                      )}
                      {usg.findings && usg.findings.trim() !== '' && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('findingsLabel')}:</Text>
                          <Text style={styles.visitNotes}>{usg.findings}</Text>
                        </View>
                      )}
                      {usg.usg_findings && usg.usg_findings.trim() !== '' && usg.usg_findings !== usg.findings && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('usgFindingsLabel')}:</Text>
                          <Text style={styles.visitNotes}>{usg.usg_findings}</Text>
                        </View>
                      )}
                      {usg.abnormal_findings && usg.abnormal_findings.trim() !== '' && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('abnormalFindingsLabel')}:</Text>
                          <Text style={[styles.visitNotes, styles.abnormalText]}>{usg.abnormal_findings}</Text>
                        </View>
                      )}
                      {usg.additional_notes && usg.additional_notes.trim() !== '' && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('additionalNotesLabel')}:</Text>
                          <Text style={styles.visitNotes}>{usg.additional_notes}</Text>
                        </View>
                      )}
                      {usg.reschedule_reason && usg.reschedule_reason.trim() !== '' && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('rescheduleReasonLabel')}:</Text>
                          <Text style={styles.visitNotes}>{usg.reschedule_reason}</Text>
                        </View>
                      )}
                      {usg.prescription_file_url && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('prescriptionFileLabel')}:</Text>
                          <TouchableOpacity
                            style={styles.fileLinkButton}
                            onPress={() => openFile(usg.prescription_file_url, 'prescription', usg.id)}
                          >
                          <Text style={styles.fileLinkText}>{t('viewOrDownloadPrescription')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {usg.report_file_url && (
                        <View style={styles.notesSection}>
                          <Text style={styles.notesLabel}>{t('reportFileLabel')}:</Text>
                          <TouchableOpacity
                            style={styles.fileLinkButton}
                            onPress={() => openFile(usg.report_file_url, 'report', usg.id)}
                          >
                          <Text style={styles.fileLinkText}>{t('viewOrDownloadReport')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Referral Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FileText size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>{t('referralInformation') || 'Referral Information'}</Text>
              <View style={[styles.headerStatusBadge, { backgroundColor: getStatusBgColor(referral.status || 'pending') }]}>
                <Text style={[styles.headerStatusText, { color: getStatusColor(referral.status || 'pending') }]}>
                  {(referral.status || 'pending').toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              {/* Priority Section */}
              <View style={styles.prioritySection}>
                <View style={styles.priorityBadge}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.priorityBadgeText}>{t('highPriority') || 'High Priority'}</Text>
                </View>
              </View>

              {/* Referring DP Section */}
              <View style={styles.dpSection}>
                <View style={styles.dpHeader}>
                  <User size={20} color="#D2691E" />
                  <Text style={styles.dpTitle}>{t('referringDeliveryPoint') || 'Referring Delivery Point'}</Text>
                </View>
                <View style={styles.dpDetails}>
                  <Text style={styles.dpName}>{referral.dp_name || notSpecifiedText}</Text>
                </View>
              </View>

              {latestReferralFlow && (
                <View style={styles.routeSection}>
                  <Text style={styles.routeTitle}>{t('referralRoute') || 'Referral Route'}</Text>
                  <View style={styles.routeSummaryCard}>
                    <View style={styles.routeRow}>
                      <Text style={styles.routeLabel}>{t('referredFrom') || 'Referred From'}</Text>
                      <Text style={styles.routeValue}>{latestReferralFlow.fromLabel || notSpecifiedText}</Text>
                    </View>
                    <View style={styles.routeArrowRow}>
                      <Text style={styles.routeArrow}>↓</Text>
                    </View>
                    <View style={styles.routeRow}>
                      <Text style={styles.routeLabel}>{t('referredTo') || 'Referred To'}</Text>
                      <Text style={styles.routeValue}>{latestReferralFlow.toLabel || notSpecifiedText}</Text>
                    </View>
                  </View>

                  {referralFlow.length > 1 && (
                    <View style={styles.routeHistoryList}>
                      {referralFlow.map((step, index) => (
                        <View key={`${step.referral_id || index}_${index}`} style={styles.routeHistoryItem}>
                          <Text style={styles.routeHistoryStep}>{`${t('stepLabel') || 'Step'} ${index + 1}`}</Text>
                          <View style={styles.routeHistoryFlow}>
                            <Text style={styles.routeHistoryText}>{step.fromLabel || notSpecifiedText}</Text>
                            <Text style={styles.routeHistoryArrow}>↓</Text>
                            <Text style={styles.routeHistoryText}>{step.toLabel || notSpecifiedText}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Timeline Section */}
              <View style={styles.timelineSection}>
                <Text style={styles.timelineTitle}>{t('timeline')}</Text>
                <View style={styles.timelineItems}>
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineIcon}>
                      <Calendar size={16} color="#059669" />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineLabel}>{t('referralCreated')}</Text>
                      <Text style={styles.timelineValue}>
                        {referral.created_at ? formatDateTime(referral.created_at) : notSpecifiedText}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.timelineItem}>
                    <View style={styles.timelineIcon}>
                      <Clock size={16} color="#3b82f6" />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineLabel}>{t('lastUpdated')}</Text>
                      <Text style={styles.timelineValue}>
                        {referral.updated_at ? formatDateTime(referral.updated_at) : notSpecifiedText}
                      </Text>
                    </View>
                  </View>
                  
                  {referral.accepted_at && (
                    <View style={styles.timelineItem}>
                      <View style={styles.timelineIcon}>
                        <UserCheck size={16} color="#10b981" />
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineLabel}>{t('accepted')}</Text>
                        <Text style={styles.timelineValue}>
                          {formatDateTime(referral.accepted_at)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Previous Referral Link */}
              {referral.previous_referral_id && (
                <View style={styles.previousReferralSection}>
                  <RefreshCw size={16} color="#6b7280" />
                  <Text style={styles.previousReferralText}>
                    {t('previousReferral')}: #{referral.previous_referral_id}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Medical Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Heart size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>{t('medicalInformation')}</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.infoColumn}>
                <Text style={styles.infoLabel}>{t('observationNotes')}:</Text>
                <View style={styles.notesContainer}>
                  <Text style={styles.notesText}>
                    {referral.observation_notes || t('noSpecificObservations')}
                  </Text>
                </View>
              </View>
              {referral.re_refer_reason && (
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>{t('reReferReasonLabel')}:</Text>
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesText}>
                      {referral.re_refer_reason}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.infoColumn}>
                <Text style={styles.infoLabel}>{t('riskAssessment')}:</Text>
                <View style={styles.notesContainer}>
                  <View style={styles.riskAssessment}>
                    <View style={[styles.riskDot, { backgroundColor: referral.is_high_risk ? '#dc2626' : '#10b981' }]} />
                    <Text style={[styles.riskText, { color: referral.is_high_risk ? '#dc2626' : '#10b981' }]}>
                      {referral.is_high_risk ? t('highRiskPregnancy') : t('normalPregnancy')}
                    </Text>
                  </View>
                  {referral.risk_factors && (
                    <Text style={styles.riskFactorsText}>
                      {t('riskFactorsLabel')}: {referral.risk_factors}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Referral Chain Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <RefreshCw size={24} color="#D2691E" />
                <Text style={styles.cardTitle}>{t('referralChainCount', { count: referral.referral_chain.length })}</Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.chainDescription}>
                  {t('completeReferralHistory')}
                </Text>
                {referral.referral_chain.map((chain, index) => (
                  <View key={index} style={styles.chainItemExpanded}>
                    <View style={styles.chainHeaderExpanded}>
                      <View style={styles.chainStepContainer}>
                        <View style={styles.chainStepBadge}>
                          <Text style={styles.chainStepNumber}>{index + 1}</Text>
                        </View>
                        <Text style={styles.chainStepTitle}>{`${t('referralStepLabel') || 'Referral Step'} ${index + 1}`}</Text>
                      </View>
                      <View style={[styles.chainStatusBadge, { backgroundColor: getStatusBgColor(chain.status) }]}>
                        <Text style={[styles.chainStatusBadgeText, { color: getStatusColor(chain.status) }]}>
                          {chain.status?.toUpperCase() || 'UNKNOWN'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.chainDetailsExpanded}>
                      {/* Referring Information */}
                      <View style={styles.chainSection}>
                        <Text style={styles.chainSectionTitle}>{t('referringInformation') || 'Referring Information'}</Text>
                        <View style={styles.chainDetailRow}>
                          <Text style={styles.chainDetailLabel}>{t('referredBy') || 'Referred By'}:</Text>
                          <Text style={styles.chainDetailValue}>
                            {referralFlow[index]?.fromLabel || chain.referred_by || notSpecifiedText}
                          </Text>
                        </View>
                        <View style={styles.chainDetailRow}>
                          <Text style={styles.chainDetailLabel}>{t('referredTo') || 'Referred To'}:</Text>
                          <Text style={styles.chainDetailValue}>
                            {referralFlow[index]?.toLabel || chain.referred_to || chain.dp_name || notSpecifiedText}
                          </Text>
                        </View>
                        <View style={styles.chainDetailRow}>
                          <Text style={styles.chainDetailLabel}>{t('referralIdLabel')}:</Text>
                          <Text style={styles.chainDetailValue}>#{chain.referral_id || notSpecifiedText}</Text>
                        </View>
                        <View style={styles.chainDetailRow}>
                          <Text style={styles.chainDetailLabel}>{t('dpNameLabel')}:</Text>
                          <Text style={styles.chainDetailValue}>{chain.dp_name || notSpecifiedText}</Text>
                        </View>
                        
                      </View>

                      {/* Timeline Information */}
                      <View style={styles.chainSection}>
                        <Text style={styles.chainSectionTitle}>{t('timeline')}</Text>
                        <View style={styles.chainDetailRow}>
                          <Text style={styles.chainDetailLabel}>{t('created')}:</Text>
                          <Text style={styles.chainDetailValue}>{formatDateTime(chain.created_at)}</Text>
                        </View>
                      </View>

                      {/* Medical Information */}
                      {(chain.observation_notes || chain.re_refer_reason) && (
                        <View style={styles.chainSection}>
                          <Text style={styles.chainSectionTitle}>{t('medicalInformation')}</Text>
                          {chain.observation_notes && (
                            <View style={styles.chainNotesContainer}>
                              <Text style={styles.chainNotesLabel}>{t('observationNotes')}:</Text>
                              <Text style={styles.chainNotesText}>{chain.observation_notes}</Text>
                            </View>
                          )}
                          {chain.re_refer_reason && (
                            <View style={styles.chainNotesContainer}>
                              <Text style={styles.chainNotesLabel}>{t('reReferReasonLabel')}:</Text>
                              <Text style={[styles.chainNotesText, styles.reReferReasonText]}>{chain.re_refer_reason}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <CheckCircle size={24} color="#059669" />
              <Text style={styles.cardTitle}>{t('deliveryOutcome')}</Text>
            </View>
            <View style={styles.cardContent}>
              {!referral.outcome && (
                <Text style={styles.infoValue}>{t('outcomeNotRecordedYet')}</Text>
              )}
              {outcome.delivery_type && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('deliveryType')}:</Text>
                  <Text style={styles.infoValue}>{formatDeliveryType(outcome.delivery_type)}</Text>
                </View>
              )}
              {outcome.delivery_date && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('deliveryDate')}:</Text>
                  <Text style={styles.infoValue}>{formatDateTime(outcome.delivery_date)}</Text>
                </View>
              )}
              {babies.length > 0 && (
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>{t('babies')}:</Text>
                  <View style={styles.notesContainer}>
                    {babies.map((baby, index) => (
                      <View
                        key={`${baby.gender || 'baby'}_${index}`}
                        style={[
                          styles.babyOutcomeRow,
                          index !== babies.length - 1 && styles.babyOutcomeRowBorder,
                        ]}
                      >
                        <Text style={styles.babyOutcomeTitle}>{t('babyLabel', { count: index + 1 })}</Text>
                        <Text style={styles.babyOutcomeText}>
                          {t('gender')}: {formatOutcomeValue(baby.gender)}
                        </Text>
                        <Text style={styles.babyOutcomeText}>
                          {t('status')}: {formatOutcomeValue(baby.status)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {outcome.delivery_time && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('deliveryTime')}:</Text>
                  <Text style={styles.infoValue}>{outcome.delivery_time}</Text>
                </View>
              )}
              {outcome.baby_weight && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('babyWeight')}:</Text>
                  <Text style={styles.infoValue}>{outcome.baby_weight} kg</Text>
                </View>
              )}
              {outcome.baby_gender && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('babyGender')}:</Text>
                  <Text style={styles.infoValue}>{outcome.baby_gender}</Text>
                </View>
              )}
              {outcome.mother_condition && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('motherCondition')}:</Text>
                  <Text style={styles.infoValue}>{outcome.mother_condition}</Text>
                </View>
              )}
              {outcome.baby_condition && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('babyCondition')}:</Text>
                  <Text style={styles.infoValue}>{outcome.baby_condition}</Text>
                </View>
              )}
              {outcome.complications && (
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>{t('complications')}:</Text>
                  <View style={styles.notesContainer}>
                    <Text style={[styles.notesText, { color: '#dc2626', fontWeight: '500' }]}>
                      {outcome.complications}
                    </Text>
                  </View>
                </View>
              )}
              {outcome.remarks && (
                <View style={styles.infoColumn}>
                  <Text style={styles.infoLabel}>{t('remarks')}:</Text>
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesText}>{outcome.remarks}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons - Only show for DP users */}
          {userInfo?.role === 'dp' && (
            <View style={styles.actionSection}>
              {(referral.status || 'pending') === 'pending' && (
                <>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={handleAcceptReferral}
                  >
                    <UserCheck size={20} color="white" />
                    <Text style={styles.acceptButtonText}>{t('acceptReferral')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.reReferButton}
                    onPress={handleReRefer}
                  >
                    <RefreshCw size={20} color="#dc2626" />
                    <Text style={styles.reReferButtonText}>{t('reReferPatient')}</Text>
                  </TouchableOpacity>
                </>
              )}
              
              {(referral.status || 'pending') === 'accepted' && (
                <TouchableOpacity
                  style={styles.outcomeButton}
                  onPress={handleRecordOutcome}
                >
                  <CheckCircle size={20} color="#059669" />
                  <Text style={styles.outcomeButtonText}>{t('recordOutcome')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Info message for non-DP users */}
          {userInfo?.role !== 'dp' && ((referral.status || 'pending') === 'pending' || (referral.status || 'pending') === 'accepted') && (
            <View style={styles.infoMessageContainer}>
              <AlertCircle size={20} color="#3b82f6" />
              <Text style={styles.infoMessageText}>
                {t('onlyDpCanManageReferral')}
              </Text>
            </View>
          )}

          <Footer />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  offlineInfoBanner: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  offlineInfoContent: {
    flex: 1,
  },
  offlineInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  offlineInfoText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  offlineInfoQueued: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#0369a1',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
  },
  cardContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoColumn: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#6b7280',
    flex: 2,
    textAlign: 'right',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  notesContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  babyOutcomeRow: {
    paddingVertical: 6,
  },
  babyOutcomeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 6,
    paddingBottom: 10,
  },
  babyOutcomeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  babyOutcomeText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  actionSection: {
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  acceptButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  reReferButton: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  chainItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D2691E',
  },
  chainItemExpanded: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chainDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  chainHeaderExpanded: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f3f4f6',
  },
  chainStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chainStepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D2691E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainStepNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  chainStepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  chainStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chainStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chainDetailsExpanded: {
    gap: 16,
  },
  chainSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  chainSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  chainDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  chainDetailLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  chainDetailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },
  chainNotesContainer: {
    marginBottom: 8,
  },
  chainNotesLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
  },
  chainNotesText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  reReferReasonText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  priorityHighlight: {
    color: '#dc2626',
    fontWeight: '700',
  },
  outcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  complicationText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  chainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chainStep: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D2691E',
  },
  chainStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  chainStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  chainDetails: {
    gap: 4,
  },
  chainText: {
    fontSize: 13,
    color: '#6b7280',
  },
  chainReason: {
    fontSize: 13,
    color: '#dc2626',
    fontStyle: 'italic',
    marginTop: 4,
  },
  riskAssessment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  riskFactorsText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  headerStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  headerStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  prioritySection: {
    alignItems: 'flex-end',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 4,
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  dpSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E',
  },
  dpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  dpDetails: {
    marginLeft: 28,
  },
  dpName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  routeSection: {
    marginBottom: 20,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  routeSummaryCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 14,
  },
  routeRow: {
    gap: 4,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9a3412',
    letterSpacing: 0.4,
  },
  routeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  routeArrowRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  routeArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D2691E',
  },
  routeHistoryList: {
    marginTop: 12,
    gap: 8,
  },
  routeHistoryItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  routeHistoryStep: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 4,
  },
  routeHistoryFlow: {
    alignItems: 'center',
    gap: 4,
  },
  routeHistoryText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
    textAlign: 'center',
  },
  routeHistoryArrow: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D2691E',
  },
  timelineSection: {
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  timelineItems: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  timelineValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  previousReferralSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  previousReferralText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  reReferButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '700',
  },
  outcomeButton: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#86efac',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  outcomeButtonText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '700',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 8,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6,
  },
  onlineText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  offlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  infoMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  infoMessageText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  visitItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E',
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  visitNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D2691E',
  },
  visitDate: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  visitDetails: {
    gap: 8,
  },
  visitDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  visitDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  visitDetailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  yesText: {
    color: '#059669',
  },
  noText: {
    color: '#6b7280',
  },
  emergencyText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  highRiskText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  normalRiskText: {
    color: '#059669',
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  emergencyBadgeText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  notesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 4,
  },
  visitNotes: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  fileLinkButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fileLinkText: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  abnormalText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  usgHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  usgStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  usgStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default ReferralDetailScreen;
