import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { apiService } from './api';
import { authStorage } from './authStorage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request all necessary permissions
export const requestAllPermissions = async () => {
  const permissions = {
    camera: false,
    mediaLibrary: false,
    audio: false,
    notifications: false,
  };

  try {
    // Camera permission
    const cameraResult = await ImagePicker.requestCameraPermissionsAsync();
    permissions.camera = cameraResult.status === 'granted';

    // Media library permission
    const mediaResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    permissions.mediaLibrary = mediaResult.status === 'granted';

    // Audio recording permission
    const audioResult = await Audio.requestPermissionsAsync();
    permissions.audio = audioResult.status === 'granted';

    // Push notifications permission
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      permissions.notifications = finalStatus === 'granted';
    }

    return permissions;
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return permissions;
  }
};

// Get Expo push token
export const getPushToken = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      console.warn('Must use physical device for Push Notifications');
      return null;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (error) {
    // Silently fail - this is often due to Expo service temporary unavailability
    // Only log if it's not a 503/service unavailable error
    if (error instanceof Error && error.message.includes('503')) {
      console.warn('Expo push notification service temporarily unavailable');
    } else {
      console.error('Error getting push token:', error);
    }
    return null;
  }
};

// Register push token with backend
export const registerPushToken = async (token: string): Promise<boolean> => {
  try {
    const authToken = await authStorage.getToken();
    if (!authToken) {
      console.warn('No auth token available for push token registration');
      return false;
    }

    // Use the API_BASE_URL from apiService by creating a temporary request
    const API_BASE_URL = 'http://192.168.0.150:8080/api'; // Same as in api.ts

    const response = await fetch(`${API_BASE_URL}/auth/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });

    if (response.ok) {
      console.log('Push token registered successfully');
      return true;
    } else {
      console.error('Failed to register push token:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
};

// Initialize push notifications and register token
export const initializePushNotifications = async (): Promise<void> => {
  try {
    // Request permissions
    const permissions = await requestAllPermissions();
    console.log('Permissions granted:', permissions);

    // Get and register push token
    const pushToken = await getPushToken();
    if (pushToken) {
      const registered = await registerPushToken(pushToken);
      if (registered) {
        console.log('Push notifications initialized successfully');
      }
    }

    // Set up notification listeners (these will be cleaned up when component unmounts)
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle notification tap - could navigate to chat
    });

    // Note: In a real app, you'd want to store these listeners and remove them on cleanup
    // For now, they persist for the app session
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

// Handle incoming push notifications (for foreground display)
export const handlePushNotification = (notification: Notifications.Notification) => {
  const { title, body, data } = notification.request.content;

  // You can customize how notifications are displayed in foreground
  // For now, just log it - the system will handle the display
  console.log('Push notification handled:', { title, body, data });

  // If you want custom foreground display, you could show a local notification or modal
};