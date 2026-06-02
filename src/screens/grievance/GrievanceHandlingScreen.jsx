import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, FileText, Users, CheckCircle, WifiOff, Wifi, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncService } from '../../utils/syncService';
import NetInfo from '@react-native-community/netinfo';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { grievanceAPI, adminAPI } from '../../services/api';
import { secureStorage } from '../../utils/secureStorage';
const GrievanceHandlingScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const [activeTab, setActiveTab] = useState('All');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [statistics, setStatistics] = useState(null);
  const [grievances, setGrievances] = useState([]);
  const [selectedGrievanceId, setSelectedGrievanceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCacheWarning, setShowCacheWarning] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [offlineChanges, setOfflineChanges] = useState([]);
  const [blocksMap, setBlocksMap] = useState({});
  const [wardsMap, setWardsMap] = useState({});
  const [userInfo, setUserInfo] = useState(null);
  useEffect(() => {
    loadUserInfo();

    // Listen for network changes to refresh data
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        // Refresh data when coming online
        setTimeout(() => {
          loadData();
        }, 2000); // Wait 2 seconds for sync to complete
      }
    });
    return () => unsubscribe();
  }, [isOnline]);
  useEffect(() => {
    if (userInfo) {
      loadLookupData(userInfo);
      loadData(userInfo);
    }
  }, [activeTab, isOnline, userInfo]);
  const loadUserInfo = async () => {
    try {
      const userData = await secureStorage.getItem('user_info');
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };

  // Add focus listener to reload data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userInfo) {
        loadData(userInfo);
      }
    });
    return unsubscribe;
  }, [navigation, userInfo]);
  const buildStatisticsFromList = (grievanceList = []) => ({
    total_grievances: grievanceList.length,
    pending: grievanceList.filter(item => item?.status === 'pending').length,
    resolved: grievanceList.filter(item => item?.status === 'resolved').length,
    in_progress: grievanceList.filter(item => item?.status === 'in_progress').length,
    escalated: grievanceList.filter(item => item?.escalated_to_district === true).length
  });
  const buildScopedParams = user => {
    const params = {};
    if (!user) return params;
    if (user.role !== 'district' && user.block_id) {
      params.block_id = user.block_id;
    }
    return params;
  };
  const loadLookupData = async user => {
    try {
      const [blocksData, wardsData] = await Promise.all([user?.district_id ? adminAPI.getBlocks(user.district_id).catch(() => []) : adminAPI.getBlocks().catch(() => []), user?.block_id ? adminAPI.getWards({
        block_id: user.block_id
      }).catch(() => []) : adminAPI.getWards().catch(() => [])]);
      const blocksLookup = {};
      const wardsLookup = {};
      if (Array.isArray(blocksData)) {
        blocksData.forEach(block => {
          blocksLookup[block.id] = block.name;
        });
      }
      if (Array.isArray(wardsData)) {
        wardsData.forEach(ward => {
          wardsLookup[ward.id] = ward.name;
        });
      }
      setBlocksMap(blocksLookup);
      setWardsMap(wardsLookup);
    } catch (error) {}
  };
  const loadData = async (currentUser = userInfo) => {
    try {
      setLoading(true);
      setSyncError(null);
      const grievanceData = await syncService.getGrievances(buildScopedParams(currentUser));

      // Filter data based on active tab
      let filteredData = grievanceData;
      if (activeTab !== 'All') {
        filteredData = filterGrievances(grievanceData);
      }
      setStatistics(buildStatisticsFromList(grievanceData));
      setGrievances(filteredData);
    } catch (error) {
      setStatistics({
        total_grievances: 0,
        pending: 0,
        resolved: 0,
        in_progress: 0,
        escalated: 0
      });
      setGrievances([]);
    } finally {
      setLoading(false);
    }
  };
  const filterGrievances = grievances => {
    if (activeTab === 'All') return grievances;
    const filtered = grievances.filter(grievance => {
      if (activeTab === 'Escalated') {
        return grievance.escalated_to_district === true;
      }
      const targetStatus = activeTab.toLowerCase().replace(' ', '_');
      return grievance.status === targetStatus;
    });
    return filtered;
  };
  const tabs = statistics ? [{
    label: 'All',
    count: statistics.total_grievances || 0
  }, {
    label: 'Pending',
    count: statistics.pending || 0
  }, {
    label: 'In Progress',
    count: statistics.in_progress || 0
  }, {
    label: 'Resolved',
    count: statistics.resolved || 0
  }, {
    label: 'Escalated',
    count: statistics.escalated || 0
  }] : [{
    label: 'All',
    count: 0
  }, {
    label: 'Pending',
    count: 0
  }, {
    label: 'In Progress',
    count: 0
  }, {
    label: 'Resolved',
    count: 0
  }, {
    label: 'Escalated',
    count: 0
  }];
  const filteredGrievances = grievances;
  const handleResolve = async () => {
    if (isOnline) {
      try {
        await grievanceAPI.resolve(selectedGrievanceId, resolutionNotes);
        setShowResolveModal(false);
        setResolutionNotes('');
        loadData();
      } catch (error) {
        Alert.alert('Error', 'Failed to resolve grievance. Please try again.', [{
          text: 'OK'
        }]);
      }
    } else {
      // Store offline change
      const change = {
        id: selectedGrievanceId,
        action: 'resolve',
        notes: resolutionNotes,
        queued_at: new Date().toISOString()
      };
      const newChanges = [...offlineChanges, change];
      setOfflineChanges(newChanges);
      await syncService.queueOfflineGrievanceChange(change);

      // Update local grievance status
      const updatedGrievances = grievances.map(g => g.id === selectedGrievanceId ? {
        ...g,
        status: 'resolved'
      } : g);
      setGrievances(updatedGrievances);
      setShowResolveModal(false);
      setResolutionNotes('');
      Alert.alert('Offline Mode', 'Grievance marked as resolved offline. Changes will sync when online.', [{
        text: 'OK'
      }]);
    }
  };
  const handleMarkInProgress = async grievanceId => {
    if (isOnline) {
      try {
        await grievanceAPI.updateStatus(grievanceId, {
          status: 'in_progress'
        });
        loadData();
      } catch (error) {
        Alert.alert('Error', 'Failed to update grievance. Please try again.', [{
          text: 'OK'
        }]);
      }
    } else {
      // Store offline change
      const change = {
        id: grievanceId,
        action: 'in_progress',
        queued_at: new Date().toISOString()
      };
      const newChanges = [...offlineChanges, change];
      setOfflineChanges(newChanges);
      await syncService.queueOfflineGrievanceChange(change);

      // Update local grievance status
      const updatedGrievances = grievances.map(g => g.id === grievanceId ? {
        ...g,
        status: 'in_progress'
      } : g);
      setGrievances(updatedGrievances);
      Alert.alert('Offline Mode', 'Grievance marked as in progress offline. Changes will sync when online.', [{
        text: 'OK'
      }]);
    }
  };
  const handleRefresh = async () => {
    if (!isOnline) {
      Alert.alert('Offline Mode', 'Cannot refresh data while offline. Please connect to the internet.', [{
        text: 'OK'
      }]);
      return;
    }
    loadData();
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <ArrowLeft size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{t('grievanceHandling')}</Text>
              <Text style={styles.headerSubtitle}>{t('viewResolveIssues')} / ସମସ୍ୟାର ସମାଧାନ</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh} disabled={loading} activeOpacity={0.7}>
              {loading ? <Text style={styles.refreshText}>...</Text> : <Text style={styles.refreshText}>↻</Text>}
            </TouchableOpacity>
          </View>

          {/* Network Status Bar */}
          {syncError && <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#dc2626" />
              <Text style={styles.errorText}>{syncError}</Text>
            </View>}
          
          {showCacheWarning && <View style={styles.warningBanner}>
              <AlertCircle size={16} color="#d97706" />
              <Text style={styles.warningText}>
                Data may be outdated. Last synced more than 1 hour ago.
              </Text>
            </View>}
          
          <View style={styles.networkStatus}>
            <View style={styles.networkStatusInner}>
              {isOnline ? <>
                  <Wifi size={16} color="#16a34a" />
                  <Text style={styles.networkOnline}>Online - Synced</Text>
                </> : <>
                  <WifiOff size={16} color="#dc2626" />
                  <Text style={styles.networkOffline}>Offline - Using cached data</Text>
                </>}
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Tabs */}
              <View style={styles.tabsContainer}>
                {tabs.map(tab => <TouchableOpacity key={tab.label} style={[styles.tabButton, activeTab === tab.label && styles.tabButtonActive]} onPress={() => setActiveTab(tab.label)} activeOpacity={0.7} disabled={loading}>
                    <Text style={[styles.tabCount, activeTab === tab.label && styles.tabCountActive]}>{tab.count}</Text>
                    <Text style={[styles.tabLabel, activeTab === tab.label && styles.tabLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>)}
              </View>

              {/* Grievances List */}
              <View style={styles.grievancesList}>
                {loading ? <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading grievances...</Text>
                  </View> : filteredGrievances.length === 0 ? <View style={styles.emptyState}>
                    <FileText size={48} color="#9ca3af" style={styles.emptyIcon} />
                    <Text style={styles.emptyStateText}>
                      {isOnline ? 'No grievances found' : 'No cached grievances available'}
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      {isOnline ? 'No grievances match your criteria' : 'Please connect to the internet to fetch latest data'}
                    </Text>
                    {!isOnline && <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
                        <Text style={styles.retryButtonText}>Retry Connection</Text>
                      </TouchableOpacity>}
                  </View> : filteredGrievances.map(grievance => <TouchableOpacity key={grievance.id || grievance.ticket_number} style={styles.grievanceCard} onPress={() => navigation.navigate('GrievanceDetail', {
                grievanceId: grievance.id,
                isOnline: isOnline
              })} activeOpacity={0.7}>
                      <View style={styles.grievanceCardHeader}>
                        <View style={styles.grievanceIdBadge}>
                          <FileText size={14} color="#8B4513" />
                          <Text style={styles.grievanceIdText}>{grievance.ticket_number || 'GRV-' + (grievance.id || 'N/A')}</Text>
                        </View>
                        <View style={[styles.statusBadge, grievance.status === 'pending' && styles.statusPending, grievance.status === 'in_progress' && styles.statusInProgress, grievance.status === 'resolved' && styles.statusResolved, grievance.escalated_to_district && styles.statusEscalated]}>
                          <Text style={styles.statusBadgeText}>
                            {grievance.escalated_to_district ? 'ESCALATED' : (grievance.status || 'pending').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.grievanceTitle}>{grievance.name || 'Anonymous'}</Text>
                      <Text style={styles.grievanceDescription}>
                        {grievance.grievance_note || 'No description provided'}
                      </Text>

                      <View style={styles.grievanceDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailText}>
                            📞 {grievance.mobile_number || 'Not provided'}
                          </Text>
                          <Text style={styles.detailRight}>
                            🏘️ {wardsMap[grievance.ward_id] || `Ward ${grievance.ward_id || 'N/A'}`}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailText}>
                            📅 {grievance.created_at ? formatDateDDMMYYYY(grievance.created_at) : 'Date unknown'}
                          </Text>
                          <Text style={styles.detailRight}>
                            🏢 {blocksMap[grievance.block_id] || `Block ${grievance.block_id || 'N/A'}`}
                          </Text>
                        </View>
                        {grievance.rch_id && <View style={styles.detailRow}>
                            <Text style={styles.detailText}>🆔 RCH ID: {grievance.rch_id}</Text>
                          </View>}
                      </View>

                      {grievance.status !== 'resolved' && <View style={styles.grievanceActions}>
                          {/* Block users can't take actions on escalated grievances */}
                          {grievance.escalated_to_district && userInfo?.role === 'block' ? <Text style={styles.escalatedNote}>Only district can handle escalated grievances</Text> : <>
                              <TouchableOpacity style={[styles.btnSecondary, grievance.status === 'in_progress' && styles.btnDisabled]} activeOpacity={0.7} onPress={() => handleMarkInProgress(grievance.id)} disabled={grievance.status === 'in_progress'}>
                                <Text style={[styles.btnSecondaryText, grievance.status === 'in_progress' && styles.btnDisabledText]}>
                                  {grievance.status === 'in_progress' ? 'In Progress' : 'Mark in Progress'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.7} onPress={() => {
                      setSelectedGrievanceId(grievance.id);
                      setShowResolveModal(true);
                    }}>
                                <Text style={styles.btnPrimaryText}>Mark as Resolved</Text>
                              </TouchableOpacity>
                            </>}
                        </View>}
                    </TouchableOpacity>)}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Resolve Modal */}
        <Modal visible={showResolveModal} transparent={true} animationType="fade" onRequestClose={() => setShowResolveModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.resolvePopup}>
              <View style={styles.popupHeader}>
                <CheckCircle size={24} color="#16a34a" style={styles.popupIcon} />
                <Text style={styles.popupTitle}>{t('resolveGrievance')}</Text>
              </View>
              <View style={styles.popupContent}>
                <Text style={styles.popupLabel}>{t('resolutionNotes')} / ସମାଧାନ ବିବରଣୀ:</Text>
                <TextInput style={styles.popupTextarea} placeholder={t('enterResolutionDetails')} multiline numberOfLines={4} value={resolutionNotes} onChangeText={setResolutionNotes} textAlignVertical="top" editable={true} />
                {!isOnline && <Text style={styles.offlineWarning}>
                    ⚠️ Cannot resolve while offline
                  </Text>}
              </View>
              <View style={styles.popupActions}>
                <TouchableOpacity style={styles.popupBtnSecondary} onPress={() => {
                setShowResolveModal(false);
                setResolutionNotes('');
              }} activeOpacity={0.7}>
                  <Text style={styles.popupBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.popupBtnPrimary} onPress={handleResolve} activeOpacity={0.7}>
                  <Text style={styles.popupBtnPrimaryText}>Mark Resolved</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>;
};
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  scrollContent: {
    flexGrow: 1
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerInfo: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)'
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  refreshText: {
    fontSize: 22,
    color: 'white',
    fontWeight: 'bold',
    bottom: 3
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    gap: 8
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    flex: 1
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    gap: 8
  },
  warningText: {
    fontSize: 12,
    color: '#d97706',
    flex: 1
  },
  networkStatus: {
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  networkStatusInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8
  },
  networkOnline: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500'
  },
  networkOffline: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '500'
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%'
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12
  },
  tabButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 50
  },
  tabButtonActive: {
    backgroundColor: '#8B4513',
    borderColor: '#8B4513'
  },
  tabCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2
  },
  tabCountActive: {
    color: 'white'
  },
  tabLabel: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    flexShrink: 1
  },
  tabLabelActive: {
    color: 'white'
  },
  grievancesList: {
    gap: 12
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280'
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  emptyIcon: {
    marginBottom: 16
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16
  },
  retryButton: {
    backgroundColor: '#8B4513',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  grievanceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  grievanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  grievanceIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  grievanceIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B4513'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusPending: {
    backgroundColor: '#fef3c7'
  },
  statusInProgress: {
    backgroundColor: '#dbeafe'
  },
  statusResolved: {
    backgroundColor: '#dcfce7'
  },
  statusEscalated: {
    backgroundColor: '#fee2e2'
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937'
  },
  grievanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6
  },
  grievanceDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18
  },
  grievanceDetails: {
    gap: 6,
    marginBottom: 12
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailText: {
    fontSize: 11,
    color: '#1f2937',
    flex: 1
  },
  detailRight: {
    fontSize: 11,
    color: '#6b7280'
  },
  grievanceActions: {
    flexDirection: 'row',
    gap: 8
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'center'
  },
  btnSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280'
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center'
  },
  btnDisabled: {
    backgroundColor: '#0bb449',
    opacity: 0.7
  },
  btnPrimaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  resolvePopup: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10
  },
  popupIcon: {
    marginRight: 4
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  popupContent: {
    padding: 16
  },
  popupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8
  },
  popupTextarea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#1f2937',
    minHeight: 100,
    backgroundColor: 'white'
  },
  offlineWarning: {
    fontSize: 11,
    color: '#dc2626',
    marginTop: 8,
    fontStyle: 'italic'
  },
  popupActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  popupBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    alignItems: 'center'
  },
  popupBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280'
  },
  popupBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center'
  },
  btnDisabledText: {
    color: 'white'
  }
});
export default GrievanceHandlingScreen;
