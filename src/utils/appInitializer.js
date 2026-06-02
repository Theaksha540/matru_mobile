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
      const permissionScreenShown = await AsyncStorage.getItem('permission_screen_shown');
      if (permissionScreenShown !== 'true') {
        await AsyncStorage.setItem('storage_permission_granted', 'true');
      }
      await offlineDB.init();
      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = true; // Mark as initialized even on error to prevent blocking
    }
  }
}
export const appInitializer = new AppInitializer();
