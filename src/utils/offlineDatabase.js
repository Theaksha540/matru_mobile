import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { secureStorage } from './secureStorage';

class OfflineDatabase {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.encryptionKey = null;
    this.operationQueue = Promise.resolve();
  }

  async init() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  async performInitialization() {
    try {
      let keyData = await secureStorage.getItem('db_master_key');
      if (!keyData) {
        keyData = await this.generateSecureKey();
        try {
          await secureStorage.setItem('db_master_key', keyData);
        } catch (keyError) {
          console.warn('Failed to save encryption key:', keyError);
        }
      }
      this.encryptionKey = keyData;

      this.db = await SQLite.openDatabaseAsync('matru_secure.db');
      await this.createTablesAsync();
      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.isInitialized = true;
      this.db = null;
    } finally {
      this.initPromise = null;
    }
  }

  async generateSecureKey() {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async createTablesAsync() {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS secure_data (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_type ON secure_data(type);
      CREATE INDEX IF NOT EXISTS idx_updated ON secure_data(updated_at);
    `);
  }

  async runDatabaseOperation(operation) {
    const task = this.operationQueue.then(async () => {
      await this.init();
      if (!this.db) {
        throw new Error('Database not initialized');
      }
      return await operation();
    });

    this.operationQueue = task.catch(() => {});
    return await task;
  }

  async encrypt(data) {
    const jsonString = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(jsonString);

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      jsonString + this.encryptionKey
    );

    const keyBytes = new TextEncoder().encode(this.encryptionKey);
    const encrypted = new Uint8Array(dataBytes.length);

    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }

    return {
      data: Array.from(encrypted).map((b) => b.toString(16).padStart(2, '0')).join(''),
      hash,
    };
  }

  async decrypt(encryptedData, expectedHash) {
    try {
      const encrypted = new Uint8Array(
        encryptedData.match(/.{2}/g).map((byte) => parseInt(byte, 16))
      );

      const keyBytes = new TextEncoder().encode(this.encryptionKey);
      const decrypted = new Uint8Array(encrypted.length);

      for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
      }

      const jsonString = new TextDecoder().decode(decrypted);

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        jsonString + this.encryptionKey
      );

      if (hash !== expectedHash) {
        throw new Error('Data integrity check failed');
      }

      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  async saveSecureData(type, id, data) {
    try {
      const { data: encryptedData, hash } = await this.encrypt(data);

      await this.runDatabaseOperation(async () => {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO secure_data (id, type, encrypted_data, hash, updated_at)
           VALUES (?, ?, ?, ?, strftime('%s', 'now'))`,
          [`${type}_${id}`, type, encryptedData, hash]
        );
      });

      console.log(`[OfflineDB] Saved ${type}_${id}`);
      return true;
    } catch (error) {
      console.error(`[OfflineDB] Failed to save ${type}_${id}:`, error.message);
      return false;
    }
  }

  async getSecureData(type, id = null) {
    try {
      return await this.runDatabaseOperation(async () => {
        if (id) {
          const result = await this.db.getFirstAsync(
            'SELECT encrypted_data, hash FROM secure_data WHERE id = ?',
            [`${type}_${id}`]
          );

          if (!result) return null;
          return await this.decrypt(result.encrypted_data, result.hash);
        }

        const results = await this.db.getAllAsync(
          'SELECT encrypted_data, hash FROM secure_data WHERE type = ? ORDER BY updated_at DESC',
          [type]
        );

        const decrypted = [];
        for (const row of results) {
          const data = await this.decrypt(row.encrypted_data, row.hash);
          if (data) decrypted.push(data);
        }
        return decrypted;
      });
    } catch (error) {
      console.error(`[OfflineDB] Failed to get ${type}${id ? '_' + id : ''}:`, error.message);
      return id ? null : [];
    }
  }

  async savePatients(patients) {
    let successCount = 0;
    for (const patient of patients) {
      const saved = await this.saveSecureData('patient', patient.id, patient);
      if (saved) successCount++;
    }
    console.log(`[OfflineDB] Saved ${successCount}/${patients.length} patients`);
  }

  async getPatients() {
    return await this.getSecureData('patient');
  }

  async getPatientById(id) {
    return await this.getSecureData('patient', id);
  }

  async saveANCVisits(patientId, visits) {
    await this.saveSecureData('anc_visits', patientId, visits);
  }

  async getANCVisits(patientId) {
    return await this.getSecureData('anc_visits', patientId) || [];
  }

  async saveAppointments(appointments) {
    await this.saveSecureData('appointments', 'all', appointments);
  }

  async getAppointments() {
    return await this.getSecureData('appointments', 'all') || [];
  }

  async saveGrievances(grievances) {
    await this.saveSecureData('grievances', 'all', grievances);
  }

  async getGrievances() {
    return await this.getSecureData('grievances', 'all') || [];
  }

  async savePendingApprovals(pendingApprovals) {
    await this.saveSecureData('pending_approvals', 'all', pendingApprovals);
  }

  async getPendingApprovals() {
    return await this.getSecureData('pending_approvals', 'all') || [];
  }

  async clearAll() {
    try {
      await this.runDatabaseOperation(async () => {
        await this.db.runAsync('DELETE FROM secure_data');
      });
    } catch (error) {
      console.error('[OfflineDB] Failed to clear database:', error.message);
    }
  }
}

export const offlineDB = new OfflineDatabase();
