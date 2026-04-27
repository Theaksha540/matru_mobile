import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, TriangleAlert, MapPin, Phone, User, X, Search, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { syncService } from '../../utils/syncService';
import { secureStorage } from '../../utils/secureStorage';
import { formatDateDDMMYYYY } from '../../utils/dateFormat';
import { pregnantWomenAPI } from '../../services/api';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import '../../i18n';

const HighRiskCasesScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
  // Get params from notification
  const { patientId, initialSearchQuery, fromNotification } = route.params || {};

  useEffect(() => {
    loadUserInfo();
    loadHighRiskCases();
  }, []);
  
  // Set initial search query from notification
  useEffect(() => {
    if (initialSearchQuery && fromNotification) {
      setSearchQuery(initialSearchQuery);
      console.log('[HIGH-RISK] Setting search from notification:', initialSearchQuery);
    }
  }, [initialSearchQuery, fromNotification]);
  
  // Auto-open detail modal if patientId is provided from notification
  useEffect(() => {
    if (patientId && cases.length > 0 && fromNotification) {
      const matchedCase = cases.find(c => c.id === patientId);
      if (matchedCase) {
        console.log('[HIGH-RISK] Auto-opening detail for patient:', patientId);
        setSelectedCase(matchedCase);
        setShowDetailModal(true);
      }
    }
  }, [patientId, cases, fromNotification]);

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

  const loadHighRiskCases = async () => {
    try {
      const user = userInfo || await secureStorage.getItem('user_info');
      if (user && !userInfo) {
        setUserInfo(user);
      }
      const scopedParams = { is_high_risk: true };
      if (user?.block_id) {
        scopedParams.block_id = user.block_id;
      } else if (user?.district_id) {
        scopedParams.district_id = user.district_id;
      }

      const scopedWomen = isOnline
        ? await pregnantWomenAPI.getAll(scopedParams).then((response) =>
            Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : []
          )
        : await syncService.getPatients(scopedParams);
      
      const highRiskCases = scopedWomen.filter(woman => 
        woman.is_high_risk || (woman.age && (woman.age < 20 || woman.age > 35))
      ).map(woman => ({
        id: woman.id,
        name: woman.full_name,
        husbandName: woman.husband_name,
        age: woman.age ? `${woman.age} years` : 'N/A',
        mobile: woman.mobile_number || 'N/A',
        rchId: woman.rch_id || 'N/A',
        abhaId: woman.abha_id || 'N/A',
        lmp: formatDateDDMMYYYY(woman.lmp_date),
        edd: formatDateDDMMYYYY(woman.edd_date),
        address: woman.address || 'N/A',
        phone: woman.mobile_number || 'N/A',
        bloodGroup: woman.blood_group || 'N/A',
        gravida: woman.gravida || 'N/A',
        para: woman.para || 'N/A',
        severity: woman.is_high_risk ? 'high' : 'warning',
        riskFactors: getRiskFactors(woman),
      }));
      
      setCases(highRiskCases);
    } catch (error) {
      console.error('Error loading high-risk cases:', error);
      setCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getRiskFactors = (woman) => {
    const factors = [];
    
    if (woman.age && woman.age > 35) factors.push(t('ageOver35'));
    if (woman.age && woman.age < 20) factors.push(t('ageUnder20'));
    
    // Add backend risk factors if available
    if (woman.risk_factors && woman.risk_factors.trim() !== '') {
      const backendFactors = woman.risk_factors.split(',').map(f => f.trim()).filter(f => f);
      factors.push(...backendFactors);
    }
    
    if (factors.length === 0) factors.push(t('riskAssessmentPending'));
    
    return factors;
  };

  const onRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    loadHighRiskCases();
  };

  const filteredCases = cases.filter(caseItem => 
    caseItem.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    caseItem.phone.includes(searchQuery) ||
    caseItem.rchId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCases = filteredCases.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleViewDetails = (caseItem) => {
    // Only sub_centre users can access ANC tracking
    if (userInfo?.role === 'sub_centre') {
      navigation.navigate('ANCTracking', { patientId: caseItem.id });
    } else {
      // Block and district users see patient details in custom modal
      setSelectedCase(caseItem);
      setShowDetailModal(true);
    }
  };

  const handleFollowUp = async (caseId) => {
    const updatedCompleted = [...completedCases, caseId];
    setCompletedCases(updatedCompleted);
    
    // Persist to AsyncStorage
    try {
      await AsyncStorage.setItem('completed_followups', JSON.stringify(updatedCompleted));
    } catch (error) {
      console.error('Error saving completed follow-up:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <ArrowLeft size={20} color="white" />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>{t('highRiskCases')}</Text>
                <Text style={styles.headerSubtitle}>ଉଚ୍ଚ ଜୋଖିମ ମାମଲା</Text>
              </View>
            </View>
            {fromNotification && initialSearchQuery && (
              <View style={styles.notificationBanner}>
                <Text style={styles.notificationBannerText}>🔔 Filtered from notification</Text>
              </View>
            )}
            <View style={styles.alertBanner}>
              <TriangleAlert size={20} color="#fecaca" />
              <Text style={styles.alertText}>{filteredCases.length} {t('casesRequireAttention')}</Text>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Search size={18} color="#8b6549" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, phone, or RCH ID..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setCurrentPage(1);
                }}
              />
            </View>
          </View>

          <View style={styles.casesList}>
            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#D2691E" />
                <Text style={styles.loaderText}>{t('loading')}</Text>
              </View>
            ) : paginatedCases.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>{t('noDataFound')}</Text>
              </View>
            ) : paginatedCases.map((caseItem) => {
              const headerBg = caseItem.severity === 'high' ? '#D2691E' : '#FF8C00';
              
              return (
                <LinearGradient key={caseItem.id} colors={['#fad5a5', '#e2e8f0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.caseCard}>
                  <View style={[styles.caseHeader, { backgroundColor: headerBg }]}>
                    <TriangleAlert size={16} color="white" />
                    <Text style={styles.severityText}>{caseItem.severity === 'high' ? `${t('highRisk')} / ଉଚ୍ଚ ଜୋଖିମ` : `${t('warning')} / ଚେତାବନୀ`}</Text>
                  </View>
                  
                  <View style={styles.caseDetails}>
                    <View style={styles.nameRow}>
                      <User size={16} color="#8b6549" />
                      <Text style={styles.patientName}>{caseItem.name}</Text>
                    </View>
                    
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>{t('age')} / ବୟସ</Text>
                        <Text style={styles.detailValue}>{caseItem.age}</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>EDD</Text>
                        <Text style={styles.detailValue}>{caseItem.edd}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoBox}>
                      <View style={styles.infoRow}>
                        <MapPin size={14} color="#8b6549" />
                        <Text style={styles.infoText}>{caseItem.address}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Phone size={14} color="#8b6549" />
                        <Text style={styles.infoText}>{caseItem.phone}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.riskBox}>
                      <View style={styles.riskTitleRow}>
                        <TriangleAlert size={14} color="#8b6549" />
                        <Text style={styles.riskTitle}>{t('riskFactors')} / ବିପଦ କାରଣ:</Text>
                      </View>
                      {caseItem.riskFactors.map((factor, idx) => (
                        <Text key={idx} style={styles.riskItem}>• {factor}</Text>
                      ))}
                    </View>
                    
                    <View style={styles.actionButtons}>
                      <TouchableOpacity style={styles.viewButton} onPress={() => handleViewDetails(caseItem)}>
                        <Text style={styles.viewButtonText}>{t('viewDetails')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </LinearGradient>
              );
            })}
          </View>

          {filteredCases.length > itemsPerPage && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity 
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                onPress={handlePrevPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={20} color={currentPage === 1 ? '#9ca3af' : '#8b6549'} />
              </TouchableOpacity>
              
              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  Page {currentPage} of {totalPages}
                </Text>
                <Text style={styles.paginationSubtext}>
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredCases.length)} of {filteredCases.length}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                onPress={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={20} color={currentPage === totalPages ? '#9ca3af' : '#8b6549'} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerTitle}>{t('guidelines')} / ନିର୍ଦ୍ଦେଶାବଳୀ:</Text>
            <Text style={styles.footerText}>{t('contactHighRiskWithin24h')}</Text>
            <Text style={styles.footerText}>{t('ensureRegularANCVisits')}</Text>
            <Text style={styles.footerText}>{t('coordinateWithMedicalOfficers')}</Text>
          </View>
        </ScrollView>

        {/* Patient Detail Modal */}
        <Modal
          visible={showDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Header */}
              <LinearGradient
                colors={['#D2691E', '#8B4513']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalHeader}
              >
                <View>
                  <Text style={styles.modalTitle}>Patient Information</Text>
                  <Text style={styles.modalSubtitle}>High Risk Case Details</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.closeButton}>
                  <X size={20} color="white" />
                </TouchableOpacity>
              </LinearGradient>
              
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {selectedCase && (
                  <>
                    {/* Patient Card */}
                    <View style={styles.patientCard}>
                      <View style={styles.patientHeader}>
                        <View style={styles.avatarCircle}>
                          <User size={24} color="#D2691E" />
                        </View>
                        <View style={styles.patientInfo}>
                          <Text style={styles.patientName}>{selectedCase.name}</Text>
                          <View style={styles.severityBadge}>
                            <TriangleAlert size={12} color="white" />
                            <Text style={styles.severityText}>{selectedCase.severity === 'high' ? 'High Risk' : 'Warning'}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Details Grid */}
                    <View style={styles.detailsGrid}>
                      <View style={styles.detailCard}>
                        <View style={styles.detailIconBox}>
                          <Text style={styles.detailEmoji}>👤</Text>
                        </View>
                        <Text style={styles.detailLabel}>Age</Text>
                        <Text style={styles.detailValue}>{selectedCase.age}</Text>
                      </View>

                      <View style={styles.detailCard}>
                        <View style={styles.detailIconBox}>
                          <Text style={styles.detailEmoji}>🩸</Text>
                        </View>
                        <Text style={styles.detailLabel}>Blood Group</Text>
                        <Text style={styles.detailValue}>{selectedCase.bloodGroup}</Text>
                      </View>
                    </View>

                    {/* Pregnancy Details */}
                    <View style={styles.contactSection}>
                      <Text style={styles.sectionTitle}>Pregnancy Details</Text>
                      
                      <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>LMP Date</Text>
                          <Text style={styles.infoValue}>{selectedCase.lmp}</Text>
                        </View>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>EDD Date</Text>
                          <Text style={styles.infoValue}>{selectedCase.edd}</Text>
                        </View>
                      </View>

                      <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>Gravida</Text>
                          <Text style={styles.infoValue}>{selectedCase.gravida}</Text>
                        </View>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>Para</Text>
                          <Text style={styles.infoValue}>{selectedCase.para}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Personal Details */}
                    <View style={styles.contactSection}>
                      <Text style={styles.sectionTitle}>Personal Details</Text>
                      
                      <View style={styles.contactItem}>
                        <View style={styles.contactIconBox}>
                          <Text style={styles.detailEmoji}>👨</Text>
                        </View>
                        <View style={styles.contactContent}>
                          <Text style={styles.contactLabel}>Husband Name</Text>
                          <Text style={styles.contactValue}>{selectedCase.husbandName}</Text>
                        </View>
                      </View>

                      <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>RCH ID</Text>
                          <Text style={styles.infoValue}>{selectedCase.rchId}</Text>
                        </View>
                        <View style={styles.infoItem}>
                          <Text style={styles.infoLabel}>ABHA ID</Text>
                          <Text style={styles.infoValue}>{selectedCase.abhaId}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Contact Info */}
                    <View style={styles.contactSection}>
                      <Text style={styles.sectionTitle}>Contact Information</Text>
                      
                      <View style={styles.contactItem}>
                        <View style={styles.contactIconBox}>
                          <Phone size={16} color="#D2691E" />
                        </View>
                        <View style={styles.contactContent}>
                          <Text style={styles.contactLabel}>Phone Number</Text>
                          <Text style={styles.contactValue}>{selectedCase.phone}</Text>
                        </View>
                      </View>

                      <View style={styles.contactItem}>
                        <View style={styles.contactIconBox}>
                          <MapPin size={16} color="#D2691E" />
                        </View>
                        <View style={styles.contactContent}>
                          <Text style={styles.contactLabel}>Address</Text>
                          <Text style={styles.contactValue}>{selectedCase.address}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Risk Factors */}
                    <View style={styles.riskSection}>
                      <View style={styles.riskHeader}>
                        <TriangleAlert size={18} color="#dc2626" />
                        <Text style={styles.riskTitle}>Risk Factors</Text>
                      </View>
                      <View style={styles.riskList}>
                        {selectedCase.riskFactors.map((factor, idx) => (
                          <View key={idx} style={styles.riskItem}>
                            <View style={styles.riskDot} />
                            <Text style={styles.riskText}>{factor}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>

              {/* Footer Button */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setShowDetailModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fad5a5' },
  header: { backgroundColor: '#D2691E', padding: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backButton: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white' },
  headerSubtitle: { fontSize: 11, color: 'white', opacity: 0.9 },
  notificationBanner: { 
    backgroundColor: 'rgba(59, 130, 246, 0.3)', 
    padding: 8, 
    borderRadius: 8, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  notificationBannerText: { 
    color: 'white', 
    fontSize: 12, 
    fontWeight: '600',
    textAlign: 'center',
  },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(220,38,38,0.2)', padding: 8, borderRadius: 8 },
  alertText: { color: 'white', fontSize: 12, fontWeight: '500' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fad5a5' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: '#d4845a' },
  searchInput: { flex: 1, fontSize: 14, color: '#1f2937', fontWeight: '500' },
  casesList: { padding: 8 },
  loaderContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 12, fontSize: 14, color: '#8b6549', fontWeight: '600' },
  emptyStateContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  emptyStateText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  caseCard: { borderWidth: 1, borderColor: '#d4845a', borderRadius: 12, padding: 12, marginHorizontal: 8, marginBottom: 10, shadowColor: '#8b6549', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  caseHeader: { padding: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  severityText: { color: 'white', fontSize: 11, fontWeight: '600' },
  caseDetails: { padding: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  patientName: { fontSize: 14, fontWeight: '700', color: '#8b6549' },
  detailsGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  detailBox: { flex: 1, padding: 6, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 6, borderLeftWidth: 2, borderLeftColor: '#8b6549' },
  detailLabel: { fontSize: 9, color: '#8b6549', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { fontSize: 12, fontWeight: '600', color: '#1f2937', marginTop: 3 },
  infoBox: { backgroundColor: 'rgba(255,255,255,0.7)', padding: 8, borderRadius: 6, marginVertical: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3 },
  infoText: { fontSize: 11, color: '#8b6549', fontWeight: '500', flex: 1 },
  riskBox: { backgroundColor: 'rgba(139,101,73,0.1)', padding: 8, borderRadius: 6, marginVertical: 10, borderWidth: 1, borderColor: 'rgba(139,101,73,0.3)' },
  riskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  riskTitle: { fontSize: 11, fontWeight: '700', color: '#8b6549' },
  riskItem: { fontSize: 11, color: '#6b7280', marginBottom: 2, marginLeft: 20 },
  actionButtons: { flexDirection: 'row', gap: 6, marginTop: 12 },
  viewButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#8b6549', borderRadius: 6, padding: 8, alignItems: 'center' },
  viewButtonText: { color: '#8b6549', fontSize: 11, fontWeight: '600' },
  followUpButton: { flex: 1, borderRadius: 6, padding: 8, alignItems: 'center', justifyContent: 'center' },
  followUpText: { color: 'white', fontSize: 11, fontWeight: '600' },
  footer: { backgroundColor: 'rgba(255,255,255,0.9)', padding: 16, margin: 8, borderRadius: 8 },
  footerTitle: { fontSize: 12, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  footerText: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  paginationContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', marginHorizontal: 8, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#d4845a' },
  paginationButton: { width: 40, height: 40, backgroundColor: '#fff7ed', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d4845a' },
  paginationButtonDisabled: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  paginationInfo: { alignItems: 'center' },
  paginationText: { fontSize: 14, fontWeight: '600', color: '#8b6549', marginBottom: 2 },
  paginationSubtext: { fontSize: 11, color: '#6b7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fad5a5', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: 'white' },
  modalSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  closeButton: { width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20, paddingTop: 0 },
  patientCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  patientHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', gap: 4 },
  severityText: { fontSize: 11, fontWeight: '600', color: 'white' },
  detailsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  detailCard: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  detailIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  detailEmoji: { fontSize: 20 },
  detailLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  contactSection: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  contactItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  contactIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  contactContent: { flex: 1 },
  contactLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2, fontWeight: '500' },
  contactValue: { fontSize: 14, color: '#1f2937', fontWeight: '600' },
  riskSection: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#fecaca', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  riskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#fee2e2' },
  riskTitle: { fontSize: 14, fontWeight: '700', color: '#dc2626', marginLeft: 8 },
  riskList: { gap: 8 },
  riskItem: { flexDirection: 'row', alignItems: 'flex-start' },
  riskDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626', marginTop: 6, marginRight: 10 },
  riskText: { fontSize: 13, color: '#991b1b', flex: 1, lineHeight: 20 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  infoItem: { flex: 1, backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  infoLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#1f2937', fontWeight: '600' },
  modalFooter: { padding: 20, paddingTop: 12, backgroundColor: '#fad5a5', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  closeModalButton: { backgroundColor: '#D2691E', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  closeModalButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
});

export default HighRiskCasesScreen;
