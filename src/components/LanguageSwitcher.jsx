import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { switchLanguage, getCurrentLanguage } from '../i18n';

const LanguageSwitcher = ({ style }) => {
  const { i18n } = useTranslation();
  const currentLanguage = getCurrentLanguage();

  const handleLanguageSwitch = async () => {
    const newLanguage = currentLanguage === 'en' ? 'or' : 'en';
    await switchLanguage(newLanguage);
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handleLanguageSwitch}
      activeOpacity={0.7}
    >
      <View style={styles.languageButton}>
        <Text style={styles.languageText}>
          {currentLanguage === 'en' ? 'ଓଡ଼ିଆ' : 'English'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  languageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LanguageSwitcher;