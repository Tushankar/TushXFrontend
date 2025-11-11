import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiService } from '../utils/api';
import { authStorage } from '../utils/authStorage';
export default function ContactInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as any;
  const userId = params.userId as string;
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [starredMessagesCount, setStarredMessagesCount] = useState(0);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';
  useEffect(() => {
    fetchContactInfo();
  }, [userId]);
  const fetchContactInfo = async () => {
    try {
      setLoading(true);
      
      // Get token
      const token = await authStorage.getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      // Fetch current user profile
      const profileResponse = await fetch('http://192.168.0.150:8080/api/auth/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profileData = await profileResponse.json();
      setCurrentUser(profileData.user);

      // Fetch all users to find the specific contact
      const usersResponse = await fetch('http://192.168.0.150:8080/api/auth/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!usersResponse.ok) {
        throw new Error('Failed to fetch users');
      }

      const usersData = await usersResponse.json();
      const foundUser = usersData.users.find((u: any) => u._id === userId);

      if (!foundUser) {
        throw new Error('User not found');
      }

      setUser(foundUser);

      // Fetch favourite messages to count starred messages for this user
      try {
        const favouritesData = await apiService.getFavouriteMessages(token);
        const starredCount = favouritesData.messages.filter((msg: any) => 
          msg.from === userId || msg.to === userId
        ).length;
        setStarredMessagesCount(starredCount);
      } catch (favouritesError) {
        console.error('Failed to fetch starred messages count:', favouritesError);
        setStarredMessagesCount(0);
      }
    } catch (error) {
      console.error('Failed to fetch contact info:', error);
      Alert.alert('Error', 'Failed to load contact information');
    } finally {
      setLoading(false);
    }
  };
  const startChat = () => {
    if (user) {
      router.push(`/chat?userId=${user._id}&userName=${encodeURIComponent(user.name)}` as any);
    }
  };
  const makeCall = () => {
    Alert.alert('Call', 'Voice calling feature coming soon!');
  };
  const makeVideoCall = () => {
    Alert.alert('Video Call', 'Video calling feature coming soon!');
  };
  const blockContact = () => {
    Alert.alert('Block Contact', 'Block contact feature coming soon!');
  };
  const reportContact = () => {
    Alert.alert('Report Contact', 'Report contact feature coming soon!');
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const token = await authStorage.getToken();
      if (!token) return;

      // Fetch all messages between current user and this contact
      const messagesResponse = await fetch(`http://192.168.0.150:8080/api/auth/messages/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!messagesResponse.ok) {
        throw new Error('Failed to fetch messages');
      }

      const messagesData = await messagesResponse.json();
      const messages = messagesData.messages || [];

      // Filter messages that contain the search query (case insensitive)
      const filteredMessages = messages.filter((msg: any) =>
        msg.message.toLowerCase().includes(query.toLowerCase())
      );

      setSearchResults(filteredMessages);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const navigateToMessage = (message: any) => {
    setShowSearchModal(false);
    // Navigate to chat with the message ID to scroll to it
    router.push(`/chat?userId=${userId}&userName=${encodeURIComponent(user?.name || 'Unknown')}&verified=1&messageId=${message.id}` as any);
  };
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
        <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact info</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
        <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact info</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            Contact not found
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact info</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="edit-2" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={[styles.profileSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => user.avatarUrl && user.avatarUrl.trim() && setShowFullImage(true)}
          >
            {user.avatarUrl && user.avatarUrl.trim() ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatar}
                onError={() => console.log('Image load error for user:', user.name)}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942' }]}>
                <Text style={[styles.avatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                  {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
         
          <Text style={[styles.userName, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
            {user.name}
          </Text>
         
          <Text style={[styles.userEmail, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            {user.email || ''}
          </Text>
        </View>
        {/* About Section */}
        {user.bio && (
          <>
            <View style={styles.sectionGap} />
            <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
              <View style={styles.aboutHeader}>
                <Text style={[styles.aboutLabel, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  About
                </Text>
              </View>
              <View style={styles.aboutContent}>
                <Text style={[styles.aboutText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  {user.bio}
                </Text>
              </View>
              <View style={styles.aboutFooter}>
                <Text style={[styles.aboutDate, { color: isLightMode ? '#8696A0' : '#667781' }]}>
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  }) : ''}
                </Text>
              </View>
            </View>
          </>
        )}
        {/* Action Buttons */}
        <View style={styles.sectionGap} />
        <View style={[styles.actionsSection, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity style={styles.actionButton} onPress={makeCall}>
            <View style={[styles.actionIconContainer, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}>
              <Feather name="phone" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionText, { color: isLightMode ? '#00A884' : '#00A884' }]}>Audio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={makeVideoCall}>
            <View style={[styles.actionIconContainer, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}>
              <Feather name="video" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionText, { color: isLightMode ? '#00A884' : '#00A884' }]}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowSearchModal(true)}>
            <View style={[styles.actionIconContainer, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}>
              <Feather name="search" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.actionText, { color: isLightMode ? '#00A884' : '#00A884' }]}>Search</Text>
          </TouchableOpacity>
        </View>
        {/* Media Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity style={[styles.listItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
            <View style={styles.listItemLeft}>
              <Feather name="image" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Media, links and docs
              </Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={[styles.listItemCount, { color: isLightMode ? '#667781' : '#8696A0' }]}>0</Text>
              <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.listItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={() => router.push('/favourites' as any)}
          >
            <View style={styles.listItemLeft}>
              <Feather name="star" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Starred messages
              </Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={[styles.listItemCount, { color: isLightMode ? '#667781' : '#8696A0' }]}>{starredMessagesCount}</Text>
              <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listItem} onPress={() => setShowSearchModal(true)}>
            <View style={styles.listItemLeft}>
              <Feather name="search" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Chat search
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Notifications Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity style={[styles.listItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
            <View style={styles.listItemLeft}>
              <Feather name="bell" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <View style={styles.listItemTextContainer}>
                <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  Mute notifications
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.listItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
            <View style={styles.listItemLeft}>
              <Feather name="music" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <View style={styles.listItemTextContainer}>
                <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  Custom notifications
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Feather name="image" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <View style={styles.listItemTextContainer}>
                <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  Media visibility
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Encryption Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity style={styles.encryptionItem}>
            <View style={styles.encryptionLeft}>
              <Feather name="lock" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <View style={styles.encryptionTextContainer}>
                <Text style={[styles.encryptionTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  Encryption
                </Text>
                <Text style={[styles.encryptionDesc, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Messages and calls are end-to-end encrypted. Tap to verify.
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Disappearing Messages */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Feather name="clock" size={20} color={isLightMode ? '#54656F' : '#8696A0'} />
              <View style={styles.listItemTextContainer}>
                <Text style={[styles.listItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                  Disappearing messages
                </Text>
                <Text style={[styles.listItemSubtext, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Off
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Groups Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <View style={styles.groupsHeader}>
            <Text style={[styles.groupsHeaderText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              0 groups in common
            </Text>
          </View>
        </View>
        {/* Actions Section */}
        <View style={styles.sectionGap} />
        <View style={[styles.section, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
          <TouchableOpacity
            style={[styles.listItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={blockContact}
          >
            <View style={styles.listItemLeft}>
              <Feather name="slash" size={20} color="#E53935" />
              <Text style={styles.dangerText}>Block {user.name}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.listItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
            onPress={reportContact}
          >
            <View style={styles.listItemLeft}>
              <Feather name="alert-triangle" size={20} color="#E53935" />
              <Text style={styles.dangerText}>Report {user.name}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.listItem}>
            <View style={styles.listItemLeft}>
              <Feather name="trash-2" size={20} color="#E53935" />
              <Text style={styles.dangerText}>Delete chat</Text>
            </View>
            <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
          </TouchableOpacity>
        </View>
        {/* Footer Space */}
        <View style={{ height: 40 }} />
      </ScrollView>
      {/* Full Image Modal */}
      <Modal visible={showFullImage} transparent animationType="fade" onRequestClose={() => setShowFullImage(false)}>
        <View style={styles.fullImageModal}>
          <TouchableOpacity
            style={styles.fullImageClose}
            onPress={() => setShowFullImage(false)}
          >
            <Feather name="x" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {user.avatarUrl && user.avatarUrl.trim() && (
            <Image
              source={{ uri: user.avatarUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal visible={showSearchModal} transparent animationType="slide" onRequestClose={() => setShowSearchModal(false)}>
        <View style={styles.searchModalOverlay}>
          <View style={[styles.searchModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            {/* Search Header */}
            <View style={styles.searchHeader}>
              <TouchableOpacity onPress={() => setShowSearchModal(false)} style={styles.searchBackButton}>
                <Feather name="arrow-left" size={24} color={isLightMode ? '#000000' : '#E9EDEF'} />
              </TouchableOpacity>
              <Text style={[styles.searchTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Search in chat
              </Text>
              <View style={styles.searchPlaceholder} />
            </View>

            {/* Search Input */}
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              <TextInput
                style={[styles.searchInput, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                placeholder="Search messages..."
                placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
                value={searchQuery}
                onChangeText={(text: string) => {
                  setSearchQuery(text);
                  performSearch(text);
                }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}>
                  <Feather name="x" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            {isSearching ? (
              <View style={styles.searchLoading}>
                <Text style={[styles.searchLoadingText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Searching...
                </Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item: any) => item.id}
                renderItem={({ item }: { item: any }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => navigateToMessage(item)}
                  >
                    <View style={styles.searchResultContent}>
                      <Text style={[styles.searchResultText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                        {item.message}
                      </Text>
                      <Text style={[styles.searchResultDate, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                        {new Date(item.timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
                  </TouchableOpacity>
                )}
                style={styles.searchResultsList}
              />
            ) : searchQuery.length > 0 ? (
              <View style={styles.searchEmpty}>
                <Feather name="search" size={48} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
                <Text style={[styles.searchEmptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  No messages found
                </Text>
              </View>
            ) : (
              <View style={styles.searchEmpty}>
                <Feather name="search" size={48} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
                <Text style={[styles.searchEmptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Search for messages in this chat
                </Text>
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
    flex: 1,
    marginLeft: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerActionButton: {
    padding: 4,
  },
  headerPlaceholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    marginBottom: 16,
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
  userName: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    textAlign: 'center',
  },
  sectionGap: {
    height: 8,
  },
  section: {
    paddingVertical: 0,
  },
  aboutHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  aboutLabel: {
    fontSize: 13,
  },
  aboutContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  aboutText: {
    fontSize: 16,
    lineHeight: 22,
  },
  aboutFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  aboutDate: {
    fontSize: 13,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemText: {
    fontSize: 16,
  },
  listItemSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemCount: {
    fontSize: 14,
  },
  encryptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  encryptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },
  encryptionTextContainer: {
    flex: 1,
  },
  encryptionTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  encryptionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  groupsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  groupsHeaderText: {
    fontSize: 14,
  },
  dangerText: {
    fontSize: 16,
    color: '#E53935',
  },
  fullImageModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    zIndex: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  searchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchModal: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchBackButton: {
    padding: 4,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginLeft: 16,
  },
  searchPlaceholder: {
    width: 32,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  searchLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchLoadingText: {
    fontSize: 16,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultText: {
    fontSize: 16,
    marginBottom: 4,
  },
  searchResultDate: {
    fontSize: 12,
  },
  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  searchEmptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});