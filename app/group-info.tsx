import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { authStorage } from '../utils/authStorage';

interface User {
  _id: string;
  name: string;
  avatarUrl?: string;
}

interface GroupData {
  _id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  admin: {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  members: User[];
}

export default function GroupInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as any;
  const groupId = params.groupId as string;
  const { colors } = useTheme();

  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<Set<string>>(new Set());
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';

  useEffect(() => {
    const loadGroupInfo = async () => {
      try {
        setLoading(true);
        const token = await authStorage.getToken();
        if (!token) {
          router.replace('/');
          return;
        }

        const profileResponse = await fetch('http://192.168.0.150:8080/api/auth/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setCurrentUserId(profileData.user.id);
        }

        // Fetch group info
        const response = await fetch(`http://192.168.0.150:8080/api/auth/groups/${groupId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setGroupData(data.group);
        }

        // Fetch all users
        const usersResponse = await fetch('http://192.168.0.150:8080/api/auth/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setAllUsers(usersData.users || []);
        }
      } catch (error) {
        console.error('Error loading group info:', error);
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      loadGroupInfo();
    }
  }, [groupId]);

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Remove ${memberName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await authStorage.getToken();
              const response = await fetch(
                `http://192.168.0.150:8080/api/auth/groups/${groupId}/members/${memberId}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                const data = await response.json();
                setGroupData(data.group);
                Alert.alert('Success', 'Member removed successfully');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await authStorage.getToken();
              const response = await fetch(
                `http://192.168.0.150:8080/api/auth/groups/${groupId}/leave`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );

              if (response.ok) {
                Alert.alert('Success', 'You have left the group', [
                  {
                    text: 'OK',
                    onPress: () => router.back(),
                  },
                ]);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.size === 0) {
      Alert.alert('Info', 'Please select at least one member');
      return;
    }

    try {
      setIsAddingMembers(true);
      const token = await authStorage.getToken();
      const memberIds = Array.from(selectedNewMembers);

      const response = await fetch(
        `http://192.168.0.150:8080/api/auth/groups/${groupId}/members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberIds }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGroupData(data.group);
        setSelectedNewMembers(new Set());
        setShowAddMembersModal(false);
        Alert.alert('Success', 'Members added successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to add members');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add members');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const toggleMemberSelection = (userId: string) => {
    const newSelection = new Set(selectedNewMembers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedNewMembers(newSelection);
  };

  // Get users that are not already in the group
  const availableUsers = allUsers.filter(
    (user) =>
      !groupData?.members.some((member) => member._id === user._id) &&
      user._id !== currentUserId
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Info</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isLightMode ? '#075E54' : '#00A884'} />
        </View>
      </View>
    );
  }

  if (!groupData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group Info</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Group not found</Text>
        </View>
      </View>
    );
  }

  const isAdmin = groupData.admin._id === currentUserId;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Group Header */}
        <View style={styles.groupHeaderContainer}>
          {groupData.avatarUrl ? (
            <Image source={{ uri: groupData.avatarUrl }} style={styles.groupImage} />
          ) : (
            <View style={[styles.groupImage, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[styles.groupImageText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                {groupData.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.groupName, { color: colors.text }]}>{groupData.name}</Text>
          {groupData.description && (
            <Text style={[styles.groupDescription, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              {groupData.description}
            </Text>
          )}
        </View>

        {/* Members Section */}
        <View style={[styles.section, { backgroundColor: isLightMode ? '#F7F8FA' : '#1F2C34' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isLightMode ? '#075E54' : '#00A884' }]}>
              Members ({groupData.members.length})
            </Text>
            {isAdmin && availableUsers.length > 0 && (
              <TouchableOpacity onPress={() => setShowAddMembersModal(true)} style={styles.addButton}>
                <Feather name="plus" size={20} color={isLightMode ? '#075E54' : '#00A884'} />
              </TouchableOpacity>
            )}
          </View>
          {groupData.members.map((member, index) => (
            <View
              key={member._id}
              style={[
                styles.memberItem,
                {
                  borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942',
                  borderBottomWidth: index < groupData.members.length - 1 ? 1 : 0,
                },
              ]}
            >
              {member.avatarUrl ? (
                <Image source={{ uri: member.avatarUrl }} style={styles.memberAvatar} />
              ) : (
                <View
                  style={[
                    styles.memberAvatar,
                    { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942', justifyContent: 'center', alignItems: 'center' },
                  ]}
                >
                  <Text style={[styles.memberAvatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>{member.name}</Text>
                {groupData.admin._id === member._id && (
                  <Text style={[styles.adminBadge, { color: isLightMode ? '#075E54' : '#00A884' }]}>Admin</Text>
                )}
              </View>
              {isAdmin && member._id !== currentUserId && (
                <TouchableOpacity onPress={() => handleRemoveMember(member._id, member.name)}>
                  <Feather name="x" size={20} color="#E74C3C" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Group Info */}
        <View style={[styles.section, { backgroundColor: isLightMode ? '#F7F8FA' : '#1F2C34' }]}>
          <Text style={[styles.sectionTitle, { color: isLightMode ? '#075E54' : '#00A884' }]}>Group Settings</Text>
          <View style={styles.infoItem}>
            <Feather name="hash" size={20} color={isLightMode ? '#667781' : '#8696A0'} style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: isLightMode ? '#667781' : '#8696A0' }]}>Group ID</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{groupId}</Text>
            </View>
          </View>
        </View>

        {/* Leave Group */}
        <TouchableOpacity
          style={[styles.leaveButton, { backgroundColor: '#E74C3C' }]}
          onPress={handleLeaveGroup}
        >
          <Feather name="log-out" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.leaveButtonText}>Leave Group</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Members Modal */}
      <Modal visible={showAddMembersModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowAddMembersModal(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Add Members</Text>
                  <TouchableOpacity onPress={() => setShowAddMembersModal(false)}>
                    <Feather name="x" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={availableUsers}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.userItem,
                        {
                          borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942',
                          backgroundColor: selectedNewMembers.has(item._id)
                            ? isLightMode
                              ? '#E8F5E9'
                              : '#1B5E20'
                            : 'transparent',
                        },
                      ]}
                      onPress={() => toggleMemberSelection(item._id)}
                    >
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
                      ) : (
                        <View
                          style={[
                            styles.userAvatar,
                            { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942', justifyContent: 'center', alignItems: 'center' },
                          ]}
                        >
                          <Text style={[styles.userAvatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                            {item.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.userName, { color: colors.text, flex: 1 }]}>{item.name}</Text>
                      {selectedNewMembers.has(item._id) && (
                        <Feather name="check" size={20} color={isLightMode ? '#075E54' : '#00A884'} />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyList}>
                      <Text style={[styles.emptyListText, { color: colors.text }]}>No available users to add</Text>
                    </View>
                  }
                  scrollEnabled={true}
                  style={styles.userList}
                />

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                    onPress={() => setShowAddMembersModal(false)}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}
                    onPress={handleAddMembers}
                    disabled={isAddingMembers || selectedNewMembers.size === 0}
                  >
                    {isAddingMembers ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalButtonTextPrimary}>Add ({selectedNewMembers.size})</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  groupHeaderContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
  },
  groupImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  groupImageText: {
    fontSize: 48,
    fontWeight: '600',
  },
  groupName: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  groupDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  addButton: {
    padding: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 20,
    fontWeight: '500',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  adminBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  leaveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  userList: {
    maxHeight: 350,
    paddingHorizontal: 0,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '500',
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyListText: {
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
