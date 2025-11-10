import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { io } from 'socket.io-client';
import { apiService } from '../utils/api';
import { authStorage } from '../utils/authStorage';
export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [openPasswordModalVisible, setOpenPasswordModalVisible] = useState(false);
  const [openPassword, setOpenPassword] = useState('');
  const [showOpenPassword, setShowOpenPassword] = useState(false);
  const [pendingOpenUser, setPendingOpenUser] = useState<any>(null);
  const [unlockPasswordModalVisible, setUnlockPasswordModalVisible] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [pendingUnlockUser, setPendingUnlockUser] = useState<any>(null);
  const [socket, setSocket] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuUser, setMenuUser] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'archived' | 'favourites' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      
      // Get token
      const token = await authStorage.getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      // Fetch current user profile
      const profileResponse = await apiService.getProfile(token);
      const currentUserDataFetched = profileResponse.user;

      // Fetch all users
      let allUsers = [];
      try {
        const response = await fetch('http://192.168.0.150:8080/api/auth/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        allUsers = data.users || [];
      } catch (err) {
        console.log('Could not fetch users list:', err);
        allUsers = [];
      }

      // Filter out current user by ID
      const filteredUsers = allUsers.filter((user: any) => user._id !== currentUserDataFetched.id);

      // Create current user data with actual profile data
      const currentUserData = {
        id: currentUserDataFetched.id,
        name: currentUserDataFetched.name,
        email: currentUserDataFetched.email,
        pinned: currentUserDataFetched.pinned || [],
        archived: currentUserDataFetched.archived || [],
        favourites: currentUserDataFetched.favourites || [],
        locked: currentUserDataFetched.locked || []
      };
      setCurrentUser(currentUserData);
      // Fetch conversations data
      let conversationsData = { conversations: [] };
      try {
        const convResponse = await fetch('http://192.168.0.150:8080/api/auth/conversations', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (convResponse.ok) {
          conversationsData = await convResponse.json();
        }
      } catch (err) {
        console.log('Could not fetch conversations:', err);
      }

      // Create map of conversations
      const convMap = new Map();
      conversationsData.conversations.forEach((conv: any) => {
        convMap.set(conv.userId, { lastMessage: conv.lastMessage, lastMessageTime: conv.lastMessageTime, unseenCount: conv.unseenCount });
      });
      const mergedUsers = filteredUsers.map((user: any) => ({
        ...user,
        lastMessage: convMap.get(user._id)?.lastMessage || null,
        lastMessageTime: convMap.get(user._id)?.lastMessageTime || null,
        unseenCount: convMap.get(user._id)?.unseenCount || 0
      }));
      
      mergedUsers.sort((a: any, b: any) => {
        const aPinned = (currentUserData as any)?.pinned?.includes(a._id) ? 1 : 0;
        const bPinned = (currentUserData as any)?.pinned?.includes(b._id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        if (a.lastMessageTime) return -1;
        if (b.lastMessageTime) return 1;
        return a.name.localeCompare(b.name);
      });
      setUsers(mergedUsers);
      // Socket setup for real-time updates
      if (!socket && currentUserData?.id) {
        const newSocket = io('http://192.168.0.150:8080', {
          auth: { token },
          transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
          console.log('Dashboard connected to socket');
        });

        newSocket.on('messageStatusUpdate', (data: { messageId: string, status: string }) => {
          console.log('Dashboard received message status update:', data);
          // Refresh conversations when message status changes
          loadUsers();
        });

        newSocket.on('receiveMessage', (messageData: any) => {
          console.log('Dashboard received new message:', messageData);
          // Immediately update the conversation data for the sender
          setUsers(prev => {
            const updated = prev.map(user => {
              if (user._id === messageData.from) {
                return {
                  ...user,
                  lastMessage: messageData.message,
                  lastMessageTime: new Date(messageData.timestamp),
                  unseenCount: user.unseenCount + 1
                };
              }
              return user;
            });
            
            // Re-sort the updated list
            const currentUserData = currentUser;
            return updated.sort((a: any, b: any) => {
              const aPinned = currentUserData?.pinned?.includes(a._id) ? 1 : 0;
              const bPinned = currentUserData?.pinned?.includes(b._id) ? 1 : 0;
              if (aPinned !== bPinned) return bPinned - aPinned;
              if (a.lastMessageTime && b.lastMessageTime) {
                return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
              }
              if (a.lastMessageTime) return -1;
              if (b.lastMessageTime) return 1;
              return a.name.localeCompare(b.name);
            });
          });
        });

        newSocket.on('conversationUpdate', (data: { userId: string, action: string }) => {
          console.log('Dashboard received conversation update:', data);
          // Refresh conversations when messages are read or other updates
          loadUsers();
        });

        setSocket(newSocket);
      }
    } catch (error) {
      setErrorMessage('Unable to load users. Pull to refresh or try again later.');
    } finally {
      setLoading(false);
    }
  }, [router]);
  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers])
  );
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);
  const handleSearch = () => {
    setIsSearching(!isSearching);
    if (isSearching) {
      setSearchQuery('');
    }
  };
  const handleArchive = async () => {
    if (!menuUser || !currentUser) return;
    try {
      const isArchived = currentUser.archived?.includes(menuUser._id);
      const updatedArchived = isArchived
        ? (currentUser.archived || []).filter((id: string) => id !== menuUser._id)
        : [...(currentUser.archived || []), menuUser._id];
      await updateProfile({ archived: updatedArchived });
      Alert.alert('Success', isArchived ? 'Chat unarchived' : 'Chat archived successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to archive chat');
    }
    setShowMenu(false);
  };
  const handleMarkRead = async () => {
    if (!menuUser) return;
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch(`http://192.168.0.150:8080/api/auth/conversations/${menuUser._id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      // Update local state
      setUsers(prev => prev.map(u => u._id === menuUser._id ? { ...u, unseenCount: 0 } : u));
      Alert.alert('Success', 'Marked as read');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark as read');
    }
    setShowMenu(false);
  };

  const handleMarkUnread = async () => {
    if (!menuUser) return;
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch(`http://192.168.0.150:8080/api/auth/conversations/${menuUser._id}/unread`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark as unread');
      }

      // Refresh users to update unseen count
      loadUsers();
      Alert.alert('Success', 'Marked as unread');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark as unread');
    }
    setShowMenu(false);
  };
  const handleFavourite = async () => {
    if (!menuUser || !currentUser) return;
    try {
      const isFav = currentUser.favourites?.includes(menuUser._id);
      const updatedFavourites = isFav
        ? (currentUser.favourites || []).filter((id: string) => id !== menuUser._id)
        : [...(currentUser.favourites || []), menuUser._id];
      await updateProfile({ favourites: updatedFavourites });
      Alert.alert('Success', isFav ? 'Removed from favourites' : 'Chat added to favourites');
    } catch (error) {
      Alert.alert('Error', 'Failed to add to favourites');
    }
    setShowMenu(false);
  };
  const handleLock = async () => {
    if (!menuUser || !currentUser) return;
    try {
      const isLocked = currentUser.locked?.includes(menuUser._id);
      if (isLocked) {
        setShowMenu(false);
        setPendingUnlockUser(menuUser);
        setUnlockPassword('');
        setShowUnlockPassword(false);
        setUnlockPasswordModalVisible(true);
      } else {
        const updatedLocked = [...(currentUser.locked || []), menuUser._id];
        await updateProfile({ locked: updatedLocked });
        Alert.alert('Success', 'Chat locked successfully');
        setShowMenu(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to lock chat');
      setShowMenu(false);
    }
  };
  const handlePin = async () => {
    if (!menuUser || !currentUser) return;
    try {
      const isPinned = currentUser.pinned?.includes(menuUser._id);
      const updatedPinned = isPinned
        ? (currentUser.pinned || []).filter((id: string) => id !== menuUser._id)
        : [...(currentUser.pinned || []), menuUser._id];
      await updateProfile({ pinned: updatedPinned });
      Alert.alert('Success', isPinned ? 'Chat unpinned' : 'Chat pinned');
    } catch (error) {
      Alert.alert('Error', 'Failed to update pin status');
    }
    setShowMenu(false);
  };
  const menuUserId = menuUser?._id ?? menuUser?.id ?? null;
  const menuIsArchived = Boolean(menuUserId && (currentUser?.archived || []).includes(menuUserId));
  const menuIsFavourite = Boolean(menuUserId && (currentUser?.favourites || []).includes(menuUserId));
  const menuIsLocked = Boolean(menuUserId && (currentUser?.locked || []).includes(menuUserId));
  const menuIsPinned = Boolean(menuUserId && (currentUser?.pinned || []).includes(menuUserId));
  const openChat = async (user: any) => {
    if (!user) return;
    const isLocked = currentUser?.locked?.includes(user._id);
    if (isLocked) {
      setPendingOpenUser(user);
      setOpenPassword('');
      setOpenPasswordModalVisible(true);
      return;
    }
    router.push(('/chat?userId=' + user._id + '&userName=' + encodeURIComponent(user.name)) as any);
  };
  const updateProfile = async (updates: any) => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch('http://192.168.0.150:8080/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();
      setCurrentUser(data.user);
      setUsers(prev => {
        const sorted = [...prev].sort((a: any, b: any) => {
          const currentUserData = data.user;
          const aPinned = currentUserData?.pinned?.includes(a._id) ? 1 : 0;
          const bPinned = currentUserData?.pinned?.includes(b._id) ? 1 : 0;
          if (aPinned !== bPinned) return bPinned - aPinned;
          if (a.lastMessageTime && b.lastMessageTime) {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          }
          if (a.lastMessageTime) return -1;
          if (b.lastMessageTime) return 1;
          return a.name.localeCompare(b.name);
        });
        return sorted;
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';
  const [activeTab, setActiveTab] = useState('chats');
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIcon} onPress={() => {}}>
              <Feather name="camera" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} onPress={handleSearch}>
              <Feather name="search" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => router.push('/settings' as any)}
            >
              <Feather name="more-vertical" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        {/* Search Input */}
        {isSearching && (
          <View style={[styles.searchContainer, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
            <View style={[styles.searchInputContainer, { backgroundColor: isLightMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.1)' }]}>
              <Feather name="search" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search chats..."
                placeholderTextColor="rgba(255, 255, 255, 0.7)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <Feather name="x" size={20} color="rgba(255, 255, 255, 0.7)" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('favourites')}
            style={[styles.filterTab, filter === 'favourites' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === 'favourites' && styles.filterTabTextActive]}>Favourites</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('locked')}
            style={[styles.filterTab, filter === 'locked' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === 'locked' && styles.filterTabTextActive]}>Locked</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('archived')}
            style={[styles.filterTab, filter === 'archived' && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, filter === 'archived' && styles.filterTabTextActive]}>Archived</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={isLightMode ? '#075E54' : '#00A884'} />
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]} onPress={loadUsers}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {(() => {
            const filteredUsers = users.filter(user => {
              if (user._id === currentUser?.id) return false;
              
              // First filter by category
              let passesCategoryFilter = false;
              switch (filter) {
                case 'all': passesCategoryFilter = !currentUser?.archived?.includes(user._id); break;
                case 'archived': passesCategoryFilter = currentUser?.archived?.includes(user._id); break;
                case 'favourites': passesCategoryFilter = currentUser?.favourites?.includes(user._id); break;
                case 'locked': passesCategoryFilter = currentUser?.locked?.includes(user._id); break;
                default: passesCategoryFilter = !currentUser?.archived?.includes(user._id); break;
              }
              
              // Then filter by search query
              const passesSearchFilter = !searchQuery || 
                user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase()));
              
              return passesCategoryFilter && passesSearchFilter;
            });
            if (filteredUsers.length === 0) {
              return (
                <View style={styles.noResultsContainer}>
                  <Feather name="search" size={48} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.noResultsText, { color: colors.text }]}>No results found</Text>
                  <Text style={[styles.noResultsSubtext, { color: isLightMode ? '#667781' : '#8696A0' }]}>Try adjusting your search or filter</Text>
                </View>
              );
            }
            return filteredUsers.map((user) => (
              <TouchableOpacity
                key={user._id || user.email}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openChat(user);
                }}
                onLongPress={() => {
                  setMenuUser(user);
                  setShowMenu(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <View style={[styles.chatItem, { backgroundColor: colors.background, borderBottomColor: isLightMode ? '#E9EDEF' : '#1F2C34' }]}>
                  <TouchableOpacity onPress={() => {
                    if (user.avatarUrl && user.avatarUrl.trim()) {
                      setSelectedUser(user);
                      setModalVisible(true);
                    }
                  }}>
                    {user.avatarUrl && user.avatarUrl.trim() ? (
                      <Image
                        source={{ uri: user.avatarUrl }}
                        style={styles.avatar}
                        onError={() => console.log('Image load error for user:', user.name)}
                      />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 24, fontWeight: '500', color: isLightMode ? '#54656F' : '#8696A0' }}>
                          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                      <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <View style={styles.chatMeta}>
                        {/* Time moved to footer */}
                      </View>
                    </View>
                    <View style={styles.chatFooter}>
                      <View style={styles.chatStatusRow}>
                        {currentUser?.pinned?.includes(user._id) && (
                          <Feather name="map-pin" size={14} color={isLightMode ? '#667781' : '#8696A0'} style={{ marginRight: 4 }} />
                        )}
                        {currentUser?.locked?.includes(user._id) && (
                          <Feather name="lock" size={14} color={isLightMode ? '#667781' : '#8696A0'} style={{ marginRight: 4 }} />
                        )}
                        <Text style={[styles.chatPreview, { color: isLightMode ? '#667781' : '#8696A0' }]} numberOfLines={1}>
                          {user.lastMessage || 'Tap to open chat'}
                        </Text>
                        {user.lastMessageTime && (
                          <Text style={[styles.chatTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                            {new Date(user.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        )}
                      </View>
                      {user.unseenCount > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}>
                          <Text style={styles.unreadCount}>{user.unseenCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ));
          })()}
        </ScrollView>
      )}
      {/* Avatar Preview Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            {selectedUser && selectedUser.avatarUrl && (
              <>
                <Image
                  source={{ uri: selectedUser.avatarUrl }}
                  style={styles.modalAvatar}
                  resizeMode="cover"
                />
                <Text style={[styles.modalName, { color: colors.text }]}>{selectedUser.name}</Text>
                {selectedUser.bio && (
                  <Text style={[styles.modalBio, { color: isLightMode ? '#667781' : '#8696A0' }]}>{selectedUser.bio}</Text>
                )}
              </>
            )}
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Open Password Modal */}
      <Modal
        visible={openPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpenPasswordModalVisible(false);
          setPendingOpenUser(null);
          setOpenPassword('');
          setShowOpenPassword(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setOpenPasswordModalVisible(false);
            setPendingOpenUser(null);
            setOpenPassword('');
            setShowOpenPassword(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.passwordModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]} onPress={() => {}}>
            <Text style={[styles.passwordTitle, { color: colors.text }]}>Protected chat</Text>
            <Text style={[styles.passwordSubtitle, { color: isLightMode ? '#667781' : '#8696A0' }]}>This chat is locked. Enter your account password to continue.</Text>
            <View style={[styles.passwordInputContainer, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942', backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942' }]}>
              <TextInput
                style={[styles.passwordInputField, { color: colors.text }]}
                value={openPassword}
                onChangeText={setOpenPassword}
                placeholder="Password"
                placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
                secureTextEntry={!showOpenPassword}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowOpenPassword(s => !s)}
                style={styles.eyeIcon}
              >
                <Feather name={showOpenPassword ? 'eye-off' : 'eye'} size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordActions}>
              <TouchableOpacity
                style={[styles.passwordButton, styles.cancelButton, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                onPress={() => {
                  setOpenPasswordModalVisible(false);
                  setPendingOpenUser(null);
                  setOpenPassword('');
                  setShowOpenPassword(false);
                }}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passwordButton, styles.verifyButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}
                onPress={async () => {
                  try {
                    // Mock password verification - always succeed for demo
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const data = { valid: true };
                    if (data && data.valid === true) {
                      setOpenPasswordModalVisible(false);
                      const user = pendingOpenUser;
                      setPendingOpenUser(null);
                      setOpenPassword('');
                      setShowOpenPassword(false);
                      if (user) router.push(('/chat?userId=' + user._id + '&userName=' + encodeURIComponent(user.name) + '&verified=1') as any);
                    } else {
                      Alert.alert('Invalid Password', 'Please enter the correct password to access this chat.');
                    }
                  } catch (err) {
                    Alert.alert('Error', 'Failed to verify password.');
                  }
                }}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Verify</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* Unlock Password Modal */}
      <Modal
        visible={unlockPasswordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setUnlockPasswordModalVisible(false);
          setPendingUnlockUser(null);
          setUnlockPassword('');
          setShowUnlockPassword(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setUnlockPasswordModalVisible(false);
            setPendingUnlockUser(null);
            setUnlockPassword('');
            setShowUnlockPassword(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.passwordModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]} onPress={() => {}}>
            <Text style={[styles.passwordTitle, { color: colors.text }]}>Unlock chat</Text>
            <Text style={[styles.passwordSubtitle, { color: isLightMode ? '#667781' : '#8696A0' }]}>Enter your account password to unlock this chat.</Text>
            <View style={[styles.passwordInputContainer, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942', backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942' }]}>
              <TextInput
                style={[styles.passwordInputField, { color: colors.text }]}
                value={unlockPassword}
                onChangeText={setUnlockPassword}
                placeholder="Password"
                placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
                secureTextEntry={!showUnlockPassword}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowUnlockPassword(s => !s)}
                style={styles.eyeIcon}
              >
                <Feather name={showUnlockPassword ? 'eye-off' : 'eye'} size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordActions}>
              <TouchableOpacity
                style={[styles.passwordButton, styles.cancelButton, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                onPress={() => {
                  setUnlockPasswordModalVisible(false);
                  setPendingUnlockUser(null);
                  setUnlockPassword('');
                  setShowUnlockPassword(false);
                }}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passwordButton, styles.verifyButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}
                onPress={async () => {
                  try {
                    // Mock password verification - always succeed for demo
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const data = { valid: true };
                    if (data && data.valid === true) {
                      const user = pendingUnlockUser;
                      if (user) {
                        const updatedLocked = (currentUser.locked || []).filter((id: string) => id !== user._id);
                        await updateProfile({ locked: updatedLocked });
                        Alert.alert('Success', 'Chat unlocked');
                      }
                      setUnlockPasswordModalVisible(false);
                      setPendingUnlockUser(null);
                      setUnlockPassword('');
                      setShowUnlockPassword(false);
                      setShowMenu(false);
                    } else {
                      Alert.alert('Invalid Password', 'Please enter the correct password to unlock this chat.');
                    }
                  } catch (err) {
                    Alert.alert('Error', 'Failed to verify password.');
                  }
                }}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Verify</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} onPress={handleArchive}>
              <Feather name="archive" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{menuIsArchived ? 'Unarchive chat' : 'Archive chat'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} onPress={handleMarkRead}>
              <Feather name="check-circle" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} onPress={handleMarkUnread}>
              <Feather name="eye-off" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Mark as unread</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} onPress={handleFavourite}>
              <Feather name="star" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{menuIsFavourite ? 'Remove from favourites' : 'Add to favourites'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} onPress={handleLock}>
              <Feather name="lock" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{menuIsLocked ? 'Unlock chat' : 'Lock chat'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handlePin}>
              <Feather name="map-pin" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>{menuIsPinned ? 'Unpin chat' : 'Pin chat'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Bottom Navigation */}
      <BlurView intensity={80} tint={isLightMode ? 'light' : 'dark'} style={[styles.bottomNav, { borderTopColor: isLightMode ? 'rgba(233, 237, 239, 0.3)' : 'rgba(42, 57, 66, 0.3)' }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('status')}>
          <Feather name="radio" size={24} color={activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('phone')}>
          <Feather name="phone" size={24} color={activeTab === 'phone' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'phone' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Calls</Text>
        </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('chats')}>
          <Feather name="message-circle" size={24} color={activeTab === 'chats' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'chats' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('settings'); router.push('/settings' as any); }}>
          <Feather name="settings" size={24} color={activeTab === 'settings' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'settings' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Settings</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  headerIcon: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterTabText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  chatItem: {
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
  chatContent: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
  },
  chatMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatTime: {
    fontSize: 12,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatPreview: {
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalAvatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 16,
  },
  modalName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalBio: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  passwordModal: {
    width: '85%',
    borderRadius: 12,
    padding: 24,
  },
  passwordTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  passwordInputField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  verifyButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuModal: {
    width: '85%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});