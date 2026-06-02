// App.js - FIXED VERSION
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Updates from 'expo-updates';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appInitializer } from './src/utils/appInitializer';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { secureStorage } from './src/utils/secureStorage';
import { syncService } from './src/utils/syncService';
import i18n from './src/i18n';
import './src/i18n';
// Auth screens
import LoginScreen from './src/screens/auth/LoginScreen.jsx';
import PermissionScreen from './src/screens/auth/PermissionScreen.jsx';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen.jsx';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen.jsx';
import ChangePasswordScreen from './src/screens/auth/ChangePasswordScreen.jsx';
import SelfRegisterScreen from './src/screens/auth/SelfRegisterScreen.jsx';
import InformedConsentScreen from './src/screens/auth/InformedConsentScreen.jsx';

// Dashboard screens
import DistrictDashboard from './src/screens/dashboard/DistrictDashboard.jsx';
import DPDashboard from './src/screens/dashboard/DPDashboard.jsx';
import BlockDashboard from './src/screens/dashboard/BlockDashboard.jsx';
import BlockDetailsScreen from './src/screens/dashboard/BlockDetailsScreen.jsx';
import WardDetailsScreen from './src/screens/dashboard/WardDetailsScreen.jsx';
import SubCentreDashboard from './src/screens/dashboard/SubCentreDashboard.jsx';
import USGDashboard from './src/screens/dashboard/USGDashboard.jsx';
import MotherDashboard from './src/screens/dashboard/MotherDashboard.jsx';

// ANC screens
import ANCTrackingScreen from './src/screens/anc/ANCTrackingScreen.jsx';
import ANCTracking from './src/screens/anc/BlockANCTrackingScreen.jsx';
import ANCUpdateForm from './src/screens/anc/ANCUpdateForm.jsx';
import USGAppointmentForm from './src/screens/anc/USGAppointmentForm.jsx';
import USGAppointmentsList from './src/screens/anc/USGAppointmentsList.jsx';

// Report screens
import DistrictReportsScreen from './src/screens/reports/DistrictReportsScreen.jsx';
import BlockReportsScreen from './src/screens/reports/BlockReportsScreen.jsx';
import DeliveryPointReportsScreen from './src/screens/reports/DeliveryPointReportsScreen.jsx';
import PerformanceTrends from './src/screens/reports/PerformanceTrends.jsx';
import USGReportUpload from './src/screens/reports/USGReportUpload.jsx';
import CreateECGReportScreen from './src/screens/reports/CreateECGReportScreen.jsx';
import ECGReportsListScreen from './src/screens/reports/ECGReportsListScreen.jsx';
import ECGReportDetailScreen from './src/screens/reports/ECGReportDetailScreen.jsx';

// Upload screens
import BulkUploadScreen from './src/screens/upload/BulkUploadScreen.jsx';

// Deduplication screens
import DeduplicationCheckScreen from './src/screens/deduplication/DeduplicationCheckScreen.jsx';

// Grievance screens
import GrievanceHandlingScreen from './src/screens/grievance/GrievanceHandlingScreen.jsx';
import GrievanceDetailScreen from './src/screens/grievance/GrievanceDetailScreen.jsx';

// Delivery screens
import DeliveryReferralsScreen from './src/screens/delivery/DeliveryReferralsScreen.jsx';
import PendingReferralsScreen from './src/screens/delivery/PendingReferralsScreen.jsx';
import ReferralDetailScreen from './src/screens/delivery/ReferralDetailScreen.jsx';
import ReReferredCasesScreen from './src/screens/delivery/ReReferredCasesScreen.jsx';
import ReReferScreen from './src/screens/delivery/ReReferScreen.jsx';
import RecordOutcomeScreen from './src/screens/delivery/RecordOutcomeScreen.jsx';
import CreateDeliveryReferralScreen from './src/screens/delivery/CreateDeliveryReferralScreen.jsx';

// Registration screens
import RegisterPregnancyScreen from './src/screens/registration/RegisterPregnancyScreen.jsx';

