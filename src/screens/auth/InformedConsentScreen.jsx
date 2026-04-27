import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Circle, Volume2, Globe } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../../components/LanguageToggle';
import '../../i18n';

const InformedConsentScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const [consentChecked, setConsentChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const currentLang = i18n.language;

  const content = {
    en: {
      title: 'Informed Consent',
      titleOdia: 'ସୂଚିତ ସମ୍ମତି',
      location: 'Puri District, Odisha',
      
      aboutTitle: 'About This Programme',
      aboutText: 'The NIRIKHYANA programme is designed to monitor and support pregnant women in Puri District, Odisha. This initiative by the Health & Family Welfare Department helps ensure safe pregnancy and delivery through regular health tracking and timely medical intervention.',
      whyTitle: 'Why We Collect Your Information',
      whyPoints: [
        'Register and identify all pregnant women in the district',
        'Monitor your health throughout pregnancy with regular check-ups',
        'Maintain medical records including BP, blood sugar, and ultrasound reports',
        'Provide timely referral support to appropriate healthcare facilities',
        'Send timely reminders for ANC visits and health check-ups',
      ],
      whatTitle: 'What Information We Collect',
      whatPoints: [
        'Personal details: Name, age, address, contact number',
        'Pregnancy details: LMP date, expected delivery date, pregnancy history',
        'Medical records: Blood pressure, sugar levels, hemoglobin, weight',
        'Ultrasound reports and findings',
        'Antenatal care visit records and delivery outcomes',
      ],
      protectTitle: 'How We Protect Your Data',
      protectPoints: [
        'All data is stored securely on government-approved servers',
        'Only authorized healthcare workers (ANM, doctors, block officers) can access your information',
        'Your data will NEVER be shared with private companies or third parties',
        "Complies with Government of India's data protection and privacy guidelines",
        'You can request to view your data at any time',
      ],
      rightsTitle: 'Your Rights',
      rightsPoints: [
        'Participation in this programme is completely voluntary',
        'You can withdraw from the programme at any time without giving reasons',
        'Withdrawal will NOT affect your access to government healthcare services',
        'You have the right to access and review your data',
        'You can request corrections to any incorrect information',
      ],
      benefitsTitle: 'Benefits of Joining',
      benefitsPoints: [
        'Regular monitoring ensures better health for you and your baby',
        'Timely alerts and reminders for important check-ups',
        'Quick emergency support and referral during complications',
        'Access to government health schemes and benefits',
        'Improved safety and reduced risks during pregnancy and delivery',
      ],
      consentText: 'I have carefully read and understood all the information provided above. I voluntarily agree to participate in the NIRIKHYANA maternal health monitoring programme.',
      privacyText: 'I agree to the ',
      privacyLink: 'Privacy Policy and Terms & Conditions',
      agreeButton: 'I Agree & Continue',
      declineButton: 'Decline',
      footerText: 'For any questions or concerns, please contact your local health worker or call the district helpline: +91 9439994716',
      alertRequired: 'Required',
      alertRequiredMsg: 'Please check both consent boxes to continue.',
      alertThankYou: 'Thank You',
      alertThankYouMsg: 'Your consent has been recorded. You can now proceed with registration.',
      alertContinue: 'Continue',
      alertDecline: 'Decline Consent',
      alertDeclineMsg: 'If you decline, you will not be able to register in the programme. Are you sure?',
      alertCancel: 'Cancel',
      alertYesDecline: 'Yes, Decline',
      alertPrivacy: 'Privacy Policy & Terms',
      alertPrivacyMsg: 'Detailed privacy policy and terms & conditions will be displayed here.',
      alertOk: 'OK',
      alertReadAloud: 'Read Aloud',
      alertReadAloudMsg: 'Text-to-speech functionality will be implemented here.',
    },
    or: {
      title: 'ସୂଚିତ ସମ୍ମତି',
      titleOdia: 'Informed Consent',
      location: 'ପୁରୀ ଜିଲ୍ଲା, ଓଡିଶା',
      
      aboutTitle: 'ଏହି କାର୍ଯ୍ୟକ୍ରମ ବିଷୟରେ',
      aboutText: 'NIRIKHYANA କାର୍ଯ୍ୟକ୍ରମ ପୁରୀ ଜିଲ୍ଲା, ଓଡିଶାରେ ଗର୍ଭବତୀ ମହିଳାମାନଙ୍କୁ ନିରୀକ୍ଷଣ ଏବଂ ସହାୟତା କରିବା ପାଇଁ ପରିକଳ୍ପିତ। ସ୍ୱାସ୍ଥ୍ୟ ଏବଂ ପରିବାର କଲ୍ୟାଣ ବିଭାଗର ଏହି ପଦକ୍ଷେପ ନିୟମିତ ସ୍ୱାସ୍ଥ୍ୟ ଟ୍ରାକିଂ ଏବଂ ସମୟାନୁବର୍ତ୍ତୀ ଚିକିତ୍ସା ହସ୍ତକ୍ଷେପ ମାଧ୍ୟମରେ ସୁରକ୍ଷିତ ଗର୍ଭଧାରଣ ଏବଂ ପ୍ରସବ ନିଶ୍ଚିତ କରିବାରେ ସାହାଯ୍ୟ କରେ।',
      whyTitle: 'ଆମେ କାହିଁକି ଆପଣଙ୍କ ସୂଚନା ସଂଗ୍ରହ କରୁ',
      whyPoints: [
        'ଜିଲ୍ଲାର ସମସ୍ତ ଗର୍ଭବତୀ ମହିଳାଙ୍କୁ ପଞ୍ଜୀକରଣ ଏବଂ ଚିହ୍ନଟ କରିବା',
        'ନିୟମିତ ଯାଞ୍ଚ ସହିତ ଗର୍ଭଧାରଣ ସମୟରେ ଆପଣଙ୍କ ସ୍ୱାସ୍ଥ୍ୟ ନିରୀକ୍ଷଣ କରିବା',
        'BP, ରକ୍ତ ଶର୍କରା ଏବଂ ଅଲଟ୍ରାସାଉଣ୍ଡ ରିପୋର୍ଟ ସହିତ ଚିକିତ୍ସା ରେକର୍ଡ ରକ୍ଷଣାବେକ୍ଷଣ',
        'ଉପଯୁକ୍ତ ସ୍ୱାସ୍ଥ୍ୟସେବା ସୁବିଧାକୁ ସମୟାନୁବର୍ତ୍ତୀ ରେଫରାଲ ସହାୟତା ପ୍ରଦାନ',
        'ANC ଭିଜିଟ ଏବଂ ସ୍ୱାସ୍ଥ୍ୟ ଯାଞ୍ଚ ପାଇଁ ସମୟାନୁବର୍ତ୍ତୀ ସ୍ମାରକ ପଠାଇବା',
      ],
      whatTitle: 'ଆମେ କେଉଁ ସୂଚନା ସଂଗ୍ରହ କରୁ',
      whatPoints: [
        'ବ୍ୟକ୍ତିଗତ ବିବରଣୀ: ନାମ, ବୟସ, ଠିକଣା, ଯୋଗାଯୋଗ ନମ୍ବର',
        'ଗର୍ଭଧାରଣ ବିବରଣୀ: LMP ତାରିଖ, ଆଶା କରାଯାଉଥିବା ପ୍ରସବ ତାରିଖ, ଗର୍ଭଧାରଣ ଇତିହାସ',
        'ଚିକିତ୍ସା ରେକର୍ଡ: ରକ୍ତଚାପ, ଶର୍କରା ସ୍ତର, ହିମୋଗ୍ଲୋବିନ, ଓଜନ',
        'ଅଲଟ୍ରାସାଉଣ୍ଡ ରିପୋର୍ଟ ଏବଂ ଫାଇଣ୍ଡିଂସ',
        'ପ୍ରସବପୂର୍ବ ଯତ୍ନ ଭିଜିଟ ରେକର୍ଡ ଏବଂ ପ୍ରସବ ଫଳାଫଳ',
      ],
      protectTitle: 'ଆମେ କିପରି ଆପଣଙ୍କ ତଥ୍ୟ ସୁରକ୍ଷିତ କରୁ',
      protectPoints: [
        'ସମସ୍ତ ତଥ୍ୟ ସରକାରୀ-ଅନୁମୋଦିତ ସର୍ଭରରେ ସୁରକ୍ଷିତ ଭାବରେ ସଂରକ୍ଷିତ',
        'କେବଳ ଅଧିକୃତ ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀ (ANM, ଡାକ୍ତର, ବ୍ଲକ ଅଧିକାରୀ) ଆପଣଙ୍କ ସୂଚନା ଆକ୍ସେସ କରିପାରିବେ',
        'ଆପଣଙ୍କ ତଥ୍ୟ କଦାପି ବେସରକାରୀ କମ୍ପାନୀ କିମ୍ବା ତୃତୀୟ ପକ୍ଷ ସହିତ ଅଂଶୀଦାର ହେବ ନାହିଁ',
        'ଭାରତ ସରକାରଙ୍କ ତଥ୍ୟ ସୁରକ୍ଷା ଏବଂ ଗୋପନୀୟତା ନିର୍ଦ୍ଦେଶାବଳୀ ପାଳନ କରେ',
        'ଆପଣ ଯେକୌଣସି ସମୟରେ ଆପଣଙ୍କ ତଥ୍ୟ ଦେଖିବାକୁ ଅନୁରୋଧ କରିପାରିବେ',
      ],
      rightsTitle: 'ଆପଣଙ୍କର ଅଧିକାର',
      rightsPoints: [
        'ଏହି କାର୍ଯ୍ୟକ୍ରମରେ ଅଂଶଗ୍ରହଣ ସମ୍ପୂର୍ଣ୍ଣ ସ୍ୱେଚ୍ଛାକୃତ',
        'ଆପଣ କାରଣ ନ ଦେଇ ଯେକୌଣସି ସମୟରେ କାର୍ଯ୍ୟକ୍ରମରୁ ପ୍ରତ୍ୟାହାର କରିପାରିବେ',
        'ପ୍ରତ୍ୟାହାର ସରକାରୀ ସ୍ୱାସ୍ଥ୍ୟସେବା ସେବାକୁ ଆପଣଙ୍କ ପ୍ରବେଶକୁ ପ୍ରଭାବିତ କରିବ ନାହିଁ',
        'ଆପଣଙ୍କର ତଥ୍ୟ ଆକ୍ସେସ ଏବଂ ସମୀକ୍ଷା କରିବାର ଅଧିକାର ଅଛି',
        'ଆପଣ କୌଣସି ଭୁଲ ସୂଚନାକୁ ସଂଶୋଧନ ପାଇଁ ଅନୁରୋଧ କରିପାରିବେ',
      ],
      benefitsTitle: 'ଯୋଗଦାନର ଲାଭ',
      benefitsPoints: [
        'ନିୟମିତ ନିରୀକ୍ଷଣ ଆପଣ ଏବଂ ଆପଣଙ୍କ ଶିଶୁ ପାଇଁ ଉତ୍ତମ ସ୍ୱାସ୍ଥ୍ୟ ନିଶ୍ଚିତ କରେ',
        'ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ ଯାଞ୍ଚ ପାଇଁ ସମୟାନୁବର୍ତ୍ତୀ ସତର୍କତା ଏବଂ ସ୍ମାରକ',
        'ଜଟିଳତା ସମୟରେ ଶୀଘ୍ର ଜରୁରୀକାଳୀନ ସହାୟତା ଏବଂ ରେଫରାଲ',
        'ସରକାରୀ ସ୍ୱାସ୍ଥ୍ୟ ଯୋଜନା ଏବଂ ଲାଭକୁ ପ୍ରବେଶ',
        'ଗର୍ଭଧାରଣ ଏବଂ ପ୍ରସବ ସମୟରେ ଉନ୍ନତ ସୁରକ୍ଷା ଏବଂ ହ୍ରାସ ହୋଇଥିବା ବିପଦ',
      ],
      consentText: 'ମୁଁ ଉପରେ ପ୍ରଦାନ କରାଯାଇଥିବା ସମସ୍ତ ସୂଚନାକୁ ଯତ୍ନର ସହିତ ପଢିଛି ଏବଂ ବୁଝିଛି। ମୁଁ ସ୍ୱେଚ୍ଛାକୃତ ଭାବରେ NIRIKHYANA ମାତୃ ସ୍ୱାସ୍ଥ୍ୟ ନିରୀକ୍ଷଣ କାର୍ଯ୍ୟକ୍ରମରେ ଅଂଶଗ୍ରହଣ କରିବାକୁ ସହମତ।',
      privacyText: 'ମୁଁ ',
      privacyLink: 'ଗୋପନୀୟତା ନୀତି ଏବଂ ସର୍ତ୍ତାବଳୀ',
      privacyTextEnd: ' ସହିତ ସହମତ।',
      agreeButton: 'ମୁଁ ସହମତ ଏବଂ ଜାରି ରଖନ୍ତୁ',
      declineButton: 'ଅସ୍ୱୀକାର',
      footerText: 'କୌଣସି ପ୍ରଶ୍ନ କିମ୍ବା ଚିନ୍ତା ପାଇଁ, ଦୟାକରି ଆପଣଙ୍କ ସ୍ଥାନୀୟ ସ୍ୱାସ୍ଥ୍ୟ କର୍ମୀଙ୍କ ସହିତ ଯୋଗାଯୋଗ କରନ୍ତୁ କିମ୍ବା ଜିଲ୍ଲା ହେଲ୍ପଲାଇନକୁ କଲ କରନ୍ତୁ: +91 9439994716',
      alertRequired: 'ଆବଶ୍ୟକ',
      alertRequiredMsg: 'ଜାରି ରଖିବା ପାଇଁ ଦୟାକରି ଉଭୟ ସମ୍ମତି ବାକ୍ସ ଯାଞ୍ଚ କରନ୍ତୁ।',
      alertThankYou: 'ଧନ୍ୟବାଦ',
      alertThankYouMsg: 'ଆପଣଙ୍କର ସମ୍ମତି ରେକର୍ଡ ହୋଇଛି। ଆପଣ ବର୍ତ୍ତମାନ ପଞ୍ଜୀକରଣ ସହିତ ଆଗକୁ ବଢିପାରିବେ।',
      alertContinue: 'ଜାରି ରଖନ୍ତୁ',
      alertDecline: 'ସମ୍ମତି ଅସ୍ୱୀକାର',
      alertDeclineMsg: 'ଯଦି ଆପଣ ଅସ୍ୱୀକାର କରନ୍ତି, ଆପଣ କାର୍ଯ୍ୟକ୍ରମରେ ପଞ୍ଜୀକରଣ କରିପାରିବେ ନାହିଁ। ଆପଣ ନିଶ୍ଚିତ କି?',
      alertCancel: 'ବାତିଲ',
      alertYesDecline: 'ହଁ, ଅସ୍ୱୀକାର',
      alertPrivacy: 'ଗୋପନୀୟତା ନୀତି ଏବଂ ସର୍ତ୍ତାବଳୀ',
      alertPrivacyMsg: 'ବିସ୍ତୃତ ଗୋପନୀୟତା ନୀତି ଏବଂ ସର୍ତ୍ତାବଳୀ ଏଠାରେ ପ୍ରଦର୍ଶିତ ହେବ।',
      alertOk: 'ଠିକ ଅଛି',
      alertReadAloud: 'ଉଚ୍ଚସ୍ୱରରେ ପଢନ୍ତୁ',
      alertReadAloudMsg: 'ଟେକ୍ସଟ-ଟୁ-ସ୍ପିଚ କାର୍ଯ୍ୟକାରିତା ଏଠାରେ କାର୍ଯ୍ୟକାରୀ ହେବ।',
    },
  };

  const lang = content[currentLang] || content.en;

  const handleReadAloud = () => {
    Alert.alert(
      lang.alertReadAloud,
      lang.alertReadAloudMsg,
      [{ text: lang.alertOk }]
    );
  };

  const handleAgree = () => {
    if (!consentChecked || !privacyChecked) {
      Alert.alert(
        lang.alertRequired,
        lang.alertRequiredMsg,
        [{ text: lang.alertOk }]
      );
      return;
    }

    // Navigate to next screen (e.g., SelfRegister or Login)
    Alert.alert(
      lang.alertThankYou,
      lang.alertThankYouMsg,
      [
        {
          text: lang.alertContinue,
          onPress: () => navigation.navigate('SelfRegister'),
        },
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      lang.alertDecline,
      lang.alertDeclineMsg,
      [
        { text: lang.alertCancel, style: 'cancel' },
        {
          text: lang.alertYesDecline,
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      lang.alertPrivacy,
      lang.alertPrivacyMsg,
      [{ text: lang.alertOk }]
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{lang.title}</Text>
            <Text style={styles.headerSubtitle}>{lang.titleOdia}</Text>
            <Text style={styles.headerLocation}>{lang.location}</Text>
          </View>
          <View style={styles.headerActions}>
            <LanguageToggle style={styles.languageToggle} />
            
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang.aboutTitle}</Text>
            <Text style={styles.sectionText}>{lang.aboutText}</Text>
          </View>

          {/* Why We Collect */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang.whyTitle}</Text>
            {lang.whyPoints.map((point, index) => (
              <BulletPoint key={index} text={point} />
            ))}
          </View>

          {/* What Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang.whatTitle}</Text>
            {lang.whatPoints.map((point, index) => (
              <BulletPoint key={index} text={point} />
            ))}
          </View>

          {/* Data Protection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang.protectTitle}</Text>
            {lang.protectPoints.map((point, index) => (
              <BulletPoint key={index} text={point} />
            ))}
          </View>

          {/* Your Rights */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang.rightsTitle}</Text>
            {lang.rightsPoints.map((point, index) => (
              <BulletPoint key={index} text={point} />
            ))}
          </View>

          {/* Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{lang.benefitsTitle}</Text>
            {lang.benefitsPoints.map((point, index) => (
              <BulletPoint key={index} text={point} />
            ))}
          </View>

          {/* Consent Checkboxes */}
          <LinearGradient
            colors={['#fff7ed', '#fef3c7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.consentBox}
          >
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setConsentChecked(!consentChecked)}
              activeOpacity={0.7}
            >
              {consentChecked ? (
                <CheckCircle2 size={24} color="#8B4513" />
              ) : (
                <Circle size={24} color="#9ca3af" />
              )}
              <Text style={styles.checkboxText}>{lang.consentText}</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setPrivacyChecked(!privacyChecked)}
              activeOpacity={0.7}
            >
              {privacyChecked ? (
                <CheckCircle2 size={24} color="#8B4513" />
              ) : (
                <Circle size={24} color="#9ca3af" />
              )}
              <View style={styles.privacyTextContainer}>
                <Text style={styles.checkboxText}>
                  {lang.privacyText}
                  <Text style={styles.linkText} onPress={handlePrivacyPolicy}>
                    {lang.privacyLink}
                  </Text>
                  {lang.privacyTextEnd || '.'}
                </Text>
              </View>
            </TouchableOpacity>
          </LinearGradient>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.agreeButton,
                (!consentChecked || !privacyChecked) && styles.agreeButtonDisabled,
              ]}
              onPress={handleAgree}
              disabled={!consentChecked || !privacyChecked}
              activeOpacity={0.8}
            >
              <Text style={styles.agreeButtonText}>{lang.agreeButton}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>{lang.declineButton}</Text>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>{lang.footerText}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

// Bullet Point Component
const BulletPoint = ({ text }) => (
  <View style={styles.bulletPoint}>
    <View style={styles.bullet} />
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#D2691E',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    marginBottom: 12,
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#e9d5ff',
    fontSize: 16,
    marginBottom: 4,
  },
  headerLocation: {
    color: '#e9d5ff',
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  readAloudButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  readAloudText: {
    color: '#8B4513',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B4513',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B4513',
    marginTop: 8,
    marginRight: 10,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  consentBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  privacyTextContainer: {
    flex: 1,
  },
  linkText: {
    color: '#8B4513',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: '#d1d5db',
    marginVertical: 16,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 20,
  },
  agreeButton: {
    backgroundColor: '#8B4513',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  agreeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  declineButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  declineButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  footerNoteText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
});

export default InformedConsentScreen;
