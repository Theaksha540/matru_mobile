import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, Funnel, Calendar, FileText, Download } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncService } from '../../utils/syncService';
import { buildApiUrl, reportsAPI } from '../../services/api';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { downloadRemoteReport } from '../../utils/reportDownload';
import '../../i18n';
const DistrictReportsScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const [showFilter, setShowFilter] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFormatModal, setShowFormatModal] = useState(false);
  useEffect(() => {
    loadReportData();
  }, []);

  // Add focus listener to reload data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadReportData();
    });
    return unsubscribe;
  }, [navigation]);
  const loadReportData = async () => {
    try {
      const data = await syncService.getDistrictReports();
      setReportData(data);
    } catch (error) {} finally {
      setLoading(false);
    }
  };

  // Filter options
  const filterOptions = [{
    id: 'all',
    label: t('allReports')
  }, {
    id: 'this-month',
    label: t('thisMonth')
  }, {
    id: 'last-month',
    label: t('lastMonth')
  }, {
    id: 'last-quarter',
    label: t('lastQuarter')
  }];

  // Summary stats
  const summaryStats = reportData ? [{
    id: 1,
    value: reportData.district_summary?.total_pregnant_women?.toString() || '0',
    label: t('totalCases')
  }, {
    id: 2,
    value: reportData.district_summary?.high_risk_cases?.toString() || '0',
    label: t('highRisk')
  }, {
    id: 3,
    value: `${reportData.usg_statistics?.completion_rate?.toFixed(0) || 0}%`,
    label: t('usgRate')
  }] : [{
    id: 1,
    value: '0',
    label: t('totalCases')
  }, {
    id: 2,
    value: '0',
    label: t('highRisk')
  }, {
    id: 3,
    value: '0%',
    label: t('usgRate')
  }];

  // Monthly reports data
  const monthlyReports = reportData ? [{
    id: 1,
    month: `District Performance Report - ${reportData.report_period?.start_date} to ${reportData.report_period?.end_date}`,
    date: formatDateDDMMYYYY(new Date()),
    stats: {
      total: reportData.district_summary?.total_pregnant_women?.toString() || '0',
      highRisk: reportData.district_summary?.high_risk_cases?.toString() || '0',
      ancDone: reportData.usg_statistics?.completed_appointments?.toString() || '0'
    }
  }] : [];
  const handleBack = () => {
    navigation.goBack();
  };
  const handleFilterPress = () => {
    setShowFilter(!showFilter);
  };
  const buildFilterParams = filterId => {
    const params = {};
    const today = new Date();
    switch (filterId) {
      case 'this-month':
        params.start_date = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        params.end_date = today.toISOString().split('T')[0];
        break;
      case 'last-month':
        {
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
          params.start_date = lastMonth.toISOString().split('T')[0];
          params.end_date = lastMonthEnd.toISOString().split('T')[0];
          break;
        }
      case 'last-quarter':
        {
          const quarterStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
          params.start_date = quarterStart.toISOString().split('T')[0];
          params.end_date = today.toISOString().split('T')[0];
          break;
        }
      default:
        break;
    }
    return params;
  };
  const handleFilterSelect = async filterId => {
    setSelectedFilter(filterId);
    setLoading(true);
    try {
      const params = buildFilterParams(filterId);
      if (isOnline) {
        const data = await reportsAPI.getDistrictPerformance(params);
        setReportData(data);
      } else {
        // Use syncService for offline data and apply client-side filtering
        const data = await syncService.getDistrictReports();
        if (data && filterId !== 'all') {
          // Apply date filtering to cached data
          const filteredData = {
            ...data
          };
          // Note: Client-side filtering is limited - showing all data when offline
          setReportData(filteredData);
        } else {
          setReportData(data);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load filtered data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const handleDownloadReport = async format => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot download reports while offline. Please connect to the internet.');
      setShowFormatModal(false);
      return;
    }
    try {
      const fileName = `district_report_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const downloadUrl = buildApiUrl(`/api/v2/reports/district/export/${format}`, buildFilterParams(selectedFilter));
      await downloadRemoteReport({
        url: downloadUrl,
        fileName,
        mimeType: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      });
      Alert.alert('Success', 'Report downloaded successfully');
    } catch (error) {
      Alert.alert(t('error'), error.response?.data?.detail || 'Failed to download report. Please try again.');
    } finally {
      setShowFormatModal(false);
    }
  };
  const showDownloadOptions = () => {
    setShowFormatModal(true);
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>{t('reports')}</Text>
                  <Text style={styles.headerSubtitle}>ରିପୋର୍ଟ</Text>
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
                  <Funnel size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Filter Section */}
          {showFilter && <View style={styles.filterSection}>
              <View style={styles.filterContent}>
                <Text style={styles.filterTitle}>
                  {t('filterByPeriod')} / ଅବଧି ଦ୍ୱାରା ଫିଲ୍ଟର୍ କରନ୍ତୁ
                </Text>
                <View style={styles.filterOptions}>
                  {filterOptions.map(option => <TouchableOpacity key={option.id} style={[styles.filterOption, selectedFilter === option.id && styles.filterOptionSelected]} onPress={() => handleFilterSelect(option.id)} activeOpacity={0.7}>
                      <Text style={[styles.filterOptionText, selectedFilter === option.id && styles.filterOptionTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>)}
                </View>
              </View>
            </View>}

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Summary Stats */}
              <View style={styles.summaryGrid}>
                {summaryStats.map(stat => <View key={stat.id} style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{stat.value}</Text>
                    <Text style={styles.summaryLabel}>{stat.label}</Text>
                  </View>)}
              </View>

              {/* Monthly Reports Section */}
              <Text style={styles.sectionTitle}>
                {t('monthlyReports')} / ମାସିକ ରିପୋର୍ଟ
              </Text>
              <View style={styles.reportsList}>
                {monthlyReports.map(report => <View key={report.id} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <View style={styles.reportInfo}>
                        <Text style={styles.reportMonth}>{report.month}</Text>
                        <View style={styles.reportDateContainer}>
                          <Calendar size={16} color="#6b7280" style={styles.calendarIcon} />
                          <Text style={styles.reportDate}>{report.date}</Text>
                        </View>
                      </View>
                      <View style={styles.reportIconContainer}>
                        <FileText size={16} color="#8B4513" />
                      </View>
                    </View>

                    {/* Report Stats */}
                    <View style={styles.reportStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{report.stats.total}</Text>
                        <Text style={styles.statLabel}>{t('total')}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.highRiskValue}>{report.stats.highRisk}</Text>
                        <Text style={styles.highRiskLabel}>{t('highRisk')}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.ancDoneValue}>{report.stats.ancDone}</Text>
                        <Text style={styles.ancDoneLabel}>{t('ancDone')}</Text>
                      </View>
                    </View>

                    {/* Download Button */}
                    <TouchableOpacity style={styles.downloadButton} onPress={showDownloadOptions} activeOpacity={0.7}>
                      <Download size={16} color="white" style={styles.downloadIcon} />
                      <Text style={styles.downloadText}>
                        {t('downloadReport')} / ରିପୋର୍ଟ ଡାଉନଲୋଡ୍ କରନ୍ତୁ
                      </Text>
                    </TouchableOpacity>
                  </View>)}
              </View>

              {/* Note Banner */}
              <View style={styles.noteBanner}>
                <Text style={styles.noteText}>
                  <Text style={styles.noteBold}>{t('note')}:</Text> {t('reportsGeneratedMonthly')}
                </Text>
                <Text style={styles.noteTextSub}>
                  ପ୍ରତି ମାସର 20 ତାରିଖରେ ରିପୋର୍ଟ ସ୍ୱୟଂଚାଳିତ ଭାବରେ ସୃଷ୍ଟି ହୁଏ
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Format Selection Modal */}
        <Modal visible={showFormatModal} transparent={true} animationType="fade" onRequestClose={() => setShowFormatModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.formatModal}>
              <Text style={styles.modalTitle}>{t('selectDownloadFormat')}</Text>
              <TouchableOpacity style={styles.formatOption} onPress={() => handleDownloadReport('excel')}>
                <Text style={styles.formatText}>Excel (.xlsx)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.formatOption} onPress={() => handleDownloadReport('csv')}>
                <Text style={styles.formatText}>CSV (.csv)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowFormatModal(false)}>
                <Text style={styles.cancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%'
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 20
  },
  headerContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  headerTitleContainer: {
    flex: 1
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: '#8B4513',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  filterSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 8
  },
  filterContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  filterOption: {
    padding: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 4
  },
  filterOptionSelected: {
    backgroundColor: '#8B4513'
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  radioOuter: {
    width: 0,
    height: 0,
    display: 'none'
  },
  radioOuterSelected: {
    display: 'none'
  },
  radioInner: {
    display: 'none'
  },
  filterOptionText: {
    fontSize: 12,
    color: '#1f2937'
  },
  filterOptionTextSelected: {
    color: 'white',
    fontWeight: '500'
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f0f4f8'
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center'
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12
  },
  reportsList: {
    marginBottom: 20
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 8
  },
  reportHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  reportInfo: {
    flex: 1
  },
  reportMonth: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 3
  },
  reportDateContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  calendarIcon: {
    marginRight: 4
  },
  reportDate: {
    fontSize: 11,
    color: '#6b7280'
  },
  reportIconContainer: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  reportStats: {
    backgroundColor: '#f7fafc',
    borderRadius: 6,
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    padding: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 4
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 1
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: '#718096'
  },
  highRiskValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 4
  },
  highRiskLabel: {
    fontSize: 12,
    color: '#dc2626'
  },
  ancDoneValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 4
  },
  ancDoneLabel: {
    fontSize: 12,
    color: '#16a34a'
  },
  downloadButton: {
    backgroundColor: '#8B4513',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  downloadIcon: {
    marginRight: 8
  },
  downloadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center'
  },
  customReportButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#8B4513',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20
  },
  customReportIcon: {
    marginBottom: 12,
    color: '#8B4513'
  },
  customReportTextContainer: {
    alignItems: 'center'
  },
  customReportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 4
  },
  customReportSubtitle: {
    fontSize: 14,
    color: '#6b7280'
  },
  noteBanner: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16
  },
  noteText: {
    fontSize: 14,
    color: '#1e40af',
    marginBottom: 8
  },
  noteBold: {
    fontWeight: '600'
  },
  noteTextSub: {
    fontSize: 14,
    color: '#1d4ed8'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  formatModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#1f2937'
  },
  formatOption: {
    backgroundColor: '#8B4513',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center'
  },
  formatText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  cancelText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
});
export default DistrictReportsScreen;

