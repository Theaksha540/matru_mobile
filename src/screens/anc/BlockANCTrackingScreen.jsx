// src/screens/ANCTrackingScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Clock, ChevronRight, FileText, Calendar } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminAPI, usgAppointmentAPI, pregnantWomenAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
const ANCTracking = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const {
    width
  } = useWindowDimensions();
  const isSmallScreen = width < 380;
  const isTablet = width >= 768;
  const horizontalPadding = isSmallScreen ? 12 : isTablet ? 24 : 16;
  const contentMaxWidth = isTablet ? 860 : width;
  const patientId = route?.params?.patientId;
  const [patientInfo, setPatientInfo] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usgCentres, setUsgCentres] = useState([]);
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_info');
      if (userData) {
        const user = JSON.parse(userData);
        setUserInfo(user);

        // Load USG centres for the district
        if (user.district_id) {
          const centres = await adminAPI.getUSGCentres(user.district_id);
          setUsgCentres(centres);
        }
      }
      if (patientId) {
        const patientData = await pregnantWomenAPI.getById(patientId);
        setPatientInfo(patientData);
      }
    } catch (error) {} finally {
      setLoading(false);
    }
  };

  // ANC Visits data - should come from API
  const ancVisits = [];
  const handleBack = () => {
    navigation.goBack();
  };
  const handleUpdateVisit = visitId => {
    navigation.navigate('ANCUpdateForm', {
      visitId
    });
  };
  const handleScheduleUSG = () => {
    if (!patientInfo?.id) {
      Alert.alert(t('error'), t('noPatientSelected'));
      return;
    }
    if (usgCentres.length === 0) {
      Alert.alert(t('error'), t('noUSGCentresInDistrict'));
      return;
    }

    // Navigate to USG appointment form
    navigation.navigate('USGAppointmentForm', {
      patientId: patientInfo.id,
      patientName: patientInfo.full_name
    });
  };
  const renderVisitCard = (visit, isLast) => {
    const IconComponent = visit.icon;
    return <View key={visit.id} style={styles.visitContainer}>
        {/* Timeline line - except for last item */}
        {!isLast && <View style={styles.timelineLine} />}
        
        <View style={[styles.visitCard, {
        backgroundColor: visit.color,
        borderColor: visit.borderColor
      }]}>
          <View style={styles.visitContent}>
            <View style={styles.visitIcon}>
              <IconComponent size={20} color={visit.statusColor} />
            </View>
            
            <View style={styles.visitDetails}>
              {/* Visit header */}
              <View style={styles.visitHeader}>
                <Text style={styles.visitTitle}>{visit.visitNumber}</Text>
                <View style={[styles.statusBadge, {
                backgroundColor: visit.statusColor
              }]}>
                  <Text style={styles.statusText}>
                    {visit.status === 'completed' ? 'Completed' : 'Pending'}
                  </Text>
                </View>
              </View>

              {/* Visit dates */}
              <View style={styles.visitDates}>
                <Text style={styles.dateText}>Due Date: {visit.dueDate}</Text>
                {visit.completedDate && <Text style={styles.dateText}>Completed: {visit.completedDate}</Text>}
              </View>

              {/* Health metrics for completed visits */}
              {visit.status === 'completed' && <View style={styles.metricsCard}>
                  <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Weight</Text>
                      <Text style={styles.metricValue}>{visit.weight}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>BP</Text>
                      <Text style={styles.metricValue}>{visit.bp}</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Hb</Text>
                      <Text style={styles.metricValue}>{visit.haemoglobin}</Text>
                    </View>
                  </View>
                </View>}

              {/* Update button for pending visits */}
              {visit.status === 'pending' && <TouchableOpacity style={styles.updateButton} onPress={() => handleUpdateVisit(visit.id)} activeOpacity={0.7}>
                  <Text style={styles.updateButtonText}>
                    Update Visit / ଭେଟ ଅପଡେଟ୍ କରନ୍ତୁ
                  </Text>
                  <ChevronRight size={16} color="white" />
                </TouchableOpacity>}
            </View>
          </View>
        </View>
      </View>;
  };
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeftSection}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <ArrowLeft size={12} color="white" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>{t('ancTracking')}</Text>
                  <Text style={styles.headerSubtitle}>ANC ଟ୍ରାକିଂ</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={[styles.mainContent, {
          paddingHorizontal: horizontalPadding
        }]}>
            <View style={[styles.contentContainer, {
            maxWidth: contentMaxWidth
          }]}>
              {/* Patient Info Card */}
              <View style={styles.patientCard}>
                <Text style={styles.patientName}>{patientInfo?.full_name || t('noPatientSelected')}</Text>
                
                <View style={styles.patientDetailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Age / ବୟସ</Text>
                    <Text style={styles.detailValue}>{patientInfo?.age ? `${patientInfo.age} ${t('years')}` : 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>EDD</Text>
                    <Text style={styles.detailValue}>{patientInfo?.edd_date || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>LMP</Text>
                    <Text style={styles.detailValue}>{patientInfo?.lmp_date || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Location / ସ୍ଥାନ</Text>
                    <Text style={styles.detailValue}>{patientInfo?.address || 'N/A'}</Text>
                  </View>
                </View>
              </View>

              {/* ANC Timeline */}
              <View style={styles.ancTimeline}>
                <Text style={styles.sectionTitle}>
                  {t('ancVisitTimeline')}
                </Text>
                
                <TouchableOpacity style={styles.timelineItemSimple} onPress={handleScheduleUSG} activeOpacity={0.7}>
                  <View style={styles.timelineIconSimple}>
                    <FileText size={14} color="white" />
                  </View>
                  <View style={styles.timelineContentSimple}>
                    <Text style={styles.timelineTitle}>{t('uploadReport')}</Text>
                    <Text style={styles.timelineSubtitle}>ଅଲଟ୍ରାସାଉଣ୍ଡ ରିପୋର୍ଟ ଅପଡେଟ କରନ୍ତୁ</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
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
    padding: 20,
    width: '100%'
  },
  headerLeftSection: {
    flexDirection: 'column',
    gap: 8
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    padding: 3,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitleContainer: {
    flex: 1
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 0,
    letterSpacing: -0.25
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 11,
    opacity: 0.9,
    fontWeight: '500'
  },
  mainContent: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f0f4f8'
  },
  contentContainer: {
    alignSelf: 'center',
    width: '100%'
  },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 8
  },
  patientDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  detailItem: {
    flexDirection: 'column',
    gap: 2,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    width: '48%',
    flex: 1,
    flexBasis: '48%'
  },
  detailLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  detailValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600'
  },
  ancTimeline: {
    padding: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16
  },
  timelineItemSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: 12
  },
  timelineIconSimple: {
    width: 32,
    height: 32,
    backgroundColor: '#8B4513',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  timelineContentSimple: {
    flex: 1
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2
  },
  timelineSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    margin: 0
  },
  visitContainer: {
    position: 'relative'
  },
  timelineLine: {
    position: 'absolute',
    left: 36,
    top: 60,
    width: 2,
    height: '100%',
    backgroundColor: '#d1d5db',
    zIndex: -1
  },
  visitCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12
  },
  visitContent: {
    flexDirection: 'row'
  },
  visitIcon: {
    marginRight: 12,
    marginTop: 2
  },
  visitDetails: {
    flex: 1
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  visitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600'
  },
  visitDates: {
    marginBottom: 12
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2
  },
  metricsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    marginBottom: 12
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metricItem: {
    alignItems: 'center',
    flex: 1
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 2
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937'
  },
  updateButton: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  updateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8
  },
  usgButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#8B4513',
    borderRadius: 12,
    padding: 16
  },
  usgButtonContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  usgIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  usgTextContainer: {
    flex: 1
  },
  usgTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2
  },
  usgSubtitle: {
    fontSize: 12,
    color: '#6b7280'
  },
  usgCentreInfo: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4
  },
  noVisitsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  noVisitsText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center'
  }
});
export default ANCTracking;
