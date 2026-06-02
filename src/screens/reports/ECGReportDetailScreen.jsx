import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Home, FileText } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { syncService } from '../../utils/syncService';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';
const ECGReportDetailScreen = ({ navigation, route }) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const ecgId = route?.params?.ecgId;
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(route?.params?.reportData || null);

  const buildAbsoluteUrlCandidates = relativeOrAbsolutePath => {
    if (!relativeOrAbsolutePath || typeof relativeOrAbsolutePath !== 'string') {
      return [];
    }
    if (/^https?:\/\//i.test(relativeOrAbsolutePath)) {
      return [relativeOrAbsolutePath];
    }
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiBaseUrl) {
      return [relativeOrAbsolutePath];
    }
    try {
      const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '');
      if (relativeOrAbsolutePath.startsWith('/')) {
        const origin = new URL(apiBaseUrl).origin;
        const candidates = [
          `${normalizedBaseUrl}${relativeOrAbsolutePath}`,
          `${origin}${relativeOrAbsolutePath}`
        ];
        return [...new Set(candidates)];
      }
      return [new URL(relativeOrAbsolutePath, `${normalizedBaseUrl}/`).toString()];
    } catch (error) {
      return [relativeOrAbsolutePath];
    }
  };

  const getMimeType = sourcePath => {
    const normalizedPath = String(sourcePath || '').toLowerCase();
    if (normalizedPath.endsWith('.png')) return 'image/png';
    if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) return 'image/jpeg';
    if (normalizedPath.endsWith('.pdf')) return 'application/pdf';
    return report?.file_info?.mime_type || 'application/octet-stream';
  };

  const formatReportDate = value => formatDateDDMMYYYY(value);
  const formatReportDateTime = value => formatDateTimeDDMMYYYY(value);

  const getReportFileName = () => {
    const originalName = report?.file_info?.original_name || report?.report_file_name || report?.file_name || report?.report_name;
    if (originalName) {
      return originalName;
    }
    const inferredPath = report?.report_file_url || report?.report_file || report?.report_url || '';
    const cleanPath = String(inferredPath).split('?')[0].split('#')[0];
    const extensionMatch = cleanPath.match(/\.([a-z0-9]+)$/i);
    const extension = extensionMatch?.[1] || 'pdf';
    return `ecg_report_${report?.id || Date.now()}.${extension}`;
  };

  const getCacheFileCandidates = fileName => {
    const normalizedFileName = fileName || getReportFileName();
    const candidates = [];
    const maxCandidateCount = 3;
    for (let index = 0; index < maxCandidateCount; index++) {
      candidates.push(`${FileSystem.cacheDirectory}${report?.id || 'ecg'}_${index}_${normalizedFileName}`);
    }
    return candidates;
  };

  const findCachedReportFile = async fileName => {
    const cacheCandidates = getCacheFileCandidates(fileName);
    for (const cachePath of cacheCandidates) {
      const fileInfo = await FileSystem.getInfoAsync(cachePath);
      if (fileInfo?.exists) {
        return cachePath;
      }
    }
    return null;
  };

  const getRemoteReportUrls = () => {
    const candidates = [
      report?.report_file_url,
      report?.report_url,
      report?.report_file,
      Array.isArray(report?.report_file_urls) ? report.report_file_urls[0] : null,
      Array.isArray(report?.report_urls) ? report.report_urls[0] : null
    ].filter(Boolean);
    const rawUrl = candidates[0] || null;
    return rawUrl ? buildAbsoluteUrlCandidates(rawUrl) : [];
  };

  const openLocalFile = async localUri => {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo?.exists) {
      throw new Error(`Local ECG report file not found: ${localUri}`);
    }
    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(localUri);
      const mimeType = getMimeType(localUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: mimeType
      });
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error('Sharing is not available on this device');
    }
    await Sharing.shareAsync(localUri, {
      mimeType: getMimeType(localUri)
    });
  };

  const downloadAuthenticatedFileToCache = async (remoteUrls, fileName) => {
    const candidates = Array.isArray(remoteUrls) ? remoteUrls.filter(Boolean) : [remoteUrls].filter(Boolean);
    if (candidates.length === 0) {
      throw new Error('No ECG report URL candidates available for download');
    }
    const normalizedFileName = fileName || `ecg_report_${report?.id || Date.now()}`;
    const token = await secureStorage.getItem('access_token');
    let lastError = null;
    for (let index = 0; index < candidates.length; index++) {
      const remoteUrl = candidates[index];
      const cachePath = `${FileSystem.cacheDirectory}${report?.id || 'ecg'}_${index}_${normalizedFileName}`;
      try {
        const downloadResult = await FileSystem.downloadAsync(remoteUrl, cachePath, {
          headers: token ? {
            Authorization: `Bearer ${token}`
          } : {}
        });
        if (downloadResult?.status && downloadResult.status >= 400) {
          lastError = new Error(`ECG report download failed with status ${downloadResult.status}`);
          continue;
        }
        return downloadResult?.uri || cachePath;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('ECG report download failed');
  };

  const shouldUseAuthenticatedDownload = remoteUrl => {
    const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!remoteUrl) return false;
    try {
      const absoluteRemoteUrl = new URL(remoteUrl);
      if (!configuredBaseUrl) {
        return absoluteRemoteUrl.pathname.startsWith('/uploads/');
      }
      const apiUrl = new URL(configuredBaseUrl);
      return absoluteRemoteUrl.host === apiUrl.host;
    } catch (error) {
      return true;
    }
  };

  useEffect(() => {
    loadUserInfo();
    loadReportDetail();
  }, [ecgId]);

  const handleGoHome = async () => {
    const storedUser = await secureStorage.getItem('user_info');
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    navigation.navigate(roleRouteMap[storedUser?.role] || 'DPDashboard');
  };

  const loadUserInfo = async () => {
    try {
      const data = await secureStorage.getItem('user_info');
      if (data) {
        setUserInfo(data);
      }
    } catch (error) {}
  };

  const loadReportDetail = async () => {
    if (!ecgId) {
      setLoading(false);
      Alert.alert(t('error'), t('ecgReportIdMissing'));
      return;
    }
    try {
      setLoading(true);
      const data = await syncService.getECGReportById(ecgId);
      setReport(data || null);
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadEcgReportDetail'));
    } finally {
      setLoading(false);
    }
  };

  const openReportFile = async () => {
    try {
      const fileName = getReportFileName();
      const cachedUri = await findCachedReportFile(fileName);
      const localUri = report?.file_info?.local_uri || cachedUri || null;
      const remoteUrls = getRemoteReportUrls();
      const remoteUrl = remoteUrls[0] || null;
      const mimeType = getMimeType(remoteUrl || localUri || fileName);

      if (localUri) {
        await openLocalFile(localUri);
        return;
      }

      if (!remoteUrl) {
        Alert.alert(t('info'), t('noReportFileAttached'));
        return;
      }

      if (!isOnline) {
        Alert.alert(t('error'), t('unableToOpenReportFile'));
        return;
      }

      const canOpen = await Linking.canOpenURL(remoteUrl);
      if (shouldUseAuthenticatedDownload(remoteUrl)) {
        const downloadedUri = await downloadAuthenticatedFileToCache(remoteUrls, fileName);
        await openLocalFile(downloadedUri);
        return;
      }
      if (canOpen) {
        await Linking.openURL(remoteUrl);
        return;
      }
      throw new Error('No supported method available to open ECG report URL');
    } catch (error) {
      Alert.alert(t('error'), t('unableToOpenReportFile'));
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D2691E" />
            <Text style={styles.loadingText}>{t('loadingEcgReportDetail')}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!report) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('ecgReportDetailUnavailable')}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <LinearGradient colors={['#D2691E', '#B8860B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('ecgReportDetail')}</Text>
            <Text style={styles.headerSubtitle}>{userInfo?.dp_name || userInfo?.username || t('detailView')}</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {!isOnline && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>{t('ecgOfflineDetailInfo')}</Text>
          </View>
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('patientInformation')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('name')}</Text>
              <Text style={styles.infoValue}>{report.pregnant_woman_name || t('notAvailable')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('mobile')}</Text>
              <Text style={styles.infoValue}>{report.mobile_number || t('notAvailable')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('pregnantWomanId')}</Text>
              <Text style={styles.infoValue}>{report.pregnant_woman_id ?? t('notAvailable')}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('ecgDetails')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('reportId')}</Text>
              <Text style={styles.infoValue}>{report.id ?? t('notAvailable')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ecgDate')}</Text>
              <Text style={styles.infoValue}>{formatReportDate(report.ecg_date)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('result')}</Text>
              <Text style={styles.infoValue}>{String(report.result || t('notAvailable')).toUpperCase()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('notes')}</Text>
              <Text style={styles.infoValue}>{report.notes || t('notAvailable')}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('auditInformation')}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('deliveryPoint')}</Text>
              <Text style={styles.infoValue}>{report.dp_name || t('notAvailable')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('recordedBy')}</Text>
              <Text style={styles.infoValue}>{report.recorded_by_name || t('notAvailable')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('createdAtLabel')}</Text>
              <Text style={styles.infoValue}>{formatReportDateTime(report.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('updatedAt')}</Text>
              <Text style={styles.infoValue}>{formatReportDateTime(report.updated_at)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.fileButton} onPress={openReportFile}>
            <FileText size={18} color="#8B4513" />
            <Text style={styles.fileButtonText}>{t('viewReportFile')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700'
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    marginTop: 2
  },
  warningBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 16
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600'
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    color: '#111827',
    fontWeight: '600'
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 24
  },
  fileButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B4513'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center'
  }
});

export default ECGReportDetailScreen;
