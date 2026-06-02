import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Home, Search, Upload, CheckCircle, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { secureStorage } from '../../utils/secureStorage';
import { syncService } from '../../utils/syncService';
import { requestStoragePermission } from '../../utils/permissions';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import { useTranslation } from 'react-i18next';

const CreateECGReportScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const isOnline = useNetworkStatus();
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ecgDate, setEcgDate] = useState(new Date());
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [reportFile, setReportFile] = useState(null);
  const handleGoHome = async () => {
    const userInfo = await secureStorage.getItem('user_info');
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg_centre: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    navigation.navigate(roleRouteMap[userInfo?.role] || 'DPDashboard');
  };
  const isPatientApproved = patient => {
    if (patient?.is_self_registered === false) {
      return true;
    }
    const approvalValue = patient?.registration_approved ?? patient?.is_registration_approved;
    if (typeof approvalValue === 'boolean') return approvalValue;
    if (typeof approvalValue === 'number') return approvalValue === 1;
    if (typeof approvalValue === 'string') {
      const normalized = approvalValue.trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'approved';
    }
    return false;
  };
  useEffect(() => {
    loadPatients();
  }, []);
  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const data = await syncService.getPatients();
      const list = Array.isArray(data) ? data.filter(patient => isPatientApproved(patient)) : [];
      setPatients(list);
    } catch (error) {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };
  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(patient => {
      const fullName = patient?.full_name?.toLowerCase() || '';
      const mobile = String(patient?.mobile_number || '');
      const rchId = patient?.rch_id?.toLowerCase() || '';
      return fullName.includes(query) || mobile.includes(query) || rchId.includes(query);
    });
  }, [patientSearch, patients]);
  const formatDate = date => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };
  const formatDateDisplay = date => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  const resultOptions = ['normal', 'abnormal'];
  const appendSelectedFile = file => {
    if (!file) return;
    setReportFile({
      uri: file.uri,
      name: file.name || file.fileName || `ecg_report_${Date.now()}.pdf`,
      type: file.mimeType || file.type || 'application/pdf'
    });
  };
  const handleImagePick = async () => {
    setShowUploadModal(false);
    try {
      const resultValue = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8
      });
      if (!resultValue.canceled && resultValue.assets?.length > 0) {
        const file = resultValue.assets[0];
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert(t('error'), t('fileTooLargeMax10MB'));
          return;
        }
        appendSelectedFile({
          uri: file.uri,
          name: file.fileName || `ecg_report_${Date.now()}.jpg`,
          mimeType: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToPickImage'));
    }
  };
  const handleCameraPick = async () => {
    setShowUploadModal(false);
    try {
      const resultValue = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8
      });
      if (!resultValue.canceled && resultValue.assets?.length > 0) {
        const file = resultValue.assets[0];
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert(t('error'), t('fileTooLargeMax10MB'));
          return;
        }
        appendSelectedFile({
          uri: file.uri,
          name: file.fileName || `ecg_report_${Date.now()}.jpg`,
          mimeType: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToTakePhoto'));
    }
  };
  const handleDocumentPick = async () => {
    setShowUploadModal(false);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        return;
      }
      const resultValue = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
        copyToCacheDirectory: true
      });
      if (!resultValue.canceled && resultValue.assets?.length > 0) {
        const file = resultValue.assets[0];
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert(t('error'), t('fileTooLargeMax10MB'));
          return;
        }
        appendSelectedFile({
          uri: file.uri,
          name: file.name || `ecg_report_${Date.now()}.pdf`,
          mimeType: file.mimeType || 'application/pdf'
        });
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToSelectFile'));
    }
  };
  const handleSubmit = async () => {
    if (!selectedPatient) {
      Alert.alert(t('validationError'), t('pleaseSelectPatient'));
      return;
    }
    if (!result) {
      Alert.alert(t('validationError'), t('pleaseSelectEcgResult'));
      return;
    }
    try {
      setSubmitting(true);
      const createdReport = await syncService.createECGReport({
        pregnant_woman_id: selectedPatient.id,
        ecg_date: formatDate(ecgDate),
        result,
        notes: notes.trim(),
        report_file: reportFile ? {
          uri: reportFile.uri,
          name: reportFile.name,
          type: reportFile.type
        } : null
      });
      Alert.alert(t('success'), createdReport?.offline ? t('ecgReportSavedOfflineWillSync') : t('ecgReportCreatedSuccessfully'), [{
        text: t('ok'),
        onPress: () => navigation.goBack()
      }]);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(item => item?.msg).filter(Boolean).join(', ') : t('failedToCreateEcgReport');
      Alert.alert(t('error'), message);
    } finally {
      setSubmitting(false);
    }
  };
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
            <Text style={styles.headerTitle}>{t('createEcgReport')}</Text>
            <Text style={styles.headerSubtitle}>{t('ecgReportWorkflow')}</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView style={styles.mainContent} contentContainerStyle={styles.mainContentContainer} keyboardShouldPersistTaps="handled">
              {!isOnline && <View style={styles.warningBanner}>
                  <Text style={styles.warningText}>{t('ecgOfflineCreateInfo')}</Text>
                </View>}

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t('patient')}</Text>
                <TouchableOpacity style={styles.selector} onPress={() => setShowPatientModal(true)}>
                  <View>
                    <Text style={styles.selectorLabel}>{t('selectedPatient')}</Text>
                    <Text style={styles.selectorValue}>
                      {selectedPatient ? `${selectedPatient.full_name} • ${selectedPatient.mobile_number || t('noMobile')}` : t('selectPatient')}
                    </Text>
                  </View>
                  <Search size={18} color="#8B4513" />
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t('ecgDetails')}</Text>
                <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                  <Calendar size={18} color="#8B4513" />
                  <Text style={styles.dateText}>{formatDateDisplay(ecgDate)}</Text>
                </TouchableOpacity>
                <Text style={styles.inputLabel}>{t('ecgResult')}</Text>
                <View style={styles.resultOptions}>
                  {resultOptions.map(option => {
                  const isSelected = result === option;
                  return <TouchableOpacity key={option} style={[styles.resultOption, isSelected && styles.resultOptionSelected]} onPress={() => setResult(option)} activeOpacity={0.7}>
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected ? <View style={styles.radioInner} /> : null}
                        </View>
                        <Text style={[styles.resultOptionText, isSelected && styles.resultOptionTextSelected]}>
                          {option === 'normal' ? t('normal') : t('abnormal')}
                        </Text>
                      </TouchableOpacity>;
                })}
                </View>
                <TextInput style={styles.textArea} placeholder={t('notesOptional')} multiline numberOfLines={4} value={notes} onChangeText={setNotes} />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t('reportFileLabel')}</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={() => setShowUploadModal(true)}>
                  <Upload size={24} color="#8B4513" />
                  <Text style={styles.uploadText}>{reportFile ? t('replaceFile') : t('uploadEcgReportFileOptional')}</Text>
                  <Text style={styles.uploadHint}>{t('allowedReportFileTypes')}</Text>
                </TouchableOpacity>
                {reportFile ? <View style={styles.fileRow}>
                    <Text style={styles.fileName} numberOfLines={1}>{reportFile.name}</Text>
                    <TouchableOpacity onPress={() => setReportFile(null)}>
                      <Text style={styles.removeText}>{t('remove')}</Text>
                    </TouchableOpacity>
                  </View> : null}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={submitting}>
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="white" /> : <View style={styles.submitContent}>
                    <CheckCircle size={16} color="white" />
                    <Text style={styles.submitText}>{t('createEcgReport')}</Text>
                  </View>}
              </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>

        <KeyboardSafeModal visible={showPatientModal} position="center" onRequestClose={() => setShowPatientModal(false)} closeOnBackdropPress={true} contentStyle={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('selectPatient')}</Text>
              <View style={styles.searchInputWrap}>
                <Search size={18} color="#6b7280" />
                <TextInput style={styles.searchInput} placeholder={t('searchByNameMobileOrRchId')} value={patientSearch} onChangeText={setPatientSearch} />
              </View>
              {loadingPatients ? <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color="#8B4513" />
                </View> : <ScrollView style={styles.patientList}>
                  {filteredPatients.map(patient => <TouchableOpacity key={patient.id} style={styles.patientItem} onPress={() => {
                setSelectedPatient(patient);
                setShowPatientModal(false);
                setPatientSearch('');
              }}>
                      <Text style={styles.patientName}>{patient.full_name}</Text>
                      <Text style={styles.patientMeta}>{patient.mobile_number || t('noMobile')}{patient.rch_id ? ` • ${patient.rch_id}` : ''}</Text>
                    </TouchableOpacity>)}
                  {filteredPatients.length === 0 ? <Text style={styles.emptyPatients}>{t('noPatientsFound')}</Text> : null}
                </ScrollView>}
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowPatientModal(false)}>
                <Text style={styles.modalCloseText}>{t('close')}</Text>
              </TouchableOpacity>
        </KeyboardSafeModal>

        <KeyboardSafeModal visible={showUploadModal} position="center" onRequestClose={() => setShowUploadModal(false)} closeOnBackdropPress={true} contentStyle={styles.uploadModalCard}>
              <Text style={styles.modalTitle}>{t('uploadFile')}</Text>
              <TouchableOpacity style={styles.uploadOptionButton} onPress={handleCameraPick}>
                <Text style={styles.uploadOptionText}>{t('takePhoto')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadOptionButton} onPress={handleImagePick}>
                <Text style={styles.uploadOptionText}>{t('gallery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadOptionButton} onPress={handleDocumentPick}>
                <Text style={styles.uploadOptionText}>{t('documentPdf')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadCancelButton} onPress={() => setShowUploadModal(false)}>
                <Text style={styles.uploadCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
        </KeyboardSafeModal>

        {showDatePicker && <DateTimePicker value={ecgDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, value) => {
        setShowDatePicker(false);
        if (value) {
          setEcgDate(value);
        }
      }} maximumDate={new Date()} />}
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
  keyboardAvoidingView: {
    flex: 1
  },
  mainContent: {
    flex: 1,
    padding: 12
  },
  mainContentContainer: {
    paddingBottom: 24
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14
  },
  warningBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12
  },
  selector: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  selectorLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4
  },
  selectorValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600'
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  dateText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600'
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'white'
  },
  resultInput: {
    marginBottom: 12
  },
  resultOptions: {
    gap: 10,
    marginBottom: 12
  },
  resultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f9fafb'
  },
  resultOptionSelected: {
    borderColor: '#D2691E',
    backgroundColor: '#fff7ed'
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOuterSelected: {
    borderColor: '#D2691E'
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D2691E'
  },
  resultOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  resultOptionTextSelected: {
    color: '#9a3412'
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: 'white',
    minHeight: 110,
    textAlignVertical: 'top'
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  uploadText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginTop: 8
  },
  uploadHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4
  },
  fileRow: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#374151'
  },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626'
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: 'white'
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D2691E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white'
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D2691E'
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#D2691E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white'
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: 16
  },
  uploadModalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 14
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0
  },
  patientList: {
    maxHeight: 360
  },
  patientItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  patientMeta: {
    fontSize: 12,
    color: '#6b7280'
  },
  emptyPatients: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280'
  },
  modalLoading: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  modalCloseButton: {
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    alignItems: 'center'
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151'
  },
  uploadOptionButton: {
    backgroundColor: '#D2691E',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10
  },
  uploadOptionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700'
  },
  uploadCancelButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    alignItems: 'center'
  },
  uploadCancelText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700'
  }
});

export default CreateECGReportScreen;
