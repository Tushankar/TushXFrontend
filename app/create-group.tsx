import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authStorage } from '../utils/authStorage';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [step, setStep] = useState<'details' | 'members'>('details');
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setGroupImage(result.assets[0].uri);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch('http://192.168.0.150:8080/api/auth/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    try {
      setLoading(true);
      const token = await authStorage.getToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('name', groupName);
      formData.append('description', groupDescription);
      formData.append('members', JSON.stringify(selectedMembers));

      if (groupImage) {
        const filename = groupImage.split('/').pop() || 'group.jpg';
        formData.append('groupImage', {
          uri: groupImage,
          type: 'image/jpeg',
          name: filename,
        } as any);
      }

      const response = await fetch('http://192.168.0.150:8080/api/auth/groups', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        Alert.alert('Success', 'Group created successfully');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to create group');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (step === 'details') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
            {groupImage ? (
              <Image source={{ uri: groupImage }} style={styles.groupImage} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942' }]}>
                <Feather name="camera" size={32} color={isLightMode ? '#54656F' : '#8696A0'} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
              placeholder="Group name (required)"
              placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={25}
            />
            <Text style={[styles.charCount, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              {groupName.length}/25
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
              placeholder="Group description (optional)"
              placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
              value={groupDescription}
              onChangeText={setGroupDescription}
              multiline
              maxLength={100}
            />
            <Text style={[styles.charCount, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              {groupDescription.length}/100
            </Text>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}
          onPress={() => {
            if (!groupName.trim()) {
              Alert.alert('Error', 'Please enter a group name');
              return;
            }
            loadUsers();
            setStep('members');
          }}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Feather name="arrow-right" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => setStep('details')} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Add Members</Text>
          <Text style={styles.headerSubtitle}>{selectedMembers.length} selected</Text>
        </View>
        <TouchableOpacity onPress={createGroup} disabled={loading}>
          <Feather name="check" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942' }]}>
          <Feather name="search" size={20} color={isLightMode ? '#667781' : '#8696A0'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search contacts..."
            placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={isLightMode ? '#075E54' : '#00A884'} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const isSelected = selectedMembers.includes(item._id);
            return (
              <TouchableOpacity
                style={[styles.userItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                onPress={() => toggleMember(item._id)}
              >
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 20, color: isLightMode ? '#54656F' : '#8696A0' }}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
                  {item.bio && <Text style={[styles.userBio, { color: isLightMode ? '#667781' : '#8696A0' }]} numberOfLines={1}>{item.bio}</Text>}
                </View>
                <View style={[styles.checkbox, isSelected && { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}>
                  {isSelected && <Feather name="check" size={16} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  groupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  userBio: {
    fontSize: 14,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8696A0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
