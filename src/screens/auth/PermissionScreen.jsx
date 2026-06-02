import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Database, Download, Upload } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestStoragePermission, checkStoragePermission } from '../../utils/permissions';
import { useTranslation } from 'react-i18next';
const PermissionScreen = ({
  navigation
}) => {
  const {
    t
  } = useTranslation();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    checkInitialPermission();
  }, []);
  const checkInitialPermission = async () => {
    const granted = await checkStoragePermission();

    // If already granted, just continue
    if (granted) {
      await AsyncStorage.setItem('permission_screen_shown', 'true');
      navigation.replace('Login');
    }
  };
  const handleContinue = async () => {
    setLoading(true);
    try {
      const granted = await requestStoragePermission();
      if (granted) {
        await AsyncStorage.setItem('permission_screen_shown', 'true');
        await AsyncStorage.setItem('storage_permission_granted', 'true');
        navigation.replace('Login');
      } else {
        continueWithoutPermission();
      }
    } catch (error) {
      continueWithoutPermission();
    } finally {
      setLoading(false);
    }
  };
  const continueWithoutPermission = async () => {
    // Mark screen as shown even if permission denied
    await AsyncStorage.setItem('permission_screen_shown', 'true');
    Alert.alert(t('limitedFunctionalityTitle'), t('limitedFunctionalityDesc'), [{
      text: t('ok'),
      onPress: () => navigation.replace('Login')
    }]);
  };
  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Image source={require('../../../assets/image/Nirikhyana_puri.png')} style={styles.logo} resizeMode="contain" />
        
        <Text style={styles.title}>{t('storagePermissionRequired')}</Text>
        <Text style={styles.subtitle}>{t('bestExperienceSubtitle')}</Text>

        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <Database size={24} color="#8B4513" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{t('offlineDataStorage')}</Text>
              <Text style={styles.featureDesc}>{t('offlineDataStorageDesc')}</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Upload size={24} color="#8B4513" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{t('uploadDocuments')}</Text>
              <Text style={styles.featureDesc}>{t('uploadDocumentsDesc')}</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Download size={24} color="#8B4513" />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{t('downloadReportsTitle')}</Text>
              <Text style={styles.featureDesc}>{t('downloadReportsDesc')}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleContinue} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? t('pleaseWait') : t('continue')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          {t('changePermissionAnytime')}
        </Text>
      </View>
    </SafeAreaView>;
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fad5a5'
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center'
  },
  featureList: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  featureText: {
    flex: 1,
    marginLeft: 16
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4
  },
  featureDesc: {
    fontSize: 14,
    color: '#6b7280'
  },
  button: {
    width: '100%',
    backgroundColor: '#8B4513',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  note: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center'
  }
});
export default PermissionScreen;
