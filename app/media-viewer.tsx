import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../utils/api';
import { authStorage } from '../utils/authStorage';
import { VoiceMessage } from '@/components/voice-message';

export default function MediaViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as any;
  const userId = params.userId as string;
  const userName = params.userName as string;
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [chatStats, setChatStats] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState('media');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';

  useEffect(() => {
    fetchChatStats();
  }, [userId]);

  const fetchChatStats = async () => {
    try {
      setLoading(true);
      const token = await authStorage.getToken();
      if (!token) {
        router.replace('/');
        return;
      }

      // Get current user
      const profileResponse = await apiService.getProfile(token);
      setCurrentUserId(profileResponse.user.id);

      // Fetch chat statistics
      const statsData = await apiService.getChatStats(token, userId);
      setChatStats(statsData.stats);
    } catch (error) {
      console.error('Failed to fetch chat stats:', error);
      Alert.alert('Error', 'Failed to load media information');
    } finally {
      setLoading(false);
    }
  };

  const navigateToMessage = (messageId: string, fromUserId?: string, toUserId?: string) => {
    // If viewing all media (userId is current user), determine the other user from the message
    if (userId === currentUserId && fromUserId && toUserId) {
      // Find the other user in the conversation
      const otherUserId = fromUserId === currentUserId ? toUserId : fromUserId;
      router.push(`/chat?userId=${otherUserId}&userName=User&messageId=${messageId}` as any);
    } else {
      router.push(`/chat?userId=${userId}&userName=${encodeURIComponent(userName)}&messageId=${messageId}` as any);
    }
  };

  const renderMediaItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.mediaItem}
      onPress={() => navigateToMessage(item.messageId, item.from, item.to)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.mediaImage} />
    </TouchableOpacity>
  );

  const renderVoiceItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.voiceItem, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
      onPress={() => navigateToMessage(item.messageId, item.from, item.to)}
    >
      <VoiceMessage
        messageId={item.messageId}
        voiceUrl={item.voiceUrl}
        duration={item.voiceDuration}
        isPlaying={playingVoiceId === item.messageId}
        onPlay={() => setPlayingVoiceId(item.messageId)}
        onPause={() => setPlayingVoiceId(null)}
        isMine={item.from === currentUserId}
        isLightMode={isLightMode}
        voiceListenedBy={item.voiceListenedBy || []}
        currentUserId={currentUserId}
        onVoiceListened={() => {}}
      />
      <Text style={[styles.voiceDate, { color: isLightMode ? '#667781' : '#8696A0' }]}>
        {new Date(item.timestamp).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const renderLinkItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.linkItem, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
      onPress={() => navigateToMessage(item.messageId, item.from, item.to)}
    >
      <View style={styles.linkContent}>
        <Feather name="link" size={20} color={isLightMode ? '#25D366' : '#00A884'} />
        <View style={styles.linkTextContainer}>
          <Text 
            style={[styles.linkUrl, { color: isLightMode ? '#1976D2' : '#53BDEB' }]}
            numberOfLines={1}
            onPress={() => Linking.openURL(item.url)}
          >
            {item.url}
          </Text>
          <Text style={[styles.linkDate, { color: isLightMode ? '#667781' : '#8696A0' }]}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <Feather name="chevron-right" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
        <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Media, links and docs</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Media, links and docs</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'media' && { borderBottomColor: isLightMode ? '#25D366' : '#00A884' }]}
          onPress={() => setSelectedTab('media')}
        >
          <Text style={[styles.tabText, { 
            color: selectedTab === 'media' 
              ? (isLightMode ? '#25D366' : '#00A884') 
              : (isLightMode ? '#667781' : '#8696A0') 
          }]}>
            Media ({chatStats?.imageCount || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'voice' && { borderBottomColor: isLightMode ? '#25D366' : '#00A884' }]}
          onPress={() => setSelectedTab('voice')}
        >
          <Text style={[styles.tabText, { 
            color: selectedTab === 'voice' 
              ? (isLightMode ? '#25D366' : '#00A884') 
              : (isLightMode ? '#667781' : '#8696A0') 
          }]}>
            Voice ({chatStats?.voiceCount || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'links' && { borderBottomColor: isLightMode ? '#25D366' : '#00A884' }]}
          onPress={() => setSelectedTab('links')}
        >
          <Text style={[styles.tabText, { 
            color: selectedTab === 'links' 
              ? (isLightMode ? '#25D366' : '#00A884') 
              : (isLightMode ? '#667781' : '#8696A0') 
          }]}>
            Links ({chatStats?.linkCount || 0})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {selectedTab === 'media' && (
          chatStats?.imageCount > 0 ? (
            <FlatList
              data={chatStats.images || []}
              renderItem={renderMediaItem}
              numColumns={3}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.mediaGrid}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="image" size={64} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
              <Text style={[styles.emptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                No media shared yet
              </Text>
            </View>
          )
        )}

        {selectedTab === 'voice' && (
          chatStats?.voiceCount > 0 ? (
            <FlatList
              data={chatStats.voices || []}
              renderItem={renderVoiceItem}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.voiceList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="mic" size={64} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
              <Text style={[styles.emptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                No voice messages yet
              </Text>
            </View>
          )
        )}

        {selectedTab === 'links' && (
          chatStats?.linkCount > 0 ? (
            <FlatList
              data={chatStats.links || []}
              renderItem={renderLinkItem}
              keyExtractor={(item, index) => index.toString()}
              contentContainerStyle={styles.linksList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Feather name="link" size={64} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
              <Text style={[styles.emptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                No links shared yet
              </Text>
            </View>
          )
        )}
      </View>
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
  headerPlaceholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  mediaGrid: {
    padding: 4,
  },
  mediaItem: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  voiceList: {
    padding: 16,
  },
  voiceItem: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  voiceDate: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
  },
  linksList: {
    padding: 16,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  linkTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  linkUrl: {
    fontSize: 14,
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  linkDate: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});