// Miscellaneous screens
import ProfileSettingsScreen from './src/screens/miscellaneous/ProfileSettingsScreen.jsx';
import HighRiskCasesScreen from './src/screens/miscellaneous/HighRiskCasesScreen.jsx';
import PatientListScreen from './src/screens/miscellaneous/PatientListScreen.jsx';
//import GrievanceScreen from './src/screens/miscellaneous/GrievanceScreen.jsx';
import PendingApprovalScreen from './src/screens/miscellaneous/PendingApprovalScreen.jsx';
import PendingApprovalDetailScreen from './src/screens/miscellaneous/PendingApprovalDetailScreen.jsx';
import BeneficiaryEditScreen from './src/screens/miscellaneous/BeneficiaryEditScreen.jsx';
const Stack = createNativeStackNavigator();

// FIXED: Use React Native components instead of HTML
function PlaceholderDashboard({
  route
}) {
  return <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderTitle}>{route.name} Dashboard</Text>
      <Text style={styles.placeholderText}>
        This is the {route.name} dashboard screen.
      </Text>
      <Text style={styles.placeholderText}>
        You'll implement this based on your requirements.
      </Text>
    </View>;
}
const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb'
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f766e',
    marginBottom: 16,
    textAlign: 'center'
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
    textAlign: 'center'
  }
});
export default function App() {
  const [initialRoute, setInitialRoute] = React.useState(null);
  useEffect(() => {
    checkInitialRoute();
  }, []);
  const checkInitialRoute = async () => {
    try {
      const permissionShown = await AsyncStorage.getItem('permission_screen_shown');
      if (!permissionShown) {
        setInitialRoute('Permission');
        return;
      }
      const token = await secureStorage.getItem('access_token');
      const userInfo = await secureStorage.getItem('user_info');
      if (token && userInfo?.role) {
        const roleNavigation = {
          district: 'DistrictDashboard',
          dp: 'DPDashboard',
          block: 'BlockDashboard',
          sub_centre: 'SubCentreDashboard',
          usg_centre: 'USGDashboard',
          mother: 'MotherDashboard'
        };
        setInitialRoute(roleNavigation[userInfo.role] || 'DistrictDashboard');
        return;
      }
      setInitialRoute('Login');
    } catch (error) {
      setInitialRoute('Permission');
    }
  };
  useEffect(() => {
    appInitializer.initialize().catch(error => {});
    checkForUpdates();
  }, []);
  useEffect(() => {
    let unsubscribe;
    const initializeSessionSync = async () => {
      try {
        const token = await secureStorage.getItem('access_token');
        const userInfo = await secureStorage.getItem('user_info');
        if (!token || !userInfo?.role) {
          return;
        }
        syncService.startAutoSync();
        const networkState = await NetInfo.fetch();
        const isOnline = networkState.isConnected && networkState.isInternetReachable;
        if (isOnline) {
          await syncService.syncOfflineData();
          await syncService.syncAll();
        }
        unsubscribe = NetInfo.addEventListener(async state => {
          const backOnline = state.isConnected && state.isInternetReachable;
          if (backOnline) {
            await syncService.syncOfflineData();
            await syncService.syncAll();
          }
        });
      } catch (error) {}
    };
    initializeSessionSync();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  const checkForUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Update Available', 'A new version has been downloaded. Restart the app to apply the update.', [{
          text: 'Later',
          style: 'cancel'
        }, {
          text: 'Restart Now',
          onPress: () => Updates.reloadAsync()
        }]);
      }
    } catch (error) {}
  };
  if (!initialRoute) {
    return null;
  }
  return <NotificationProvider>
      <NavigationContainer>
      <Stack.Navigator screenOptions={{
        headerShown: false
      }} initialRouteName={initialRoute}>
        <Stack.Screen name="Permission" component={PermissionScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="InformedConsent" component={InformedConsentScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        <Stack.Screen name="SelfRegister" component={SelfRegisterScreen} />
        <Stack.Screen name="SubmitGrievance" component={require('./src/screens/auth/SubmitGrievanceScreen.jsx').default} />
        
        
        {/* Dashboard Screens */}
        <Stack.Screen name="DistrictDashboard" component={DistrictDashboard} options={{
          headerShown: false
        }} /> 
        <Stack.Screen name="DPDashboard" component={DPDashboard} options={{
          headerShown: false
        }} /> 
        <Stack.Screen name="BlockDetailsScreen" component={BlockDetailsScreen} options={{
          headerShown: false
        }} /> 
        <Stack.Screen name="WardDetailsScreen" component={WardDetailsScreen} options={{
          headerShown: false
        }} /> 
         <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="HighRiskCases" component={HighRiskCasesScreen} options={{
          headerShown: false
        }} />

 <Stack.Screen name="ANCTracking" component={ANCTrackingScreen} options={{
          headerShown: false
        }} />

        <Stack.Screen name="DistrictReports" component={DistrictReportsScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="BlockReports" component={BlockReportsScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="DPReports" component={DeliveryPointReportsScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="PerformanceTrends" component={PerformanceTrends} options={{
          headerShown: false
        }} />
        
        {/* Placeholder for other dashboards */}
        <Stack.Screen name="SubCentreDashboard" component={SubCentreDashboard} options={{
          headerShown: false
        }} />
        <Stack.Screen name="BlockDashboard" component={BlockDashboard} options={{
          headerShown: false
        }} />
        <Stack.Screen name="PatientList" component={PatientListScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="BeneficiaryEdit" component={BeneficiaryEditScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ANCTrackingBlock" component={ANCTracking} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ANCUpdateForm" component={ANCUpdateForm} options={{
          headerShown: false
        }} />

        <Stack.Screen name="USGAppointmentForm" component={USGAppointmentForm} options={{
          headerShown: false
        }} />

        <Stack.Screen name="USGAppointmentsList" component={USGAppointmentsList} options={{
          headerShown: false
        }} />

        <Stack.Screen name="RegisterPregnancy" component={RegisterPregnancyScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="USGDashboard" component={USGDashboard} options={{
          headerShown: false
        }} />
        <Stack.Screen name="USGReportUpload" component={USGReportUpload} options={{
          headerShown: false
        }} />
        <Stack.Screen name="CreateECGReport" component={CreateECGReportScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ECGReportsList" component={ECGReportsListScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ECGReportDetail" component={ECGReportDetailScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="MotherDashboard" component={MotherDashboard} options={{
          headerShown: false
        }} />
        <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="PendingApprovalDetail" component={PendingApprovalDetailScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="BulkUpload" component={BulkUploadScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="DeduplicationCheck" component={DeduplicationCheckScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="GrievanceHandling" component={GrievanceHandlingScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="GrievanceDetail" component={GrievanceDetailScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="DeliveryReferrals" component={DeliveryReferralsScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="PendingReferrals" component={PendingReferralsScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ReferralDetail" component={ReferralDetailScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ReReferredCases" component={ReReferredCasesScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="ReReferScreen" component={ReReferScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="RecordOutcomeScreen" component={RecordOutcomeScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="CreateDeliveryReferral" component={CreateDeliveryReferralScreen} options={{
          headerShown: false
        }} />
        <Stack.Screen name="CompletedReports" component={require('./src/screens/reports/CompletedReportsScreen.jsx').default} options={{
          headerShown: false
        }} />
        <Stack.Screen name="AllReports" component={require('./src/screens/reports/AllReportsScreen.jsx').default} options={{
          headerShown: false
        }} />
        <Stack.Screen name="AppointmentDetail" component={require('./src/screens/miscellaneous/AppointmentDetailScreen.jsx').default} options={{
          headerShown: false
        }} />

        <Stack.Screen name="Notifications" component={require('./src/screens/miscellaneous/NotificationsScreen.jsx').default} options={{
          headerShown: false
        }} />

      </Stack.Navigator>
    </NavigationContainer>
    </NotificationProvider>;
}
