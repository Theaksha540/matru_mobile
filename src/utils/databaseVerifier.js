import { offlineDB } from './offlineDatabase';

/**
 * Database Verification Utility
 * 
 * This utility helps verify that data is properly stored in SQLite
 * after login and during sync operations.
 */

class DatabaseVerifier {
  /**
   * Perform a comprehensive health check of the database
   */
  async healthCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      healthy: false,
      initialized: false,
      recordCount: 0,
      dataTypes: {},
      errors: []
    };
    try {
      // Check if database is initialized
      await offlineDB.init();
      results.initialized = offlineDB.isInitialized;
      if (!offlineDB.db) {
        results.errors.push('Database object is null');
        return results;
      }

      // Get total record count
      const countResult = offlineDB.db.getFirstSync('SELECT COUNT(*) as count FROM secure_data');
      results.recordCount = countResult.count;
      // Get count by data type
      const typeResults = offlineDB.db.getAllSync('SELECT type, COUNT(*) as count FROM secure_data GROUP BY type ORDER BY count DESC');
      typeResults.forEach(row => {
        results.dataTypes[row.type] = row.count;
      });
      results.healthy = results.recordCount > 0;
      if (results.healthy) {} else {}
    } catch (error) {
      results.errors.push(error.message);
    }
    return results;
  }

  /**
   * Verify specific data types are stored
   */
  async verifyDataTypes() {
    const expectedTypes = ['patient', 'appointments', 'grievances', 'pending_approvals', 'anc_visits'];
    const results = {};
    for (const type of expectedTypes) {
      try {
        let count = 0;
        if (type === 'patient') {
          const patients = await offlineDB.getPatients();
          count = patients.length;
        } else if (type === 'appointments') {
          const appointments = await offlineDB.getAppointments();
          count = appointments.length;
        } else if (type === 'grievances') {
          const grievances = await offlineDB.getGrievances();
          count = grievances.length;
        } else if (type === 'pending_approvals') {
          const approvals = await offlineDB.getPendingApprovals();
          count = approvals.length;
        } else {
          // Generic check
          const data = await offlineDB.getSecureData(type);
          count = Array.isArray(data) ? data.length : data ? 1 : 0;
        }
        results[type] = {
          stored: count > 0,
          count: count
        };
        if (count > 0) {} else {}
      } catch (error) {
        results[type] = {
          stored: false,
          count: 0,
          error: error.message
        };
      }
    }
    return results;
  }

  /**
   * Test encryption and decryption
   */
  async testEncryption() {
    const testData = {
      id: 'test_123',
      name: 'Test Patient',
      mobile: '1234567890',
      timestamp: new Date().toISOString()
    };
    try {
      // Test save
      const saved = await offlineDB.saveSecureData('test_encryption', 'test_123', testData);
      if (!saved) {
        return {
          success: false,
          error: 'Save failed'
        };
      }
      // Test retrieve
      const retrieved = await offlineDB.getSecureData('test_encryption', 'test_123');
      if (!retrieved) {
        return {
          success: false,
          error: 'Retrieve failed'
        };
      }
      // Verify data integrity
      const match = JSON.stringify(testData) === JSON.stringify(retrieved);
      if (!match) {
        return {
          success: false,
          error: 'Data mismatch'
        };
      }
      // Clean up test data
      offlineDB.db.runSync('DELETE FROM secure_data WHERE id = ?', ['test_encryption_test_123']);
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    try {
      await offlineDB.init();
      if (!offlineDB.db) {
        return {
          error: 'Database not initialized'
        };
      }

      // Total records
      const totalResult = offlineDB.db.getFirstSync('SELECT COUNT(*) as count FROM secure_data');

      // Records by type
      const byType = offlineDB.db.getAllSync('SELECT type, COUNT(*) as count FROM secure_data GROUP BY type ORDER BY count DESC');

      // Oldest and newest records
      const oldestResult = offlineDB.db.getFirstSync('SELECT created_at FROM secure_data ORDER BY created_at ASC LIMIT 1');
      const newestResult = offlineDB.db.getFirstSync('SELECT updated_at FROM secure_data ORDER BY updated_at DESC LIMIT 1');

      // Database size (approximate)
      const sizeResult = offlineDB.db.getFirstSync('SELECT SUM(LENGTH(encrypted_data)) as size FROM secure_data');
      const stats = {
        totalRecords: totalResult.count,
        recordsByType: byType.reduce((acc, row) => {
          acc[row.type] = row.count;
          return acc;
        }, {}),
        oldestRecord: oldestResult?.created_at ? new Date(oldestResult.created_at * 1000).toISOString() : null,
        newestRecord: newestResult?.updated_at ? new Date(newestResult.updated_at * 1000).toISOString() : null,
        approximateSize: sizeResult.size ? `${(sizeResult.size / 1024).toFixed(2)} KB` : '0 KB'
      };
      Object.entries(stats.recordsByType).forEach(([type, count]) => {});
      return stats;
    } catch (error) {
      return {
        error: error.message
      };
    }
  }

  /**
   * Verify sync after login
   * Call this method after login to verify data was synced
   */
  async verifySyncAfterLogin() {
    const results = {
      timestamp: new Date().toISOString(),
      healthCheck: null,
      dataTypes: null,
      encryptionTest: null,
      statistics: null,
      overallSuccess: false
    };

    // Run health check
    results.healthCheck = await this.healthCheck();
    // Verify data types
    results.dataTypes = await this.verifyDataTypes();
    // Test encryption
    results.encryptionTest = await this.testEncryption();
    // Get statistics
    results.statistics = await this.getStatistics();
    // Determine overall success
    results.overallSuccess = results.healthCheck.healthy && results.encryptionTest.success && Object.values(results.dataTypes).some(dt => dt.stored);
    if (results.overallSuccess) {} else {
      if (!results.healthCheck.healthy) {}
      if (!results.encryptionTest.success) {}
      if (!Object.values(results.dataTypes).some(dt => dt.stored)) {}
    }
    return results;
  }

  /**
   * Quick check - just verify database has data
   */
  async quickCheck() {
    try {
      await offlineDB.init();
      if (!offlineDB.db) {
        return false;
      }
      const result = offlineDB.db.getFirstSync('SELECT COUNT(*) as count FROM secure_data');
      const hasData = result.count > 0;
      if (hasData) {} else {}
      return hasData;
    } catch (error) {
      return false;
    }
  }
}
export const dbVerifier = new DatabaseVerifier();

// Export convenience methods
export const verifyDatabaseAfterLogin = () => dbVerifier.verifySyncAfterLogin();
export const quickDatabaseCheck = () => dbVerifier.quickCheck();
export const getDatabaseStats = () => dbVerifier.getStatistics();
