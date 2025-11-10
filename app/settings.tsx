import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../utils/api';
import { authStorage } from '../utils/authStorage';
import { subscribeProfile, getProfileLocal } from '../utils/profileStore';
export default function SettingsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const { colors, theme, toggleTheme } = useTheme();
  const isLightMode = theme === 'light';
  const [notificationPreferences, setNotificationPreferences] = useState({
    messageNotifications: true,
    callNotifications: true,
    pushNotifications: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Function to generate background color based on first letter
  const getAvatarColor = (name: string) => {
    if (!name) return '#00A884';

    const firstLetter = name.charAt(0).toUpperCase();
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];

    const index = firstLetter.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Initialize from local store if available, else fetch from API
    const local = getProfileLocal();
    if (local) setProfile(local);
    fetchProfile();
    // Subscribe to profile updates so settings updates immediately
    const unsubscribe = subscribeProfile((p) => {
      if (p) setProfile(p);
    });
    return () => unsubscribe();
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
      fetchNotificationPreferences();
      setRefreshKey(prev => prev + 1); // Force re-render
    }, [])
  );
  const fetchProfile = async () => {
    try {
      const token = await authStorage.getToken();
      if (!token) {
        // No token, redirect to login
        router.replace('/');
        return;
      }

      const response = await apiService.getProfile(token);
      setProfile(response.user);
    } catch (err) {
      console.error('Failed to load profile', err);
      // If token is invalid, redirect to login
      if (err instanceof Error && err.message.includes('Invalid token')) {
        await authStorage.removeToken();
        router.replace('/');
      }
    }
  };

  const fetchNotificationPreferences = async () => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await apiService.get('/auth/notifications', token);
      if (response.ok) {
        const data = await response.json();
        setNotificationPreferences(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
    }
  };

  const updateNotificationPreference = async (key: keyof typeof notificationPreferences, value: boolean) => {
    if (loadingNotifications) return;

    setLoadingNotifications(true);
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const updatedPreferences = { ...notificationPreferences, [key]: value };
      const response = await apiService.put('/auth/notifications', updatedPreferences, token);

      if (response.ok) {
        setNotificationPreferences(updatedPreferences);
      } else {
        console.error('Failed to update notification preferences');
        // Revert the change on failure
        setNotificationPreferences(notificationPreferences);
      }
    } catch (error) {
      console.error('Failed to update notification preference:', error);
      // Revert the change on failure
      setNotificationPreferences(notificationPreferences);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authStorage.removeToken();
      router.replace('/');
    } catch (error) {
      console.error('Error during logout:', error);
      router.replace('/');
    }
  };
  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#FFFFFF' : '#0B141A' }]}>
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <TouchableOpacity
          style={[styles.profileSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
          onPress={() => router.push('/profile' as any)}
        >
          <View style={styles.profileContent}>
            {profile?.avatarUrl ? (
              <Image
                key={`${profile.avatarUrl}-${refreshKey}`}
                source={{ uri: `${profile.avatarUrl}?t=${Date.now()}` }}
                style={styles.profileAvatar}
                onError={() => {
                  // If image fails to load, fall back to default avatar
                  console.log('Avatar image failed to load, using default');
                }}
              />
            ) : (
              <View style={[styles.profileAvatar, {
                backgroundColor: getAvatarColor(profile?.name || '')
              }]}>
                <Text style={styles.avatarText}>
                  {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                {profile?.name || 'Loading...'}
              </Text>
              {profile?.bio ? (
                <Text style={[styles.profileBio, { color: isLightMode ? '#667781' : '#8696A0' }]} numberOfLines={1}>
                  {profile.bio}
                </Text>
              ) : (
                <Text style={[styles.profileBio, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Hey there! I am using WhatsApp.
                </Text>
              )}
            </View>
            <Feather name="hash" size={24} color={isLightMode ? '#00A884' : '#00A884'} />
          </View>
        </TouchableOpacity>
        {/* Account Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.sectionHeader}>
            <Feather name="key" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.sectionTitle, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Account
            </Text>
          </View>
         
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => router.push('/privacy' as any)}
          >
            <View style={styles.itemLeft}>
              <Feather name="lock" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Privacy
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => router.push('/forgot-password' as any)}
          >
            <View style={styles.itemLeft}>
              <Feather name="shield" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Change Password
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomWidth: 0 }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="users" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Account Info
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Chats Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.sectionHeader}>
            <Feather name="message-circle" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.sectionTitle, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Chats
            </Text>
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
            <View style={styles.itemLeft}>
              <Feather name="droplet" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Theme
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={[styles.itemSubtext, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                {isLightMode ? 'Light' : 'Dark'}
              </Text>
              <Switch
                value={!isLightMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#00A884' }}
                thumbColor={isLightMode ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="image" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Wallpaper
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomWidth: 0 }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="archive" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Chat backup
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Notifications Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.sectionHeader}>
            <Feather name="bell" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.sectionTitle, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Notifications
            </Text>
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
            <View style={styles.itemLeft}>
              <Feather name="message-square" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Message notifications
              </Text>
            </View>
            <Switch
              value={notificationPreferences.messageNotifications}
              onValueChange={(value) => updateNotificationPreference('messageNotifications', value)}
              trackColor={{ false: '#767577', true: '#00A884' }}
              thumbColor={isLightMode ? '#f4f3f4' : '#f4f3f4'}
              disabled={loadingNotifications}
            />
          </View>
          <View style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
            <View style={styles.itemLeft}>
              <Feather name="phone" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Call notifications
              </Text>
            </View>
            <Switch
              value={notificationPreferences.callNotifications}
              onValueChange={(value) => updateNotificationPreference('callNotifications', value)}
              trackColor={{ false: '#767577', true: '#00A884' }}
              thumbColor={isLightMode ? '#f4f3f4' : '#f4f3f4'}
              disabled={loadingNotifications}
            />
          </View>
          <View style={[styles.settingsItem, { borderBottomWidth: 0 }]}>
            <View style={styles.itemLeft}>
              <Feather name="smartphone" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Push notifications
              </Text>
            </View>
            <Switch
              value={notificationPreferences.pushNotifications}
              onValueChange={(value) => updateNotificationPreference('pushNotifications', value)}
              trackColor={{ false: '#767577', true: '#00A884' }}
              thumbColor={isLightMode ? '#f4f3f4' : '#f4f3f4'}
              disabled={loadingNotifications}
            />
          </View>
        </View>
        {/* Storage Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.sectionHeader}>
            <Feather name="database" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.sectionTitle, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Storage and data
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="bar-chart-2" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Storage usage
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomWidth: 0 }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="wifi" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Network usage
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Help Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.sectionHeader}>
            <Feather name="help-circle" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.sectionTitle, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Help
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="book-open" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Help center
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="info" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                App info
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsItem, { borderBottomWidth: 0 }]}
            onPress={() => {}}
          >
            <View style={styles.itemLeft}>
              <Feather name="file-text" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.itemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Terms and Privacy Policy
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Logout Button */}
        <View style={styles.sectionGap} />
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={20} color="#E53935" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isLightMode ? '#8696A0' : '#667781' }]}>
            from
          </Text>
          <View style={styles.footerBrand}>
            <Feather name="message-circle" size={16} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.footerBrandText, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              WHATSAPP
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '500',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 14,
  },
  sectionGap: {
    height: 8,
  },
  section: {
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },
  itemText: {
    fontSize: 16,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemSubtext: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 12,
    marginBottom: 4,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBrandText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
});