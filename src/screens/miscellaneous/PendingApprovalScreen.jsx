import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, X, User, Phone, Search, Home, Wifi, WifiOff, Clock } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import '../../i18n';
const PendingApprovalScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const [pendingList, setPendingList] = useState([]);
  const [filteredPendingList, setFilteredPendingList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [offlineApprovals, setOfflineApprovals] = useState([]);
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
  useEffect(() => {
    loadUserInfo();
    loadPendingApprovals();
  }, []);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  useFocusEffect(React.useCallback(() => {
    loadPendingApprovals();
  }, []));

  // Refresh when network status changes
  useEffect(() => {
    if (isOnline && !loading) {
      // Delay to allow sync to complete
      const timer = setTimeout(() => {
        loadPendingApprovals();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);
  useEffect(() => {
    applySearchFilter();
  }, [pendingList, searchQuery]);
  const loadPendingApprovals = async () => {
    try {
      const [data, userInfo, offlineApprovalsData] = await Promise.all([syncService.getPendingApprovals(), secureStorage.getItem('user_info'), syncService.getOfflineApprovals()]);
      const list = Array.isArray(data) ? data : data?.items || [];

      // Filter out offline approvals in BOTH online and offline mode
      const offlineApprovalIds = offlineApprovalsData.map(a => a.id);
      const filteredList = list.filter(item => !offlineApprovalIds.includes(item.id));
      const scopedList = userInfo?.role === 'sub_centre' && userInfo?.block_id ? filteredList.filter(item => String(item?.block_id) === String(userInfo.block_id)) : filteredList;
      setPendingList(scopedList);
      setOfflineApprovals(offlineApprovalsData || []);
    } catch (error) {
      if (isOnline) {
        Alert.alert(t('error'), t('failedToLoadPendingApprovals'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const applySearchFilter = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setFilteredPendingList(pendingList);
      return;
    }
    const filtered = pendingList.filter(item => {
      const name = (item?.full_name || '').toLowerCase();
      const mobile = String(item?.mobile_number || '').toLowerCase();
      const age = String(item?.age || '').toLowerCase();
      return name.includes(query) || mobile.includes(query) || age.includes(query);
    });
    setFilteredPendingList(filtered);
  };
  const onRefresh = () => {
    setRefreshing(true);
    loadPendingApprovals();
  };
  const handleApprove = async id => {
    Alert.alert(t('approveRegistration'), t('areYouSureApprove'), [{
      text: t('cancel'),
      style: 'cancel'
    }, {
      text: t('approve'),
      onPress: async () => {
        try {
          Alert.alert(t('success'), t('registrationApprovedSuccessfully'));
          loadPendingApprovals();
        } catch (error) {
          Alert.alert(t('error'), t('failedToApproveRegistration'));
        }
      }
    }]);
  };
  const handleReject = async id => {
    Alert.alert(t('rejectRegistration'), t('areYouSureReject'), [{
      text: t('cancel'),
      style: 'cancel'
    }, {
      text: t('reject'),
      style: 'destructive',
      onPress: async () => {
        try {
          Alert.alert(t('success'), t('registrationRejected'));
          loadPendingApprovals();
        } catch (error) {
          Alert.alert(t('error'), t('failedToRejectRegistration'));
        }
      }
    }]);
  };
  const renderPendingItem = item => {
    const isOfflineApproved = offlineApprovals.some(a => a.id === item.id && a.sync_status === 'pending');
    return <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => navigation.navigate('PendingApprovalDetail', {
      patientId: item.id
    })} activeOpacity={0.7}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <View style={styles.nameRow}>
              <User size={16} color="#374151" />
              <Text style={styles.itemName}>{item.full_name}</Text>
            </View>
            <View style={styles.phoneRow}>
              <Phone size={14} color="#6b7280" />
              <Text style={styles.itemPhone}>{item.mobile_number}</Text>
            </View>
          </View>
          <View style={styles.badgeContainer}>
            {isOfflineApproved ? <View style={styles.offlineApprovedBadge}>
                <Clock size={12} color="#0369a1" />
                <Text style={styles.offlineApprovedText}>Pending Sync</Text>
              </View> : <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Pending</Text>
              </View>}
          </View>
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.detailText}>{t('husband')}: {item.husband_name || 'N/A'}</Text>
          <Text style={styles.detailText}>{t('age')}: {item.age || 'N/A'}</Text>
          <Text style={styles.detailText}>{t('address')}: {item.address || 'N/A'}</Text>
          <Text style={styles.detailText}>
            {t('registrationDate')}: {formatDateDDMMYYYY(item.pregnancy_registration_date)}
          </Text>
        </View>
      </TouchableOpacity>;
  };
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('pendingApprovals')}</Text>
        <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
          <Home size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={18} color="#6b7280" />
          <TextInput style={styles.searchInput} placeholder="Search by name, mobile, or age" value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#9ca3af" />
        </View>
        {!isOnline && <View style={styles.offlineBanner}>
            <WifiOff size={16} color="#dc2626" />
            <Text style={styles.offlineBannerText}>Offline Mode - Showing cached data</Text>
          </View>}
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D2691E" />
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View> : filteredPendingList.length > 0 ? <View style={styles.listContainer}>
            <Text style={styles.countText}>
              {filteredPendingList.length} {t('registrationsPendingApproval')}
            </Text>
            {filteredPendingList.map(renderPendingItem)}
          </View> : <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No matching records found' : t('noPendingApprovals')}
            </Text>
          </View>}
      </ScrollView>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#D2691E',
    gap: 12
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  homeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    flex: 1
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fad5a5'
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937'
  },
  content: {
    flex: 1,
    padding: 16
  },
  countText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center'
  },
  listContainer: {
    gap: 16
  },
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  itemInfo: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  itemPhone: {
    fontSize: 14,
    color: '#6b7280'
  },
  statusBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e'
  },
  badgeContainer: {
    flexDirection: 'column',
    gap: 4
  },
  offlineApprovedBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  offlineApprovedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#0369a1'
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8
  },
  offlineBannerText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500'
  },
  itemDetails: {
    gap: 4
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6
  },
  approveButton: {
    backgroundColor: '#16a34a'
  },
  rejectButton: {
    backgroundColor: '#dc2626'
  },
  approveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500'
  },
  rejectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280'
  }
});
export default PendingApprovalScreen;
