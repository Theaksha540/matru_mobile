import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, FlatList } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions } from '@react-navigation/native';
import { ArrowLeft, RefreshCw, Send, User, FileText, AlertCircle, MapPin, Activity, ChevronDown, Search, X, Home, Upload } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { syncService } from '../../utils/syncService';
import { useTranslation } from 'react-i18next';
import Footer from '../../components/Footer';
import { requestStoragePermission } from '../../utils/permissions';
const ReReferScreen = ({
  navigation,
  route
}) => {
  const {
    t
  } = useTranslation();
  const {
    referralId
  } = route.params || {};
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDP, setSelectedDP] = useState(null);
  const [reReferReason, setReReferReason] = useState('');
  const [treatmentGiven, setTreatmentGiven] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [allDeliveryPoints, setAllDeliveryPoints] = useState([]);
  const [availableDPs, setAvailableDPs] = useState([]);
  const [loadingDPs, setLoadingDPs] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredDPs, setFilteredDPs] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const normalizeValue = value => String(value ?? '').trim().toLowerCase();
  const getCurrentDPIdentifiers = () => {
    const currentIds = new Set([userInfo?.dp_id, userInfo?.delivery_point_id, userInfo?.deliveryPointId, userInfo?.delivery_point?.id, userInfo?.deliveryPoint?.id, referral?.dp_id].filter(value => value !== undefined && value !== null && String(value).trim() !== '').map(value => String(value)));
    const currentNames = new Set([userInfo?.dp_name, userInfo?.delivery_point_name, userInfo?.deliveryPointName, userInfo?.delivery_point?.name, userInfo?.deliveryPoint?.name, referral?.dp_name].map(value => normalizeValue(value)).filter(Boolean));
    return {
      currentIds,
      currentNames
    };
  };
  const isCurrentDeliveryPoint = dp => {
    const {
      currentIds,
      currentNames
    } = getCurrentDPIdentifiers();
    const dpId = String(dp?.id ?? dp?.dp_id ?? '');
    const dpName = normalizeValue(dp?.name ?? dp?.dp_name);
    return currentIds.has(dpId) || dpName && currentNames.has(dpName);
  };
  const handleGoHome = () => {
    const roleRouteMap = {
      dp: 'DPDashboard',
      sub_centre: 'SubCentreDashboard',
      district: 'DistrictDashboard',
      block: 'BlockDashboard',
      usg: 'USGDashboard',
      mother: 'MotherDashboard'
    };
    const dashboardRoute = roleRouteMap[userInfo?.role] || 'SubCentreDashboard';
    navigation.navigate(dashboardRoute);
  };
  useEffect(() => {
    loadUserInfo();
    if (referralId) {
      loadReferralDetails();
      loadDeliveryPoints();
    } else {
      Alert.alert('Error', 'No referral ID provided');
      navigation.goBack();
    }
  }, [referralId]);
  const loadUserInfo = async () => {
    try {
      const userData = await syncService.getUserInfo();
      if (userData) {
        setUserInfo(userData);
      }
    } catch (error) {}
  };
  const loadDeliveryPoints = async () => {
    try {
      setLoadingDPs(true);
      const response = await syncService.getDeliveryPoints();
      if (Array.isArray(response)) {
        setAllDeliveryPoints(response);
      } else {
        Alert.alert('Error', 'Failed to load DP referrals');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load DP referrals');
    } finally {
      setLoadingDPs(false);
    }
  };
  const loadReferralDetails = async () => {
    try {
      setLoading(true);
      const referralData = await syncService.getDeliveryReferralById(referralId);
      if (referralData) {
        const flattenedData = {
          ...(referralData.referral || referralData),
          pregnant_woman_name: referralData.pregnant_woman?.full_name || referralData.pregnant_woman_name || referralData.patient_name,
          mobile_number: referralData.pregnant_woman?.mobile_number || referralData.mobile_number,
          age: referralData.pregnant_woman?.age || referralData.age,
          address: referralData.pregnant_woman?.address || referralData.address,
          rch_id: referralData.pregnant_woman?.rch_id || referralData.rch_id,
          expected_delivery_date: referralData.pregnant_woman?.edd_date || referralData.expected_delivery_date || referralData.edd_date,
          is_high_risk: referralData.pregnant_woman?.is_high_risk ?? referralData.is_high_risk,
          _original: referralData
        };
        setReferral(flattenedData);
      } else {
        Alert.alert('Error', 'Referral data not found');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load referral details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const nextDeliveryPoints = allDeliveryPoints.filter(dp => !isCurrentDeliveryPoint(dp));
    setAvailableDPs(nextDeliveryPoints);
  }, [allDeliveryPoints, userInfo, referral]);
  useEffect(() => {
    if (selectedDP || allDeliveryPoints.length === 0) {
      return;
    }
    const matchedCurrentDP = allDeliveryPoints.find(dp => isCurrentDeliveryPoint(dp));
    if (matchedCurrentDP) {
      setSelectedDP(matchedCurrentDP);
    }
  }, [selectedDP, userInfo, referral, allDeliveryPoints]);

  // Filter delivery points based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDPs(availableDPs);
    } else {
      const filtered = availableDPs.filter(dp => dp.name.toLowerCase().includes(searchQuery.toLowerCase()) || dp.address && dp.address.toLowerCase().includes(searchQuery.toLowerCase()) || dp.contact_person_name && dp.contact_person_name.toLowerCase().includes(searchQuery.toLowerCase()));
      setFilteredDPs(filtered);
    }
  }, [searchQuery, availableDPs, userInfo, referral]);
  const handleSelectDP = dp => {
    setSelectedDP(dp);
    setShowDropdown(false);
    setSearchQuery('');
  };
  const appendAttachmentFiles = files => {
    const validFiles = (Array.isArray(files) ? files : [files]).filter(Boolean);
    if (validFiles.length === 0) return;
    setAttachmentFiles(prev => {
      const nextFiles = [...prev];
      validFiles.forEach(file => {
        const fileKey = `${file.uri || ''}_${file.name || ''}`;
        const exists = nextFiles.some(existing => `${existing.uri || ''}_${existing.name || ''}` === fileKey);
        if (!exists) {
          nextFiles.push(file);
        }
      });
      return nextFiles;
    });
  };
  const removeAttachmentFile = targetIndex => {
    setAttachmentFiles(prev => prev.filter((_, index) => index !== targetIndex));
  };
  const handlePickAttachment = async () => {
    setShowUploadModal(true);
  };
  const handleImagePick = async () => {
    setShowUploadModal(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8
      });
      if (!result.canceled && result.assets?.length > 0) {
        const normalizedFiles = [];
        for (const file of result.assets) {
          if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
            Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
            return;
          }
          normalizedFiles.push({
            uri: file.uri,
            name: file.fileName || `re_refer_image_${Date.now()}_${normalizedFiles.length + 1}.jpg`,
            type: file.mimeType || 'image/jpeg',
            mimeType: file.mimeType || 'image/jpeg'
          });
        }
        appendAttachmentFiles(normalizedFiles);
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to pick image');
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
      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
          return;
        }
        appendAttachmentFiles({
          uri: file.uri,
          name: file.fileName || `re_refer_camera_${Date.now()}.jpg`,
          type: file.mimeType || 'image/jpeg',
          mimeType: file.mimeType || 'image/jpeg'
        });
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to take photo');
    }
  };
  const handleDocumentPick = async () => {
    setShowUploadModal(false);
    try {
      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: true
      });
      if (!result.canceled && result.assets?.length > 0) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const normalizedFiles = [];
        for (const file of result.assets) {
          if (file.size && file.size > 10 * 1024 * 1024) {
            Alert.alert(t('error'), 'File too large. Maximum size: 10MB');
            return;
          }
          if (file.mimeType && !allowedTypes.includes(file.mimeType.toLowerCase())) {
            Alert.alert(t('error'), 'Invalid file type. Allowed types: PDF, JPG, JPEG, PNG');
            return;
          }
          normalizedFiles.push({
            uri: file.uri,
            name: file.name || `re_refer_document_${Date.now()}_${normalizedFiles.length + 1}`,
            type: file.mimeType || 'application/pdf',
            mimeType: file.mimeType || 'application/pdf'
          });
        }
        appendAttachmentFiles(normalizedFiles);
      }
    } catch (error) {
      Alert.alert(t('error'), 'Failed to select file. Please check permissions.');
    }
  };
  const handleSubmitReReferral = async () => {
    if (!selectedDP) {
      Alert.alert('Validation Error', 'Please select a DP referral to re-refer to');
      return;
    }
    if (isCurrentDeliveryPoint(selectedDP)) {
      Alert.alert('Validation Error', 'Please select a different DP referral for re-referral');
      return;
    }
    if (!reReferReason.trim()) {
      Alert.alert('Validation Error', 'Please provide a reason for re-referral');
      return;
    }
    Alert.alert('Confirm Re-referral', `Are you sure you want to re-refer this patient to ${selectedDP.name}?`, [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Re-refer',
      onPress: async () => {
        try {
          setSubmitting(true);
          const reReferralData = {
            new_dp_id: selectedDP.id,
            re_refer_reason: reReferReason.trim()
          };
          if (treatmentGiven.trim()) {
            reReferralData.treatment_given = treatmentGiven.trim();
          }
          if (attachmentFiles.length > 0) {
            reReferralData.attachment_files = attachmentFiles.map((file, index) => ({
              uri: file.uri,
              type: file.mimeType || file.type || 'application/octet-stream',
              name: file.name || `re_refer_attachment_${index + 1}`
            }));
          }
          console.log('[ReReferScreen] Submitting re-referral payload', {
            referralId,
            selectedDP: {
              id: selectedDP?.id,
              name: selectedDP?.name
            },
            payload: reReferralData
          });
          const result = await syncService.reReferDeliveryReferral(referralId, reReferralData);
          console.log('[ReReferScreen] Re-referral result received', {
            referralId,
            result
          });
          Alert.alert('Success', result?.offline ? 'Patient has been re-referred offline and will sync when online.' : 'Patient has been successfully re-referred', [{
            text: 'OK',
            onPress: () => {
              navigation.dispatch(CommonActions.reset({
                index: 1,
                routes: [{
                  name: 'ReReferredCases',
                  params: {
                    refreshToken: Date.now()
                  }
                }, {
                  name: 'ReferralDetail',
                  params: {
                    referralId,
                    backTarget: 'ReReferredCases',
                    refreshToken: Date.now()
                  }
                }]
              }));
            }
          }]);
        } catch (error) {
          console.error('[ReReferScreen] Re-referral submission failed', {
            referralId,
            status: error?.response?.status,
            statusText: error?.response?.statusText,
            responseData: error?.response?.data,
            message: error?.message
          });
          Alert.alert('Error', 'Failed to submit re-referral. Please try again.');
        } finally {
          setSubmitting(false);
        }
      }
    }]);
  };
  const formatDate = dateString => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };
  if (loading) {
    return <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <Activity size={48} color="#D2691E" />
            <Text style={styles.loadingText}>Loading referral details...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>;
  }
  if (!referral) {
    return <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#dc2626" />
            <Text style={styles.errorText}>Referral not found</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>;
  }
  return <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <LinearGradient colors={['#D2691E', '#B8860B']} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }} style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Re-refer Patient</Text>
            <Text style={styles.headerSubtitle}>ରୋଗୀଙ୍କୁ ପୁନଃ ରେଫର କରନ୍ତୁ</Text>
          </View>
          <TouchableOpacity style={styles.homeButton} onPress={handleGoHome}>
            <Home size={20} color="white" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Patient Information Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <User size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Patient Information</Text>
            </View>
            <View style={styles.cardContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name:</Text>
                <Text style={styles.infoValue}>{referral.pregnant_woman_name || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mobile:</Text>
                <Text style={styles.infoValue}>{referral.mobile_number || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Age:</Text>
                <Text style={styles.infoValue}>{referral.age || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>RCH ID:</Text>
                <Text style={styles.infoValue}>{referral.rch_id || 'Not specified'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Expected Delivery:</Text>
                <Text style={styles.infoValue}>
                  {referral.expected_delivery_date ? formatDate(referral.expected_delivery_date) : 'Not specified'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Risk Status:</Text>
                <View style={styles.riskContainer}>
                  <View style={[styles.riskDot, {
                  backgroundColor: referral.is_high_risk ? '#dc2626' : '#10b981'
                }]} />
                  <Text style={[styles.riskText, {
                  color: referral.is_high_risk ? '#dc2626' : '#10b981'
                }]}>
                    {referral.is_high_risk ? 'High Risk' : 'Normal Risk'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Select DP Referral Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MapPin size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Select New DP Referral</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.sectionLabel}>Choose DP Referral:</Text>
              
              {/* Dropdown Trigger */}
              <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowDropdown(true)} disabled={loadingDPs}>
                <View style={styles.dropdownContent}>
                  {loadingDPs ? <>
                      <Activity size={20} color="#D2691E" />
                      <Text style={styles.dropdownPlaceholder}>Loading DP referrals...</Text>
                    </> : selectedDP ? <>
                      <MapPin size={20} color="#D2691E" />
                      <View style={styles.selectedDPInfo}>
                        <Text style={styles.selectedDPName}>{selectedDP.name}</Text>
                        {selectedDP.address && <Text style={styles.selectedDPAddress}>{selectedDP.address}</Text>}
                      </View>
                    </> : <>
                      <MapPin size={20} color="#9ca3af" />
                      <Text style={styles.dropdownPlaceholder}>Select a DP referral</Text>
                    </>}
                </View>
                <ChevronDown size={20} color="#6b7280" />
              </TouchableOpacity>
              
              {availableDPs.length === 0 && !loadingDPs && <View style={styles.noDPsContainer}>
                  <AlertCircle size={24} color="#dc2626" />
                  <Text style={styles.noDPsText}>No DP referrals available</Text>
                </View>}
            </View>
          </View>

          {/* Re-referral Reason Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FileText size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Detailed Reason</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.sectionLabel}>{t('reReferReasonOrObservation')}</Text>
              <TextInput style={styles.reasonInput} multiline numberOfLines={4} placeholder="Enter detailed reason" placeholderTextColor="#9ca3af" value={reReferReason} onChangeText={setReReferReason} textAlignVertical="top" />
              <Text style={styles.characterCount}>
                {reReferReason.length}/500 characters
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FileText size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Treatment Given</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.sectionHelperText}>Please provide the detailed treatment note.</Text>
              <TextInput style={styles.reasonInput} multiline numberOfLines={4} placeholder="Enter treatment given details" placeholderTextColor="#9ca3af" value={treatmentGiven} onChangeText={setTreatmentGiven} textAlignVertical="top" />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Upload size={24} color="#D2691E" />
              <Text style={styles.cardTitle}>Upload Photo/File</Text>
            </View>
            <View style={styles.cardContent}>
              <TouchableOpacity style={styles.uploadBox} onPress={handlePickAttachment}>
                <Upload size={24} color="#8B4513" />
                <Text style={styles.uploadText}>
                  {attachmentFiles.length > 0 ? 'Add more' : 'Tap to upload photos or PDF files'}
                </Text>
                <Text style={styles.uploadHint}>PNG, JPG, JPEG, PDF up to 10MB each</Text>
              </TouchableOpacity>
              {attachmentFiles.map((file, index) => <View key={`${file.uri}_${index}`} style={styles.selectedFileRow}>
                  <Text style={styles.selectedFileText} numberOfLines={1}>
                    {file.name || `Attachment ${index + 1}`}
                  </Text>
                  <TouchableOpacity onPress={() => removeAttachmentFile(index)}>
                    <Text style={styles.removeFileText}>Remove</Text>
                  </TouchableOpacity>
                </View>)}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={[styles.submitButton, (!selectedDP || !reReferReason.trim() || submitting) && styles.submitButtonDisabled]} onPress={handleSubmitReReferral} disabled={!selectedDP || !reReferReason.trim() || submitting}>
            <Send size={20} color="white" />
            <Text style={styles.submitButtonText}>
              {submitting ? 'Submitting...' : 'Submit Re-referral'}
            </Text>
          </TouchableOpacity>

          <Footer />
        </ScrollView>
        
        {/* Dropdown Modal */}
        <Modal visible={showDropdown} transparent={true} animationType="fade" onRequestClose={() => setShowDropdown(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDropdown(false)}>
            <View style={styles.dropdownModal}>
              <TouchableOpacity activeOpacity={1}>
                {/* Header */}
                <View style={styles.dropdownHeader}>
                  <Text style={styles.dropdownTitle}>Select DP Referral</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setShowDropdown(false)}>
                    <X size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                
                {/* Search Input */}
                <View style={styles.searchContainer}>
                  <Search size={20} color="#6b7280" />
                  <TextInput style={styles.searchInput} placeholder="Search DP referrals..." placeholderTextColor="#9ca3af" value={searchQuery} onChangeText={setSearchQuery} autoFocus={true} />
                  {searchQuery.length > 0 && <TouchableOpacity style={styles.clearSearch} onPress={() => setSearchQuery('')}>
                      <X size={16} color="#6b7280" />
                    </TouchableOpacity>}
                </View>
                
                {/* DP Referrals List */}
                <FlatList
                  data={filteredDPs}
                  keyExtractor={item => item.id.toString()}
                  style={styles.dropdownList}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => <TouchableOpacity style={[styles.dropdownItem, selectedDP?.id === item.id && styles.dropdownItemSelected]} onPress={() => handleSelectDP(item)}>
                      <View style={styles.dropdownItemContent}>
                        <MapPin size={16} color="#D2691E" />
                        <View style={styles.dropdownItemInfo}>
                          <Text style={styles.dropdownItemName}>{item.name}</Text>
                          {item.address && <Text style={styles.dropdownItemAddress}>{item.address}</Text>}
                          {item.contact_number && <Text style={styles.dropdownItemContact}>📞 {item.contact_number}</Text>}
                          {item.contact_person_name && <Text style={styles.dropdownItemPerson}>👤 {item.contact_person_name}</Text>}
                        </View>
                      </View>
                    </TouchableOpacity>}
                  ListEmptyComponent={() => <View style={styles.emptyList}>
                      <AlertCircle size={32} color="#9ca3af" />
                      <Text style={styles.emptyListText}>
                        {searchQuery ? 'No DP referrals match your search' : 'No DP referrals available'}
                      </Text>
                    </View>}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        <Modal visible={showUploadModal} transparent animationType="fade" onRequestClose={() => setShowUploadModal(false)}>
          <View style={styles.uploadModalOverlay}>
            <View style={styles.uploadModalContent}>
              <Text style={styles.uploadModalTitle}>Upload Attachment</Text>
              <Text style={styles.uploadModalSubtitle}>Choose file type</Text>

              <TouchableOpacity style={styles.uploadOptionButton} onPress={handleCameraPick}>
                <Text style={styles.uploadOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadOptionButton} onPress={handleImagePick}>
                <Text style={styles.uploadOptionText}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadOptionButton} onPress={handleDocumentPick}>
                <Text style={styles.uploadOptionText}>Document (PDF/Image)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadCancelButton} onPress={() => setShowUploadModal(false)}>
                <Text style={styles.uploadCancelText}>{t('cancel')}</Text>
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
    backgroundColor: '#f8fafc'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  homeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
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
  content: {
    flex: 1,
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500'
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center'
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12
  },
  cardContent: {
    padding: 16
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1
  },
  infoValue: {
    fontSize: 14,
    color: '#6b7280',
    flex: 2,
    textAlign: 'right'
  },
  riskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  riskText: {
    fontSize: 14,
    fontWeight: '600'
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12
  },
  sectionHelperText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: '#9ca3af'
  },
  selectedDPInfo: {
    flex: 1
  },
  selectedDPName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2
  },
  selectedDPAddress: {
    fontSize: 13,
    color: '#6b7280'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  dropdownModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxHeight: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151'
  },
  clearSearch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dropdownList: {
    maxHeight: 400
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  dropdownItemSelected: {
    backgroundColor: '#fef7f0',
    borderLeftWidth: 4,
    borderLeftColor: '#D2691E'
  },
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  dropdownItemInfo: {
    flex: 1
  },
  dropdownItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4
  },
  dropdownItemAddress: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2
  },
  dropdownItemContact: {
    fontSize: 13,
    color: '#059669',
    marginBottom: 2
  },
  dropdownItemPerson: {
    fontSize: 13,
    color: '#3b82f6'
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12
  },
  emptyListText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center'
  },
  noDPsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  noDPsText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '500'
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#f9fafb',
    minHeight: 120,
    maxLength: 500
  },
  characterCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 8
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9fafb'
  },
  uploadText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center'
  },
  uploadHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center'
  },
  selectedFileRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    color: '#374151'
  },
  removeFileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626'
  },
  submitButton: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700'
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
    backgroundColor: '#8B4513',
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
  }
});
export default ReReferScreen;
