import { offlineDB } from './offlineDatabase';
import { pregnantWomenAPI, ancVisitAPI, usgAppointmentAPI, grievanceAPI, reportsAPI, adminAPI, authAPI, deliveryReferralAPI } from '../services/api';
import { secureStorage } from './secureStorage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.isSyncingOffline = false;
    this.offlineSyncPromise = null;
    this.syncQueue = [];
    this.syncInterval = null;
  }

  // Auto-sync when network becomes available
  async startAutoSync() {
    if (this.syncInterval) return; // Already running
    
    this.syncInterval = setInterval(async () => {
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable;
      
      if (isOnline && !this.isSyncing && !this.isSyncingOffline) {
        await this.syncOfflineData();
        await this.syncAll();
      }
    }, 30000); // Sync every 30 seconds when online
  }

  // Stop auto-sync (for logout)
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isSyncing = false;
    this.isSyncingOffline = false;
  }

  // Get offline data helper
  async getOfflineData(type, id) {
    return await offlineDB.getSecureData(type, id);
  }

  // Save offline USG report
  async saveOfflineUSGReport(reportData) {
    await offlineDB.saveSecureData('offline_usg_reports', reportData.id, reportData);
  }

  // Save offline USG appointment
  async saveOfflineUSGAppointment(appointmentData) {
    await offlineDB.saveSecureData('offline_usg_appointments', appointmentData.id, appointmentData);
  }

  normalizeReferralList(referrals) {
    if (Array.isArray(referrals)) {
      return referrals;
    }

    if (Array.isArray(referrals?.items)) {
      return referrals.items;
    }

    if (Array.isArray(referrals?.results)) {
      return referrals.results;
    }

    return [];
  }

  async cacheDeliveryReferrals(referrals) {
    const normalizedReferrals = this.normalizeReferralList(referrals);
    const referralsByStatus = {
      pending: normalizedReferrals.filter((referral) => referral?.status === 'pending'),
      accepted: normalizedReferrals.filter((referral) => referral?.status === 'accepted'),
      re_referred: normalizedReferrals.filter((referral) => referral?.status === 're_referred'),
      completed: normalizedReferrals.filter((referral) => referral?.status === 'completed'),
    };

    await offlineDB.saveSecureData('delivery_referrals', 'all', normalizedReferrals);
    await offlineDB.saveSecureData('delivery_referrals_all', 'data', normalizedReferrals);

    for (const [status, filteredReferrals] of Object.entries(referralsByStatus)) {
      await offlineDB.saveSecureData(`delivery_referrals_${status}`, 'data', filteredReferrals);
    }

    for (const referral of normalizedReferrals) {
      if (!referral?.id) continue;
      try {
        await offlineDB.saveSecureData('delivery_referral_detail', referral.id, referral);
      } catch (error) {
        console.error(`[SyncService] Error caching referral ${referral.id}:`, error);
      }
    }

    return normalizedReferrals;
  }

  async ensureDeliveryReferralCaches() {
    if (!(await this.isOnline())) {
      return false;
    }

    const response = await deliveryReferralAPI.getAll();
    const referrals = await this.cacheDeliveryReferrals(response);
    return referrals.length > 0;
  }

  // Save offline patient update
  async saveOfflinePatientUpdate(patientId, patientData) {
    const offlineUpdate = {
      id: patientId,
      data: patientData,
      sync_status: 'pending',
      updated_at: new Date().toISOString(),
    };
    await offlineDB.saveSecureData('offline_patient_updates', patientId, offlineUpdate);
    console.log(`Saved offline patient update for ID: ${patientId}`);
  }

  // Save offline approval
  async saveOfflineApproval(patientId, patientData = null) {
    const offlineApproval = {
      id: patientId,
      patient_data: patientData,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    };
    await offlineDB.saveSecureData('offline_approvals', patientId, offlineApproval);
    console.log(`[OfflineDB] Saved offline approval for ID: ${patientId}`);
  }

  // Get offline approvals
  async getOfflineApprovals() {
    try {
      const approvals = await offlineDB.getSecureData('offline_approvals') || [];
      // Only return pending approvals (not synced ones)
      return Array.isArray(approvals) ? approvals.filter(a => a.sync_status === 'pending') : [];
    } catch (error) {
      console.error('Error getting offline approvals:', error);
      return [];
    }
  }

  // Save offline pregnancy registration
  async saveOfflinePregnancy(pregnancyData) {
    const createdAt = pregnancyData?.created_at || new Date().toISOString();
    const normalizedPregnancy = {
      ...pregnancyData,
      created_at: createdAt,
      pregnancy_registration_date:
        pregnancyData?.pregnancy_registration_date || createdAt.split('T')[0],
      registration_approved: false,
      is_registration_approved: false,
    };

    await offlineDB.saveSecureData('offline_pregnancies', normalizedPregnancy.id, normalizedPregnancy);
  }

  async getPendingOfflinePregnancies() {
    try {
      const offlinePregnancies = await offlineDB.getSecureData('offline_pregnancies') || [];

      return (Array.isArray(offlinePregnancies) ? offlinePregnancies : [])
        .filter((pregnancy) => pregnancy?.sync_status === 'pending')
        .map((pregnancy) => {
          const createdAt = pregnancy?.created_at || new Date().toISOString();

          return {
            ...pregnancy,
            created_at: createdAt,
            pregnancy_registration_date:
              pregnancy?.pregnancy_registration_date || createdAt.split('T')[0],
            registration_approved: false,
            is_registration_approved: false,
          };
        });
    } catch (error) {
      console.error('Error loading pending offline pregnancies:', error);
      return [];
    }
  }

  mergePendingOfflinePregnancies(records = [], offlinePregnancies = []) {
    const mergedRecords = [...(Array.isArray(records) ? records : [])];
    const existingIds = new Set(
      mergedRecords
        .map((record) => record?.id)
        .filter((id) => id !== undefined && id !== null)
        .map((id) => String(id))
    );

    for (const pregnancy of Array.isArray(offlinePregnancies) ? offlinePregnancies : []) {
      const pregnancyId = pregnancy?.id;
      if (pregnancyId === undefined || pregnancyId === null) {
        continue;
      }

      if (!existingIds.has(String(pregnancyId))) {
        mergedRecords.unshift(pregnancy);
        existingIds.add(String(pregnancyId));
      }
    }

    return mergedRecords;
  }

  async setCachedResource(key, data) {
    if (!key) return false;
    return await offlineDB.saveSecureData('app_cache', key, data);
  }

  async getCachedResource(key) {
    if (!key) return null;
    return await offlineDB.getSecureData('app_cache', key);
  }

  async queueOfflineGrievanceChange(change) {
    if (!change?.id || !change?.action) return false;

    const existingChanges = await this.getOfflineGrievanceChanges();
    const queuedAt = change.queued_at || new Date().toISOString();
    const nextChanges = [
      ...existingChanges,
      {
        ...change,
        queued_at: queuedAt,
      },
    ];

    return await offlineDB.saveSecureData('offline_grievance_changes', 'all', nextChanges);
  }

  async getOfflineGrievanceChanges() {
    return await offlineDB.getSecureData('offline_grievance_changes', 'all') || [];
  }

  async clearOfflineGrievanceChanges() {
    return await offlineDB.saveSecureData('offline_grievance_changes', 'all', []);
  }

  async queueOfflineReferralAction(change) {
    if (!change?.id || !change?.action || !change?.referral_id) return false;

    const existingChanges = await this.getOfflineReferralActions();
    const queuedAt = change.queued_at || new Date().toISOString();
    const nextChanges = [
      ...existingChanges,
      {
        ...change,
        queued_at: queuedAt,
      },
    ];

    return await offlineDB.saveSecureData('offline_referral_actions', 'all', nextChanges);
  }

  async getOfflineReferralActions() {
    return await offlineDB.getSecureData('offline_referral_actions', 'all') || [];
  }

  async clearOfflineReferralActions() {
    return await offlineDB.saveSecureData('offline_referral_actions', 'all', []);
  }

  sanitizeOfflinePregnancyForSync(pregnancy) {
    if (!pregnancy) return pregnancy;

    const sanitizedPregnancy = { ...pregnancy };
    delete sanitizedPregnancy.id;
    delete sanitizedPregnancy.sync_status;
    delete sanitizedPregnancy.created_offline;

    return sanitizedPregnancy;
  }

  sanitizeOfflineUSGAppointmentForSync(appointment) {
    if (!appointment) return appointment;

    const sanitizedAppointment = { ...appointment };
    delete sanitizedAppointment.id;
    delete sanitizedAppointment.sync_status;
    delete sanitizedAppointment.created_offline;

    return sanitizedAppointment;
  }

  sanitizeOfflineANCVisitForSync(visit) {
    if (!visit) return visit;

    const sanitizedVisit = { ...visit };
    delete sanitizedVisit.sync_status;
    delete sanitizedVisit.created_offline;

    if (visit.created_offline) {
      delete sanitizedVisit.id;
    }

    return sanitizedVisit;
  }

  sanitizeOfflineDeliveryReferralForSync(referral) {
    if (!referral) return referral;

    const sanitizedReferral = { ...referral };
    delete sanitizedReferral.id;
    delete sanitizedReferral.sync_status;
    delete sanitizedReferral.created_offline;
    delete sanitizedReferral.created_at;
    delete sanitizedReferral.status;

    return sanitizedReferral;
  }

  extractReferralId(referralResponse) {
    return (
      referralResponse?.id ||
      referralResponse?.referral?.id ||
      referralResponse?.referral_id ||
      referralResponse?.data?.id ||
      referralResponse?.data?.referral?.id ||
      null
    );
  }

  matchesReferralId(referral, referralId) {
    const targetId = String(referralId);
    return [
      referral?.id,
      referral?.referral_id,
      referral?.delivery_referral_id,
      referral?.reference_id,
    ]
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value))
      .includes(targetId);
  }

  async updateReferralCaches(referralId, updater) {
    const cacheTargets = [
      { type: 'delivery_referrals', id: 'all', status: null },
      { type: 'delivery_referrals_all', id: 'data', status: null },
      { type: 'delivery_referrals_pending', id: 'data', status: 'pending' },
      { type: 'delivery_referrals_accepted', id: 'data', status: 'accepted' },
      { type: 'delivery_referrals_re_referred', id: 'data', status: 're_referred' },
      { type: 'delivery_referrals_completed', id: 'data', status: 'completed' },
    ];

    for (const cacheTarget of cacheTargets) {
      const cachedValue = await offlineDB.getSecureData(cacheTarget.type, cacheTarget.id);
      const cachedList = this.normalizeReferralList(cachedValue);

      if (cachedList.length === 0) {
        continue;
      }

      const updatedList = cachedList.map((referral) => {
        if (!this.matchesReferralId(referral, referralId)) {
          return referral;
        }

        return updater({ ...referral });
      });

      const filteredList = cacheTarget.status
        ? updatedList.filter((referral) => referral?.status === cacheTarget.status)
        : updatedList;

      await offlineDB.saveSecureData(cacheTarget.type, cacheTarget.id, filteredList);
    }

    const cachedDetail = await offlineDB.getSecureData('delivery_referral_detail', referralId);
    if (cachedDetail) {
      await offlineDB.saveSecureData('delivery_referral_detail', referralId, updater({ ...cachedDetail }));
    }

    const offlineReferral = await offlineDB.getSecureData('offline_delivery_referrals', referralId);
    if (offlineReferral) {
      const updatedOfflineReferral = await this.hydrateOfflineDeliveryReferral(updater({ ...offlineReferral }));
      await offlineDB.saveSecureData('offline_delivery_referrals', referralId, updatedOfflineReferral);
    }
  }

  async remapOfflineReferralActionTargets(previousReferralId, nextReferralId) {
    if (!previousReferralId || !nextReferralId || String(previousReferralId) === String(nextReferralId)) {
      return;
    }

    const queuedActions = await this.getOfflineReferralActions();
    const remappedActions = queuedActions.map((change) => (
      String(change?.referral_id) === String(previousReferralId)
        ? { ...change, referral_id: nextReferralId }
        : change
    ));

    await offlineDB.saveSecureData('offline_referral_actions', 'all', remappedActions);
  }

  async acceptDeliveryReferral(referralId) {
    if (await this.isOnline()) {
      return await deliveryReferralAPI.accept(referralId);
    }

    const now = new Date().toISOString();

    await this.updateReferralCaches(referralId, (referral) => ({
      ...referral,
      status: 'accepted',
      accepted_at: referral.accepted_at || now,
      updated_at: now,
    }));

    await this.queueOfflineReferralAction({
      id: `offline_accept_${referralId}_${Date.now()}`,
      action: 'accept',
      referral_id: referralId,
      queued_at: now,
    });

    return { offline: true, referral_id: referralId };
  }

  async reReferDeliveryReferral(referralId, payload = {}) {
    if (await this.isOnline()) {
      return await deliveryReferralAPI.reRefer(referralId, payload);
    }

    const now = new Date().toISOString();
    const deliveryPoints = await this.getDeliveryPoints();
    const matchedDeliveryPoint = (Array.isArray(deliveryPoints) ? deliveryPoints : [])
      .find((deliveryPoint) => String(deliveryPoint?.id) === String(payload?.new_dp_id));

    await this.updateReferralCaches(referralId, (referral) => {
      const existingChain = Array.isArray(referral?.referral_chain) ? [...referral.referral_chain] : [];
      const nextChain = [
        ...existingChain,
        {
          referral_id: referral?.id || referral?.referral_id || referralId,
          dp_id: payload?.new_dp_id,
          dp_name: matchedDeliveryPoint?.name || matchedDeliveryPoint?.dp_name || referral?.dp_name || null,
          status: 're_referred',
          created_at: now,
          observation_notes: referral?.observation_notes || null,
          re_refer_reason: payload?.re_refer_reason || null,
        },
      ];

      return {
        ...referral,
        status: 're_referred',
        dp_id: payload?.new_dp_id || referral?.dp_id,
        dp_name: matchedDeliveryPoint?.name || matchedDeliveryPoint?.dp_name || referral?.dp_name || null,
        delivery_point: matchedDeliveryPoint || referral?.delivery_point || null,
        re_refer_reason: payload?.re_refer_reason || null,
        updated_at: now,
        referral_chain: nextChain,
      };
    });

    await this.queueOfflineReferralAction({
      id: `offline_rerefer_${referralId}_${Date.now()}`,
      action: 're_refer',
      referral_id: referralId,
      payload,
      queued_at: now,
    });

    return { offline: true, referral_id: referralId };
  }

  async recordOutcomeDeliveryReferral(referralId, payload = {}) {
    if (await this.isOnline()) {
      return await deliveryReferralAPI.recordOutcome(referralId, payload);
    }

    const now = new Date().toISOString();

    await this.updateReferralCaches(referralId, (referral) => ({
      ...referral,
      status: 'completed',
      updated_at: now,
      outcome: {
        ...(referral?.outcome || {}),
        ...payload,
      },
    }));

    await this.queueOfflineReferralAction({
      id: `offline_outcome_${referralId}_${Date.now()}`,
      action: 'record_outcome',
      referral_id: referralId,
      payload,
      queued_at: now,
    });

    return { offline: true, referral_id: referralId };
  }

  // Sync offline data to server
  async syncOfflineData() {
    if (this.isSyncingOffline && this.offlineSyncPromise) {
      return await this.offlineSyncPromise;
    }

    this.isSyncingOffline = true;
    this.offlineSyncPromise = (async () => {
      const ancPatientsToRefresh = new Set();

      // Sync offline patient updates
      const offlineUpdates = await offlineDB.getSecureData('offline_patient_updates') || [];
      
      for (const update of offlineUpdates) {
        if (update.sync_status === 'pending') {
          try {
            await pregnantWomenAPI.update(update.id, update.data);
            
            // Mark as synced
            update.sync_status = 'synced';
            await offlineDB.saveSecureData('offline_patient_updates', update.id, update);
            
            console.log(`Synced offline patient update: ${update.id}`);
          } catch (error) {
            console.error(`Failed to sync offline patient update ${update.id}:`, error);
          }
        }
      }
      
      // Sync offline approvals
      const offlineApprovals = await offlineDB.getSecureData('offline_approvals') || [];
      
      for (const approval of offlineApprovals) {
        if (approval.sync_status === 'pending') {
          try {
            await pregnantWomenAPI.approve(approval.id);
            
            // Mark as synced
            approval.sync_status = 'synced';
            await offlineDB.saveSecureData('offline_approvals', approval.id, approval);
            
            console.log(`Synced offline approval: ${approval.id}`);
          } catch (error) {
            console.error(`Failed to sync offline approval ${approval.id}:`, error);
          }
        }
      }
      
      // Sync offline pregnancies
      const offlinePregnancies = await offlineDB.getSecureData('offline_pregnancies') || [];
      
      for (const pregnancy of offlinePregnancies) {
        if (pregnancy.sync_status === 'pending') {
          try {
            await pregnantWomenAPI.register(this.sanitizeOfflinePregnancyForSync(pregnancy));
            
            // Mark as synced
            pregnancy.sync_status = 'synced';
            await offlineDB.saveSecureData('offline_pregnancies', pregnancy.id, pregnancy);
            
            console.log(`Synced offline pregnancy: ${pregnancy.id}`);
          } catch (error) {
            console.error(`Failed to sync offline pregnancy ${pregnancy.id}:`, error);
          }
        }
      }
      
      // Sync offline USG appointments
      const offlineAppointments = await offlineDB.getSecureData('offline_usg_appointments') || [];
      
      for (const appointment of offlineAppointments) {
        if (appointment.sync_status === 'pending') {
          try {
            await usgAppointmentAPI.schedule(this.sanitizeOfflineUSGAppointmentForSync(appointment));
            
            // Mark as synced
            appointment.sync_status = 'synced';
            await offlineDB.saveSecureData('offline_usg_appointments', appointment.id, appointment);
            
            console.log(`Synced offline USG appointment: ${appointment.id}`);
          } catch (error) {
            console.error(`Failed to sync offline USG appointment ${appointment.id}:`, error);
          }
        }
      }
      
      // Sync offline USG reports
      const offlineReports = await offlineDB.getSecureData('offline_usg_reports') || [];
      
      for (const report of offlineReports) {
        if (report.sync_status === 'pending') {
          try {
            // Check if file still exists
            if (report.file_info?.local_uri) {
              const fileExists = await FileSystem.getInfoAsync(report.file_info.local_uri);
              if (!fileExists.exists) {
                console.error(`File not found for report ${report.id}`);
                report.sync_status = 'failed';
                report.error_message = 'File not found';
                await offlineDB.saveSecureData('offline_usg_reports', report.id, report);
                continue;
              }
              
              // Update report with file for upload
              report.report_file = {
                uri: report.file_info.local_uri,
                type: report.file_info.mime_type,
                name: report.file_info.original_name
              };
            }
            
            await usgAppointmentAPI.complete(report.appointment_id, report);
            
            // Mark as synced and clean up file
            report.sync_status = 'synced';
            if (report.file_info?.local_uri) {
              await FileSystem.deleteAsync(report.file_info.local_uri, { idempotent: true });
            }
            await offlineDB.saveSecureData('offline_usg_reports', report.id, report);
            
            console.log(`Synced offline USG report: ${report.id}`);
          } catch (error) {
            console.error(`Failed to sync offline USG report ${report.id}:`, error);
            report.sync_status = 'failed';
            report.error_message = error.message;
            await offlineDB.saveSecureData('offline_usg_reports', report.id, report);
          }
        }
      }
      
      // Get all offline ANC visits
      const offlineVisits = await offlineDB.getSecureData('offline_anc_visits') || [];
      
      for (const visit of offlineVisits) {
        if (visit.sync_status === 'pending') {
          try {
            if (visit.created_offline) {
              // Create new visit
              await ancVisitAPI.create(this.sanitizeOfflineANCVisitForSync(visit));
            } else {
              // Update existing visit
              await ancVisitAPI.update(visit.id, this.sanitizeOfflineANCVisitForSync(visit));
            }
            
            // Mark as synced
            visit.sync_status = 'synced';
            await offlineDB.saveSecureData('offline_anc_visits', visit.id, visit);
            if (visit.pregnant_woman_id) {
              ancPatientsToRefresh.add(String(visit.pregnant_woman_id));
            }
            
            console.log(`Synced offline ANC visit: ${visit.id}`);
          } catch (error) {
            console.error(`Failed to sync offline ANC visit ${visit.id}:`, error);
          }
        }
      }

      for (const patientId of ancPatientsToRefresh) {
        try {
          const response = await ancVisitAPI.getByPregnantWoman(patientId);
          const visits = response?.visits || [];
          await offlineDB.saveSecureData('anc_visits', patientId, visits);
        } catch (error) {
          console.error(`Failed to refresh ANC cache for patient ${patientId}:`, error);
        }
      }

      const offlineDeliveryReferrals = await offlineDB.getSecureData('offline_delivery_referrals') || [];

      for (const referral of offlineDeliveryReferrals) {
        if (referral.sync_status === 'pending') {
          try {
            const syncedReferralResponse = await deliveryReferralAPI.create(this.sanitizeOfflineDeliveryReferralForSync(referral));
            const syncedReferralId = this.extractReferralId(syncedReferralResponse) || referral.id;

            referral.sync_status = 'synced';
            referral.server_referral_id = syncedReferralId;
            await offlineDB.saveSecureData('offline_delivery_referrals', referral.id, referral);
            await this.remapOfflineReferralActionTargets(referral.id, syncedReferralId);

            console.log(`Synced offline delivery referral: ${referral.id}`);
          } catch (error) {
            console.error(`Failed to sync offline delivery referral ${referral.id}:`, error);
          }
        }
      }

      const offlineGrievanceChanges = await this.getOfflineGrievanceChanges();
      const remainingGrievanceChanges = [];

      for (const change of offlineGrievanceChanges) {
        try {
          if (change.action === 'resolve') {
            await grievanceAPI.resolve(change.id, change.notes || '');
          } else if (change.action === 'in_progress') {
            await grievanceAPI.updateStatus(change.id, { status: 'in_progress' });
          } else {
            remainingGrievanceChanges.push(change);
          }
        } catch (error) {
          console.error(`Failed to sync offline grievance change ${change.id}:`, error);
          remainingGrievanceChanges.push(change);
        }
      }

      await offlineDB.saveSecureData('offline_grievance_changes', 'all', remainingGrievanceChanges);

      const offlineReferralActions = await this.getOfflineReferralActions();
      const remainingReferralActions = [];

      for (const change of offlineReferralActions) {
        try {
          if (change.action === 'accept') {
            await deliveryReferralAPI.accept(change.referral_id);
          } else if (change.action === 're_refer') {
            await deliveryReferralAPI.reRefer(change.referral_id, change.payload || {});
          } else if (change.action === 'record_outcome') {
            await deliveryReferralAPI.recordOutcome(change.referral_id, change.payload || {});
          } else {
            remainingReferralActions.push(change);
          }
        } catch (error) {
          console.error(`Failed to sync offline referral action ${change.referral_id}:`, error);
          remainingReferralActions.push(change);
        }
      }

      await offlineDB.saveSecureData('offline_referral_actions', 'all', remainingReferralActions);
    })();

    try {
      await this.offlineSyncPromise;
    } catch (error) {
      console.error('Error syncing offline data:', error);
    } finally {
      this.isSyncingOffline = false;
      this.offlineSyncPromise = null;
    }
  }

  // Get offline ANC visits for a patient
  async getOfflineANCVisits(patientId) {
    try {
      const allOfflineVisits = await offlineDB.getSecureData('offline_anc_visits') || [];
      return allOfflineVisits.filter(visit => 
        visit.pregnant_woman_id === patientId && visit.sync_status === 'pending'
      );
    } catch (error) {
      console.error('Error getting offline ANC visits:', error);
      return [];
    }
  }

  // Save offline ANC visit
  async saveOfflineANCVisit(visitData) {
    await offlineDB.saveSecureData('offline_anc_visits', visitData.id, visitData);
  }

  async getOfflineUSGAppointments(patientId = null) {
    try {
      const allOfflineAppointments = await offlineDB.getSecureData('offline_usg_appointments') || [];
      const pendingAppointments = Array.isArray(allOfflineAppointments)
        ? allOfflineAppointments.filter((appointment) => appointment?.sync_status === 'pending')
        : [];

      if (!patientId) {
        return pendingAppointments;
      }

      return pendingAppointments.filter(
        (appointment) => String(appointment?.pregnant_woman_id) === String(patientId)
      );
    } catch (error) {
      console.error('Error getting offline USG appointments:', error);
      return [];
    }
  }

  async hydrateOfflineDeliveryReferral(referralData) {
    if (!referralData) return referralData;

    const hydratedReferral = {
      referral_chain: [],
      anc_visits: [],
      usg_appointments: [],
      ...referralData,
    };

    try {
      if (hydratedReferral.pregnant_woman_id) {
        const patient = await this.getPatientById(hydratedReferral.pregnant_woman_id);

        if (patient) {
          hydratedReferral.pregnant_woman = hydratedReferral.pregnant_woman || patient;
          hydratedReferral.patient = hydratedReferral.patient || patient;
          hydratedReferral.pregnant_woman_name =
            hydratedReferral.pregnant_woman_name ||
            patient.full_name ||
            patient.patient_name;
          hydratedReferral.patient_name =
            hydratedReferral.patient_name ||
            patient.full_name ||
            patient.patient_name;
          hydratedReferral.mobile_number =
            hydratedReferral.mobile_number ||
            patient.mobile_number ||
            patient.phone;
          hydratedReferral.phone =
            hydratedReferral.phone ||
            patient.mobile_number ||
            patient.phone;
          hydratedReferral.age = hydratedReferral.age ?? patient.age ?? null;
          hydratedReferral.address = hydratedReferral.address || patient.address || null;
          hydratedReferral.blood_group = hydratedReferral.blood_group || patient.blood_group || null;
          hydratedReferral.husband_name = hydratedReferral.husband_name || patient.husband_name || null;
          hydratedReferral.rch_id = hydratedReferral.rch_id || patient.rch_id || null;
          hydratedReferral.abha_id = hydratedReferral.abha_id || patient.abha_id || null;
          hydratedReferral.gravida = hydratedReferral.gravida ?? patient.gravida ?? null;
          hydratedReferral.para = hydratedReferral.para ?? patient.para ?? null;
          hydratedReferral.lmp_date = hydratedReferral.lmp_date || patient.lmp_date || null;
          hydratedReferral.edd_date =
            hydratedReferral.edd_date ||
            patient.edd_date ||
            patient.expected_delivery_date ||
            null;
          hydratedReferral.expected_delivery_date =
            hydratedReferral.expected_delivery_date ||
            patient.expected_delivery_date ||
            patient.edd_date ||
            null;
          hydratedReferral.is_high_risk =
            hydratedReferral.is_high_risk ?? patient.is_high_risk ?? false;
          hydratedReferral.risk_factors =
            hydratedReferral.risk_factors || patient.risk_factors || null;
          hydratedReferral.sub_centre_name =
            hydratedReferral.sub_centre_name ||
            patient.sub_centre_name ||
            patient.facility_name ||
            null;
        }

        if (!Array.isArray(hydratedReferral.anc_visits) || hydratedReferral.anc_visits.length === 0) {
          const [syncedVisits, offlineVisits] = await Promise.all([
            this.getANCVisits(hydratedReferral.pregnant_woman_id),
            this.getOfflineANCVisits(hydratedReferral.pregnant_woman_id),
          ]);

          hydratedReferral.anc_visits = [...(syncedVisits || []), ...(offlineVisits || [])]
            .filter(Boolean)
            .reduce((visits, visit) => {
              const dedupeKey = `${visit.sync_status || 'synced'}_${visit.id || visit.visit_number}_${visit.visit_date || ''}`;
              if (!visits.some((existingVisit) => existingVisit._dedupeKey === dedupeKey)) {
                visits.push({ ...visit, _dedupeKey: dedupeKey });
              }
              return visits;
            }, [])
            .map(({ _dedupeKey, ...visit }) => visit);
        }

        if (!Array.isArray(hydratedReferral.usg_appointments) || hydratedReferral.usg_appointments.length === 0) {
          const appointments = await this.getAppointments();
          hydratedReferral.usg_appointments = (Array.isArray(appointments) ? appointments : [])
            .filter((appointment) => String(appointment?.pregnant_woman_id) === String(hydratedReferral.pregnant_woman_id));
        }
      }

      if (hydratedReferral.dp_id && (!hydratedReferral.dp_name || !hydratedReferral.delivery_point)) {
        const deliveryPoints = await this.getDeliveryPoints();
        const matchedDeliveryPoint = (Array.isArray(deliveryPoints) ? deliveryPoints : [])
          .find((deliveryPoint) => String(deliveryPoint?.id) === String(hydratedReferral.dp_id));

        if (matchedDeliveryPoint) {
          hydratedReferral.dp_name =
            hydratedReferral.dp_name ||
            matchedDeliveryPoint.name ||
            matchedDeliveryPoint.dp_name;
          hydratedReferral.delivery_point = hydratedReferral.delivery_point || matchedDeliveryPoint;
        }
      }
    } catch (error) {
      console.error('Error hydrating offline delivery referral:', error);
    }

    return hydratedReferral;
  }

  async saveOfflineDeliveryReferral(referralData) {
    const hydratedReferral = await this.hydrateOfflineDeliveryReferral(referralData);
    await offlineDB.saveSecureData('offline_delivery_referrals', hydratedReferral.id, hydratedReferral);
  }

  async getOfflineDeliveryReferrals() {
    try {
      const referrals = await offlineDB.getSecureData('offline_delivery_referrals') || [];
      if (!Array.isArray(referrals)) {
        return [];
      }

      const pendingReferrals = referrals.filter((referral) => referral.sync_status === 'pending');
      return await Promise.all(
        pendingReferrals.map((referral) => this.hydrateOfflineDeliveryReferral(referral))
      );
    } catch (error) {
      console.error('Error getting offline delivery referrals:', error);
      return [];
    }
  }

  async isOnline() {
    const networkState = await NetInfo.fetch();
    return networkState.isConnected && networkState.isInternetReachable;
  }

  async syncAll() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    try {
      await Promise.all([
        this.syncPatients(),
        this.syncAppointments(),
        this.syncGrievances(),
        this.syncReports(),
        this.syncDeliveryReferrals(), // Add missing delivery referrals sync
      ]);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncPatients() {
    try {
      const response = await pregnantWomenAPI.getAll();
      const patients = response.items || response || [];
      await offlineDB.savePatients(patients);
      
      // Also sync high-risk cases specifically
      try {
        const highRiskResponse = await pregnantWomenAPI.getAll({ is_high_risk: true });
        const highRiskPatients = highRiskResponse.items || highRiskResponse || [];
        console.log('Synced high-risk patients:', highRiskPatients.length);
        // Merge with existing patients (avoid duplicates)
        const allPatients = [...patients];
        highRiskPatients.forEach(hrPatient => {
          if (!allPatients.find(p => p.id === hrPatient.id)) {
            allPatients.push(hrPatient);
          }
        });
        await offlineDB.savePatients(allPatients);
      } catch (error) {
        console.error('Error syncing high-risk patients:', error);
      }
      
      // Sync pending approvals
      const pendingApprovals = await pregnantWomenAPI.getPendingApproval();
      await offlineDB.savePendingApprovals(pendingApprovals);
      
      // Sync ANC visits for each patient
      for (const patient of patients.slice(0, 10)) {
        try {
          const visits = await ancVisitAPI.getByPregnantWoman(patient.id);
          await offlineDB.saveANCVisits(patient.id, visits?.visits || []);
        } catch (error) {
          console.error(`Error syncing ANC visits for patient ${patient.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing patients:', error);
      // Don't throw - continue with other sync operations
    }
  }

  async syncAppointments() {
    const getFileExtensionFromUrl = (fileUrl) => {
      if (!fileUrl) return 'pdf';
      const cleanUrl = String(fileUrl).split('?')[0].split('#')[0];
      const match = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
      const ext = match?.[1]?.toLowerCase();
      return ['pdf', 'jpg', 'jpeg', 'png'].includes(ext) ? ext : 'pdf';
    };

    try {
      const response = await usgAppointmentAPI.getAll();
      const appointments = response.items || response || [];
      await offlineDB.saveAppointments(appointments);
      
      // Download files for offline viewing
      for (const appointment of appointments) {
        if (appointment.prescription_file_url) {
          try {
            const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
            const fullURL = appointment.prescription_file_url.startsWith('http') 
              ? appointment.prescription_file_url 
              : `${BASE_URL}${appointment.prescription_file_url}`;
            
            const fileExtension = getFileExtensionFromUrl(appointment.prescription_file_url);
            const fileName = `prescription_${appointment.id}.${fileExtension}`;
            const downloadPath = `${FileSystem.cacheDirectory}${fileName}`;
            
            const fileInfo = await FileSystem.getInfoAsync(downloadPath);
            if (!fileInfo.exists) {
              await FileSystem.downloadAsync(fullURL, downloadPath);
            }
          } catch (fileError) {
            console.error(`Failed to cache prescription for appointment ${appointment.id}:`, fileError);
          }
        }
        
        if (appointment.report_file_url) {
          try {
            const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
            const fullURL = appointment.report_file_url.startsWith('http') 
              ? appointment.report_file_url 
              : `${BASE_URL}${appointment.report_file_url}`;
            
            const fileExtension = getFileExtensionFromUrl(appointment.report_file_url);
            const fileName = `report_${appointment.id}.${fileExtension}`;
            const downloadPath = `${FileSystem.cacheDirectory}${fileName}`;
            
            const fileInfo = await FileSystem.getInfoAsync(downloadPath);
            if (!fileInfo.exists) {
              await FileSystem.downloadAsync(fullURL, downloadPath);
            }
          } catch (fileError) {
            console.error(`Failed to cache report for appointment ${appointment.id}:`, fileError);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing appointments:', error);
    }
  }

  async syncGrievances() {
    try {
      const response = await grievanceAPI.getAll();
      const grievances = response.items || response || [];
      await offlineDB.saveGrievances(grievances);
      
      // Cache individual grievance details
      for (const grievance of grievances) {
        try {
          await offlineDB.saveSecureData('grievance_detail', grievance.id, grievance);
        } catch (error) {
          console.error(`Error caching grievance ${grievance.id}:`, error);
        }
      }
      
      // Sync grievance stats
      try {
        const stats = await grievanceAPI.getStatistics();
        await offlineDB.saveSecureData('grievance_stats', 'all', stats);
      } catch (error) {
        console.error('Error syncing grievance stats:', error);
      }
    } catch (error) {
      console.error('Error syncing grievances:', error);
      // Don't throw - continue with other sync operations
    }
  }

  async syncReports() {
    try {
      // Sync district reports
      try {
        const userInfo = await secureStorage.getItem('user_info');
        if (userInfo?.role === 'district') {
          const districtReports = await reportsAPI.getDistrictPerformance();
          await offlineDB.saveSecureData('district_reports', 'all', districtReports);
        }
      } catch (error) {
        if (error.response?.status === 403) {
          console.log('District reports access denied - user may not have permission');
        } else {
          console.error('Error syncing district reports:', error.response?.status || error.message);
        }
      }
      
      // Sync block reports
      try {
        const blockReports = await reportsAPI.getBlockWardWiseReport();
        await offlineDB.saveSecureData('block_reports', 'all', blockReports);
      } catch (error) {
        if (error.response?.status === 403) {
          console.log('Block reports access denied - user may not have permission');
        } else {
          console.error('Error syncing block reports:', error.response?.status || error.message);
        }
      }
      
      // Sync options data
      try {
        const abnormalOptions = await authAPI.getAbnormalFindingsOptions();
        await offlineDB.saveSecureData('abnormal_options', 'all', abnormalOptions);
        
        const scanTypeOptions = await authAPI.getScanTypesOptions();
        await offlineDB.saveSecureData('scan_type_options', 'all', scanTypeOptions);
      } catch (error) {
        console.error('Error syncing options data:', error.response?.status || error.message);
      }
      
      // Sync USG centres
      try {
        const districts = await adminAPI.getDistricts();
        const deliveryPoints = await adminAPI.getDeliveryPoints();
        await offlineDB.saveSecureData('delivery_points', 'all', deliveryPoints);

        for (const district of districts) {
          const centres = await adminAPI.getUSGCentres(district.id);
          await offlineDB.saveSecureData('usg_centres', district.id, centres);
          
          // Sync blocks for each district
          const blocks = await adminAPI.getBlocks(district.id);
          await offlineDB.saveSecureData('blocks', 'all', blocks);
          
          // Sync wards for each block
          for (const block of blocks) {
            const wards = await adminAPI.getWards({ block_id: block.id });
            await offlineDB.saveSecureData('wards', block.id, wards);
          }
        }
      } catch (error) {
        console.error('Error syncing admin data:', error.response?.status || error.message);
      }
    } catch (error) {
      console.error('Error syncing reports:', error);
    }
  }

  // Get data with automatic fallback
  async getPatients(params = {}) {
    console.log('[SyncService] getPatients called with params:', JSON.stringify(params));
    
    // Extract pagination params
    const { skip, limit, ...searchParams } = params;
    
    if (await this.isOnline()) {
      try {
        console.log('[SyncService] Online - fetching from API');
        const pendingOfflinePregnancies = await this.getPendingOfflinePregnancies();
        
        // IMPORTANT: API returns array directly, no {items, total} wrapper
        // To get accurate total count, we need to fetch without pagination first
        
        if (skip === 0 || skip === undefined) {
          // First page: Fetch all to get total count, then cache it
          console.log('[SyncService] First page - fetching all for accurate count');
          const allResponse = await pregnantWomenAPI.getAll(searchParams);
          const allPatients = Array.isArray(allResponse) ? allResponse : [];
          console.log('[SyncService] Total patients from API:', allPatients.length);
          
          // Cache all patients for offline use
          setTimeout(() => {
            if (allPatients.length > 0) {
              offlineDB.savePatients(allPatients);
            }
          }, 0);
          
          // Return all patients (caller will paginate)
          return this.mergePendingOfflinePregnancies(allPatients, pendingOfflinePregnancies);
        } else {
          // Subsequent pages: Fetch all (API doesn't support server-side pagination properly)
          console.log('[SyncService] Subsequent page - fetching all');
          const allResponse = await pregnantWomenAPI.getAll(searchParams);
          const allPatients = Array.isArray(allResponse) ? allResponse : [];
          console.log('[SyncService] Total patients from API:', allPatients.length);
          
          return this.mergePendingOfflinePregnancies(allPatients, pendingOfflinePregnancies);
        }
      } catch (error) {
        console.log('[SyncService] API failed, using offline data:', error.message);
      }
    } else {
      console.log('[SyncService] Offline - loading from cache');
    }
    
    // Offline mode - get ALL cached patients and apply search filters
    const cachedPatients = await offlineDB.getPatients();
    const pendingOfflinePregnancies = await this.getPendingOfflinePregnancies();
    const mergedCachedPatients = this.mergePendingOfflinePregnancies(cachedPatients, pendingOfflinePregnancies);
    console.log('[SyncService] Cached patients count:', mergedCachedPatients.length);
    
    if (!searchParams || Object.keys(searchParams).length === 0) {
      console.log('[SyncService] No search params - returning all cached patients');
      return mergedCachedPatients;
    }
    
    console.log('[SyncService] Applying search filters...');
    const filteredPatients = mergedCachedPatients.filter((patient) => {
      // Apply search filter
      if (searchParams.search) {
        const searchLower = searchParams.search.toLowerCase();
        const matchesName = patient?.full_name?.toLowerCase().includes(searchLower);
        const matchesMobile = patient?.mobile_number?.includes(searchParams.search);
        const matchesRCH = patient?.rch_id?.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesMobile && !matchesRCH) {
          return false;
        }
      }
      
      // Apply other filters
      if (searchParams.block_id && String(patient?.block_id) !== String(searchParams.block_id)) return false;
      if (searchParams.sub_centre_id && String(patient?.sub_centre_id) !== String(searchParams.sub_centre_id)) return false;
      if (searchParams.district_id && String(patient?.district_id) !== String(searchParams.district_id)) return false;
      if (searchParams.is_high_risk !== undefined && Boolean(patient?.is_high_risk) !== Boolean(searchParams.is_high_risk)) return false;
      if (searchParams.registration_approved !== undefined) {
        const isApproved = patient?.registration_approved ?? patient?.is_registration_approved;
        if (Boolean(isApproved) !== Boolean(searchParams.registration_approved)) return false;
      }
      
      return true;
    });
    
    console.log('[SyncService] Filtered patients count (before pagination):', filteredPatients.length);
    return filteredPatients;
  }

  async getPatientById(id) {
    if (await this.isOnline()) {
      try {
        const patient = await pregnantWomenAPI.getById(id);
        // Save to offline DB in background
        setTimeout(() => offlineDB.savePatients([patient]), 0);
        return patient;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    const cachedPatient = await offlineDB.getPatientById(id);
    if (cachedPatient) {
      return cachedPatient;
    }

    return await offlineDB.getSecureData('offline_pregnancies', id);
  }

  async getANCVisits(patientId) {
    if (await this.isOnline()) {
      try {
        const response = await ancVisitAPI.getByPregnantWoman(patientId);
        const visits = response?.visits || [];
        await offlineDB.saveSecureData('anc_visits', patientId, visits);
        return visits;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('anc_visits', patientId) || [];
  }

  async getAppointments(params = {}) {
    if (await this.isOnline()) {
      try {
        const response = await usgAppointmentAPI.getAll(params);
        const appointments = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response)
            ? response
            : [];
        setTimeout(() => {
          offlineDB.saveSecureData('appointments', 'all', appointments);
        }, 0);
        return appointments;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    const cachedAppointments = await offlineDB.getSecureData('appointments', 'all') || [];
    if (!params || Object.keys(params).length === 0) {
      return cachedAppointments;
    }
    return cachedAppointments.filter((appointment) => {
      if (params.status && appointment?.status !== params.status) return false;
      if (params.usg_centre_id && String(appointment?.usg_centre_id) !== String(params.usg_centre_id)) return false;
      if (params.appointment_type && appointment?.appointment_type !== params.appointment_type) return false;
      return true;
    });
  }

  async getAppointmentById(appointmentId) {
    if (await this.isOnline()) {
      try {
        const appointment = await usgAppointmentAPI.getById(appointmentId);
        // Save to offline DB in background
        setTimeout(() => {
          this.getAppointments().then(appointments => {
            const updatedAppointments = appointments.filter(apt => apt.id !== appointmentId);
            updatedAppointments.push(appointment);
            offlineDB.saveAppointments(updatedAppointments);
          });
        }, 0);
        return appointment;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    
    // Load from offline DB
    const allAppointments = await offlineDB.getSecureData('appointments', 'all') || [];
    return allAppointments.find(apt => apt.id === appointmentId);
  }

  async getGrievances(params = {}) {
    if (await this.isOnline()) {
      try {
        const grievances = await grievanceAPI.getAll(params);
        setTimeout(async () => {
          await offlineDB.saveSecureData('grievances', 'all', grievances);
          for (const grievance of grievances) {
            await offlineDB.saveSecureData('grievance_detail', grievance.id, grievance);
          }
        }, 0);
        return grievances;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    const cachedGrievances = await offlineDB.getSecureData('grievances', 'all') || [];
    if (!params || Object.keys(params).length === 0) {
      return cachedGrievances;
    }
    return cachedGrievances.filter((grievance) => {
      if (params.block_id && String(grievance?.block_id) !== String(params.block_id)) return false;
      if (params.district_id && String(grievance?.district_id) !== String(params.district_id)) return false;
      if (params.status && grievance?.status !== params.status) return false;
      if (params.escalated_only !== undefined && Boolean(grievance?.escalated_to_district) !== Boolean(params.escalated_only)) return false;
      return true;
    });
  }

  async getPendingApprovals() {
    console.log('[SyncService] getPendingApprovals called, isOnline:', await this.isOnline());
    const pendingOfflinePregnancies = await this.getPendingOfflinePregnancies();
    if (await this.isOnline()) {
      try {
        const pendingApprovals = await pregnantWomenAPI.getPendingApproval();
        console.log('[SyncService] Fetched pending approvals from API:', pendingApprovals?.length || 0);
        await offlineDB.savePendingApprovals(pendingApprovals);
        return this.mergePendingOfflinePregnancies(pendingApprovals, pendingOfflinePregnancies);
      } catch (error) {
        console.log('[SyncService] API failed, using offline data:', error.message);
      }
    } else {
      console.log('[SyncService] Offline - loading pending approvals from cache');
    }
    const cachedApprovals = await offlineDB.getPendingApprovals();
    const mergedPendingApprovals = this.mergePendingOfflinePregnancies(cachedApprovals, pendingOfflinePregnancies);
    console.log('[SyncService] Cached pending approvals count:', mergedPendingApprovals?.length || 0);
    return mergedPendingApprovals;
  }

  async getGrievanceStats() {
    if (await this.isOnline()) {
      try {
        const stats = await grievanceAPI.getStatistics();
        await offlineDB.saveSecureData('grievance_stats', 'all', stats);
        return stats;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('grievance_stats', 'all') || {};
  }

  async getGrievanceById(id) {
    if (await this.isOnline()) {
      try {
        const grievance = await grievanceAPI.getById(id);
        await offlineDB.saveSecureData('grievance_detail', id, grievance);
        return grievance;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('grievance_detail', id);
  }

  async getDistricts() {
    if (await this.isOnline()) {
      try {
        const districts = await adminAPI.getDistricts();
        await offlineDB.saveSecureData('districts', 'all', districts);
        return districts;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('districts', 'all') || [];
  }

  async getBlocks() {
    if (await this.isOnline()) {
      try {
        const blocks = await adminAPI.getBlocks();
        await offlineDB.saveSecureData('blocks', 'all', blocks);
        return blocks;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('blocks', 'all') || [];
  }

  async getDistrictReports() {
    if (await this.isOnline()) {
      try {
        const reports = await reportsAPI.getDistrictPerformance();
        await offlineDB.saveSecureData('district_reports', 'all', reports);
        return reports;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('district_reports', 'all') || {};
  }

  async getPerformanceTrends(viewType) {
    if (await this.isOnline()) {
      try {
        const trends = viewType === 'block' 
          ? await reportsAPI.getBlockWiseTrends(2026)
          : await reportsAPI.getWardWiseTrends(1, 2026);
        await offlineDB.saveSecureData('performance_trends', viewType, trends);
        return trends;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('performance_trends', viewType) || {};
  }

  async getBlockReports() {
    if (await this.isOnline()) {
      try {
        const reports = await reportsAPI.getBlockWardWiseReport();
        await offlineDB.saveSecureData('block_reports', 'all', reports);
        return reports;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('block_reports', 'all') || {};
  }

  async getUSGCentres(params = {}) {
    if (await this.isOnline()) {
      try {
        const centres = await adminAPI.getUSGCentres(params);
        const cacheKey = params.district_id || params.block_id || 'all';
        await offlineDB.saveSecureData('usg_centres', cacheKey, centres);
        const allCentres = await offlineDB.getSecureData('usg_centres', 'all') || [];
        const updatedAll = [...allCentres.filter(c => !centres.find(nc => nc.id === c.id)), ...centres];
        await offlineDB.saveSecureData('usg_centres', 'all', updatedAll);
        return centres;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    
    const allCentres = await offlineDB.getSecureData('usg_centres', 'all') || [];
    
    if (params.block_id) {
      return allCentres.filter(centre => centre.block_id === params.block_id);
    }
    
    if (params.district_id) {
      return allCentres.filter(centre => centre.district_id === params.district_id);
    }
    
    return allCentres;
  }

  async getDeliveryPoints(params = {}) {
    if (await this.isOnline()) {
      try {
        const deliveryPoints = await adminAPI.getDeliveryPoints(params);
        await offlineDB.saveSecureData('delivery_points', 'all', deliveryPoints);
        return deliveryPoints;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }

    const cachedDeliveryPoints = await offlineDB.getSecureData('delivery_points', 'all') || [];
    return cachedDeliveryPoints.filter((deliveryPoint) => {
      if (params.block_id && String(deliveryPoint?.block_id) !== String(params.block_id)) return false;
      if (params.district_id && String(deliveryPoint?.district_id) !== String(params.district_id)) return false;
      return true;
    });
  }

  async getWards(blockId) {
    if (await this.isOnline()) {
      try {
        const wards = await adminAPI.getWards({ block_id: blockId });
        await offlineDB.saveSecureData('wards', blockId, wards);
        return wards;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    return await offlineDB.getSecureData('wards', blockId) || [];
  }

  // Add missing delivery referrals sync methods
  async syncDeliveryReferrals() {
    try {
      console.log('[SyncService] syncDeliveryReferrals - Starting sync...');
      const response = await deliveryReferralAPI.getAll();
      console.log('[SyncService] syncDeliveryReferrals - API response type:', typeof response);
      console.log('[SyncService] syncDeliveryReferrals - Is array:', Array.isArray(response));
      
      const referrals = await this.cacheDeliveryReferrals(response);
      console.log('[SyncService] syncDeliveryReferrals - Referrals count:', referrals.length);

      console.log('[SyncService] syncDeliveryReferrals - Saved to offline DB');
      console.log('[SyncService] syncDeliveryReferrals - Completed successfully');
    } catch (error) {
      console.error('[SyncService] Error syncing delivery referrals:', error);
    }
  }

  async getDeliveryReferrals(status = null) {
    console.log('[SyncService] getDeliveryReferrals called, status:', status);
    
    if (await this.isOnline()) {
      try {
        console.log('[SyncService] Online - fetching from API');
        const params = status ? { status } : {};
        const response = await deliveryReferralAPI.getAll(params);
        const referrals = this.normalizeReferralList(response);
        console.log('[SyncService] API returned referrals:', referrals?.length || 0);
        
        if (!status) {
          await this.cacheDeliveryReferrals(referrals);
        } else {
          const cacheKey = `delivery_referrals_${status}`;
          await offlineDB.saveSecureData(cacheKey, 'data', referrals);
        }
        
        const offlineReferrals = await this.getOfflineDeliveryReferrals();
        const mergedReferrals = [...referrals, ...offlineReferrals];

        return status ? mergedReferrals.filter((referral) => referral.status === status) : mergedReferrals;
      } catch (error) {
        console.log('[SyncService] API failed, using offline data:', error.message);
      }
    } else {
      console.log('[SyncService] Offline - loading from cache');
    }
    
    // Load from offline DB
    const cacheKey = status ? `delivery_referrals_${status}` : 'delivery_referrals_all';
    let cachedData = await offlineDB.getSecureData(cacheKey, 'data');
    const normalizedCachedData = this.normalizeReferralList(cachedData);
    console.log('[SyncService] Cached data from key', cacheKey, ':', normalizedCachedData?.length || 0);
    
    if (normalizedCachedData.length > 0) {
      const offlineReferrals = await this.getOfflineDeliveryReferrals();
      const mergedReferrals = [...normalizedCachedData, ...offlineReferrals];
      return status ? mergedReferrals.filter((referral) => referral.status === status) : mergedReferrals;
    }
    
    // Fallback: filter from all referrals if specific status cache not found
    console.log('[SyncService] Trying fallback from delivery_referrals/all');
    const allReferrals = this.normalizeReferralList(
      await offlineDB.getSecureData('delivery_referrals', 'all')
    );
    console.log('[SyncService] All referrals from fallback:', allReferrals.length);
    
    const offlineReferrals = await this.getOfflineDeliveryReferrals();
    const mergedReferrals = [...allReferrals, ...offlineReferrals];

    return status ? mergedReferrals.filter(r => r.status === status) : mergedReferrals;
  }

  async getDeliveryReferralById(referralId) {
    if (await this.isOnline()) {
      try {
        const referral = await deliveryReferralAPI.getById(referralId);
        await offlineDB.saveSecureData('delivery_referral_detail', referralId, referral);
        return referral;
      } catch (error) {
        console.log('API failed, using offline data');
      }
    }
    const cachedReferral = await offlineDB.getSecureData('delivery_referral_detail', referralId);
    if (cachedReferral) {
      return cachedReferral;
    }

    const offlineReferral = await offlineDB.getSecureData('offline_delivery_referrals', referralId);
    if (offlineReferral) {
      return await this.hydrateOfflineDeliveryReferral(offlineReferral);
    }

    return null;
  }
}

export const syncService = new SyncService();
