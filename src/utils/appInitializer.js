import { syncService } from './syncService';
import NetInfo from '@react-native-community/netinfo';
import { requestStoragePermissionSilent, checkStoragePermission } from './permissions';
import { offlineDB } from './offlineDatabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

class AppInitializer {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  async performInitialization() {
    try {
      console.log('🚀 Initializing app...');
      
      // Check if we should request permissions
      const permissionScreenShown = await AsyncStorage.getItem('permission_screen_shown');
      
      if (permissionScreenShown === 'true') {
        // User has seen permission screen, try to request permissions silently
        await requestStoragePermissionSilent();
      }
      
      // Check if we have permission before initializing database
      const hasPermission = await checkStoragePermission();
      
      if (hasPermission) {
        // Initialize offline database only if we have permission
        await offlineDB.init();
        console.log('✅ Database initialized with permissions');
      } else {
        console.log('⚠️ Database initialization skipped - no storage permission');
        // Still mark as initialized but without database
      }
      
      console.log('✅ App initialized');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ App initialization error:', error);
      this.isInitialized = true; // Mark as initialized even on error to prevent blocking
    }
  }
}

export const appInitializer = new AppInitializer();