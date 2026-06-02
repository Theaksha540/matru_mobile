import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { ArrowLeft, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { adminAPI, grievanceAPI } from '../../services/api';
import LanguageToggle from '../../components/LanguageToggle';
import KeyboardSafeModal from '../../components/KeyboardSafeModal';
import '../../i18n';
const SubmitGrievanceScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const [formData, setFormData] = useState({
    grievanceName: '',
    grievancePhone: '',
    grievanceComplaint: '',
    grievanceDistrictId: '1',
    grievanceBlockId: '',
    grievanceWardId: ''
  });
  const [blocks, setBlocks] = useState([]);
  const [wards, setWards] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [grievanceAttachment, setGrievanceAttachment] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [blockSearch, setBlockSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  useEffect(() => {
    loadDistricts();
    loadBlocks();
  }, []);
  useEffect(() => {
    if (formData.grievanceBlockId) {
      loadWards(formData.grievanceBlockId);
    } else {
      setWards([]);
    }
  }, [formData.grievanceBlockId]);
  const loadDistricts = async () => {
    try {
      const data = await adminAPI.getDistricts();
      setDistricts(data);
    } catch (error) {}
  };
  const loadBlocks = async () => {
    try {
      const data = await adminAPI.getBlocks();
      setBlocks(data);
    } catch (error) {}
  };
  const loadWards = async blockId => {
    try {
      const data = await adminAPI.getWards({
        block_id: blockId
      });
      setWards(data);
    } catch (error) {}
  };
  const pickGrievanceDocument = async () => {
    setShowUploadModal(true);
  };
  const handleImagePick = async () => {
    setShowUploadModal(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Validate file size (10MB)
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert('Error', 'File too large. Maximum size: 10MB');
          return;
        }
        setGrievanceAttachment({
          uri: file.uri,
          name: file.fileName || `image_${Date.now()}.jpg`,
          type: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };
  const handleCameraPick = async () => {
    setShowUploadModal(false);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 0.8
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Validate file size (10MB)
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert('Error', 'File too large. Maximum size: 10MB');
          return;
        }
        setGrievanceAttachment({
          uri: file.uri,
          name: file.fileName || `camera_${Date.now()}.jpg`,
          type: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };
  const handleDocumentPick = async () => {
    setShowUploadModal(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        // Validate file size (10MB)
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert('Error', 'File too large. Maximum size: 10MB');
          return;
        }
        setGrievanceAttachment({
          uri: file.uri,
          name: file.name,
          type: file.mimeType
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };
  const handleSubmit = async () => {
    if (!formData.grievanceName || !formData.grievancePhone || !formData.grievanceComplaint || !formData.grievanceBlockId) {
      Alert.alert(t('error'), t('pleaseEnterMandatoryFields'));
      return;
    }
    if (formData.grievanceBlockId && wards.length > 0 && !formData.grievanceWardId) {
      Alert.alert(t('error'), 'Ward selection is mandatory for this block');
      return;
    }
    if (formData.grievancePhone.length !== 10) {
      Alert.alert(t('error'), t('mobileNumberMust10Digits'));
      return;
    }
    setIsSubmitting(true);
    try {
      const submitData = {
        name: formData.grievanceName,
        mobile_number: formData.grievancePhone,
        grievance_note: formData.grievanceComplaint,
        block_id: parseInt(formData.grievanceBlockId),
        district_id: parseInt(formData.grievanceDistrictId || 1)
      };
      if (formData.grievanceWardId) {
        submitData.ward_id = parseInt(formData.grievanceWardId);
      }
      if (grievanceAttachment) {
        submitData.attachment = grievanceAttachment;
      }
      // Create FormData for proper file upload
      const formDataToSend = new FormData();
      formDataToSend.append('name', submitData.name);
      formDataToSend.append('mobile_number', submitData.mobile_number);
      formDataToSend.append('grievance_note', submitData.grievance_note);
      formDataToSend.append('block_id', submitData.block_id.toString());
      formDataToSend.append('district_id', submitData.district_id.toString());
      if (submitData.ward_id) {
        formDataToSend.append('ward_id', submitData.ward_id.toString());
      }
      if (grievanceAttachment) {
        formDataToSend.append('attachment', {
          uri: grievanceAttachment.uri,
          type: grievanceAttachment.type,
          name: grievanceAttachment.name
        });
      }
      const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/v2/grievances/`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      Alert.alert(t('success'), t('grievanceSubmittedSuccessfully') + '\n\nTicket Number: ' + response.data.ticket_number + '\n\nPlease save this ticket number for future reference.', [{
        text: 'OK',
        onPress: () => navigation.navigate('Login')
      }]);
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (errorDetail) {
        if (errorDetail.includes('Invalid mobile number format')) {
          Alert.alert(t('error'), 'Invalid mobile number format. Must be 10 digits starting with 6-9.');
        } else if (errorDetail.includes('not registered')) {
          Alert.alert('Not Registered', 'You are not registered. Please register first as a Pregnant Woman before submitting a grievance.', [{
            text: 'Cancel',
            style: 'cancel'
          }, {
            text: 'Register Now',
            onPress: () => navigation.navigate('SelfRegister')
          }]);
        } else if (errorDetail.includes('Invalid file type')) {
          Alert.alert(t('error'), 'Invalid file type. Allowed types: PDF, JPG, JPEG, PNG');
        } else if (errorDetail.includes('File too large')) {
          Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
        } else if (errorDetail.includes('File content does not match')) {
          Alert.alert(t('error'), 'File content mismatch. Please check the file.');
        } else {
          Alert.alert(t('error'), errorDetail);
        }
      } else if (error.code === 'NETWORK_ERROR' || error.message === 'Network Error') {
        Alert.alert(t('error'), 'Network connection failed. Please check your internet connection and try again.');
      } else {
        Alert.alert(t('error'), t('failedToSubmitGrievance'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('submitGrievance')}</Text>
        <LanguageToggle style={styles.languageToggle} />
      </View>

      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('fullName')} *</Text>
            <TextInput style={styles.input} placeholder={t('enterFullName')} value={formData.grievanceName} onChangeText={text => setFormData({
              ...formData,
              grievanceName: text
            })} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('phoneNumber')} *</Text>
            <TextInput style={styles.input} placeholder={t('mobile10Digit')} value={formData.grievancePhone} onChangeText={text => setFormData({
              ...formData,
              grievancePhone: text
            })} keyboardType="phone-pad" maxLength={10} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('complaintDetails')} *</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder={t('complaintDetails')} value={formData.grievanceComplaint} onChangeText={text => setFormData({
              ...formData,
              grievanceComplaint: text
            })} multiline numberOfLines={6} textAlignVertical="top" />
          </View>

          {districts.length > 1 && <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('selectDistrict')}</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={formData.grievanceDistrictId || '1'} onValueChange={value => setFormData({
                ...formData,
                grievanceDistrictId: value,
                grievanceBlockId: '',
                grievanceWardId: ''
              })} style={styles.picker}>
                  {districts.map(district => <Picker.Item key={district.id} label={district.name} value={district.id} />)}
                </Picker>
              </View>
            </View>}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('selectBlock')} *</Text>
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowBlockModal(true)}>
              <Text style={formData.grievanceBlockId ? styles.selectTextFilled : styles.selectText}>
                {blocks.find(b => b.id === formData.grievanceBlockId)?.name || t('selectBlock')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('selectWard')} {wards.length > 0 ? '*' : ''}</Text>
            <TouchableOpacity style={styles.selectButton} onPress={() => wards.length > 0 && setShowWardModal(true)} disabled={!formData.grievanceBlockId || wards.length === 0}>
              <Text style={formData.grievanceWardId ? styles.selectTextFilled : styles.selectText}>
                {wards.find(w => w.id === formData.grievanceWardId)?.name || (formData.grievanceBlockId ? wards.length > 0 ? t('selectWard') : 'No ward selection needed' : t('selectBlockFirst'))}
              </Text>
            </TouchableOpacity>
            {wards.length > 0 && !formData.grievanceWardId && <Text style={styles.noteText}>* Ward selection is mandatory for this block</Text>}
          </View>

          <TouchableOpacity style={styles.uploadButton} onPress={pickGrievanceDocument}>
            <Upload size={20} color="#8b4513" />
            <Text style={styles.uploadText}>
              {grievanceAttachment ? grievanceAttachment.name : t('uploadAttachment')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.submitButton, (!formData.grievanceName || !formData.grievancePhone || !formData.grievanceComplaint || !formData.grievanceBlockId || wards.length > 0 && !formData.grievanceWardId || isSubmitting) && styles.disabledButton]} onPress={handleSubmit} disabled={!formData.grievanceName || !formData.grievancePhone || !formData.grievanceComplaint || !formData.grievanceBlockId || wards.length > 0 && !formData.grievanceWardId || isSubmitting}>
            <Text style={styles.submitText}>
              {isSubmitting ? t('submitting') : t('submitGrievanceBtn')}
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showUploadModal} transparent animationType="fade">
        <View style={styles.uploadModalOverlay}>
          <View style={styles.uploadModalContent}>
            <Text style={styles.uploadModalTitle}>Upload Attachment</Text>
            <Text style={styles.uploadModalSubtitle}>Choose file type</Text>
            
            <TouchableOpacity style={styles.uploadOptionButton} onPress={handleCameraPick}>
              <Text style={styles.uploadOptionText}>📷 Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.uploadOptionButton} onPress={handleImagePick}>
              <Text style={styles.uploadOptionText}>🖼️ Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.uploadOptionButton} onPress={handleDocumentPick}>
              <Text style={styles.uploadOptionText}>📄 Document (PDF)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.uploadCancelButton} onPress={() => setShowUploadModal(false)}>
              <Text style={styles.uploadCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Block Modal */}
      <KeyboardSafeModal visible={showBlockModal} position="center" onRequestClose={() => {
      setShowBlockModal(false);
      setBlockSearch('');
    }} closeOnBackdropPress={true}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectBlock')}</Text>
          <TouchableOpacity onPress={() => {
          setShowBlockModal(false);
          setBlockSearch('');
        }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.searchInput} placeholder="Search block..." value={blockSearch} onChangeText={setBlockSearch} />
        <ScrollView style={{
        maxHeight: 400
      }} keyboardShouldPersistTaps="handled">
          {blocks.filter(block => block.name.toLowerCase().includes(blockSearch.toLowerCase())).map(block => <TouchableOpacity key={block.id} style={styles.modalOption} onPress={() => {
          setFormData({
            ...formData,
            grievanceBlockId: block.id,
            grievanceWardId: ''
          });
          setShowBlockModal(false);
          setBlockSearch('');
        }}>
                <Text style={styles.modalOptionText}>{block.name}</Text>
              </TouchableOpacity>)}
        </ScrollView>
      </KeyboardSafeModal>

      {/* Ward Modal */}
      <KeyboardSafeModal visible={showWardModal} position="center" onRequestClose={() => {
      setShowWardModal(false);
      setWardSearch('');
    }} closeOnBackdropPress={true}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('selectWard')}</Text>
          <TouchableOpacity onPress={() => {
          setShowWardModal(false);
          setWardSearch('');
        }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.searchInput} placeholder="Search ward..." value={wardSearch} onChangeText={setWardSearch} />
        <ScrollView style={{
        maxHeight: 400
      }} keyboardShouldPersistTaps="handled">
          {wards.filter(ward => ward.name.toLowerCase().includes(wardSearch.toLowerCase())).map(ward => <TouchableOpacity key={ward.id} style={styles.modalOption} onPress={() => {
          setFormData({
            ...formData,
            grievanceWardId: ward.id
          });
          setShowWardModal(false);
          setWardSearch('');
        }}>
                <Text style={styles.modalOptionText}>{ward.name}</Text>
              </TouchableOpacity>)}
        </ScrollView>
      </KeyboardSafeModal>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  header: {
    backgroundColor: '#D2691E',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
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
    color: 'white'
  },
  keyboardAvoidingView: {
    flex: 1
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 12
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    gap: 16
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6
  },
  input: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    fontSize: 16,
    backgroundColor: '#ffffff'
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top'
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#ffffff'
  },
  picker: {
    height: 50
  },
  uploadButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    gap: 8
  },
  uploadText: {
    fontSize: 14,
    color: '#6b7280'
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#8B4513',
    alignItems: 'center',
    marginTop: 20
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600'
  },
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400
  },
  uploadModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center'
  },
  uploadModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center'
  },
  uploadOptionButton: {
    backgroundColor: '#8b4513',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center'
  },
  uploadOptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  uploadCancelButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    alignItems: 'center'
  },
  uploadCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600'
  },
  languageToggle: {
    marginLeft: 'auto'
  },
  selectButton: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    justifyContent: 'center'
  },
  selectText: {
    fontSize: 16,
    color: '#9ca3af'
  },
  selectTextFilled: {
    fontSize: 16,
    color: '#111827'
  },
  noteText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontStyle: 'italic'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937'
  },
  modalClose: {
    fontSize: 24,
    color: '#6B7280'
  },
  searchInput: {
    margin: 16,
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 14,
    backgroundColor: '#F9FAFB'
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151'
  }
});
export default SubmitGrievanceScreen;

