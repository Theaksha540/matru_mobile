import React, { createContext, useState, useEffect, useContext } from 'react';
import { notificationAPI } from '../services/notificationAPI';
import { secureStorage } from '../utils/secureStorage';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const matchesField = (notificationValue, userValue) => {
    if (notificationValue === null || notificationValue === undefined) return true;
    if (userValue === null || userValue === undefined) return true;

    if (Array.isArray(notificationValue)) {
      return notificationValue.map(String).includes(String(userValue));
    }

    return String(notificationValue) === String(userValue);
  };

  const matchesUserScope = (notification, userInfo) => {
    if (!userInfo) return true;

    const targetRole = notification.target_role ?? notification.role;
    if (targetRole && !matchesField(targetRole, userInfo.role)) {
      return false;
    }

    const districtMatch = matchesField(notification.district_id, userInfo.district_id);
    const blockMatch = matchesField(notification.block_id, userInfo.block_id);
    const subCentreMatch = matchesField(notification.sub_centre_id, userInfo.sub_centre_id);
    const usgCentreMatch = matchesField(notification.usg_centre_id, userInfo.usg_centre_id);

    if (!districtMatch || !blockMatch || !subCentreMatch || !usgCentreMatch) {
      return false;
    }

    return true;
  };

  const filterNotificationsByUserScope = async (data = []) => {
    const items = Array.isArray(data) ? data : (data?.items || []);
    const userInfo = await secureStorage.getItem('user_info');
    return items.filter((notification) => matchesUserScope(notification, userInfo));
  };

  const fetchUnreadCount = async () => {
    try {
      const token = await secureStorage.getItem('access_token');
      if (!token) return;
      const data = await notificationAPI.getNotifications({ is_read: false, limit: 500 });
      const scopedUnread = await filterNotificationsByUserScope(data);
      setUnreadCount(scopedUnread.length);
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Error fetching unread count:', error);
      }
    }
  };

  const fetchNotifications = async (params = {}) => {
    try {
      const token = await secureStorage.getItem('access_token');
      if (!token) return [];
      const data = await notificationAPI.getNotifications(params);
      const scopedNotifications = await filterNotificationsByUserScope(data);
      setNotifications(scopedNotifications);
      return scopedNotifications;
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('Error fetching notifications:', error);
      }
      return [];
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      await fetchUnreadCount();
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      await fetchUnreadCount();
      await fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = await secureStorage.getItem('access_token');
      setIsAuthenticated(!!token);
      if (token) {
        fetchUnreadCount();
      }
    };
    checkAuth();
    const interval = setInterval(checkAuth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        fetchUnreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
