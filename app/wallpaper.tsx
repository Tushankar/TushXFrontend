import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { authStorage } from '@/utils/authStorage';
import { apiService } from '@/utils/api';
import * as ImagePicker from 'expo-image-picker';

interface WallpaperOption {
  id: string;
  name: string;
  source: ImageSourcePropType;
}

export default function WallpaperScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';
  const [selectedWallpaper, setSelectedWallpaper] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSolidColors, setShowSolidColors] = useState(false);

  const wallpapers: WallpaperOption[] = [
    {
      id: 'wallpaper1',
      name: 'Wallpaper 1',
      source: require('@/assets/images/ChatWallpaper-1.jpg'),
    },
    {
      id: 'wallpaper2',
      name: 'Wallpaper 2',
      source: require('@/assets/images/chatWallpaper-2.jpg'),
    },
    {
      id: 'wallpaper3',
      name: 'Wallpaper 3',
      source: require('@/assets/images/chatWallpaper-3.jpg'),
    },
    {
      id: 'wallpaper4',
      name: 'Wallpaper 4',
      source: require('@/assets/images/chatWallpaper-4.jpg'),
    },
    {
      id: 'wallpaper5',
      name: 'Wallpaper 5',
      source: require('@/assets/images/chatWallpaper-5.jpg'),
    },
    {
      id: 'wallpaper6',
      name: 'Wallpaper 6',
      source: require('@/assets/images/chatWallpaper-6.jpg'),
    },
    {
      id: 'wallpaper7',
      name: 'Wallpaper 7',
      source: require('@/assets/images/chatWallpaper-7.jpg'),
    },
    {
      id: 'wallpaper8',
      name: 'Wallpaper 8',
      source: require('@/assets/images/chatWallpaper-8.jpg'),
    },
  ];

  const solidColors = [
    { id: 'color1', color: '#0A4D3C', name: 'Dark Green' },
    { id: 'color2', color: '#5E35B1', name: 'Deep Purple' },
    { id: 'color3', color: '#C62828', name: 'Dark Red' },
    { id: 'color4', color: '#2E7D32', name: 'Green' },
    { id: 'color5', color: '#1565C0', name: 'Blue' },
    { id: 'color6', color: '#6A1B9A', name: 'Purple' },
    { id: 'color7', color: '#D84315', name: 'Orange' },
    { id: 'color8', color: '#424242', name: 'Dark Gray' },
    { id: 'color9', color: '#F06292', name: 'Pink' },
    { id: 'color10', color: '#4DB6AC', name: 'Teal' },
    { id: 'color11', color: '#9575CD', name: 'Light Purple' },
    { id: 'color12', color: '#4FC3F7', name: 'Light Blue' },
  ];

  const solidColorMap = {
    'color1': '#0A4D3C',
    'color2': '#5E35B1',
    'color3': '#C62828',
    'color4': '#2E7D32',
    'color5': '#1565C0',
    'color6': '#6A1B9A',
    'color7': '#D84315',
    'color8': '#424242',
    'color9': '#F06292',
    'color10': '#4DB6AC',
    'color11': '#9575CD',
    'color12': '#4FC3F7',
  };

  useEffect(() => {
    fetchCurrentWallpaper();
  }, []);

  const fetchCurrentWallpaper = async () => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await apiService.get('/auth/chat-wallpaper', token);
      if (response.ok) {
        const data = await response.json();
        const wallpaper = data.wallpaper || { type: 'default', id: null, customUrl: null };
        setSelectedWallpaper(wallpaper.type === 'default' ? null : wallpaper.id || wallpaper.customUrl);
      }
    } catch (error) {
      console.error('Failed to fetch current wallpaper:', error);
    }
  };

  const handleSelectWallpaper = async (wallpaperId: string, type: 'predefined' | 'solid' = 'predefined') => {
    setLoading(true);
    try {
      const token = await authStorage.getToken();
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await apiService.put(
        '/auth/chat-wallpaper',
        { type, id: wallpaperId },
        token
      );

      if (response.ok) {
        setSelectedWallpaper(wallpaperId);
        Alert.alert('Success', 'Chat wallpaper changed successfully');
      } else {
        Alert.alert('Error', 'Failed to change wallpaper');
      }
    } catch (error) {
      console.error('Failed to save wallpaper:', error);
      Alert.alert('Error', 'Failed to change wallpaper');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    Alert.alert(
      'Reset to Default',
      'Are you sure you want to reset to the default simple background?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await authStorage.getToken();
              if (!token) {
                Alert.alert('Error', 'Not authenticated');
                return;
              }

              const response = await apiService.put(
                '/auth/chat-wallpaper',
                { type: 'default' },
                token
              );

              if (response.ok) {
                setSelectedWallpaper(null);
                Alert.alert('Success', 'Chat theme reset to default');
              } else {
                Alert.alert('Error', 'Failed to reset wallpaper');
              }
            } catch (error) {
              console.error('Failed to reset wallpaper:', error);
              Alert.alert('Error', 'Failed to reset wallpaper');
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleUploadWallpaper = async () => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // Chat aspect ratio
        quality: 0.8,
      });

      if (!result.canceled) {
        setLoading(true);
        const token = await authStorage.getToken();
        if (!token) {
          Alert.alert('Error', 'Not authenticated');
          return;
        }

        // Create form data
        const formData = new FormData();
        const imageUri = result.assets[0].uri;
        const filename = imageUri.split('/').pop() || 'wallpaper.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('wallpaper', {
          uri: imageUri,
          name: filename,
          type,
        } as any);

        // Upload image
        const response = await fetch(`http://192.168.0.150:8080/api/auth/wallpaper`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type for FormData
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setSelectedWallpaper(data.wallpaper.customUrl);
          Alert.alert('Success', 'Custom wallpaper uploaded successfully');
        } else {
          const errorData = await response.json();
          Alert.alert('Error', errorData.message || 'Failed to upload wallpaper');
        }
      }
    } catch (error) {
      console.error('Failed to upload wallpaper:', error);
      Alert.alert('Error', 'Failed to upload wallpaper');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#FFFFFF' : '#0B141A' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat wallpaper</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Preview Section */}
        <View style={[styles.previewSection, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
          <View style={styles.previewContainer}>
            {/* Wallpaper Background */}
            {selectedWallpaper && (
              selectedWallpaper.startsWith('http') ? (
                <Image
                  source={{ uri: selectedWallpaper }}
                  style={styles.previewWallpaperBackground}
                  resizeMode="cover"
                />
              ) : solidColorMap[selectedWallpaper as keyof typeof solidColorMap] ? (
                <View
                  style={[styles.previewWallpaperBackground, { backgroundColor: solidColorMap[selectedWallpaper as keyof typeof solidColorMap] }]}
                />
              ) : (
                wallpapers.find(w => w.id === selectedWallpaper) && (
                  <Image
                    source={wallpapers.find(w => w.id === selectedWallpaper)!.source}
                    style={styles.previewWallpaperBackground}
                    resizeMode="cover"
                  />
                )
              )
            )}
            {/* Sample Chat Messages */}
            <View style={styles.chatPreview}>
              <View style={[styles.messageBubbleReceived, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
                <Text style={[styles.messageText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  Hey! How are you?
                </Text>
                <Text style={[styles.messageTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  10:30 AM
                </Text>
              </View>
              <View style={[styles.messageBubbleSent, { backgroundColor: '#DCF8C6' }]}>
                <Text style={[styles.messageText, { color: '#000000' }]}>
                  I'm good! Thanks for asking 😊
                </Text>
                <Text style={[styles.messageTime, { color: '#667781' }]}>
                  10:31 AM
                </Text>
              </View>
              <View style={[styles.messageBubbleReceived, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
                <Text style={[styles.messageText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  This wallpaper looks great!
                </Text>
                <Text style={[styles.messageTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  10:32 AM
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Wallpaper Options */}
        <View style={styles.section}>
          {/* Library Option */}
          <TouchableOpacity 
            style={[styles.option, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
            onPress={handleUploadWallpaper}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}>
              <Feather name="image" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                My photos
              </Text>
            </View>
            <Feather name="chevron-right" size={22} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>

          {/* Solid Colors Option */}
          <TouchableOpacity 
            style={[styles.option, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
            onPress={() => setShowSolidColors(!showSolidColors)}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}>
              <Feather name="droplet" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Solid colours
              </Text>
            </View>
            <Feather name="chevron-right" size={22} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>

          {/* Default Option */}
          <TouchableOpacity 
            style={[styles.option, styles.optionLast, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
            onPress={handleResetToDefault}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}>
              <Feather name="smartphone" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.optionContent}>
              <Text style={[styles.optionTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Default
              </Text>
            </View>
            {!selectedWallpaper && (
              <Feather name="check" size={22} color={isLightMode ? '#25D366' : '#00A884'} />
            )}
          </TouchableOpacity>
        </View>

        {/* Solid Colors Section */}
        {showSolidColors && (
          <>
            <View style={[styles.sectionHeader, { backgroundColor: isLightMode ? '#F0F2F5' : '#0B141A' }]}>
              <Text style={[styles.sectionHeaderText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                SOLID COLOURS
              </Text>
            </View>

            <View style={styles.colorGrid}>
              {solidColors.map((color) => {
                const isSelected = selectedWallpaper === color.id;
                return (
                  <TouchableOpacity
                    key={color.id}
                    style={styles.colorItem}
                    onPress={() => handleSelectWallpaper(color.id, 'solid')}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.colorCircle, { backgroundColor: color.color }]}>
                      {isSelected && (
                        <View style={styles.colorSelectedBadge}>
                          <Feather name="check" size={20} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Light Wallpapers Section */}
        <View style={[styles.sectionHeader, { backgroundColor: isLightMode ? '#F0F2F5' : '#0B141A' }]}>
          <Text style={[styles.sectionHeaderText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            LIGHT WALLPAPERS
          </Text>
        </View>

        <View style={styles.wallpaperGrid}>
          {wallpapers.slice(0, 4).map((wallpaper) => {
            const isSelected = selectedWallpaper === wallpaper.id;
            return (
              <TouchableOpacity
                key={wallpaper.id}
                style={styles.wallpaperItem}
                onPress={() => handleSelectWallpaper(wallpaper.id)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Image
                  source={wallpaper.source}
                  style={styles.wallpaperImage}
                  resizeMode="cover"
                />
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <View style={styles.selectedBadgeInner}>
                      <Feather name="check" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dark Wallpapers Section */}
        <View style={[styles.sectionHeader, { backgroundColor: isLightMode ? '#F0F2F5' : '#0B141A' }]}>
          <Text style={[styles.sectionHeaderText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            DARK WALLPAPERS
          </Text>
        </View>

        <View style={styles.wallpaperGrid}>
          {wallpapers.slice(4, 8).map((wallpaper) => {
            const isSelected = selectedWallpaper === wallpaper.id;
            return (
              <TouchableOpacity
                key={wallpaper.id}
                style={styles.wallpaperItem}
                onPress={() => handleSelectWallpaper(wallpaper.id)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Image
                  source={wallpaper.source}
                  style={styles.wallpaperImage}
                  resizeMode="cover"
                />
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <View style={styles.selectedBadgeInner}>
                      <Feather name="check" size={16} color="#FFFFFF" />
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 20 }} />
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  headerPlaceholder: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  wallpaperGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  wallpaperItem: {
    width: '33.33%',
    aspectRatio: 0.75,
    padding: 4,
    position: 'relative',
  },
  wallpaperImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewSection: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  previewWallpaperBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chatPreview: {
    paddingVertical: 16,
  },
  messageBubbleReceived: {
    maxWidth: '75%',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleSent: {
    maxWidth: '75%',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  colorItem: {
    width: '25%',
    aspectRatio: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  colorSelectedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});