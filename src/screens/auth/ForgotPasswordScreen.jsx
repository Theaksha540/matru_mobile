import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../../services/api';
import '../../i18n';

const ForgotPasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or username');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(identifier);
      
      // Show success alert with icon
      Alert.alert(
        '✅ OTP Sent Successfully!', 
        '📧 A password reset OTP has been sent to your email. Please check your inbox and follow the instructions.',
        [
          {
            text: 'Continue',
            onPress: () => navigation.navigate('ResetPassword', { identifier })
          }
        ]
      );
    } catch (error) {
      // Show error alert with icon
      Alert.alert(
        '❌ Failed to Send OTP', 
        `⚠️ ${error.response?.data?.detail || 'Unable to send reset email. Please try again.'}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#8B4513" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('forgotPassword')} / ପାସୱାର୍ଡ ଭୁଲିଗଲେ</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.mailIconWrapper}>
            <Mail size={48} color="white" />
          </View>
        </View>
        
        <Text style={styles.subtitle}>
          {t('enterEmailForOTP')} / OTP ପାଇଁ ଆପଣଙ୍କ ଇମେଲ ବା ଯୂଜରନେମ ଦିଅନ୍ତୁ
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('emailOrUsername')} / ଇମେଲ ବା ଯୂଜରନେମ</Text>
          <TextInput
            style={styles.input}
            placeholder={t('enterEmailOrUsername')}
            value={identifier}
            onChangeText={setIdentifier}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? t('sending') + ' / ପଠାଉଚି...' : t('sendResetOTP') + ' / OTP ପଠାନ୍ତୁ'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backToLogin}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backToLoginText}>{t('backToLogin')} / ଲଗଇନକୁ ଫିରନ୍ତୁ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  mailIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#8B4513',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B4513',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#8B4513',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backToLogin: {
    alignItems: 'center',
  },
  backToLoginText: {
    color: '#8B4513',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;