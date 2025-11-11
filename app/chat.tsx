import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Clipboard, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, SectionList, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { authStorage } from '@/utils/authStorage';
import { apiService } from '@/utils/api';
import { VoiceMessage } from '@/components/voice-message';
import { VoiceRecorder } from '@/components/voice-recorder';
interface Message {
  id: string;
  from: string;
  to: string;
  message: string;
  voiceUrl?: string;
  voiceDuration?: number;
  voiceListenedBy?: string[]; // Array of user IDs who have listened to the voice message
  messageType?: 'text' | 'voice'; // New field for message type
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
  isForwarded?: boolean;
  forwardedFrom?: {
    id: string;
    name: string;
    avatarUrl?: string;
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
export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as any;
  const userId = params.userId as string;
  const userName = params.userName as string;
  const verified = params.verified === '1' || params.verified === 'true';
  const messageId = params.messageId as string;
  const { colors } = useTheme();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [messageInfo, setMessageInfo] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<Date | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojis, setEmojis] = useState<any[]>([]);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState('faces');
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';
  const flatListRef = useRef<FlatList>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardRecipients, setForwardRecipients] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [chatWallpaper, setChatWallpaper] = useState<{type: string, id: string | null, customUrl: string | null} | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoiceMessageId, setPlayingVoiceMessageId] = useState<string | null>(null);

  const wallpaperImages: { [key: string]: any } = {
    wallpaper1: require('@/assets/images/ChatWallpaper-1.jpg'),
    wallpaper2: require('@/assets/images/chatWallpaper-2.jpg'),
    wallpaper3: require('@/assets/images/chatWallpaper-3.jpg'),
    wallpaper4: require('@/assets/images/chatWallpaper-4.jpg'),
    wallpaper5: require('@/assets/images/chatWallpaper-5.jpg'),
    wallpaper6: require('@/assets/images/chatWallpaper-6.jpg'),
    wallpaper7: require('@/assets/images/chatWallpaper-7.jpg'),
    wallpaper8: require('@/assets/images/chatWallpaper-8.jpg'),
  };

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

  const mergeMessages = (existing: Message[], incoming: Message[] | Message) => {
    const incomingArr = Array.isArray(incoming) ? incoming : [incoming];
    const map = new Map<string, Message>();
    for (const m of existing) {
      if (m && m.id) map.set(m.id, m);
    }
    for (const m of incomingArr) {
      if (!m) continue;
      if (m.id) {
        map.set(m.id, m);
      } else {
        const tempId = `tmp-${(m.timestamp instanceof Date ? m.timestamp.getTime() : Date.now())}-${Math.random().toString(36).substr(2,9)}`;
        map.set(tempId, { ...m, id: tempId } as Message);
      }
    }
    const result = Array.from(map.values()).sort((a, b) => {
      const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return tb - ta; // Newest first
    });
    return result;
  };
  const getUserStatusText = () => {
    if (otherUserOnline) {
      return 'Online';
    } else if (otherUserLastSeen) {
      const now = new Date();
      const lastSeen = new Date(otherUserLastSeen);
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffMins < 1) {
        return 'Last seen just now';
      } else if (diffMins < 60) {
        return `Last seen ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `Last seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays === 1) {
        return 'Last seen yesterday';
      } else if (diffDays < 7) {
        return `Last seen ${diffDays} days ago`;
      } else {
        return `Last seen ${lastSeen.toLocaleDateString()}`;
      }
    } else {
      return 'Offline';
    }
  };
  const checkUserOnlineStatus = async () => {
    try {
      const authToken = await authStorage.getToken();
      if (!authToken) return;
      // Get user's online status and last seen time from dedicated endpoint
      const statusResponse = await apiService.get(`/auth/status/${userId}`, authToken);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('User status from API:', statusData);
       
        setOtherUserOnline(statusData.isOnline);
        if (statusData.lastSeen) {
          setOtherUserLastSeen(new Date(statusData.lastSeen));
        } else {
          setOtherUserLastSeen(null);
        }
      }
      // Also get other user info including last seen for profile data
      const usersResponse = await apiService.get('/auth/users', authToken);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const foundUser = usersData.users.find((u: any) => u._id === userId || u.id === userId);
        if (foundUser) {
          setOtherUser(foundUser);
        }
      }
    } catch (error) {
      console.error('Failed to check user online status:', error);
    }
  };
  const loadMessages = async () => {
    try {
      if (!currentUserId || !userId) return;
      const authToken = await authStorage.getToken();
      if (!authToken) return;
      const response = await apiService.get(`/auth/messages/${userId}`, authToken);
      if (response.ok) {
        const data = await response.json();
        const parsedMessages = data.messages.map((msg: any) => ({
          ...msg,
          id: msg.id || msg._id,
          timestamp: new Date(msg.timestamp),
          status: msg.status || 'sent',
          deliveredAt: msg.deliveredAt ? new Date(msg.deliveredAt) : undefined,
          readAt: msg.readAt ? new Date(msg.readAt) : undefined,
          pinned: msg.pinned || false,
          favourite: msg.favourite || false,
          isForwarded: msg.isForwarded || false,
          forwardedFrom: msg.forwardedFrom || null,
          messageType: msg.messageType || (msg.voiceUrl ? 'voice' : 'text'),
          voiceUrl: msg.voiceUrl,
          voiceDuration: msg.voiceDuration || 0,
          voiceListenedBy: msg.voiceListenedBy || [],
          replyTo: msg.replyTo ? {
            ...msg.replyTo,
            timestamp: new Date(msg.replyTo.timestamp),
          } : null,
        })).sort((a: Message, b: Message) => {
          // Sort by timestamp (newest first)
          const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return tb - ta;
        });
        // Keep all messages in messages array, create pinnedMessages by filtering
        const pinnedMsgs = parsedMessages.filter((msg: Message) => msg.pinned);
        setMessages(parsedMessages);
        setPinnedMessages(pinnedMsgs);
       
        // Scroll to bottom after loading messages
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };
  useEffect(() => {
    const initChat = async () => {
      try {
        const token = await authStorage.getToken();
        if (!token) {
          console.error('No auth token found');
          return;
        }
        // Get current user profile
        const profileResponse = await apiService.getProfile(token);
        setCurrentUserId(profileResponse.user.id);
        setCurrentUser(profileResponse.user);
        
        // Fetch chat wallpaper preference
        const wallpaperResponse = await apiService.get('/auth/chat-wallpaper', token);
        if (wallpaperResponse.ok) {
          const wallpaperData = await wallpaperResponse.json();
          setChatWallpaper(wallpaperData.wallpaper || { type: 'default', id: null, customUrl: null });
        }
        
        // Get other user info from API
        const usersResponse = await apiService.get('/auth/users', token);
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          const foundUser = usersData.users.find((u: any) => u._id === userId || u.id === userId);
          setOtherUser(foundUser);
        }
        // Check if chat is locked
        // Note: locked property not implemented in current API
        // if (profileResponse.user.locked && profileResponse.user.locked.includes(userId)) {
        // if (!verified) {
        // setShowPasswordModal(true);
        // }
        // }
        // Initialize Socket.IO connection
        console.log('Initializing socket with token:', token ? 'present' : 'missing');
       
        const newSocket = io('http://192.168.29.157:8080', {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        newSocket.on('connect', () => {
          console.log('Connected to socket server');
          setIsConnected(true);
          newSocket.emit('userOnline');
          newSocket.emit('joinChat', { otherUserId: userId });
        });
        newSocket.on('disconnect', () => {
          console.log('Disconnected from socket server');
          setIsConnected(false);
        });
        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          setIsConnected(false);
        });
        newSocket.on('messageSent', (data: { messageId: string, dbId: string, status: string }) => {
          console.log('Message sent confirmation:', data);
          setMessages(prev => prev.map(msg => {
            if (msg.id === data.messageId) {
              // Preserve all message data including voice message fields when updating ID
              return {
                ...msg,
                id: data.dbId,
                status: 'sent' as const
              };
            }
            return msg;
          }));
        });
        newSocket.on('receiveMessage', (messageData: any) => {
          console.log('Received message:', messageData);
          const processedMessage: Message = {
            id: messageData.id,
            from: messageData.from,
            to: messageData.to,
            message: messageData.message,
            voiceUrl: messageData.voiceUrl,
            voiceDuration: messageData.voiceDuration,
            messageType: messageData.messageType || 'text',
            replyTo: messageData.replyTo || null,
            isForwarded: messageData.isForwarded || false,
            forwardedFrom: messageData.forwardedFrom || null,
            timestamp: new Date(messageData.timestamp),
            status: messageData.status || 'delivered',
            deliveredAt: messageData.deliveredAt ? new Date(messageData.deliveredAt) : undefined,
            pinned: messageData.pinned || false,
            favourite: messageData.favourite || false,
          };
          setMessages(prev => mergeMessages(prev, processedMessage));
          if (processedMessage.pinned) {
            setPinnedMessages(prev => [processedMessage, ...prev.filter(msg => msg.id !== processedMessage.id)]);
          }
          // Auto-mark as delivered
          if (messageData.id) {
            newSocket.emit('messageDelivered', { messageId: messageData.id, from: messageData.from });
          }
          // Scroll to bottom when receiving new message
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
        });
        newSocket.on('receiveVoiceMessage', (messageData: any) => {
          console.log('Received voice message:', messageData);
          const processedMessage: Message = {
            id: messageData.id,
            from: messageData.from,
            to: messageData.to,
            message: '[Voice Message]',
            voiceUrl: messageData.voiceUrl,
            voiceDuration: messageData.voiceDuration,
            voiceListenedBy: messageData.voiceListenedBy || [],
            messageType: 'voice',
            replyTo: messageData.replyTo || null,
            isForwarded: messageData.isForwarded || false,
            forwardedFrom: messageData.forwardedFrom || null,
            timestamp: new Date(messageData.timestamp),
            status: messageData.status || 'delivered',
            deliveredAt: messageData.deliveredAt ? new Date(messageData.deliveredAt) : undefined,
            pinned: messageData.pinned || false,
            favourite: messageData.favourite || false,
          };
          setMessages(prev => mergeMessages(prev, processedMessage));
          if (processedMessage.pinned) {
            setPinnedMessages(prev => [processedMessage, ...prev.filter(msg => msg.id !== processedMessage.id)]);
          }
          // Auto-mark as delivered
          if (messageData.id) {
            newSocket.emit('messageDelivered', { messageId: messageData.id, from: messageData.from });
          }
          // Scroll to bottom when receiving new message
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 100);
        });
        newSocket.on('messageDeleted', (data: { messageId: string, chatKey: string }) => {
          console.log('Message deleted:', data);
          setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
          setPinnedMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        });
        newSocket.on('messageStatusUpdate', (data: { messageId: string, status: 'sending' | 'sent' | 'delivered' | 'read' }) => {
          console.log('Message status update:', data);
          setMessages(prev => prev.map(msg => {
            if (msg.id === data.messageId) {
              const update: any = { status: data.status };
              if (data.status === 'delivered') {
                update.deliveredAt = new Date();
              } else if (data.status === 'read') {
                update.readAt = new Date();
              }
              return { ...msg, ...update };
            }
            return msg;
          }));
        });
        newSocket.on('messageError', (data: { messageId: string, error: string }) => {
          console.error('Message send error:', data);
          // Update message status to show error
          setMessages(prev => prev.map(msg =>
            msg.id === data.messageId ? { ...msg, status: 'sending' as const } : msg
          ));
          Alert.alert('Message Error', 'Failed to send message. Please try again.');
        });
        newSocket.on('userOnline', (data: { userId: string; isOnline?: boolean; lastSeenText?: string }) => {
          console.log('User came online:', data);
          if (data.userId === userId) {
            setOtherUserOnline(true);
            setOtherUserLastSeen(null);
          }
        });
        newSocket.on('userCameOnline', (data: { userId: string; isOnline?: boolean; lastSeenText?: string }) => {
          console.log('User came online:', data);
          if (data.userId === userId) {
            setOtherUserOnline(true);
            setOtherUserLastSeen(null);
          }
        });
        newSocket.on('userWentOffline', (data: { userId: string; isOnline: boolean; lastSeen?: string; lastSeenText?: string }) => {
          console.log('User went offline:', data);
          if (data.userId === userId) {
            setOtherUserOnline(false);
            if (data.lastSeen) {
              setOtherUserLastSeen(new Date(data.lastSeen));
            }
          }
        });
        newSocket.on('userOffline', (data: { userId: string; lastSeen?: string; isOnline?: boolean; lastSeenText?: string }) => {
          console.log('User went offline:', data);
          if (data.userId === userId) {
            setOtherUserOnline(false);
            if (data.lastSeen) {
              setOtherUserLastSeen(new Date(data.lastSeen));
            }
          }
        });
        setSocket(newSocket);
      } catch (err) {
        console.error('Failed to initialize chat', err);
      }
    };
    initChat();
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [userId]);
  useFocusEffect(
    React.useCallback(() => {
      const fetchOtherUser = async () => {
        try {
          const authToken = await authStorage.getToken();
          if (!authToken) return;
          // Refetch users to get updated info
          const usersResponse = await apiService.get('/auth/users', authToken);
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            const foundUser = usersData.users.find((u: any) => u._id === userId || u.id === userId);
            if (foundUser) {
              setOtherUser(foundUser);
            }
          }
        } catch (err) {
          console.error('Failed to refetch other user info', err);
        }
      };
      
      const fetchWallpaper = async () => {
        try {
          const authToken = await authStorage.getToken();
          if (!authToken) return;
          const wallpaperResponse = await apiService.get('/auth/chat-wallpaper', authToken);
          if (wallpaperResponse.ok) {
            const wallpaperData = await wallpaperResponse.json();
            const wallpaper = wallpaperData.wallpaper || { type: 'default', id: null, customUrl: null };
            setChatWallpaper(wallpaper);
          }
        } catch (err) {
          console.error('Failed to fetch wallpaper', err);
        }
      };
      
      if (userId && currentUserId) {
        loadMessages();
        fetchOtherUser();
        checkUserOnlineStatus();
        fetchWallpaper();
      }
    }, [userId, currentUserId])
  );
  useEffect(() => {
    if (socket && messages.length > 0 && currentUserId && !isLoadingMessages) {
      const unreadMessages = messages.filter(msg =>
        msg.from !== currentUserId &&
        msg.status !== 'read' &&
        msg.id
      );
      if (unreadMessages.length > 0) {
        const unreadMessageIds = unreadMessages.map(msg => msg.id).filter(id => id);
        if (unreadMessageIds.length > 0) {
          socket.emit('messagesRead', { messageIds: unreadMessageIds, from: currentUserId });
          setMessages(prev => {
            const updatedMessages = prev.map(msg => {
              if (msg.from !== currentUserId && msg.status !== 'read' && msg.id) {
                return { ...msg, status: 'read' as const, readAt: new Date() };
              }
              return msg;
            });
            return updatedMessages;
          });
        }
      }
    }
  }, [messages, socket, currentUserId, userId, isLoadingMessages]);
  // Scroll to specific message if messageId is provided
  useEffect(() => {
    if (messageId && messages.length > 0 && !isLoadingMessages) {
      console.log('Attempting to scroll to message:', messageId);
      console.log('Total messages:', messages.length);
      const targetMessage = messages.find(msg => msg.id === messageId);
      console.log('Target message found:', targetMessage ? 'yes' : 'no');
      if (targetMessage) {
        setTimeout(() => {
          if (flatListRef.current) {
            console.log('Scrolling to item:', targetMessage);
            flatListRef.current.scrollToItem({
              item: targetMessage,
              animated: true,
              viewPosition: 0.1, // Position message near the top
            });
          } else {
            console.log('FlatList ref is null');
          }
        }, 1000); // Increased delay to ensure list is fully rendered
      } else {
        console.log('Message not found in current messages array');
      }
    }
  }, [messageId, messages, isLoadingMessages]);
  useEffect(() => {
    // Mock connection status - always connected
    setIsConnected(true);
    
    // Fetch all users for forwarding
    const fetchUsers = async () => {
      try {
        const authToken = await authStorage.getToken();
        if (!authToken) return;
        
        const usersResponse = await apiService.get('/auth/users', authToken);
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setAllUsers(usersData.users);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    
    fetchUsers();
  }, []);

  // Note: Recording timer is now managed by VoiceRecorder component
  // recordingTime state is kept for compatibility but not actively used

  const toggleMessageSelection = async (messageId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
        if (newSet.size === 0) {
          setSelectionMode(false);
        }
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const startSelectionMode = async (messageId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedMessages(new Set([messageId]));
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const openForwardModal = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowForwardModal(true);
    setForwardRecipients(new Set());
  };

  const toggleRecipient = async (userId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    setForwardRecipients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const forwardMessages = async () => {
    if (!socket || selectedMessages.size === 0 || forwardRecipients.size === 0) return;

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const messagesToForward = messages.filter(msg => selectedMessages.has(msg.id));
      
      for (const recipient of Array.from(forwardRecipients)) {
        for (const msg of messagesToForward) {
          const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          
          socket.emit('sendMessage', {
            to: recipient,
            message: msg.message,
            messageId,
            isForwarded: true,
            forwardedFrom: msg.isForwarded ? msg.forwardedFrom?.id : msg.from,
            replyTo: null,
          });
        }
      }

      // Close modal and reset selection
      setShowForwardModal(false);
      setForwardRecipients(new Set());
      cancelSelection();
      
      Alert.alert('Success', `Message${selectedMessages.size > 1 ? 's' : ''} forwarded to ${forwardRecipients.size} recipient${forwardRecipients.size > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to forward messages:', error);
      Alert.alert('Error', 'Failed to forward messages');
    }
  };
  const sendVoiceMessage = async (voiceUri: string, duration: number) => {
    if (!socket) {
      Alert.alert('Error', 'Connection not established');
      return;
    }

    try {
      setIsRecording(true);
      const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      console.log('Starting voice message send:', { voiceUri, duration, messageId });
      
      // Create FormData to upload voice file
      const formData = new FormData();
      const fileName = `voice_${messageId}.m4a`;
      formData.append('voiceMessage', {
        uri: voiceUri,
        name: fileName,
        type: 'audio/m4a',
      } as any);
      
      // Upload voice file to server
      const authToken = await authStorage.getToken();
      if (!authToken) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const uploadResponse = await fetch('http://192.168.29.157:8080/api/auth/voice-message', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload voice message');
      }

      const uploadData = await uploadResponse.json();
      const voiceUrl = uploadData.voiceUrl;

      console.log('Voice upload successful:', { voiceUrl, duration });

      // Create message with voice data
      const messageData: Message = {
        id: messageId,
        from: currentUserId,
        to: userId,
        message: '[Voice Message]',
        voiceUrl: voiceUrl,
        voiceDuration: duration,
        messageType: 'voice',
        replyTo: replyingTo || null,
        timestamp: new Date(),
        status: 'sending'
      };

      console.log('Adding voice message to state:', messageData);
      setMessages(prev => mergeMessages(prev, messageData));
      
      // Emit socket event
      socket.emit('sendVoiceMessage', {
        to: userId,
        messageId,
        voiceUrl,
        voiceDuration: duration,
        replyTo: replyingTo ? replyingTo.id : null,
      });

      setReplyingTo(null);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setIsRecording(false);
    }
  };

  const handleVoiceListened = async (messageId: string) => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      console.log('Voice message finished playing, marking as listened:', messageId);

      // Call API to mark voice as listened
      const response = await fetch(`http://192.168.29.157:8080/api/auth/messages/${messageId}/voice-listened`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark voice as listened');
      }

      const data = await response.json();
      console.log('Voice marked as listened, response:', data);

      // Update local message state
      setMessages(prev => {
        const updated = prev.map(msg => {
          if (msg.id === messageId) {
            console.log('Updating message', messageId, 'with voiceListenedBy:', data.voiceListenedBy);
            return { ...msg, voiceListenedBy: data.voiceListenedBy };
          }
          return msg;
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to mark voice as listened:', error);
    }
  };

  const sendMessage = () => {
    if (!socket || !inputMessage.trim()) return;
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const messageData = {
      id: messageId,
      from: currentUserId,
      to: userId,
      message: inputMessage.trim(),
      replyTo: replyingTo,
      timestamp: new Date(),
      status: 'sending' as const
    };
    setMessages(prev => mergeMessages(prev, messageData));
    socket.emit('sendMessage', { to: userId, message: inputMessage.trim(), messageId, replyTo: replyingTo ? replyingTo.id : null });
    setInputMessage('');
    setReplyingTo(null); // Clear reply state after sending
   
    // Scroll to bottom after sending message
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  };
  const handleEmojiSelected = (emoji: string) => {
    setInputMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };
  const fetchEmojis = async () => {
    // Categorized emoji list
const emojiCategories = [
  {
    title: 'Faces',
    data: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
      '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
      '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
      '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
      '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
      '😾'
    ]
  },
  {
    title: 'Hearts',
    data: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️'
    ]
  },
  {
    title: 'Animals',
    data: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
      '🦗', '🕷️', '🕸️', '🦂', '🐢', '🦎', '🐍', '🦕', '🦖', '🦑',
      '🦐', '🦞', '🦀', '🐙', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈',
      '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪',
      '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑',
      '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓',
      '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡',
      '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'
    ]
  },
  {
    title: 'Nature',
    data: [
      '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀',
      '🎋', '🎍', '🌾', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌸'
    ]
  },
  {
    title: 'Food',
    data: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
      '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅',
      '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
      '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔',
      '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗',
      '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟',
      '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡',
      '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬',
      '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖',
      '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷',
      '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣',
      '🥡', '🥢', '🧂'
    ]
  },
  {
    title: 'Activities',
    data: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
      '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
      '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
      '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓',
      '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇',
      '🤦', '🤷', '🧑‍⚕️', '👨‍⚕️', '👩‍⚕️', '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧑‍🏫', '👨‍🏫',
      '👩‍🏫', '🧑‍⚖️', '👨‍⚖️', '👩‍⚖️', '🧑‍🌾', '👨‍🌾', '👩‍🌾', '🧑‍🍳', '👨‍🍳', '👩‍🍳',
      '🧑‍🔧', '👨‍🔧', '👩‍🔧', '🧑‍🏭', '👨‍🏭', '👩‍🏭', '🧑‍💼', '👨‍💼', '👩‍💼', '🧑‍🔬',
      '👨‍🔬', '👩‍🔬', '🧑‍💻', '👨‍💻', '👩‍💻', '🧑‍🎤', '👨‍🎤', '👩‍🎤', '🧑‍🎨', '👨‍🎨',
      '👩‍🎨', '🧑‍✈️', '👨‍✈️', '👩‍✈️', '🧑‍🚀', '👨‍🚀', '👩‍🚀', '🧑‍🚒', '👨‍🚒', '👩‍🚒',
      '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸', '👳', '👲', '🧕',
      '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙',
      '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆', '💇', '🚶', '🧍',
      '🧎', '🧑‍🦯', '👨‍🦯', '👩‍🦯', '🧑‍🦼', '👨‍🦼', '👩‍🦼', '🧑‍🦽', '👨‍🦽', '👩‍🦽',
      '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗', '🤺', '🏇', '⛷️',
      '🏂', '🏌️', '🏄', '🚣', '🏊', '⛹️', '🏋️', '🚴', '🚵', '🤸',
      '🤼', '🤽', '🤾', '🤹', '🧘', '🛀', '🛌', '👭', '👫', '👬',
      '💏', '💑', '👪', '🗣️', '👤', '👥', '🫂'
    ]
  },
  {
    title: 'Travel',
    data: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
      '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
      '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
      '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
      '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽',
      '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯',
      '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋',
      '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️',
      '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫',
      '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️',
      '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇',
      '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁'
    ]
  },
  {
    title: 'Objects',
    data: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
      '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
      '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
      '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛',
      '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱',
      '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️',
      '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️',
      '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠',
      '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿',
      '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑',
      '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞',
      '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊',
      '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌',
      '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮',
      '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️',
      '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁',
      '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘',
      '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏',
      '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝',
      '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'
    ]
  },
  {
    title: 'Flags',
    data: [
      '🇮🇳', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇯🇵', '🇨🇳', '🇰🇷', '🇧🇷', '🇷🇺',
      '🇮🇹', '🇪🇸', '🇲🇽', '🇨🇦', '🇦🇺', '🇳🇱', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮',
      '🇵🇱', '�🇷', '🇨🇭', '🇹🇷', '🇿🇦', '🇪🇬', '🇹🇭', '🇻🇳', '🇵🇭', '🇸🇬',
      '🇲🇾', '🇮🇩', '🇵🇰', '🇧🇩', '🇳🇬', '🇰🇪', '🇬🇭', '🇲🇦', '🇵🇪', '🇨🇱',
      '🇨🇴', '🇻🇪', '🇪🇨', '🇧🇴', '🇵🇾', '🇺🇾', '🇬🇹', '🇭🇳', '🇸🇻', '🇳🇮',
      '🇨🇷', '🇵🇦', '🇯🇲', '🇭🇹', '🇩🇴', '🇨🇺', '🇵🇷', '🇧🇸', '🇧🇧', '🇹🇹',
      '�🏴‍☠️', '🏁', '🚩', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🎌', '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '🏴󠁧�󠁮󠁩�󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
    ]
  },
  {
    title: 'Symbols',
    data: [
      '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💬', '👁️‍🗨️',
      '🗨️', '🗯️', '💭', '🤚', '❤️', '🧡', '💛', '💚', '💙', '💜',
      '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯',
      '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌',
      '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑',
      '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️',
      '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️',
      '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛',
      '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵',
      '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️',
      '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️',
      '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿',
      '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺',
      '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤',
      '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣',
      '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢',
      '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️',
      '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️',
      '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️',
      '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖',
      '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰',
      '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴',
      '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻',
      '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽',
      '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜',
      '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬',
      '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐',
      '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚',
      '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤',
      '🕥', '🕦', '🕧'
    ]
  }
];
    setEmojis(emojiCategories);
  };
  const deleteForMe = async (message: Message) => {
    if (socket && message.id) {
      socket.emit('deleteForMe', { messageId: message.id });
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
      setPinnedMessages(prev => prev.filter(msg => msg.id !== message.id));
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const deleteForEveryone = (message: Message) => {
    if (socket && message.id) {
      socket.emit('deleteForEveryone', { messageId: message.id });
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
      setPinnedMessages(prev => prev.filter(msg => msg.id !== message.id));
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const copyMessage = async (message: Message) => {
    try {
      await Clipboard.setString(message.message);
      setShowCopyToast(true);
      // Hide toast after 2 seconds
      setTimeout(() => setShowCopyToast(false), 2000);
      // Play vibrant haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.error('Failed to copy message:', error);
      Alert.alert('Error', 'Failed to copy message');
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const pinMessage = async (message: Message) => {
    try {
      const authToken = await authStorage.getToken();
      if (!authToken) return;
      const response = await apiService.put(`/auth/messages/${message.id}/pin`, {}, authToken);
      if (response.ok) {
        // Update pinned status in messages array and update pinnedMessages
        setMessages(prev => prev.map(msg =>
          msg.id === message.id ? { ...msg, pinned: true } : msg
        ));
        setPinnedMessages(prev => {
          const updatedMessage = { ...message, pinned: true };
          return [updatedMessage, ...prev.filter(msg => msg.id !== message.id)];
        });
      } else {
        Alert.alert('Error', 'Failed to pin message');
      }
    } catch (error) {
      console.error('Failed to pin message:', error);
      Alert.alert('Error', 'Failed to pin message');
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const unpinMessage = async (message: Message) => {
    try {
      const authToken = await authStorage.getToken();
      if (!authToken) return;
      const response = await apiService.put(`/auth/messages/${message.id}/unpin`, {}, authToken);
      if (response.ok) {
        // Update pinned status in messages array and remove from pinnedMessages
        setMessages(prev => prev.map(msg =>
          msg.id === message.id ? { ...msg, pinned: false } : msg
        ));
        setPinnedMessages(prev => prev.filter(msg => msg.id !== message.id));
      } else {
        Alert.alert('Error', 'Failed to unpin message');
      }
    } catch (error) {
      console.error('Failed to unpin message:', error);
      Alert.alert('Error', 'Failed to unpin message');
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const favouriteMessage = async (message: Message) => {
    try {
      const authToken = await authStorage.getToken();
      if (!authToken) return;
      await apiService.favouriteMessage(authToken, message.id);
      // Update favourite status in messages array
      setMessages(prev => prev.map(msg =>
        msg.id === message.id ? { ...msg, favourite: true } : msg
      ));
    } catch (error) {
      console.error('Failed to favourite message:', error);
      Alert.alert('Error', 'Failed to favourite message');
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const unfavouriteMessage = async (message: Message) => {
    try {
      const authToken = await authStorage.getToken();
      if (!authToken) return;
      await apiService.unfavouriteMessage(authToken, message.id);
      // Update favourite status in messages array
      setMessages(prev => prev.map(msg =>
        msg.id === message.id ? { ...msg, favourite: false } : msg
      ));
    } catch (error) {
      console.error('Failed to unfavourite message:', error);
      Alert.alert('Error', 'Failed to unfavourite message');
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const showMessageMenu = async (message: Message) => {
    setSelectedMessage(message);
    setSelectedMessageId(message.id || '');
    setMenuVisible(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }
  };
  const showMessageInfo = async (message: Message) => {
    setMessageInfo(message);
    setInfoVisible(true);
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.from === currentUserId;
    const isMessageSelected = selectedMessages.has(item.id);
    const theirBubbleColor = isLightMode ? '#FFFFFF' : '#202C33';
    const myBubbleColor = isLightMode ? '#DCF8C6' : '#005C4B';
    const isVoiceMessage = item.messageType === 'voice' && item.voiceUrl;

    // Debug logging
    if (item.messageType === 'voice') {
      console.log('Voice message detected:', {
        id: item.id,
        messageType: item.messageType,
        voiceUrl: item.voiceUrl,
        voiceDuration: item.voiceDuration,
        isVoiceMessage
      });
    }

    const handlePress = () => {
      if (selectionMode) {
        toggleMessageSelection(item.id);
      }
    };

    const handleLongPress = () => {
      showMessageMenu(item);
    };

    const renderStatusTicks = () => {
      if (!isMine) return null;
      if (!isConnected) {
        return <Feather name="clock" size={12} color={isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />;
      }
      switch (item.status) {
        case 'sending':
          return <Feather name="clock" size={12} color={isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />;
        case 'sent':
          return <Feather name="check" size={14} color={isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />;
        case 'delivered':
          return (
            <View style={styles.doubleCheck}>
              <Feather name="check" size={14} color={isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} />
              <Feather name="check" size={14} color={isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: -8 }} />
            </View>
          );
        case 'read':
          return (
            <View style={styles.doubleCheck}>
              <Feather name="check" size={14} color="#53BDEB" />
              <Feather name="check" size={14} color="#53BDEB" style={{ marginLeft: -8 }} />
            </View>
          );
        default:
          return <Feather name="clock" size={12} color={isLightMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />;
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.messageWrapper,
          isMine ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
      >
        {selectionMode && (
          <View style={styles.selectionCheckbox}>
            <View style={[
              styles.checkboxCircle,
              { borderColor: isLightMode ? '#25D366' : '#00A884' },
              isMessageSelected && { backgroundColor: isLightMode ? '#25D366' : '#00A884' }
            ]}>
              {isMessageSelected && <Feather name="check" size={16} color="#FFFFFF" />}
            </View>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            item.replyTo && styles.messageBubbleWithReply,
            isMine
              ? [styles.myMessageBubble, { backgroundColor: myBubbleColor }]
              : [styles.theirMessageBubble, { backgroundColor: theirBubbleColor }],
            isMessageSelected && styles.selectedMessage,
            isVoiceMessage && styles.voiceMessageBubble,
          ]}
        >
          {item.isForwarded && (
            <View style={styles.forwardedIndicator}>
              <Feather name="corner-up-right" size={14} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.forwardedText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                Forwarded
              </Text>
            </View>
          )}
          {item.replyTo && (
            <View style={[styles.repliedMessageContainer, { backgroundColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }]}>
              <View style={[styles.repliedMessageLine, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]} />
              <View style={styles.repliedMessageContent}>
                <Text style={[styles.repliedMessageLabel, { color: isLightMode ? '#25D366' : '#00A884' }]} numberOfLines={1}>
                  {item.replyTo.from === currentUserId ? 'You' : (item.replyTo.fromUser?.name || 'Unknown')}
                </Text>
                <Text style={[styles.repliedMessageText, { color: isLightMode ? '#667781' : '#8696A0' }]} numberOfLines={1}>
                  {item.replyTo.message || 'Voice message'}
                </Text>
              </View>
            </View>
          )}
          
          {isVoiceMessage ? (
            <View>
              <VoiceMessage
                messageId={item.id}
                voiceUrl={item.voiceUrl!}
                duration={item.voiceDuration || 0}
                isPlaying={playingVoiceMessageId === item.id}
                onPlay={() => setPlayingVoiceMessageId(item.id)}
                onPause={() => setPlayingVoiceMessageId(null)}
                isMine={isMine}
                isLightMode={isLightMode}
                voiceListenedBy={item.voiceListenedBy || []}
                currentUserId={currentUserId}
                onVoiceListened={handleVoiceListened}
              />
              <View style={styles.messageFooter}>
                {item.pinned && (
                  <Feather name="map-pin" size={12} color={isMine ? (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(233,237,239,0.6)') : (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(134,150,160,0.8)')} style={styles.pinIndicator} />
                )}
                {item.favourite && (
                  <Feather name="star" size={12} color="#FFD700" style={styles.favouriteIndicator} />
                )}
                <Text style={[
                  styles.messageTime,
                  { color: isMine ? (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(233,237,239,0.6)') : (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(134,150,160,0.8)') }
                ]}>
                  {item.timestamp instanceof Date ? item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid time'}
                </Text>
                {renderStatusTicks()}
              </View>
            </View>
          ) : (
            <>
              <Text style={[
                styles.messageText,
                { color: isMine ? (isLightMode ? '#000000' : '#E9EDEF') : (isLightMode ? '#000000' : '#E9EDEF') }
              ]}>
                {item.message}
              </Text>
              <View style={styles.messageFooter}>
                {item.pinned && (
                  <Feather name="map-pin" size={12} color={isMine ? (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(233,237,239,0.6)') : (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(134,150,160,0.8)')} style={styles.pinIndicator} />
                )}
                {item.favourite && (
                  <Feather name="star" size={12} color="#FFD700" style={styles.favouriteIndicator} />
                )}
                <Text style={[
                  styles.messageTime,
                  { color: isMine ? (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(233,237,239,0.6)') : (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(134,150,160,0.8)') }
                ]}>
                  {item.timestamp instanceof Date ? item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid time'}
                </Text>
                {renderStatusTicks()}
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
      {/* Wallpaper Background */}
      {chatWallpaper && chatWallpaper.type !== 'default' && (
        chatWallpaper.type === 'custom' && chatWallpaper.customUrl ? (
          <Image
            source={{ uri: chatWallpaper.customUrl }}
            style={styles.wallpaperBackground}
            resizeMode="cover"
          />
        ) : chatWallpaper.type === 'solid' ? (
          <View
            style={[styles.wallpaperBackground, { backgroundColor: solidColorMap[chatWallpaper.id as keyof typeof solidColorMap] || '#FFFFFF' }]}
          />
        ) : (
          wallpaperImages[chatWallpaper.id || ''] && (
            <Image
              source={wallpaperImages[chatWallpaper.id || '']}
              style={styles.wallpaperBackground}
              resizeMode="cover"
            />
          )
        )
      )}
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        {selectionMode ? (
          <>
            <TouchableOpacity onPress={cancelSelection} style={styles.backButton}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.selectionCount}>{selectedMessages.size} selected</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerActionButton} onPress={openForwardModal}>
                <Feather name="corner-up-right" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          
            <TouchableOpacity style={styles.headerUserInfo} onPress={() => router.push(('/contactinfo?userId=' + userId + '&userName=' + encodeURIComponent(userName)) as any)}>
              {otherUser?.avatarUrl && otherUser.avatarUrl.trim() ? (
                <Image
                  source={{ uri: otherUser.avatarUrl }}
                  style={styles.headerAvatar}
                  onError={() => console.log('Image load error for user:', otherUser.name)}
                />
              ) : (
                <View style={[styles.headerAvatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942' }]}>
                  <Text style={[styles.headerAvatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                    {userName ? userName.charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
              )}
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerName} numberOfLines={1}>{userName}</Text>
                <Text style={styles.headerStatus}>{getUserStatusText()}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerActionButton}>
                <Feather name="video" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionButton}>
                <Feather name="phone" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      {/* Messages Area */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          {/* Pinned Messages Section */}
          {pinnedMessages.length > 0 && (
            <View style={[styles.pinnedMessagesContainer, { backgroundColor: isLightMode ? '#F0F2F5' : '#1F2C34' }]}>
              <View style={styles.pinnedMessagesHeader}>
                <Feather name="map-pin" size={16} color={isLightMode ? '#667781' : '#8696A0'} />
                <Text style={[styles.pinnedMessagesTitle, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Pinned Messages ({pinnedMessages.length})
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinnedMessagesList}>
                {pinnedMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[styles.pinnedMessageItem, { backgroundColor: isLightMode ? '#FFFFFF' : '#2A3942' }]}
                  >
                    <TouchableOpacity
                      style={styles.pinnedMessageContent}
                      onPress={() => showMessageMenu(message)}
                    >
                      <Text style={[styles.pinnedMessageText, { color: isLightMode ? '#000000' : '#E9EDEF' }]} numberOfLines={2}>
                        {message.message}
                      </Text>
                      <Text style={[styles.pinnedMessageTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                        {message.timestamp instanceof Date ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid time'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pinnedMessageUnpinButton}
                      onPress={() => {
                        const currentMessage = pinnedMessages.find(msg => msg.id === message.id);
                        if (currentMessage) {
                          unpinMessage(currentMessage);
                        }
                      }}
                    >
                      <Feather name="x" size={16} color={isLightMode ? '#667781' : '#8696A0'} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          {isLoadingMessages ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: isLightMode ? '#667781' : '#8696A0' }]}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => item.id ? `msg-${item.id}` : `msg-fallback-${index}`}
              renderItem={renderMessage}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              inverted={true}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="message-circle" size={64} color={isLightMode ? '#DFE5E7' : '#2A3942'} />
                  <Text style={[styles.emptyText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                    No messages yet
                  </Text>
                  <Text style={[styles.emptySubtext, { color: isLightMode ? '#8696A0' : '#667781' }]}>
                    Send a message to start the conversation
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </TouchableWithoutFeedback>
      {/* Reply UI */}
      {replyingTo && (
        <View style={[styles.replyContainer, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34', borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
          <View style={styles.replyContent}>
            <View style={[styles.replyLine, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]} />
            <View style={styles.replyTextContainer}>
              <Text style={[styles.replyLabel, { color: isLightMode ? '#25D366' : '#00A884' }]}>
                Replying to {replyingTo.from === currentUserId ? 'yourself' : (replyingTo.fromUser?.name || 'Unknown')}
              </Text>
              <Text style={[styles.replyMessage, { color: isLightMode ? '#667781' : '#8696A0' }]} numberOfLines={1}>
                {replyingTo.message}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.replyCloseButton}
              onPress={() => setReplyingTo(null)}
            >
              <Feather name="x" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* WhatsApp-style Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: isLightMode ? '#F0F2F5' : '#1F2C34', borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
        {isRecording ? (
          // Full recording UI with waveform, cancel and send buttons
          <VoiceRecorder
            onVoiceRecorded={sendVoiceMessage}
            isLightMode={isLightMode}
            onRecordingStart={() => setIsRecording(true)}
            onRecordingEnd={() => setIsRecording(false)}
          />
        ) : (
          <>
            <View style={[styles.inputWrapper, { backgroundColor: isLightMode ? '#FFFFFF' : '#2A3942' }]}>
              <TouchableOpacity style={styles.emojiButton} onPress={() => {
                setShowEmojiPicker(!showEmojiPicker);
                if (!showEmojiPicker && emojis.length === 0) {
                  fetchEmojis();
                  setSelectedEmojiCategory('faces');
                }
              }}>
                <Feather name="smile" size={24} color={isLightMode ? '#8696A0' : '#8696A0'} />
              </TouchableOpacity>
            
              <TextInput
                style={[styles.messageInput, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                value={inputMessage}
                onChangeText={setInputMessage}
                placeholder="Message"
                placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                multiline
                maxLength={1000}
              />
            
              <TouchableOpacity style={styles.attachButton}>
                <Feather name="paperclip" size={22} color={isLightMode ? '#8696A0' : '#8696A0'} />
              </TouchableOpacity>
            
              {!inputMessage.trim() && (
                <TouchableOpacity style={styles.cameraButton}>
                  <Feather name="camera" size={22} color={isLightMode ? '#8696A0' : '#8696A0'} />
                </TouchableOpacity>
              )}
            </View>
            {inputMessage.trim() ? (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}
                onPress={sendMessage}
              >
                <Feather name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <VoiceRecorder
                onVoiceRecorded={sendVoiceMessage}
                isLightMode={isLightMode}
                onRecordingStart={() => setIsRecording(true)}
                onRecordingEnd={() => setIsRecording(false)}
              />
            )}
          </>
        )}
      </View>
      {/* Emoji Picker Modal */}
      <Modal
        visible={showEmojiPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmojiPicker(false)}
      >
        <TouchableOpacity
          style={styles.emojiModalOverlay}
          activeOpacity={1}
          onPress={() => setShowEmojiPicker(false)}
        >
          <View style={[styles.emojiPickerContainer, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            {/* Category Tabs */}
            <View style={[styles.emojiTabs, { borderBottomWidth: 1, borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiTabsContent}>
                {emojis.map((category, index) => (
                  <TouchableOpacity
                    key={category.title}
                    style={[
                      styles.emojiTab,
                      selectedEmojiCategory === category.title.toLowerCase() && { backgroundColor: isLightMode ? '#E3F2FD' : '#2A3942' }
                    ]}
                    onPress={() => setSelectedEmojiCategory(category.title.toLowerCase())}
                  >
                    <Text style={[
                      styles.emojiTabText,
                      selectedEmojiCategory === category.title.toLowerCase() && { color: isLightMode ? '#1976D2' : '#53BDEB' },
                      { color: isLightMode ? '#667781' : '#8696A0' }
                    ]}>
                      {category.title === 'Faces' ? '😀' :
                       category.title === 'Hearts' ? '❤️' :
                       category.title === 'Animals' ? '🐶' :
                       category.title === 'Nature' ? '🌿' :
                       category.title === 'Food' ? '🍎' :
                       category.title === 'Activities' ? '👋' :
                       category.title === 'Travel' ? '✈️' :
                       category.title === 'Objects' ? '💻' :
                       category.title === 'Flags' ? '🏁' :
                       category.title === 'Symbols' ? '💯' : '😀'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Emoji Grid */}
            <FlatList
              data={emojis.find(category => category.title.toLowerCase() === selectedEmojiCategory)?.data || []}
              keyExtractor={(item, index) => index.toString()}
              numColumns={8}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.emojiItem}
                  onPress={() => handleEmojiSelected(item)}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.emojiList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Message Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setMenuVisible(false);
          setSelectedMessageId(null);
          setSelectedMessage(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMenuVisible(false);
            setSelectedMessageId(null);
            setSelectedMessage(null);
          }}
        >
          <View style={[styles.menuModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            {selectedMessage && selectedMessage.from === currentUserId ? (
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    setMenuVisible(false);
                    setSelectedMessageId(null);
                    setSelectedMessage(null);
                    startSelectionMode(selectedMessage!.id);
                  }}
                >
                  <Feather name="check-square" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Select</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    setMenuVisible(false);
                    setSelectedMessageId(null);
                    setSelectedMessage(null);
                    setSelectedMessages(new Set([selectedMessage!.id]));
                    setShowForwardModal(true);
                    setForwardRecipients(new Set());
                  }}
                >
                  <Feather name="corner-up-right" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Forward</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      showMessageInfo(currentMessage);
                    }
                  }}
                >
                  <Feather name="info" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Info</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      copyMessage(currentMessage);
                    }
                  }}
                >
                  <Feather name="copy" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      if (currentMessage.pinned) {
                        unpinMessage(currentMessage);
                      } else {
                        pinMessage(currentMessage);
                      }
                    }
                  }}
                >
                  <Feather name={selectedMessage?.pinned ? "minus-circle" : "map-pin"} size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>{selectedMessage?.pinned ? 'Unpin' : 'Pin'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      if (currentMessage.favourite) {
                        unfavouriteMessage(currentMessage);
                      } else {
                        favouriteMessage(currentMessage);
                      }
                    }
                  }}
                >
                  <Feather name="star" size={20} color={selectedMessage?.favourite ? "#FFD700" : (isLightMode ? '#667781' : '#8696A0')} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>{selectedMessage?.favourite ? 'Unfavourite' : 'Favourite'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      setReplyingTo(currentMessage);
                    }
                    setMenuVisible(false);
                    setSelectedMessageId(null);
                    setSelectedMessage(null);
                  }}
                >
                  <Feather name="corner-up-left" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      deleteForMe(currentMessage);
                    }
                  }}
                >
                  <Feather name="trash-2" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Delete for me</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      deleteForEveryone(currentMessage);
                    }
                  }}
                >
                  <Feather name="trash" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Delete for everyone</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    setMenuVisible(false);
                    setSelectedMessageId(null);
                    setSelectedMessage(null);
                    startSelectionMode(selectedMessage!.id);
                  }}
                >
                  <Feather name="check-square" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Select</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    setMenuVisible(false);
                    setSelectedMessageId(null);
                    setSelectedMessage(null);
                    setSelectedMessages(new Set([selectedMessage!.id]));
                    setShowForwardModal(true);
                    setForwardRecipients(new Set());
                  }}
                >
                  <Feather name="corner-up-right" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Forward</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      showMessageInfo(currentMessage);
                    }
                  }}
                >
                  <Feather name="info" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Info</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      copyMessage(currentMessage);
                    }
                  }}
                >
                  <Feather name="copy" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      if (currentMessage.pinned) {
                        unpinMessage(currentMessage);
                      } else {
                        pinMessage(currentMessage);
                      }
                    }
                  }}
                >
                  <Feather name={selectedMessage?.pinned ? "minus-circle" : "map-pin"} size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>{selectedMessage?.pinned ? 'Unpin' : 'Pin'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      if (currentMessage.favourite) {
                        unfavouriteMessage(currentMessage);
                      } else {
                        favouriteMessage(currentMessage);
                      }
                    }
                  }}
                >
                  <Feather name="star" size={20} color={selectedMessage?.favourite ? "#FFD700" : (isLightMode ? '#667781' : '#8696A0')} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>{selectedMessage?.favourite ? 'Unfavourite' : 'Favourite'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      setReplyingTo(currentMessage);
                    }
                    setMenuVisible(false);
                    setSelectedMessageId(null);
                    setSelectedMessage(null);
                  }}
                >
                  <Feather name="corner-up-left" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Reply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                    if (currentMessage) {
                      deleteForMe(currentMessage);
                    }
                  }}
                >
                  <Feather name="trash-2" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Message Info Modal */}
      <Modal
        visible={infoVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setInfoVisible(false)}
        >
          <View style={[styles.infoModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            <Text style={[styles.infoTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Message Info</Text>
          
            <View style={styles.infoRow}>
              <Feather name="check" size={16} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.infoLabel, { color: isLightMode ? '#667781' : '#8696A0' }]}>Sent</Text>
              <Text style={[styles.infoValue, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                {messageInfo?.timestamp ? new Date(messageInfo.timestamp).toLocaleString() : 'N/A'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Feather name="check-circle" size={16} color={isLightMode ? '#667781' : '#8696A0'} />
              <Text style={[styles.infoLabel, { color: isLightMode ? '#667781' : '#8696A0' }]}>Read</Text>
              <Text style={[styles.infoValue, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                {messageInfo?.readAt ? new Date(messageInfo.readAt).toLocaleString() : 'Not read yet'}
              </Text>
            </View>
            {messageInfo?.messageType === 'voice' && messageInfo?.from === currentUserId && (() => {
              console.log('Voice message info debug:', {
                voiceListenedBy: messageInfo?.voiceListenedBy,
                to: messageInfo?.to,
                from: messageInfo?.from,
                currentUserId,
                includes: messageInfo?.voiceListenedBy?.includes(messageInfo?.to),
              });
              return (
              <View style={styles.infoRow}>
                <Feather 
                  name="headphones" 
                  size={16} 
                  color={messageInfo?.voiceListenedBy?.includes(messageInfo?.to) ? '#25D366' : (isLightMode ? '#667781' : '#8696A0')}
                />
                <Text style={[styles.infoLabel, { color: isLightMode ? '#667781' : '#8696A0' }]}>Played</Text>
                <Text style={[
                  styles.infoValue, 
                  { 
                    color: messageInfo?.voiceListenedBy?.includes(messageInfo?.to) ? '#25D366' : (isLightMode ? '#999999' : '#666666')
                  }
                ]}>
                  {messageInfo?.voiceListenedBy?.includes(messageInfo?.to) ? 'Yes' : 'Not played yet'}
                </Text>
              </View>
              );
            })()}
            <TouchableOpacity
              style={[styles.infoCloseButton, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}
              onPress={() => setInfoVisible(false)}
            >
              <Text style={styles.infoCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => router.back()}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => router.back()}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.passwordModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}
            onPress={() => {}}
          >
            <Text style={[styles.passwordTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
              This chat is locked
            </Text>
            <Text style={[styles.passwordSubtitle, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              Enter your account password to open this chat.
            </Text>
            <View style={[styles.passwordInputContainer, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942', backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942' }]}>
              <TextInput
                style={[styles.passwordInputField, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                secureTextEntry={!showPassword}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowPassword(s => !s)}
                style={styles.eyeIcon}
              >
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={isLightMode ? '#8696A0' : '#667781'} />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordActions}>
              <TouchableOpacity
                style={[styles.passwordCancelButton, { borderColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                onPress={() => {
                  setShowPasswordModal(false);
                  router.back();
                }}
              >
                <Text style={[styles.passwordButtonText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passwordVerifyButton, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}
                onPress={async () => {
                  try {
                    // Mock password verification - always succeed
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const data = { valid: true };
                    if (data && data.valid === true) {
                      setShowPasswordModal(false);
                      setPassword('');
                    } else {
                      Alert.alert('Invalid Password', 'Please enter the correct password to access this chat.');
                    }
                  } catch (err) {
                    Alert.alert('Error', 'Failed to verify password.');
                  }
                }}
              >
                <Text style={styles.passwordVerifyText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Forward Modal */}
      <Modal
        visible={showForwardModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowForwardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.forwardModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            <View style={[styles.forwardModalHeader, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
              <Text style={[styles.forwardModalTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                Forward to...
              </Text>
              <TouchableOpacity onPress={() => setShowForwardModal(false)}>
                <Feather name="x" size={24} color={isLightMode ? '#000000' : '#E9EDEF'} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={allUsers.filter(u => u._id !== userId)}
              keyExtractor={(item) => item._id}
              renderItem={({ item: user }) => {
                const isRecipientSelected = forwardRecipients.has(user._id);
                return (
                  <TouchableOpacity
                    style={[styles.forwardUserItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                    onPress={() => toggleRecipient(user._id)}
                  >
                    <View style={styles.forwardUserInfo}>
                      {user.avatarUrl && user.avatarUrl.trim() ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.forwardUserAvatar} />
                      ) : (
                        <View style={[styles.forwardUserAvatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942' }]}>
                          <Text style={[styles.forwardUserAvatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                            {user.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.forwardUserName, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                        {user.name}
                      </Text>
                    </View>
                    <View style={[
                      styles.forwardCheckbox,
                      { borderColor: isLightMode ? '#25D366' : '#00A884' },
                      isRecipientSelected && { backgroundColor: isLightMode ? '#25D366' : '#00A884' }
                    ]}>
                      {isRecipientSelected && <Feather name="check" size={16} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={styles.forwardUserList}
            />

            <View style={[styles.forwardModalFooter, { borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
              <TouchableOpacity
                style={[styles.forwardButton, {
                  backgroundColor: forwardRecipients.size > 0
                    ? (isLightMode ? '#25D366' : '#00A884')
                    : (isLightMode ? '#E9EDEF' : '#2A3942'),
                  opacity: forwardRecipients.size > 0 ? 1 : 0.5
                }]}
                onPress={forwardMessages}
                disabled={forwardRecipients.size === 0}
              >
                <Feather 
                  name="send" 
                  size={20} 
                  color={
                    forwardRecipients.size > 0 
                      ? '#FFFFFF' 
                      : (isLightMode ? '#667781' : '#FFFFFF')
                  } 
                />
                <Text style={[
                  styles.forwardButtonText, 
                  { 
                    color: forwardRecipients.size > 0 
                      ? '#FFFFFF' 
                      : (isLightMode ? '#667781' : '#FFFFFF') 
                  }
                ]}>
                  Forward {selectedMessages.size > 1 ? `${selectedMessages.size} messages` : 'message'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Copy Toast */}
      {showCopyToast && (
        <View style={styles.copyToast}>
          <View style={[
            styles.copyToastContent,
            isLightMode ? styles.copyToastContentLight : styles.copyToastContentDark
          ]}>
            <Feather name="check" size={18} color={isLightMode ? "#25D366" : "#25D366"} />
            <Text style={[
              styles.copyToastText,
              isLightMode ? styles.copyToastTextLight : styles.copyToastTextDark
            ]}>Message copied</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  wallpaperBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '500',
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  headerStatus: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  messagesList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    backgroundColor: 'transparent',
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
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  theirMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleWithReply: {
    maxWidth: '98%',
    minWidth: '70%',
  },
  myMessageBubble: {
    // All corners rounded
  },
  theirMessageBubble: {
    // All corners rounded
  },
  voiceMessageBubble: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 250,
  },
  selectedMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  pinIndicator: {
    marginRight: 4,
  },
  favouriteIndicator: {
    marginRight: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  tailRight: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderRightWidth: 8,
  },
  tailLeft: {
    position: 'absolute',
    bottom: 0,
    left: 2,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderLeftWidth: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  emojiButton: {
    padding: 4,
    marginRight: 4,
  },
  messageInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 4,
  },
  attachButton: {
    padding: 4,
    marginLeft: 4,
  },
  cameraButton: {
    padding: 4,
    marginLeft: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  emojiPickerContainer: {
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  emojiTabs: {
    height: 50,
  },
  emojiTabsContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  emojiTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  emojiTabText: {
    fontSize: 20,
  },
  emojiList: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  emojiItem: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  emojiText: {
    fontSize: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    borderRadius: 12,
    minWidth: 250,
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
  infoModal: {
    width: '85%',
    borderRadius: 12,
    padding: 24,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    width: 60,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  infoCloseButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  infoCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordModal: {
    width: '85%',
    borderRadius: 12,
    padding: 24,
  },
  passwordTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  passwordSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
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
  passwordCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  passwordVerifyButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  passwordVerifyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  replyContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  replyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyLine: {
    width: 3,
    height: '100%',
    borderRadius: 1.5,
    marginRight: 8,
  },
  replyTextContainer: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyMessage: {
    fontSize: 14,
  },
  replyCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  repliedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
    flex: 1,
  },
  repliedMessageLine: {
    width: 2,
    height: '100%',
    borderRadius: 1,
    marginRight: 6,
  },
  repliedMessageContent: {
    flex: 1,
  },
  repliedMessageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    flexShrink: 1,
  },
  repliedMessageText: {
    fontSize: 13,
    flexShrink: 1,
  },
  copyToast: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    transform: [{ translateY: -50 }],
  },
  copyToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  copyToastContentLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(20px)',
  },
  copyToastContentDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  copyToastText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  copyToastTextLight: {
    color: '#000000',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  copyToastTextDark: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pinnedMessagesContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  pinnedMessagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pinnedMessagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  pinnedMessagesList: {
    paddingHorizontal: 4,
  },
  pinnedMessageItem: {
    flexDirection: 'row',
    minWidth: 200,
    maxWidth: 250,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pinnedMessageContent: {
    flex: 1,
  },
  pinnedMessageUnpinButton: {
    padding: 4,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  pinnedMessageText: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  pinnedMessageTime: {
    fontSize: 12,
  },
  selectionCheckbox: {
    marginRight: 8,
    alignSelf: 'center',
  },
  checkboxCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCount: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  forwardedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  forwardedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  forwardModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  forwardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  forwardModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  forwardUserList: {
    maxHeight: 400,
  },
  forwardUserItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  forwardUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  forwardUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  forwardUserAvatarText: {
    fontSize: 18,
    fontWeight: '500',
  },
  forwardUserName: {
    fontSize: 16,
    flex: 1,
  },
  forwardCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forwardModalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  forwardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  forwardButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});