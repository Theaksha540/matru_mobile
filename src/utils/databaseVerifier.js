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
    console.log('🔍 Starting database health check...');
    
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
        console.error('❌ Database object is null');
        return results;
      }

      // Get total record count
      const countResult = offlineDB.db.getFirstSync(
        'SELECT COUNT(*) as count FROM secure_data'
      );
      results.recordCount = countResult.count;
      console.log(`📊 Total records in database: ${countResult.count}`);

      // Get count by data type
      const typeResults = offlineDB.db.getAllSync(
        'SELECT type, COUNT(*) as count FROM secure_data GROUP BY type ORDER BY count DESC'
      );
      
      typeResults.forEach(row => {
        results.dataTypes[row.type] = row.count;
        console.log(`  - ${row.type}: ${row.count} records`);
      });

      results.healthy = results.recordCount > 0;
      
      if (results.healthy) {
        console.log('✅ Database health check PASSED');
      } else {
        console.log('⚠️ Database is empty - no data synced yet');
      }

    } catch (error) {
      results.errors.push(error.message);
      console.error('❌ Database health check FAILED:', error);
    }

    return results;
  }

  /**
   * Verify specific data types are stored
   */
  async verifyDataTypes() {
    console.log('🔍 Verifying data types...');
    
    const expectedTypes = [
      'patient',
      'appointments',
      'grievances',
      'pending_approvals',
      'anc_visits'
    ];

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
          count = Array.isArray(data) ? data.length : (data ? 1 : 0);
        }

        results[type] = {
          stored: count > 0,
          count: count
        };

        if (count > 0) {
          console.log(`✅ ${type}: ${count} records`);
        } else {
          console.log(`⚠️ ${type}: No records found`);
        }

      } catch (error) {
        results[type] = {
          stored: false,
          count: 0,
          error: error.message
        };
        console.error(`❌ ${type}: Error - ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Test encryption and decryption
   */
  async testEncryption() {
    console.log('🔍 Testing encryption/decryption...');
    
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
        console.error('❌ Failed to save test data');
        return { success: false, error: 'Save failed' };
      }
      console.log('✅ Test data saved');

      // Test retrieve
      const retrieved = await offlineDB.getSecureData('test_encryption', 'test_123');
      if (!retrieved) {
        console.error('❌ Failed to retrieve test data');
        return { success: false, error: 'Retrieve failed' };
      }
      console.log('✅ Test data retrieved');

      // Verify data integrity
      const match = JSON.stringify(testData) === JSON.stringify(retrieved);
      if (!match) {
        console.error('❌ Data integrity check failed');
        console.log('Original:', testData);
        console.log('Retrieved:', retrieved);
        return { success: false, error: 'Data mismatch' };
      }
      console.log('✅ Data integrity verified');

      // Clean up test data
      offlineDB.db.runSync(
        'DELETE FROM secure_data WHERE id = ?',
        ['test_encryption_test_123']
      );
      console.log('✅ Test data cleaned up');

      return { success: true };

    } catch (error) {
      console.error('❌ Encryption test failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    console.log('📊 Gathering database statistics...');
    
    try {
      await offlineDB.init();
      
      if (!offlineDB.db) {
        return { error: 'Database not initialized' };
      }

      // Total records
      const totalResult = offlineDB.db.getFirstSync(
        'SELECT COUNT(*) as count FROM secure_data'
      );

      // Records by type
      const byType = offlineDB.db.getAllSync(
        'SELECT type, COUNT(*) as count FROM secure_data GROUP BY type ORDER BY count DESC'
      );

      // Oldest and newest records
      const oldestResult = offlineDB.db.getFirstSync(
        'SELECT created_at FROM secure_data ORDER BY created_at ASC LIMIT 1'
      );

      const newestResult = offlineDB.db.getFirstSync(
        'SELECT updated_at FROM secure_data ORDER BY updated_at DESC LIMIT 1'
      );

      // Database size (approximate)
      const sizeResult = offlineDB.db.getFirstSync(
        'SELECT SUM(LENGTH(encrypted_data)) as size FROM secure_data'
      );

      const stats = {
        totalRecords: totalResult.count,
        recordsByType: byType.reduce((acc, row) => {
          acc[row.type] = row.count;
          return acc;
        }, {}),
        oldestRecord: oldestResult?.created_at 
          ? new Date(oldestResult.created_at * 1000).toISOString() 
          : null,
        newestRecord: newestResult?.updated_at 
          ? new Date(newestResult.updated_at * 1000).toISOString() 
          : null,
        approximateSize: sizeResult.size ? `${(sizeResult.size / 1024).toFixed(2)} KB` : '0 KB'
      };

      console.log('📊 Database Statistics:');
      console.log(`  Total Records: ${stats.totalRecords}`);
      console.log(`  Approximate Size: ${stats.approximateSize}`);
      console.log(`  Oldest Record: ${stats.oldestRecord || 'N/A'}`);
      console.log(`  Newest Record: ${stats.newestRecord || 'N/A'}`);
      console.log('  Records by Type:');
      Object.entries(stats.recordsByType).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });

      return stats;

    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
      return { error: error.message };
    }
  }

  /**
   * Verify sync after login
   * Call this method after login to verify data was synced
   */
  async verifySyncAfterLogin() {
    console.log('🔍 Verifying sync after login...');
    console.log('='.repeat(50));

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
    console.log('');

    // Verify data types
    results.dataTypes = await this.verifyDataTypes();
    console.log('');

    // Test encryption
    results.encryptionTest = await this.testEncryption();
    console.log('');

    // Get statistics
    results.statistics = await this.getStatistics();
    console.log('');

    // Determine overall success
    results.overallSuccess = 
      results.healthCheck.healthy &&
      results.encryptionTest.success &&
      Object.values(results.dataTypes).some(dt => dt.stored);

    console.log('='.repeat(50));
    if (results.overallSuccess) {
      console.log('✅ VERIFICATION PASSED - Database is working correctly');
    } else {
      console.log('❌ VERIFICATION FAILED - Issues detected');
      if (!results.healthCheck.healthy) {
        console.log('  - Database health check failed');
      }
      if (!results.encryptionTest.success) {
        console.log('  - Encryption test failed');
      }
      if (!Object.values(results.dataTypes).some(dt => dt.stored)) {
        console.log('  - No data types stored');
      }
    }
    console.log('='.repeat(50));

    return results;
  }

  /**
   * Quick check - just verify database has data
   */
  async quickCheck() {
    try {
      await offlineDB.init();
      
      if (!offlineDB.db) {
        console.log('❌ Database not initialized');
        return false;
      }

      const result = offlineDB.db.getFirstSync(
        'SELECT COUNT(*) as count FROM secure_data'
      );

      const hasData = result.count > 0;
      
      if (hasData) {
        console.log(`✅ Database has ${result.count} records`);
      } else {
        console.log('⚠️ Database is empty');
      }

      return hasData;

    } catch (error) {
      console.error('❌ Quick check failed:', error);
      return false;
    }
  }
}

export const dbVerifier = new DatabaseVerifier();

// Export convenience methods
export const verifyDatabaseAfterLogin = () => dbVerifier.verifySyncAfterLogin();
export const quickDatabaseCheck = () => dbVerifier.quickCheck();
export const getDatabaseStats = () => dbVerifier.getStatistics();
