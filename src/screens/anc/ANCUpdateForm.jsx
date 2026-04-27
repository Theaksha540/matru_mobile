import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView,SafeAreaProvider } from 'react-native-safe-area-context';
import { 
  ArrowLeft,
  Check,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { syncService } from '../../utils/syncService';
import { ancVisitAPI } from '../../services/api';
import { secureStorage } from '../../utils/secureStorage';
import '../../i18n';

import DateTimePicker from '@react-native-community/datetimepicker';

const ANCUpdateForm = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { patient, visitData, onSuccess } = route.params || {};
  const isEdit = !!visitData;
  
  const [formData, setFormData] = useState({
    visit_number: visitData?.visit_number?.toString() || '',
    visit_date: visitData?.visit_date || '',
    weight: visitData?.weight?.toString() || '',
    blood_pressure: visitData?.blood_pressure || '',
    hemoglobin: visitData?.hemoglobin?.toString() || '',
    fundal_height: visitData?.fundal_height?.toString() || '',
    fetal_heart_rate: visitData?.fetal_heart_rate?.toString() || '',
    referred_for_usg: visitData?.referred_for_usg || false,
    is_emergency: visitData?.is_emergency || false,
    doctor_notes: visitData?.doctor_notes || '',
    next_visit_date: visitData?.next_visit_date || '',
    facility_name: visitData?.facility_name || '',
  });
  
  const [errors, setErrors] = useState({
    blood_pressure: '',
    hemoglobin: '',
    fetal_heart_rate: '',
    weight: '',
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNextDatePicker, setShowNextDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    verifyAccess();
  }, []);

  useEffect(() => {
    if (accessChecked && !isEdit && patient?.id) {
      loadPastVisits();
    }
  }, [patient?.id, isEdit, accessChecked]);

  const verifyAccess = async () => {
    try {
      const userInfo = await secureStorage.getItem('user_info');

      if (userInfo?.role !== 'sub_centre') {
        Alert.alert(
          t('error'),
          'Only sub-centre users can add or edit ANC visits.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setAccessChecked(true);
    } catch (error) {
      console.error('Error verifying ANC visit access:', error);
      Alert.alert(
        t('error'),
        'Unable to verify ANC visit permissions.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const loadPastVisits = async () => {
    try {
      const [syncedVisits, offlineVisits] = await Promise.all([
        syncService.getANCVisits(patient.id),
        syncService.getOfflineANCVisits(patient.id),
      ]);

      const allVisits = [...(syncedVisits || []), ...(offlineVisits || [])]
        .filter(Boolean)
        .reduce((visits, visit) => {
          const dedupeKey = `${visit.sync_status || 'synced'}_${visit.id || visit.visit_number}_${visit.visit_date || ''}`;
          if (!visits.some((existingVisit) => existingVisit._dedupeKey === dedupeKey)) {
            visits.push({ ...visit, _dedupeKey: dedupeKey });
          }
          return visits;
        }, []);

      const highestVisitNumber = allVisits.reduce((maxVisitNumber, visit) => {
        const visitNumber = Number(visit.visit_number) || 0;
        return Math.max(maxVisitNumber, visitNumber);
      }, 0);

      setFormData(prev => ({
        ...prev,
        visit_number: String(highestVisitNumber + 1)
      }));
    } catch (error) {
      console.error('Error loading past visits:', error);
      // Default to visit 1 if error
      setFormData(prev => ({
        ...prev,
        visit_number: '1'
      }));
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleInputChange = (field, value) => {
    let filteredValue = value;
    
    if (field === 'blood_pressure') {
      filteredValue = value.replace(/[^0-9\/]/g, '');
    } else if (field === 'hemoglobin') {
      filteredValue = value.replace(/[^0-9.]/g, '');
      const parts = filteredValue.split('.');
      if (parts.length > 2) filteredValue = parts[0] + '.' + parts.slice(1).join('');
    } else if (field === 'fetal_heart_rate') {
      filteredValue = value.replace(/[^0-9]/g, '');
    }
    
    setFormData({
      ...formData,
      [field]: filteredValue,
    });
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      const selectedDate = date.toISOString().split('T')[0];
      const registrationDate = patient?.created_at?.split('T')[0] || patient?.registration_date?.split('T')[0];
      
      if (registrationDate && selectedDate < registrationDate) {
        Alert.alert(t('error'), 'Visit date cannot be before registration date');
        return;
      }
      
      setSelectedDate(date);
      handleInputChange('visit_date', selectedDate);
    }
  };

  const handleNextDateChange = (event, date) => {
    setShowNextDatePicker(false);
    if (date) {
      const formattedDate = date.toISOString().split('T')[0];
      handleInputChange('next_visit_date', formattedDate);
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const validateBloodPressure = (bp) => {
    const bpRegex = /^(\d{2,3})\/(\d{2,3})$/;
    const match = bp.match(bpRegex);
    if (!match) return 'Blood Pressure must be in format: systolic/diastolic (e.g., 120/80)';
    
    const systolic = parseInt(match[1]);
    const diastolic = parseInt(match[2]);
    
    if (systolic < 70 || systolic > 200) return 'Systolic pressure must be between 70-200 mmHg';
    if (diastolic < 40 || diastolic > 130) return 'Diastolic pressure must be between 40-130 mmHg';
    if (systolic <= diastolic) return 'Systolic pressure must be greater than diastolic';
    
    return null;
  };

  const validateFetalHeartRate = (fhr) => {
    if (!fhr) return null;
    const rate = parseFloat(fhr);
    if (isNaN(rate)) return 'Fetal Heart Rate must be a valid number';
    if (rate < 110 || rate > 180) return 'Fetal Heart Rate must be between 110-180 bpm';
    return null;
  };

  const validateHemoglobin = (hb) => {
    const level = parseFloat(hb);
    if (isNaN(level)) return 'Hemoglobin must be a valid number';
    if (level < 4 || level > 20) return 'Hemoglobin must be between 4-20 g/dL';
    return null;
  };

  const validateWeight = (wt) => {
    const weight = parseFloat(wt);
    if (isNaN(weight)) return 'Weight must be a valid number';
    if (weight < 30 || weight > 200) return 'Weight must be between 30-200 kg';
    return null;
  };

  const handleSave = async () => {
    if (!accessChecked) {
      return;
    }

    if (!formData.visit_number || !formData.visit_date || !formData.weight || !formData.blood_pressure || !formData.hemoglobin) {
      Alert.alert(t('error'), t('pleaseEnterAllRequiredFields'));
      return;
    }

    const bpError = validateBloodPressure(formData.blood_pressure);
    if (bpError) {
      Alert.alert(t('error'), bpError);
      return;
    }

    const wtError = validateWeight(formData.weight);
    if (wtError) {
      Alert.alert(t('error'), wtError);
      return;
    }

    const hbError = validateHemoglobin(formData.hemoglobin);
    if (hbError) {
      Alert.alert(t('error'), hbError);
      return;
    }

    const fhrError = validateFetalHeartRate(formData.fetal_heart_rate);
    if (fhrError) {
      Alert.alert(t('error'), fhrError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pregnant_woman_id: patient.id,
        visit_number: parseInt(formData.visit_number),
        visit_date: formData.visit_date,
        weight: parseFloat(formData.weight),
        blood_pressure: formData.blood_pressure,
        hemoglobin: parseFloat(formData.hemoglobin),
        fundal_height: formData.fundal_height ? parseFloat(formData.fundal_height) : null,
        fetal_heart_rate: formData.fetal_heart_rate ? parseFloat(formData.fetal_heart_rate) : null,
        referred_for_usg: formData.referred_for_usg,
        is_emergency: formData.is_emergency,
        doctor_notes: formData.doctor_notes || null,
        next_visit_date: formData.next_visit_date || null,
        facility_name: formData.facility_name || null,
      };

      const isOnline = await syncService.isOnline();
      
      if (isOnline) {
        // Online: Save to server
        if (isEdit) {
          await ancVisitAPI.update(visitData.id, payload);
        } else {
          await ancVisitAPI.create(payload);
        }
      } else {
        // Offline: Save to local database
        const offlinePayload = {
          ...payload,
          id: isEdit ? visitData.id : `offline_${Date.now()}`,
          sync_status: 'pending',
          created_offline: !isEdit
        };
        
        // Save to offline database
        await syncService.saveOfflineANCVisit(offlinePayload);
      }

      const statusMessage = isOnline ? 'successfully' : 'offline - will sync when online';
      Alert.alert(t('success'), `${t('ancVisit')} ${isEdit ? t('updated') : t('created')} ${statusMessage}!`, [
        {
          text: 'OK',
          onPress: () => {
            if (onSuccess) onSuccess();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(t('error'), t('failedToSaveANCVisit'));
    } finally {
      setSaving(false);
    }
  };

  if (!accessChecked) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']} />
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
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={handleBack}
                >
                  <ArrowLeft size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                  <Text style={styles.headerTitle}>{t('ancTracking')}</Text>
                  <Text style={styles.headerSubtitle}>ANC ଟ୍ରାକିଂ</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Form Card */}
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>{isEdit ? t('update') : t('add')} {t('ancVisit')}</Text>
                <Text style={styles.formSubtitle}>ANC ଭେଟ {isEdit ? 'ଅପଡେଟ୍' : 'ଯୋଡନ୍ତୁ'}</Text>

                <View style={styles.formFields}>
                  {/* Visit Number */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('visitNumber')} *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: '#f9fafb', color: '#6b7280' }]}
                      placeholder="Auto-filled"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      value={formData.visit_number}
                      editable={false}
                    />
                  </View>

                  {/* Visit Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('visitDate')} *</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={formData.visit_date ? styles.dateText : styles.placeholderText}>
                        {formData.visit_date ? formatDateForDisplay(formData.visit_date) : 'Select Date (DD/MM/YYYY)'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Weight and BP in Row */}
                  <View style={styles.rowContainer}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.inputLabel}>{t('weight')} (kg) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="kg"
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        maxLength={5}
                        value={formData.weight}
                        onChangeText={(value) => {
                          const filtered = value.replace(/[^0-9.]/g, '');
                          const parts = filtered.split('.');
                          let final = filtered;
                          if (parts.length > 2) final = parts[0] + '.' + parts.slice(1).join('');
                          setFormData({ ...formData, weight: final });
                          if (final) {
                            const error = validateWeight(final);
                            setErrors(prev => ({ ...prev, weight: error || '' }));
                          } else {
                            setErrors(prev => ({ ...prev, weight: '' }));
                          }
                        }}
                      />
                      {errors.weight ? <Text style={styles.errorText}>{errors.weight}</Text> : null}
                    </View>

                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.inputLabel}>{t('bloodPressure')} *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="120/80"
                        placeholderTextColor="#9ca3af"
                        keyboardType="numbers-and-punctuation"
                        value={formData.blood_pressure}
                        onChangeText={(value) => {
                          let filtered = value.replace(/[^0-9\/]/g, '');
                          const parts = filtered.split('/');
                          if (parts.length > 2) filtered = parts[0] + '/' + parts[1];
                          if (parts[0] && parts[0].length > 3) {
                            filtered = parts[0].slice(0, 3) + '/' + (parts[1] || '');
                          } else if (parts[0] && parts[0].length === 3 && !filtered.includes('/') && value.length > formData.blood_pressure.length) {
                            filtered = parts[0] + '/';
                          }
                          if (parts[1] && parts[1].length > 3) filtered = parts[0] + '/' + parts[1].slice(0, 3);
                          setFormData({ ...formData, blood_pressure: filtered });
                          if (filtered) {
                            const error = validateBloodPressure(filtered);
                            setErrors(prev => ({ ...prev, blood_pressure: error || '' }));
                          } else {
                            setErrors(prev => ({ ...prev, blood_pressure: '' }));
                          }
                        }}
                      />
                      {errors.blood_pressure ? <Text style={styles.errorText}>{errors.blood_pressure}</Text> : null}
                    </View>
                  </View>

                  {/* Hemoglobin and Fundal Height */}
                  <View style={styles.rowContainer}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.inputLabel}>Hemoglobin (g/dl) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="11.5"
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        value={formData.hemoglobin}
                        onChangeText={(value) => {
                          let filtered = value.replace(/[^0-9.]/g, '');
                          const parts = filtered.split('.');
                          if (parts.length > 2) filtered = parts[0] + '.' + parts.slice(1).join('');
                          if (parts[0] && parts[0].length > 2) {
                            filtered = parts[0].slice(0, 2) + '.' + (parts[1] || '');
                          } else if (parts[0] && parts[0].length === 2 && !filtered.includes('.') && value.length > formData.hemoglobin.length) {
                            filtered = parts[0] + '.';
                          }
                          if (parts[1] && parts[1].length > 1) filtered = parts[0] + '.' + parts[1].slice(0, 1);
                          setFormData({ ...formData, hemoglobin: filtered });
                          if (filtered) {
                            const error = validateHemoglobin(filtered);
                            setErrors(prev => ({ ...prev, hemoglobin: error || '' }));
                          } else {
                            setErrors(prev => ({ ...prev, hemoglobin: '' }));
                          }
                        }}
                      />
                      {errors.hemoglobin ? <Text style={styles.errorText}>{errors.hemoglobin}</Text> : null}
                    </View>

                    <View style={[styles.inputGroup, styles.halfWidth]}>
                      <Text style={styles.inputLabel}>{t('fundalHeight')} (cm)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="cm"
                        placeholderTextColor="#9ca3af"
                        keyboardType="decimal-pad"
                        value={formData.fundal_height}
                        onChangeText={(value) => handleInputChange('fundal_height', value)}
                      />
                    </View>
                  </View>

                  {/* Fetal Heart Rate */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('fetalHeartRate')} (bpm)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="120-160"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                      maxLength={3}
                      value={formData.fetal_heart_rate}
                      onChangeText={(value) => {
                        const filtered = value.replace(/[^0-9]/g, '');
                        setFormData({ ...formData, fetal_heart_rate: filtered });
                        if (filtered) {
                          const error = validateFetalHeartRate(filtered);
                          setErrors(prev => ({ ...prev, fetal_heart_rate: error || '' }));
                        } else {
                          setErrors(prev => ({ ...prev, fetal_heart_rate: '' }));
                        }
                      }}
                    />
                    {errors.fetal_heart_rate ? <Text style={styles.errorText}>{errors.fetal_heart_rate}</Text> : null}
                  </View>

                  {/* Facility Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('facilityName')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('enterFacilityName')}
                      placeholderTextColor="#9ca3af"
                      value={formData.facility_name}
                      onChangeText={(value) => handleInputChange('facility_name', value)}
                    />
                  </View>

                  {/* Doctor Notes */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('doctorNotes')}</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={t('enterNotes')}
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={3}
                      value={formData.doctor_notes}
                      onChangeText={(value) => handleInputChange('doctor_notes', value)}
                    />
                  </View>

                  {/* Next Visit Date */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('nextVisitDate')}</Text>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowNextDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={formData.next_visit_date ? styles.dateText : styles.placeholderText}>
                        {formData.next_visit_date ? formatDateForDisplay(formData.next_visit_date) : 'Select Date (DD/MM/YYYY)'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Date Pickers */}
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                  />
                )}
                {showNextDatePicker && (
                  <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    onChange={handleNextDateChange}
                    minimumDate={new Date()}
                  />
                )}

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>
                      {t('cancel')} / ବାତିଲ୍
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={handleSave}
                    activeOpacity={0.7}
                  >
                    <Check size={20} color="white" style={styles.saveIcon} />
                    <Text style={styles.saveButtonText}>
                      {saving ? t('saving') : `${t('save')} / ସେଭ୍`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fad5a5',
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  formFields: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: 'white',
  },
  dateInput: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});

export default ANCUpdateForm;
