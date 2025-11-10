import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../constants/ThemeContext';
import { apiService } from '../utils/api';
import { setProfileLocal } from '../utils/profileStore';
import { authStorage } from '../utils/authStorage';
const PREDEFINED_BIOS = [
  "Hey there! I'm using WhatsApp",
  "Available",
  "Busy",
  "At work",
  "At the gym",
  "Sleeping",
  "In a meeting",
  "Driving",
  "On vacation",
  "Custom bio...",
];
export default function ProfileScreen() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [customBio, setCustomBio] = useState<string | undefined>(undefined);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarDataUri, setAvatarDataUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';

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
  useEffect(() => {
    fetchProfile();
  }, []);
  const fetchProfile = async () => {
    try {
      const token = await authStorage.getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      const response = await apiService.getProfile(token);
      setProfile(response.user);
      setName(response.user.name || '');
      setBio(response.user.bio || '');
      setAvatarUrl(response.user.avatarUrl || '');
      setAvatarDataUri(null);
    } catch (err) {
      console.error('Failed to load profile', err);
      // If token is invalid, redirect to login
      if (err instanceof Error && err.message.includes('Invalid token')) {
        await authStorage.removeToken();
        router.replace('/');
      }
    }
  };
  const saveProfile = async () => {
    setLoading(true);
    try {
      // Client-side validation
      const trimmedName = name?.trim();
      if (trimmedName && (trimmedName.length < 1 || trimmedName.length > 50)) {
        Alert.alert('Invalid name', 'Name must be between 1 and 50 characters');
        setLoading(false);
        return;
      }

      if (bio && bio.length > 139) {
        Alert.alert('Invalid bio', 'Bio must be less than 140 characters');
        setLoading(false);
        return;
      }
      const token = await authStorage.getToken();
      if (!token) {
        router.replace('/');
        return;
      }

    // Always include current name and bio so server receives intended values.
    const updateData: any = {};
    const trimmedBio = bio?.trim();
    if (trimmedName !== undefined) updateData.name = trimmedName;
    if (trimmedBio !== undefined) updateData.bio = trimmedBio;
      // If a new avatar was picked, first upload it to the server to get a public URL
      if (avatarDataUri) {
        try {
          const uploadRes = await apiService.uploadAvatar(token, avatarDataUri);
          // uploadRes.avatarUrl should be the public HTTP URL
          if (uploadRes && uploadRes.avatarUrl) {
            updateData.avatarUrl = uploadRes.avatarUrl;
          } else if (uploadRes && uploadRes.user && uploadRes.user.avatarUrl) {
            updateData.avatarUrl = uploadRes.user.avatarUrl;
          } else {
            // fallback to sending local uri (not ideal)
            updateData.avatarUrl = avatarDataUri;
          }
        } catch (err) {
          console.error('Avatar upload failed', err);
          Alert.alert('Error', 'Failed to upload avatar');
          setLoading(false);
          return;
        }
      }

  console.log('Profile.saveProfile - updateData:', updateData);
  const response = await apiService.updateProfile(token, updateData);
  console.log('Profile.saveProfile - server response:', response);

      setProfile(response.user);
      // Publish updated profile for other screens (Settings) to pick up
      try {
        setProfileLocal(response.user);
      } catch (err) {
        console.error('Failed to publish profile update', err);
      }
      setAvatarUrl(response.user.avatarUrl || '');
      setAvatarDataUri(null);
      setIsEditingName(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (err: any) {
      console.error('Failed to update profile', err);
      Alert.alert('Error', err.message || 'Unable to update profile');
    } finally {
      setLoading(false);
    }
  };
  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      // Show options
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled) {
                await processAndSaveImage(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choose from Gallery',
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });

              if (!result.canceled) {
                await processAndSaveImage(result.assets[0].uri);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const processAndSaveImage = async (uri: string) => {
    try {
      // Create a unique filename
      const fileName = `avatar_${Date.now()}.jpg`;
      const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

      // Copy the image to app's document directory
      await FileSystem.copyAsync({
        from: uri,
        to: destinationUri,
      });

      // Set the persistent URI
      setAvatarDataUri(destinationUri);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image');
    }
  };
  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#FFFFFF' : '#0B141A' }]}>
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={[styles.avatarSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.avatarContainer}>
            {avatarDataUri ? (
              <Image source={{ uri: avatarDataUri }} style={styles.avatar} />
            ) : avatarUrl ? (
              <Image key={avatarUrl} source={{ uri: `${avatarUrl}?t=${Date.now()}` }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: getAvatarColor(name) }]}>
                <Text style={styles.avatarText}>
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}
              onPress={pickImage}
            >
              <Feather name="camera" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Name Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.infoSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.infoLabel, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Name
            </Text>
            <TouchableOpacity onPress={async () => {
              // If currently editing, save changes when user taps the check
              if (isEditingName) {
                await saveProfile();
              } else {
                setIsEditingName(true);
              }
            }}>
              <Feather
                name={isEditingName ? "check" : "edit-2"}
                size={20}
                color={isLightMode ? '#00A884' : '#00A884'}
              />
            </TouchableOpacity>
          </View>
          {isEditingName ? (
            <TextInput
              style={[styles.editInput, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
              autoFocus
            />
          ) : (
            <Text style={[styles.infoValue, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
              {name || 'Add your name'}
            </Text>
          )}
          <Text style={[styles.infoHint, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            This is not your username or pin. This name will be visible to your WhatsApp contacts.
          </Text>
        </View>
        {/* Bio Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.infoSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.infoLabel, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              About
            </Text>
            <TouchableOpacity onPress={() => setShowBioModal(true)}>
              <Feather name="edit-2" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.infoValue, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
            {bio || "Hey there! I'm using WhatsApp"}
          </Text>
        </View>
        {/* Email Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.infoSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.infoLabel, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              Email
            </Text>
          </View>
          <Text style={[styles.infoValue, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
            {profile?.email || 'Loading...'}
          </Text>
          <Text style={[styles.infoHint, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            Your email address is private and cannot be changed.
          </Text>
        </View>
        {/* Theme Section */}
        <View style={styles.sectionGap} />
        <TouchableOpacity
          style={[styles.themeSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
          onPress={toggleTheme}
        >
          <View style={styles.themeSectionContent}>
            <View style={styles.themeLeft}>
              <Feather
                name={theme === 'light' ? 'sun' : 'moon'}
                size={20}
                color={isLightMode ? '#54656F' : '#8696A0'}
              />
              <Text style={[styles.themeText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Theme
              </Text>
            </View>
            <View style={styles.themeRight}>
              <Text style={[styles.themeValue, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                {theme === 'light' ? 'Light' : 'Dark'}
              </Text>
              <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
            </View>
          </View>
        </TouchableOpacity>
        {/* Save Button */}
        {(avatarDataUri || isEditingName || (name !== profile?.name) || (bio !== profile?.bio)) && (
          <>
            <View style={styles.sectionGap} />
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                onPress={() => {
                  // Reset changes
                  setName(profile?.name || '');
                  setBio(profile?.bio || '');
                  setAvatarDataUri(null);
                  setIsEditingName(false);
                  setCustomBio(undefined);
                }}
              >
                <Text style={[styles.cancelText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}
                onPress={saveProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={20} color="#FFFFFF" />
                    <Text style={styles.saveText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
        {/* Footer Space */}
        <View style={{ height: 40 }} />
      </ScrollView>
      {/* Bio Modal */}
      <Modal visible={showBioModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                About
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCustomBio(undefined);
                  setShowBioModal(false);
                }}
              >
                <Feather name="x" size={24} color={isLightMode ? '#000000' : '#E9EDEF'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.bioList} showsVerticalScrollIndicator={false}>
              {PREDEFINED_BIOS.map((presetBio, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.bioOption,
                    { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }
                  ]}
                  onPress={() => {
                    if (presetBio === 'Custom bio...') {
                      setCustomBio(bio);
                    } else {
                      setBio(presetBio);
                      setShowBioModal(false);
                    }
                  }}
                >
                  <Text style={[styles.bioOptionText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                    {presetBio}
                  </Text>
                  {bio === presetBio && (
                    <Feather name="check" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {customBio !== undefined && (
              <View style={[styles.customBioContainer, { borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
                <Text style={[styles.customBioLabel, { color: isLightMode ? '#00A884' : '#00A884' }]}>
                  Custom Status
                </Text>
                <TextInput
                  style={[
                    styles.customBioInput,
                    {
                      backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942',
                      color: isLightMode ? '#000000' : '#E9EDEF',
                      borderColor: isLightMode ? '#E9EDEF' : '#2A3942'
                    }
                  ]}
                  value={customBio}
                  onChangeText={setCustomBio}
                  placeholder="Type your status..."
                  placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                  maxLength={139}
                  multiline
                  autoFocus
                />
                <Text style={[styles.charCount, { color: isLightMode ? '#8696A0' : '#667781' }]}>
                  {customBio.length}/139
                </Text>
                <View style={styles.customBioButtons}>
                  <TouchableOpacity
                    style={[styles.customBioButtonCancel, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                    onPress={() => setCustomBio(undefined)}
                  >
                    <Text style={[styles.customBioButtonCancelText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.customBioButtonSave, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}
                    onPress={() => {
                      setBio(customBio);
                      setCustomBio(undefined);
                      setShowBioModal(false);
                    }}
                  >
                    <Text style={styles.customBioButtonSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '500',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  sectionGap: {
    height: 8,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 17,
    marginBottom: 8,
  },
  editInput: {
    fontSize: 17,
    marginBottom: 8,
    paddingVertical: 4,
  },
  infoHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  themeSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  themeSectionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  themeText: {
    fontSize: 17,
  },
  themeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeValue: {
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  bioList: {
    maxHeight: 300,
  },
  bioOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  bioOptionText: {
    fontSize: 16,
  },
  customBioContainer: {
    marginTop: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  customBioLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  customBioInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 12,
  },
  customBioButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  customBioButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  customBioButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  customBioButtonSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  customBioButtonSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});