import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft,
  FileText,
  Calendar,
  Phone,
  MapPin,
  User,
  AlertCircle,
  CheckCircle,
  Home,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { syncService } from '../../utils/syncService';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { grievanceAPI } from '../../services/api';
import { secureStorage } from '../../utils/secureStorage';
import '../../i18n';

const GrievanceDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { grievanceId } = route.params;
  const [grievance, setGrievance] = useState(null);
  const [blockName, setBlockName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [wardName, setWardName] = useState('');
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [offlineChanges, setOfflineChanges] = useState([]);
  const isOnline = useNetworkStatus();

  useEffect(() => {
    loadUserInfo();
    loadGrievanceDetail();
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

  const loadGrievanceDetail = async () => {
    try {
      // Use syncService for automatic online/offline handling
      const data = await syncService.getGrievanceById(grievanceId);
      if (data) {
        setGrievance(data);
        
        // Load district and block names
        const [districts, blocks] = await Promise.all([
          syncService.getDistricts(),
          syncService.getBlocks()
        ]);
        const wards = data.block_id ? await syncService.getWards(data.block_id) : [];
        
        const district = districts.find(d => d.id === data.district_id);
        const block = blocks.find(b => b.id === data.block_id);
        const ward = wards.find(w => w.id === data.ward_id);
        
        setDistrictName(district?.name || `District ${data.district_id}`);
        setBlockName(block?.name || `Block ${data.block_id}`);
        setWardName(ward?.name || `Ward ${data.ward_id}`);
      }
    } catch (error) {
      console.error('Error loading grievance detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInProgress = async () => {
    if (!grievance?.id) return;

    if (isOnline) {
      try {
        await grievanceAPI.updateStatus(grievance.id, { status: 'in_progress' });
        await loadGrievanceDetail();
      } catch (error) {
        console.error('Error updating grievance:', error);
        Alert.alert('Error', 'Failed to update grievance. Please try again.', [{ text: 'OK' }]);
      }
    } else {
      const change = {
        id: grievance.id,
        action: 'in_progress',
        queued_at: new Date().toISOString(),
      };

      const newChanges = [...offlineChanges, change];
      setOfflineChanges(newChanges);
      await syncService.queueOfflineGrievanceChange(change);
      setGrievance((prev) => prev ? { ...prev, status: 'in_progress' } : prev);
      Alert.alert('Offline Mode', 'Grievance marked as in progress offline. Changes will sync when online.', [{ text: 'OK' }]);
    }
  };

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

  const handleResolve = async () => {
    if (!grievance?.id) return;

    if (isOnline) {
      try {
        await grievanceAPI.resolve(grievance.id, resolutionNotes);
        setShowResolveModal(false);
        setResolutionNotes('');
        await loadGrievanceDetail();
      } catch (error) {
        console.error('Error resolving grievance:', error);
        Alert.alert('Error', 'Failed to resolve grievance. Please try again.', [{ text: 'OK' }]);
      }
    } else {
      const change = {
        id: grievance.id,
        action: 'resolve',
        notes: resolutionNotes,
        queued_at: new Date().toISOString(),
      };

      const newChanges = [...offlineChanges, change];
      setOfflineChanges(newChanges);
      await syncService.queueOfflineGrievanceChange(change);
      setGrievance((prev) => prev ? { ...prev, status: 'resolved', resolution_note: resolutionNotes } : prev);
      setShowResolveModal(false);
      setResolutionNotes('');
      Alert.alert('Offline Mode', 'Grievance marked as resolved offline. Changes will sync when online.', [{ text: 'OK' }]);
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#D2691E" />
            <Text style={styles.loaderText}>{t('loading')}</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!grievance) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loaderContainer}>
            <AlertCircle size={48} color="#dc2626" />
            <Text style={styles.errorText}>{t('grievanceNotFound')}</Text>
            <TouchableOpacity 
              style={styles.backToListButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backToListButtonText}>{t('goBack')}</Text>
            </TouchableOpacity>
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
          <LinearGradient
            colors={['#D2691E', '#8B4513']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.header}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{t('grievanceDetails')}</Text>
              <Text style={styles.headerSubtitle}>Ticket: {grievance.ticket_number}</Text>
            </View>
            <TouchableOpacity 
              style={styles.homeButton}
              onPress={handleGoHome}
              activeOpacity={0.7}
            >
              <Home size={20} color="white" />
            </TouchableOpacity>
          </LinearGradient>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Status Card */}
              <View style={styles.statusCard}>
                <View style={[
                  styles.statusBadge,
                  grievance.status === 'pending' && styles.statusPending,
                  grievance.status === 'in_progress' && styles.statusInProgress,
                  grievance.status === 'resolved' && styles.statusResolved,
                ]}>
                  <Text style={styles.statusBadgeText}>{grievance.status}</Text>
                </View>
                {grievance.escalated_to_district && (
                  <View style={styles.escalationTag}>
                    <AlertCircle size={14} color="#dc2626" />
                    <Text style={styles.escalationTagText}>Escalated</Text>
                  </View>
                )}
              </View>

              {/* Grievance Note Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <FileText size={18} color="#D2691E" />
                  <Text style={styles.cardTitle}>{t('grievanceDetails')}</Text>
                </View>
                <Text style={styles.grievanceNote}>{grievance.grievance_note}</Text>
              </View>

              {/* Notes Card */}
              {grievance.notes && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <FileText size={18} color="#D2691E" />
                    <Text style={styles.cardTitle}>{t('notes')}</Text>
                  </View>
                  <Text style={styles.grievanceNote}>{grievance.notes}</Text>
                </View>
              )}

              {/* Resolution Card */}
              {grievance.resolution_note && (
                <View style={[styles.card, styles.resolutionCard]}>
                  <View style={styles.cardHeader}>
                    <FileText size={18} color="#22c55e" />
                    <Text style={[styles.cardTitle, { color: '#22c55e' }]}>{t('resolutionNotes')}</Text>
                  </View>
                  <Text style={styles.grievanceNote}>{grievance.resolution_note}</Text>
                </View>
              )}

              {/* Personal Info Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <User size={18} color="#D2691E" />
                  <Text style={styles.cardTitle}>{t('personalInformation')}</Text>
                </View>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoItemLabel}>{t('name')}</Text>
                    <Text style={styles.infoItemValue}>{grievance.name}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoItemLabel}>Phone</Text>
                    <Text style={styles.infoItemValue}>{grievance.mobile_number}</Text>
                  </View>
                </View>
                {grievance.rch_id && (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoItemLabel}>RCH ID</Text>
                    <Text style={styles.infoItemValue}>{grievance.rch_id}</Text>
                  </View>
                )}
              </View>

              {/* Location Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <MapPin size={18} color="#D2691E" />
                  <Text style={styles.cardTitle}>{t('location')}</Text>
                </View>
                {grievance.ward_id && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('ward')}</Text>
                    <Text style={styles.infoValue}>{wardName}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('block')}</Text>
                  <Text style={styles.infoValue}>{blockName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('district')}</Text>
                  <Text style={styles.infoValue}>{districtName}</Text>
                </View>
              </View>

              {/* Timeline Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Calendar size={18} color="#D2691E" />
                  <Text style={styles.cardTitle}>{t('timeline')}</Text>
                </View>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>{t('created')}</Text>
                    <Text style={styles.timelineValue}>{formatDateDDMMYYYY(grievance.created_at)}</Text>
                  </View>
                </View>
                {grievance.resolved_at && (
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineLabel}>{t('resolved')}</Text>
                      <Text style={styles.timelineValue}>{formatDateDDMMYYYY(grievance.resolved_at)}</Text>
                    </View>
                  </View>
                )}
              </View>

              {grievance.status !== 'resolved' && (
                <View style={styles.bottomActions}>
                  {grievance.escalated_to_district && userInfo?.role === 'block' ? (
                    <Text style={styles.escalatedNote}>Only district can handle escalated grievances</Text>
                  ) : (
                    <View style={styles.grievanceActions}>
                      <TouchableOpacity
                        style={[styles.btnSecondary, grievance.status === 'in_progress' && styles.btnDisabled]}
                        activeOpacity={0.7}
                        onPress={handleMarkInProgress}
                        disabled={grievance.status === 'in_progress'}
                      >
                        <Text style={[styles.btnSecondaryText, grievance.status === 'in_progress' && styles.btnDisabledText]}>
                          {grievance.status === 'in_progress' ? 'In Progress' : 'Mark in Progress'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnPrimary}
                        activeOpacity={0.7}
                        onPress={() => setShowResolveModal(true)}
                      >
                        <Text style={styles.btnPrimaryText}>Mark as Resolved</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showResolveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResolveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resolvePopup}>
            <View style={styles.popupHeader}>
              <CheckCircle size={24} color="#16a34a" style={styles.popupIcon} />
              <Text style={styles.popupTitle}>{t('resolveGrievance')}</Text>
            </View>
            <View style={styles.popupContent}>
              <Text style={styles.popupLabel}>{`${t('resolutionNotes')}:`}</Text>
              <TextInput
                style={styles.popupTextarea}
                placeholder={t('enterResolutionDetails')}
                multiline
                numberOfLines={4}
                value={resolutionNotes}
                onChangeText={setResolutionNotes}
                textAlignVertical="top"
                editable={true}
              />
              {!isOnline && (
                <Text style={styles.offlineWarning}>
                  âš ï¸ Cannot resolve while offline
                </Text>
              )}
            </View>
            <View style={styles.popupActions}>
              <TouchableOpacity
                style={styles.popupBtnSecondary}
                onPress={() => {
                  setShowResolveModal(false);
                  setResolutionNotes('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.popupBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.popupBtnPrimary}
                onPress={handleResolve}
                activeOpacity={0.7}
              >
                <Text style={styles.popupBtnPrimaryText}>Mark Resolved</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fad5a5' },
  loaderContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#fad5a5',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  backToListButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B4513',
    borderRadius: 8,
  },
  backToListButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  scrollContent: { flexGrow: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  homeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: 'white', marginBottom: 2 },
  headerSubtitle: { fontSize: 12, color: 'rgba(255, 255, 255, 0.9)' },
  mainContent: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  contentContainer: { maxWidth: 400, alignSelf: 'center', width: '100%' },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statusPending: { backgroundColor: '#fbbf24' },
  statusInProgress: { backgroundColor: '#3b82f6' },
  statusResolved: { backgroundColor: '#22c55e' },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: 'white', textTransform: 'uppercase', letterSpacing: 0.5 },
  escalationTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 4 },
  escalationTagText: { fontSize: 11, fontWeight: '600', color: '#dc2626' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  resolutionCard: { borderWidth: 2, borderColor: '#86efac' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#D2691E' },
  grievanceNote: { fontSize: 14, color: '#374151', lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', minWidth: 70 },
  infoValue: { fontSize: 14, color: '#1f2937', flex: 1, fontWeight: '500' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D2691E', marginTop: 4, marginRight: 12 },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  timelineValue: { fontSize: 14, color: '#1f2937', fontWeight: '600' },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  infoItem: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  infoItemLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: '500' },
  infoItemValue: { fontSize: 13, color: '#1f2937', fontWeight: '600' },
  bottomActions: { marginTop: 8, marginBottom: 16 },
  grievanceActions: { flexDirection: 'row', gap: 8 },
  btnSecondary: { flex: 1, minHeight: 48, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  btnPrimary: { flex: 1, minHeight: 48, paddingVertical: 12, borderRadius: 8, backgroundColor: '#8B4513', alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: 'white' },
  btnDisabled: { backgroundColor: '#0bb449', opacity: 0.7 },
  btnDisabledText: { color: 'white' },
  escalatedNote: { fontSize: 12, color: '#dc2626', fontWeight: '500', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  resolvePopup: { backgroundColor: 'white', borderRadius: 12, width: '100%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  popupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', gap: 10 },
  popupIcon: { marginRight: 4 },
  popupTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  popupContent: { padding: 16 },
  popupLabel: { fontSize: 13, fontWeight: '600', color: '#1f2937', marginBottom: 8 },
  popupTextarea: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 13, color: '#1f2937', minHeight: 100, backgroundColor: 'white' },
  offlineWarning: { fontSize: 11, color: '#dc2626', marginTop: 8, fontStyle: 'italic' },
  popupActions: { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  popupBtnSecondary: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: 'white', alignItems: 'center' },
  popupBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  popupBtnPrimary: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#8B4513', alignItems: 'center' },
  popupBtnPrimaryText: { fontSize: 13, fontWeight: '600', color: 'white' },
});

export default GrievanceDetailScreen;
