import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ArrowLeft, Plus, Search, Filter } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import '../../i18n';

const ExampleMultiLanguageScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [, forceUpdate] = useState({});

  // Force re-render when language changes
  useEffect(() => {
    const onLanguageChange = () => {
      forceUpdate({});
    };
    
    i18n.on('languageChanged', onLanguageChange);
    
    return () => {
      i18n.off('languageChanged', onLanguageChange);
    };
  }, [i18n]);

  const handleAction = () => {
    Alert.alert(
      t('confirmation'),
      t('areYouSure'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirm'), onPress: () => console.log('Action confirmed') }
      ]
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header with Language Switcher */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{t('exampleScreen')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('multiLanguageSupport')}
            </Text>
          </View>
          
          <LanguageSwitcher />
        </View>

        <ScrollView style={styles.content}>
          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAction}>
              <Plus size={20} color="white" />
              <Text style={styles.buttonText}>{t('addNew')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton}>
              <Search size={20} color="#8B4513" />
              <Text style={styles.secondaryButtonText}>{t('search')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.secondaryButton}>
              <Filter size={20} color="#8B4513" />
              <Text style={styles.secondaryButtonText}>{t('filter')}</Text>
            </TouchableOpacity>
          </View>

          {/* Content Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('recentItems')}</Text>
            
            {loading ? (
              <Text style={styles.loadingText}>{t('loading')}</Text>
            ) : data.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('noDataFound')}</Text>
                <Text style={styles.emptyStateSubtext}>{t('addItemsToGetStarted')}</Text>
              </View>
            ) : (
              data.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                </View>
              ))
            )}
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>{t('note')}:</Text> {t('exampleNote')}
            </Text>
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
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B4513',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#8B4513',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoBanner: {
    backgroundColor: '#e6f2ff',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0B1C8C',
  },
  infoText: {
    fontSize: 14,
    color: '#0B1C8C',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
  },
});

export default ExampleMultiLanguageScreen;