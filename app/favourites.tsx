import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../utils/api';
import { authStorage } from '../utils/authStorage';

interface Message {
  id: string;
  from: string;
  to: string;
  message: string;
  replyTo?: {
    id: string;
    from: string;
    to: string;
    message: string;
    timestamp: Date;
    fromUser?: {
      id: string;
      name: string;
      avatarUrl?: string;
    };
    toUser?: {
      id: string;
      name: string;
      avatarUrl?: string;
    };
  } | null;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  deliveredAt?: Date;
  readAt?: Date;
  pinned?: boolean;
  favourite?: boolean;
  fromUser?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  toUser?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export default function FavouritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [favouriteMessages, setFavouriteMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';

  const loadFavouriteMessages = async () => {
    try {
      const authToken = await authStorage.getToken();
      if (!authToken) {
        console.error('No auth token found');
        setIsLoading(false);
        return;
      }

      // Fetch current user profile to get user id
      const profileResponse = await fetch('http://192.168.0.150:8080/api/auth/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const profileData = await profileResponse.json();
      setCurrentUserId(profileData.user.id);

      console.log('Loading favourite messages with token:', authToken.substring(0, 20) + '...');
      const data = await apiService.getFavouriteMessages(authToken);
      console.log('Received data:', data);
      
      if (!data || !data.messages) {
        console.error('Invalid response format:', data);
        setFavouriteMessages([]);
        setIsLoading(false);
        return;
      }

      const parsedMessages = data.messages.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        status: msg.status || 'sent',
        deliveredAt: msg.deliveredAt ? new Date(msg.deliveredAt) : undefined,
        readAt: msg.readAt ? new Date(msg.readAt) : undefined,
        pinned: msg.pinned || false,
        favourite: msg.favourite || false,
      }));
      
      console.log('Parsed', parsedMessages.length, 'messages');
      setFavouriteMessages(parsedMessages);
    } catch (error) {
      console.error('Failed to load favourite messages:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      setFavouriteMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadFavouriteMessages();
    }, [])
  );

  const navigateToChat = (message: Message) => {
    // Determine the other user ID
    const otherUserId = message.from === currentUserId ? message.to : message.from;
    const otherUserName = message.from === currentUserId ? (message.toUser?.name || 'Unknown') : (message.fromUser?.name || 'Unknown');

    // Navigate to chat with the other user and message ID to scroll to
    router.push(`/chat?userId=${otherUserId}&userName=${encodeURIComponent(otherUserName)}&verified=1&messageId=${message.id}` as any);
  };

  const renderFavouriteMessage = ({ item }: { item: Message }) => {
    const otherUser = item.from === currentUserId ? item.toUser : item.fromUser;

    return (
      <TouchableOpacity
        style={[styles.messageItem, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.messageHeader}>
          <View style={styles.userInfo}>
            {otherUser?.avatarUrl ? (
              <Image
                source={{ uri: otherUser.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942' }]}>
                <Text style={[styles.avatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                  {otherUser?.name ? otherUser.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                {otherUser?.name || 'Unknown'}
              </Text>
              <Text style={[styles.messageTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                {item.timestamp instanceof Date ? item.timestamp.toLocaleDateString() : 'Invalid time'}
              </Text>
            </View>
          </View>
          <Feather name="star" size={20} color="#FFD700" />
        </View>
        <Text style={[styles.messageText, { color: isLightMode ? '#000000' : '#E9EDEF' }]} numberOfLines={2}>
          {item.message}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favourites</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isLightMode ? '#667781' : '#8696A0' }]}>Loading favourites...</Text>
        </View>
      ) : favouriteMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="star" size={64} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
          <Text style={[styles.emptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            No favourite messages
          </Text>
          <Text style={[styles.emptySubtext, { color: isLightMode ? '#8696A0' : '#667781' }]}>
            Long press on any message to favourite it
          </Text>
        </View>
      ) : (
        <FlatList
          data={favouriteMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderFavouriteMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '500',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  messagesList: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  messageItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '500',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
});