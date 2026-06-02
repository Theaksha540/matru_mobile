import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Home, Search, HeartPulse, Calendar } from 'lucide-react-native';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { syncService } from '../../utils/syncService';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateFormat';

const ECGReportsListScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
  useEffect(() => {
    loadUserInfo();
    loadReports();
  }, []);
  const loadUserInfo = async () => {
    try {
      const data = await secureStorage.getItem('user_info');
      if (data) {
        setUserInfo(data);
      }
    } catch (error) {}
  };
  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await syncService.getECGReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert(t('error'), t('failedToLoadEcgReports'));
      setReports([]);
    } finally {
      setLoading(false);
    }
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };
  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter(report => [report?.pregnant_woman_name, report?.mobile_number, report?.dp_name, report?.recorded_by_name, report?.result].filter(Boolean).some(value => String(value).toLowerCase().includes(query)));
  }, [reports, searchQuery]);
  const formatReportDate = value => formatDateDDMMYYYY(value);
  const formatReportDateTime = value => formatDateTimeDDMMYYYY(value);
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <LinearGradient colors={['#D2691E', '#B8860B']} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }} style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('ecgReports')}</Text>
            <Text style={styles.headerSubtitle}>{userInfo?.dp_name || userInfo?.username || t('reportList')}</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#D2691E']} tintColor="#D2691E" />}>
          {!isOnline && <View style={styles.warningBanner}>
              <Text style={styles.warningText}>{t('ecgOfflineListInfo')}</Text>
            </View>}

          <View style={styles.searchWrap}>
            <Search size={18} color="#6b7280" />
            <TextInput style={styles.searchInput} placeholder={t('searchByPatientMobileDpOrResult')} value={searchQuery} onChangeText={setSearchQuery} />
          </View>

          {loading ? <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D2691E" />
              <Text style={styles.loadingText}>{t('loadingEcgReports')}</Text>
            </View> : filteredReports.length === 0 ? <View style={styles.emptyState}>
              <HeartPulse size={44} color="#d1d5db" />
              <Text style={styles.emptyTitle}>{t('noEcgReportsFound')}</Text>
            </View> : filteredReports.map(report => <TouchableOpacity key={report.id} style={styles.card} activeOpacity={0.8} onPress={() => navigation.navigate('ECGReportDetail', {
          ecgId: report.id,
          reportData: report
        })}>
                <View style={styles.cardHeader}>
                  <View style={styles.patientSection}>
                    <Text style={styles.patientName}>{report.pregnant_woman_name}</Text>
                    <Text style={styles.mobileText}>{report.mobile_number}</Text>
                  </View>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeText}>{String(report.result || t('notAvailable')).toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('ecgDate')}:</Text>
                  <Text style={styles.infoValue}>{formatReportDate(report.ecg_date)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('deliveryPoint')}:</Text>
                  <Text style={styles.infoValue}>{report.dp_name || t('notAvailable')}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('recordedBy')}:</Text>
                  <Text style={styles.infoValue}>{report.recorded_by_name || t('notAvailable')}</Text>
                </View>
                {report.notes ? <View style={styles.notesBox}>
                    <Text style={styles.notesText}>{report.notes}</Text>
                  </View> : null}

                <View style={styles.cardActions}>
                  <View style={styles.metaWrap}>
                    <Calendar size={14} color="#6b7280" />
                    <Text style={styles.metaText}>{formatReportDateTime(report.created_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>)}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>;
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
  content: {
    flex: 1,
    padding: 16
  },
  warningBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600'
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  patientSection: {
    flex: 1
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  mobileText: {
    fontSize: 13,
    color: '#6b7280'
  },
  resultBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 12
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9a3412'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  notesBox: {
    marginTop: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12
  },
  notesText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  metaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280'
  },
});

export default ECGReportsListScreen;
