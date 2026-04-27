import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowLeft,
  FileSpreadsheet,
  Upload,
  ClipboardList,
  CheckCircle,
  Download,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { authAPI, pregnantWomenAPI } from '../../services/api';
import '../../i18n';

const BulkUploadScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplateInfo();
  }, []);

  const loadTemplateInfo = async () => {
    try {
      const data = await authAPI.getBulkUploadTemplate();
      setTemplateInfo(data);
    } catch (error) {
      console.error('Error loading template info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel'
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert(t('error'), t('failedToSelectFile'));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert(t('error'), t('pleaseSelectFileFirst'));
      return;
    }

    setUploading(true);
    try {
      const fileData = {
        uri: selectedFile.uri,
        type: selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: selectedFile.name || 'bulk_upload.xlsx'
      };

      const result = await pregnantWomenAPI.bulkUpload(fileData);
      
      Alert.alert(
        t('success'),
        `${t('bulkUploadCompletedSuccessfully')}\n\n${t('processed')}: ${result.processed || 'N/A'} ${t('records')}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      let errorMsg = 'Upload failed. Please try again.';
      
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
        errorMsg = 'Please check your internet connection and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      Alert.alert('Upload Failed', errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await authAPI.downloadBulkUploadTemplate();
      
      const fileUri = FileSystem.documentDirectory + 'bulk_upload_template.xlsx';
      
      // Convert blob to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(response);
      });
      
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Share the file so user can save it
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Save Template File',
      });
      
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Could not download template. Please try again.');
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{t('bulkUploadRCHExcel')}</Text>
              <Text style={styles.headerSubtitle}>{t('uploadBeneficiaryData')} / ଉପକାରୀ ତଥ୍ୟ ଅପଲୋଡ</Text>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <View style={styles.contentContainer}>
              {/* Upload Card */}
              <View style={styles.uploadCard}>
                <View style={styles.uploadIconContainer}>
                  <FileSpreadsheet size={40} color="#8B4513" />
                </View>
                <Text style={styles.uploadTitle}>{t('uploadRCHExcelFile')}</Text>
                <Text style={styles.uploadSubtitle}>RCH Excel ଫାଇଲ ଅପଲୋଡ କରନ୍ତୁ</Text>

              {/* Download Template Button */}
              <TouchableOpacity 
                style={styles.downloadButton}
                onPress={downloadTemplate}
                activeOpacity={0.7}
              >
                <Download size={16} color="#8B4513" />
                <Text style={styles.downloadButtonText}>Download Template</Text>
              </TouchableOpacity>

              {/* Upload Dropzone */}
                <TouchableOpacity 
                  style={styles.uploadDropzone}
                  onPress={handleFilePick}
                  activeOpacity={0.7}
                >
                  <Upload size={32} color="#8B4513" style={styles.dropzoneIcon} />
                  <Text style={styles.dropzoneText}>{t('clickToUploadOrDrag')}</Text>
                  <Text style={styles.dropzoneSubtext}>{t('excelFilesUpTo10MB')}</Text>
                </TouchableOpacity>

                {selectedFile && (
                  <View style={styles.selectedFile}>
                    <View style={styles.fileInfo}>
                      <CheckCircle size={16} color="#22c55e" />
                      <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                      <TouchableOpacity 
                        style={styles.removeFileButton}
                        onPress={() => setSelectedFile(null)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeFileText}>×</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                      style={[styles.uploadButton, uploading && styles.disabledButton]} 
                      onPress={handleUpload}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size={16} color="white" />
                      ) : (
                        <Upload size={16} color="white" />
                      )}
                      <Text style={styles.uploadButtonText}>
                        {uploading ? t('uploading') : t('uploadFile')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Requirements Card */}
              <View style={styles.requirementsCard}>
                <View style={styles.requirementsHeader}>
                  <ClipboardList size={18} color="#8B4513" />
                  <Text style={styles.requirementsTitle}>Required Columns / ଆବଶ୍ୟକ ସ୍ତମ୍ଭ:</Text>
                </View>
                <View style={styles.requirementsList}>
                  {templateInfo ? (
                    <>
                      <Text style={styles.sectionSubtitle}>Required Fields:</Text>
                      {templateInfo.required_columns.map((field, index) => (
                        <Text key={index} style={styles.requirementItem}>• {field}</Text>
                      ))}
                      <Text style={styles.sectionSubtitle}>All Available Fields:</Text>
                      {templateInfo.template_columns.map((field, index) => (
                        <Text key={index} style={styles.requirementItem}>• {field}</Text>
                      ))}
                      <Text style={styles.sectionSubtitle}>Sample Data:</Text>
                      <Text style={styles.requirementItem}>• Name: {templateInfo.sample_data.full_name}</Text>
                      <Text style={styles.requirementItem}>• Mobile: {templateInfo.sample_data.mobile_number}</Text>
                      <Text style={styles.requirementItem}>• Age: {templateInfo.sample_data.age}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.requirementItem}>• full_name</Text>
                      <Text style={styles.requirementItem}>• mobile_number</Text>
                      <Text style={styles.requirementItem}>• husband_name</Text>
                      <Text style={styles.requirementItem}>• age</Text>
                      <Text style={styles.requirementItem}>• ward_id</Text>
                    </>
                  )}
                </View>
              </View>

              {/* Info Footer */}
              <LinearGradient
                colors={['#e6f2ff', '#fff4e6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.infoFooter}
              >
                <View style={styles.infoFooterBorder} />
                <Text style={styles.infoFooterTitle}>Important Notes / ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ସୂଚନା:</Text>
                <Text style={styles.infoFooterText}>System will automatically check for duplicates based on ABHA ID and Mobile</Text>
                <Text style={styles.infoFooterText}>Invalid data will be flagged for correction</Text>
                <Text style={styles.infoFooterText}>Only validated records will be imported</Text>
              </LinearGradient>
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
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  contentContainer: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  uploadCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139, 69, 19, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#8B4513',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  uploadDropzone: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#8B4513',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(139, 69, 19, 0.05)',
  },
  dropzoneIcon: {
    marginBottom: 12,
  },
  dropzoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  dropzoneSubtext: {
    fontSize: 11,
    color: '#6b7280',
  },
  selectedFile: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    width: '100%',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  removeFileButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  selectedFileName: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
    flex: 1,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B4513',
    borderRadius: 6,
    padding: 10,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.5,
  },
  requirementsCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  requirementsList: {
    gap: 6,
  },
  requirementItem: {
    fontSize: 12,
    color: '#1f2937',
    lineHeight: 18,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B4513',
    marginTop: 8,
    marginBottom: 4,
  },
  infoFooter: {
    borderRadius: 8,
    padding: 10,
    paddingLeft: 14,
    position: 'relative',
  },
  infoFooterBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#0B1C8C',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  infoFooterTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0B1C8C',
    marginBottom: 8,
  },
  infoFooterText: {
    fontSize: 12,
    color: '#0B1C8C',
    marginBottom: 4,
    lineHeight: 18,
  },
});

export default BulkUploadScreen;
