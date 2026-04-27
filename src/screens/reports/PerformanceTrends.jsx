import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Filter, FileText, Download, TrendingUp, Home } from 'lucide-react-native';
import { syncService } from '../../utils/syncService';
import { buildApiUrl, reportsAPI } from '../../services/api';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { downloadRemoteReport } from '../../utils/reportDownload';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import '../../i18n';

const PerformanceTrends = ({ navigation }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [activeView, setActiveView] = useState('block'); // 'block' or 'ward'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);

  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard',
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'DistrictDashboard';
    navigation.navigate(dashboardRoute);
  };

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const handleDownload = async (format) => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot download reports while offline. Please connect to the internet.');
      return;
    }
    
    try {
      console.log(`Downloading ${format} report for ${activeView} view`);
      const isBlockUser = userInfo?.role === 'block';
      const extension = format === 'excel' ? 'xlsx' : format;
      const fileName = `performance_trends_${activeView}_${new Date().toISOString().split('T')[0]}.${extension}`;
      const downloadUrl = buildApiUrl(
        isBlockUser ? `/api/v1/reports/block/export/${format}` : `/api/v1/reports/district/export/${format}`,
        { view_type: activeView, year: 2026 }
      );
      await downloadRemoteReport({
        url: downloadUrl,
        fileName,
        mimeType: format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
      });
      Alert.alert('Success', 'Report downloaded successfully');
    } catch (error) {
      console.error(`Error downloading ${format}:`, error);
      Alert.alert('Download Failed', 'Unable to download report. Please try again.');
    }
  };

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading performance trends for:', activeView);
      console.log('User info:', userInfo);
      
      let result;
      if (activeView === 'ward') {
        if (userInfo?.role === 'district') {
          console.log('District user - ward data not available');
          setData({ wards: [], message: 'Ward-wise data is only available for block users' });
          return;
        } else {
          console.log('Loading ward data using block ward-wise report');
          result = await reportsAPI.getBlockWardWiseReport();
        }
      } else {
        console.log('Loading block data');
        result = await reportsAPI.getBlockWiseTrends(2026);
      }
      
      console.log('API response:', result);
      setData(result);
    } catch (error) {
      console.error(`Error loading ${activeView} data:`, error);
      console.error('Error details:', error.response?.data);
      setData({ blocks: [], wards: [] });
    } finally {
      setLoading(false);
    }
  };

  const renderStatCard = (number, label, bgColor = '#f3f4f6', textColor = '#1f2937') => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <Text style={[styles.statNumber, { color: textColor }]}>{number}</Text>
      <Text style={[styles.statLabel, { color: textColor }]}>{label}</Text>
    </View>
  );

  const renderTableRow = (item, index) => {
    // Calculate totals from monthly_data
    const totalRegistrations = item.monthly_data?.reduce((sum, month) => sum + (month.registrations || 0), 0) || 0;
    const totalAppointments = item.monthly_data?.reduce((sum, month) => sum + (month.appointments || 0), 0) || 0;
    const totalGrievances = item.monthly_data?.reduce((sum, month) => sum + (month.grievances || 0), 0) || 0;
    const totalHighRisk = item.monthly_data?.reduce((sum, month) => sum + (month.high_risk || 0), 0) || 0;
    
    // Calculate trend (comparing current month vs previous month)
    const currentMonth = item.monthly_data?.[0] || {};
    const previousMonth = item.monthly_data?.[1] || {};
    const trendPercentage = previousMonth.registrations > 0 
      ? (((currentMonth.registrations - previousMonth.registrations) / previousMonth.registrations) * 100).toFixed(1)
      : '0';
    const isPositiveTrend = parseFloat(trendPercentage) > 0;
    
    return (
      <View key={index} style={styles.tableRow}>
        <Text style={styles.nameCell}>{item.block_name || item.ward_name}</Text>
        <Text style={styles.tableCell}>{totalRegistrations}</Text>
        <Text style={styles.tableCell}>{totalHighRisk}</Text>
        <Text style={styles.tableCell}>{totalAppointments > 0 ? Math.round((totalAppointments/totalRegistrations) * 100) : 0}%</Text>
        <Text style={styles.tableCell}>{Math.floor(totalRegistrations * 0.8)}</Text>
        <Text style={[styles.trendCell, isPositiveTrend ? styles.positiveTrend : styles.negativeTrend]}>
          {isPositiveTrend ? '+' : ''}{trendPercentage}%
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('performanceTrends')}</Text>
          <Text style={styles.headerSubtitle}>କାର୍ଯ୍ୟଦକ୍ଷତା ଧାରା</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Home size={20} color="#1f2937" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color="#1f2937" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity 
            style={[styles.toggleBtn, activeView === 'block' && styles.activeToggle]}
            onPress={() => setActiveView('block')}
          >
            <Text style={[styles.toggleText, activeView === 'block' && styles.activeToggleText]}>
              {t('blockWise')} / ବ୍ଲକ-ଭିତ୍ତିକ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, activeView === 'ward' && styles.activeToggle]}
            onPress={() => setActiveView('ward')}
          >
            <Text style={[styles.toggleText, activeView === 'ward' && styles.activeToggleText]}>
              {t('wardWise')} / ୱାର୍ଡ-ଭିତ୍ତିକ
            </Text>
          </TouchableOpacity>
        </View>

        {/* Download Section */}
        <View style={styles.downloadSection}>
          <Text style={styles.downloadTitle}>{t('downloadReports')} / ରିପୋର୍ଟ ଡାଉନଲୋଡ କରନ୍ତୁ</Text>
          <View style={styles.downloadButtons}>
            <TouchableOpacity 
              style={[styles.downloadBtn, styles.pdfBtn]}
              onPress={() => handleDownload('pdf')}
            >
              <FileText size={16} color="white" />
              <Text style={styles.downloadBtnText}>{t('pdfReport')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.downloadBtn, styles.excelBtn]}
              onPress={() => handleDownload('excel')}
            >
              <Download size={16} color="white" />
              <Text style={styles.downloadBtnText}>{t('excelReport')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#8B4513" style={styles.loading} />
        ) : (
          <>
            {/* Performance Summary */}
            <View style={styles.performanceSummary}>
              {renderStatCard(
                (data?.blocks || data?.wards)?.reduce((sum, item) => 
                  sum + (item.monthly_data?.reduce((monthSum, month) => monthSum + (month.registrations || 0), 0) || 0), 0
                ) || '0', 
                'Total Cases'
              )}
              {renderStatCard(
                (data?.blocks || data?.wards)?.length > 0 
                  ? Math.round(
                      (data.blocks || data.wards).reduce((sum, item) => {
                        const registrations = item.monthly_data?.reduce((monthSum, month) => monthSum + (month.registrations || 0), 0) || 0;
                        const appointments = item.monthly_data?.reduce((monthSum, month) => monthSum + (month.appointments || 0), 0) || 0;
                        return sum + (registrations > 0 ? (appointments/registrations) * 100 : 0);
                      }, 0) / (data.blocks || data.wards).length
                    ) + '%'
                  : '0%', 
                'Avg ANC Rate', '#dcfce7', '#16a34a'
              )}
              {renderStatCard('+2.5%', 'Growth Trend', '#dbeafe', '#2563eb')}
            </View>

            {/* Performance Table */}
            <View style={styles.performanceTable}>
              <View style={styles.tableHeader}>
                <TrendingUp size={20} color="#1f2937" />
                <Text style={styles.tableTitle}>
                  {activeView === 'block' ? 'Block Performance /ବ୍ଲକ କାର୍ଯ୍ୟଦକ୍ଷତା' : 'Ward Performance /ୱାର୍ଡ କାର୍ଯ୍ୟଦକ୍ଷତା'}
                </Text>
              </View>
              
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={styles.tableHeaderCell}>{activeView === 'block' ? 'Block' : 'Ward'}</Text>
                  <Text style={styles.tableHeaderCell}>Total Cases</Text>
                  <Text style={styles.tableHeaderCell}>High Risk</Text>
                  <Text style={styles.tableHeaderCell}>ANC Rate</Text>
                  <Text style={styles.tableHeaderCell}>Deliveries</Text>
                  <Text style={styles.tableHeaderCell}>Trend</Text>
                </View>
                
                {/* Table Body */}
                {data?.message ? (
                  <View style={styles.messageContainer}>
                    <Text style={styles.messageText}>{data.message}</Text>
                  </View>
                ) : (
                  (data?.blocks || data?.wards)?.map((item, index) => renderTableRow(item, index))
                )}
              </View>
            </View>

            {/* Key Insights */}
            <View style={styles.trendInsights}>
              <Text style={styles.insightsTitle}>Key Insights / ମୁଖ୍ୟ ଅନ୍ତର୍ଦୃଷ୍ଟି</Text>
              <View style={styles.insightsGrid}>
                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Best Performing</Text>
                  <Text style={styles.insightText}>
                    {(data?.blocks || data?.wards)?.length > 0 
                      ? (data.blocks || data.wards).reduce((best, item) => {
                          const bestTotal = best.monthly_data?.reduce((sum, month) => sum + (month.registrations || 0), 0) || 0;
                          const itemTotal = item.monthly_data?.reduce((sum, month) => sum + (month.registrations || 0), 0) || 0;
                          return itemTotal > bestTotal ? item : best;
                        })[activeView === 'block' ? 'block_name' : 'ward_name'] + ' - ' + ((data.blocks || data.wards).reduce((best, item) => {
                          const bestTotal = best.monthly_data?.reduce((sum, month) => sum + (month.registrations || 0), 0) || 0;
                          const itemTotal = item.monthly_data?.reduce((sum, month) => sum + (month.registrations || 0), 0) || 0;
                          return itemTotal > bestTotal ? item : best;
                        }).monthly_data?.reduce((sum, month) => sum + (month.registrations || 0), 0) || 0) + ' cases'
                      : 'Loading...'
                    }
                  </Text>
                </View>
                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Needs Attention</Text>
                  <Text style={styles.insightText}>
                    {(data?.blocks || data?.wards)?.length > 0 
                      ? (data.blocks || data.wards).reduce((worst, item) => {
                          const worstGrievances = worst.monthly_data?.reduce((sum, month) => sum + (month.grievances || 0), 0) || 0;
                          const itemGrievances = item.monthly_data?.reduce((sum, month) => sum + (month.grievances || 0), 0) || 0;
                          return itemGrievances > worstGrievances ? item : worst;
                        })[activeView === 'block' ? 'block_name' : 'ward_name'] + ' - ' + ((data.blocks || data.wards).reduce((worst, item) => {
                          const worstGrievances = worst.monthly_data?.reduce((sum, month) => sum + (month.grievances || 0), 0) || 0;
                          const itemGrievances = item.monthly_data?.reduce((sum, month) => sum + (month.grievances || 0), 0) || 0;
                          return itemGrievances > worstGrievances ? item : worst;
                        }).monthly_data?.reduce((sum, month) => sum + (month.grievances || 0), 0) || 0) + ' grievances'
                      : 'Loading...'
                    }
                  </Text>
                </View>
                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Most Active</Text>
                  <Text style={styles.insightText}>
                    {(data?.blocks || data?.wards)?.length > 0 
                      ? (data.blocks || data.wards).reduce((most, item) => {
                          const mostAppts = most.monthly_data?.reduce((sum, month) => sum + (month.appointments || 0), 0) || 0;
                          const itemAppts = item.monthly_data?.reduce((sum, month) => sum + (month.appointments || 0), 0) || 0;
                          return itemAppts > mostAppts ? item : most;
                        })[activeView === 'block' ? 'block_name' : 'ward_name'] + ' - ' + ((data.blocks || data.wards).reduce((most, item) => {
                          const mostAppts = most.monthly_data?.reduce((sum, month) => sum + (month.appointments || 0), 0) || 0;
                          const itemAppts = item.monthly_data?.reduce((sum, month) => sum + (month.appointments || 0), 0) || 0;
                          return itemAppts > mostAppts ? item : most;
                        }).monthly_data?.reduce((sum, month) => sum + (month.appointments || 0), 0) || 0) + ' appointments'
                      : 'Loading...'
                    }
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#D2691E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButton: {
    padding: 8,
  },
  homeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e9d5ff',
    opacity: 0.95,
  },
  filterButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  viewToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: '#D2691E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeToggleText: {
    color: 'white',
    fontWeight: '600',
  },
  downloadSection: {
    margin: 16,
    marginTop: 0,
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  downloadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  pdfBtn: {
    backgroundColor: '#dc2626',
  },
  excelBtn: {
    backgroundColor: '#16a34a',
  },
  downloadBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  performanceSummary: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  performanceTable: {
    margin: 16,
    marginTop: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  nameCell: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  trendCell: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  positiveTrend: {
    color: '#16a34a',
  },
  negativeTrend: {
    color: '#dc2626',
  },
  trendInsights: {
    margin: 16,
    marginTop: 0,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  insightsGrid: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    color: '#6b7280',
  },
  loading: {
    marginVertical: 40,
  },
  messageContainer: {
    padding: 20,
    alignItems: 'center',
  },
  messageText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default PerformanceTrends;
