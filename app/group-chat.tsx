import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { authStorage } from '../utils/authStorage';
import { VoiceRecorder } from '@/components/voice-recorder';
import { VoiceMessage } from '@/components/voice-message';

interface GroupMessage {
  id: string;
  from: string;
  group: string;
  message: string;
  messageType?: 'text' | 'voice' | 'image';
  voiceUrl?: string;
  imageUrl?: string;
  voiceDuration?: number;
  voiceListenedBy?: any[];
  imageViewedBy?: any[];
  readBy?: any[];
  replyTo?: {
    id: string;
    from: string;
    message: string;
    timestamp: Date;
    fromUser?: {
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
  fromUser: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
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
  members: Array<{
    _id: string;
    name: string;
    avatarUrl?: string;
  }>;
}

export default function GroupChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as any;
  const groupId = params.groupId as string;
  const { colors } = useTheme();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GroupMessage | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<GroupMessage[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [fullScreenImageUrl, setFullScreenImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageInfo, setMessageInfo] = useState<any>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<GroupMessage | null>(null);

  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';
  const flatListRef = useRef<FlatList>(null);

  // Helper function to deduplicate user arrays (readBy, voiceListenedBy, imageViewedBy)
  const deduplicateUserArray = (array: any[]) => {
    if (!array || !Array.isArray(array)) return [];
    
    return array.filter((item: any, index: number, self: any[]) => {
      const currentUserId = item.userId?._id || item.userId;
      return index === self.findIndex((i: any) => {
        const iUserId = i.userId?._id || i.userId;
        return iUserId === currentUserId;
      });
    });
  };

  const mergeMessages = (existing: GroupMessage[], incoming: GroupMessage[] | GroupMessage) => {
    const incomingArr = Array.isArray(incoming) ? incoming : [incoming];
    const map = new Map<string, GroupMessage>();
    for (const m of existing) {
      map.set(m.id, m);
    }
    for (const m of incomingArr) {
      map.set(m.id, m);
    }
    const result = Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateA - dateB;
    });
    return result;
  };

  const loadGroupMessages = async (token: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await fetch(`http://192.168.0.150:8080/api/auth/groups/${groupId}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Deduplicate readBy, voiceListenedBy, and imageViewedBy arrays
        const messagesWithDeduplication = (data.messages || []).map((msg: any) => ({
          ...msg,
          readBy: deduplicateUserArray(msg.readBy),
          voiceListenedBy: deduplicateUserArray(msg.voiceListenedBy),
          imageViewedBy: deduplicateUserArray(msg.imageViewedBy),
        }));
        
        setMessages(messagesWithDeduplication);
        const pinned = messagesWithDeduplication.filter((m: GroupMessage) => m.pinned);
        setPinnedMessages(pinned);
        
        // Emit read receipts for unread messages
        if (socket && currentUserId) {
          const unreadMessages = (data.messages || []).filter((m: GroupMessage) => {
            if (m.from === currentUserId) return false; // Don't mark own messages as read
            
            // Check if current user has already read this message
            const hasRead = m.readBy?.some((r: any) => {
              const readUserId = r.userId?._id || r.userId;
              return readUserId === currentUserId;
            });
            
            return !hasRead;
          });
          
          unreadMessages.forEach((msg: GroupMessage) => {
            socket.emit('markMessageAsRead', { messageId: msg.id, groupId });
          });
        }
      }
    } catch (error) {
      console.error('Error loading group messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadGroupData = async (token: string) => {
    try {
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
    } catch (error) {
      console.error('Error loading group data:', error);
    }
  };

  useEffect(() => {
    const initGroupChat = async () => {
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
        const userId = profileData.user.id;
        setCurrentUserId(userId);

        await loadGroupMessages(token);
        await loadGroupData(token);

        const newSocket = io('http://192.168.0.150:8080', {
          auth: { token },
        });

        newSocket.on('connect', () => {
          console.log('Socket connected for group chat');
          setIsConnected(true);
          newSocket.emit('joinGroup', { groupId });
          
          // Mark unread messages as read when socket connects
          (async () => {
            const response = await fetch(`http://192.168.0.150:8080/api/auth/groups/${groupId}/messages`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              const unreadMessages = (data.messages || []).filter((m: GroupMessage) => {
                if (m.from === userId) return false; // Don't mark own messages as read
                
                // Check if current user has already read this message
                const hasRead = m.readBy?.some((r: any) => {
                  const readUserId = r.userId?._id || r.userId;
                  return readUserId === userId;
                });
                
                return !hasRead;
              });
              
              unreadMessages.forEach((msg: GroupMessage) => {
                newSocket.emit('markMessageAsRead', { messageId: msg.id, groupId });
              });
            }
          })();
        });

        newSocket.on('receiveGroupMessage', (messageData: any) => {
          const newMessage: GroupMessage = {
            id: messageData.id,
            from: messageData.from,
            group: messageData.group,
            message: messageData.message,
            timestamp: new Date(messageData.timestamp),
            status: messageData.status || 'delivered',
            deliveredAt: messageData.deliveredAt,
            readAt: messageData.readAt,
            replyTo: messageData.replyTo || null,
            fromUser: messageData.fromUser,
          };
          setMessages(prev => mergeMessages(prev, newMessage));
        });

        newSocket.on('receiveGroupVoiceMessage', (messageData: any) => {
          const newMessage: GroupMessage = {
            id: messageData.id,
            from: messageData.from,
            group: messageData.group,
            message: messageData.message,
            messageType: 'voice',
            voiceUrl: messageData.voiceUrl,
            voiceDuration: messageData.voiceDuration,
            voiceListenedBy: messageData.voiceListenedBy || [],
            timestamp: new Date(messageData.timestamp),
            status: messageData.status || 'delivered',
            replyTo: messageData.replyTo || null,
            fromUser: messageData.fromUser,
          };
          setMessages(prev => mergeMessages(prev, newMessage));
        });

        newSocket.on('receiveGroupImageMessage', (messageData: any) => {
          const newMessage: GroupMessage = {
            id: messageData.id,
            from: messageData.from,
            group: messageData.group,
            message: messageData.message,
            messageType: 'image',
            imageUrl: messageData.imageUrl,
            timestamp: new Date(messageData.timestamp),
            status: messageData.status || 'delivered',
            replyTo: messageData.replyTo || null,
            fromUser: messageData.fromUser,
          };
          setMessages(prev => mergeMessages(prev, newMessage));
        });

        newSocket.on('messageSent', (data: any) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === data.messageId ? { ...msg, id: data.dbId, status: 'sent' } : msg
            )
          );
        });

        newSocket.on('messageDeleted', (data: any) => {
          setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        });

        // Handle read receipt updates with user tracking
        newSocket.on('messageReadReceipt', (data: any) => {
          setMessages(prev =>
            prev.map(msg => {
              if (msg.id === data.messageId) {
                return { 
                  ...msg, 
                  status: data.status, 
                  readAt: data.readAt,
                  readBy: deduplicateUserArray(data.readBy || msg.readBy || [])
                };
              }
              return msg;
            })
          );
        });

        // Handle voice message listen updates
        newSocket.on('voiceMessageListenUpdate', (data: any) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === data.messageId 
                ? { ...msg, voiceListenedBy: deduplicateUserArray(data.voiceListenedBy || []) } 
                : msg
            )
          );
        });

        // Handle image view updates
        newSocket.on('imageViewUpdate', (data: any) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === data.messageId 
                ? { ...msg, imageViewedBy: deduplicateUserArray(data.imageViewedBy || []) } 
                : msg
            )
          );
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
          setIsConnected(false);
        });

        setSocket(newSocket);

        return () => {
          newSocket.disconnect();
        };
      }
    };

    initGroupChat();
  }, [groupId]);

  useFocusEffect(
    React.useCallback(() => {
      if (messages.length > 0 && !isLoadingMessages) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }, [messages, isLoadingMessages])
  );
  

  const toggleMessageSelection = async (messageId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
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

  const sendMessage = () => {
    if (!socket || !inputMessage.trim()) return;

    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const messageData = {
      id: messageId,
      from: currentUserId,
      group: groupId,
      message: inputMessage.trim(),
      replyTo: replyingTo,
      isForwarded: forwardMessage ? true : false,
      forwardedFrom: forwardMessage ? forwardMessage.forwardedFrom : null,
      timestamp: new Date(),
      status: 'sending' as const,
      fromUser: { id: currentUserId, name: '', avatarUrl: undefined },
    };

    setMessages(prev => mergeMessages(prev, messageData));
    socket.emit('sendGroupMessage', {
      groupId,
      message: inputMessage.trim(),
      messageId,
      replyTo: replyingTo ? replyingTo.id : null,
      isForwarded: forwardMessage ? true : false,
      forwardedFrom: forwardMessage ? forwardMessage.forwardedFrom : null,
    });

    setInputMessage('');
    setReplyingTo(null);
    setForwardMessage(null);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendVoiceMessage = async (voiceUri: string, duration: number) => {
    if (!socket) return;

    try {
      const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      const messageData = {
        id: messageId,
        from: currentUserId,
        group: groupId,
        message: '[Voice Message]',
        messageType: 'voice' as const,
        voiceUrl: voiceUri,
        voiceDuration: duration,
        replyTo: replyingTo,
        isForwarded: forwardMessage ? true : false,
        forwardedFrom: forwardMessage ? forwardMessage.forwardedFrom : null,
        timestamp: new Date(),
        status: 'sending' as const,
        fromUser: { id: currentUserId, name: '', avatarUrl: undefined },
      };

      setMessages(prev => mergeMessages(prev, messageData));

      socket.emit('sendGroupVoiceMessage', {
        groupId,
        messageId,
        voiceUrl: voiceUri,
        voiceDuration: duration,
        replyTo: replyingTo ? replyingTo.id : null,
        isForwarded: forwardMessage ? true : false,
        forwardedFrom: forwardMessage ? forwardMessage.forwardedFrom : null,
      });

      setReplyingTo(null);
      setForwardMessage(null);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending voice message:', error);
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const sendImageMessage = async (imageUri: string) => {
    if (!socket) return;

    try {
      const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      const messageData = {
        id: messageId,
        from: currentUserId,
        group: groupId,
        message: '[Image]',
        messageType: 'image' as const,
        imageUrl: imageUri,
        replyTo: replyingTo,
        isForwarded: forwardMessage ? true : false,
        forwardedFrom: forwardMessage ? forwardMessage.forwardedFrom : null,
        timestamp: new Date(),
        status: 'sending' as const,
        fromUser: { id: currentUserId, name: '', avatarUrl: undefined },
      };

      setMessages(prev => mergeMessages(prev, messageData));

      socket.emit('sendGroupImageMessage', {
        groupId,
        messageId,
        imageUrl: imageUri,
        replyTo: replyingTo ? replyingTo.id : null,
        isForwarded: forwardMessage ? true : false,
        forwardedFrom: forwardMessage ? forwardMessage.forwardedFrom : null,
      });

      setReplyingTo(null);
      setForwardMessage(null);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending image message:', error);
      Alert.alert('Error', 'Failed to send image');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        await sendImageMessage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const openCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        await sendImageMessage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const copyMessage = async (message: GroupMessage) => {
    await Clipboard.setStringAsync(message.message);
    setShowCopyToast(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
    setTimeout(() => setShowCopyToast(false), 2000);
  };

  const deleteForMe = async (message: GroupMessage) => {
    if (!socket) return;

    socket.emit('deleteForMe', { messageId: message.id });
    setMessages(prev => prev.filter(msg => msg.id !== message.id));
    setMenuVisible(false);
  };

  const deleteForEveryone = (message: GroupMessage) => {
    if (!socket || message.from !== currentUserId) {
      Alert.alert('Error', 'You can only delete your own messages');
      return;
    }

    Alert.alert('Delete Message', 'Delete this message for everyone?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          socket.emit('deleteForEveryone', { messageId: message.id });
          setMessages(prev => prev.filter(msg => msg.id !== message.id));
          setMenuVisible(false);
        },
      },
    ]);
  };

  const pinMessage = async (message: GroupMessage) => {
    if (!socket) return;

    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch(`http://192.168.0.150:8080/api/auth/messages/${message.id}/pin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev =>
          prev.map(msg => (msg.id === message.id ? { ...msg, pinned: true } : msg))
        );
        const updatedPinned = messages.filter(m => m.pinned || m.id === message.id);
        setPinnedMessages(updatedPinned);
        setMenuVisible(false);
      }
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const unpinMessage = async (message: GroupMessage) => {
    if (!socket) return;

    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch(`http://192.168.0.150:8080/api/auth/messages/${message.id}/unpin`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev =>
          prev.map(msg => (msg.id === message.id ? { ...msg, pinned: false } : msg))
        );
        setPinnedMessages(prev => prev.filter(m => m.id !== message.id));
        setMenuVisible(false);
      }
    } catch (error) {
      console.error('Error unpinning message:', error);
    }
  };

  const favouriteMessage = async (message: GroupMessage) => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch(`http://192.168.0.150:8080/api/auth/messages/${message.id}/favourite`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev =>
          prev.map(msg => (msg.id === message.id ? { ...msg, favourite: true } : msg))
        );
        setMenuVisible(false);
        setSelectedMessageId(null);
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error favouriting message:', error);
    }
  };

  const unfavouriteMessage = async (message: GroupMessage) => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      const response = await fetch(`http://192.168.0.150:8080/api/auth/messages/${message.id}/unfavourite`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setMessages(prev =>
          prev.map(msg => (msg.id === message.id ? { ...msg, favourite: false } : msg))
        );
        setMenuVisible(false);
        setSelectedMessageId(null);
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Error unfavouriting message:', error);
    }
  };

  const handleForwardMessage = (message: GroupMessage) => {
    // Store the message to forward and show it in a way that indicates it's being forwarded
    const forwardedMessage = {
      ...message,
      isForwarded: true,
      forwardedFrom: {
        id: message.from,
        name: message.fromUser?.name || 'Unknown',
        avatarUrl: message.fromUser?.avatarUrl
      }
    };

    // Add the forwarded message to input area with a visual indicator
    if (message.messageType === 'voice' || message.messageType === 'image') {
      // For voice and image, we'll show it as being forwarded
      setForwardMessage(forwardedMessage);
      Alert.alert(
        'Forward Message',
        `Ready to forward ${message.messageType} message. You can now send it in this or another group.`,
        [{ text: 'OK', onPress: () => {} }]
      );
    } else {
      // For text, copy to clipboard and show forwarding message
      copyMessage(message);
      Alert.alert(
        'Forward Message',
        'Message copied to clipboard. You can now paste it in another conversation.',
        [{ text: 'OK', onPress: () => {} }]
      );
    }
    
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };

  const showMessageInfo = async (message: GroupMessage) => {
    try {
      const token = await authStorage.getToken();
      if (!token) return;

      // Fetch detailed message info with read receipts, voice listens, and image views
      const response = await fetch(`http://192.168.0.150:8080/api/auth/messages/${message.id}/details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('========== MESSAGE DETAILS RECEIVED ==========');
        console.log('Full response:', JSON.stringify(data, null, 2));
        console.log('Message ID:', data.message?._id);
        console.log('ReadBy array:', data.message?.readBy);
        console.log('ReadBy length:', data.message?.readBy?.length);
        if (data.message?.readBy && data.message.readBy.length > 0) {
          console.log('First readBy entry:', data.message.readBy[0]);
        }
        console.log('==============================================');
        setMessageInfo(data.message);
      } else {
        console.log('Failed to fetch message details, status:', response.status);
        console.log('Using local message data');
        setMessageInfo(message);
      }
    } catch (error) {
      console.error('Error fetching message details:', error);
      setMessageInfo(message);
    }

    setInfoVisible(true);
    setMenuVisible(false);
    setSelectedMessageId(null);
    setSelectedMessage(null);
  };

  const showMessageMenu = async (message: GroupMessage) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setSelectedMessageId(message.id);
    setMenuVisible(true);
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <Text key={index} style={[styles.messageText, styles.linkText]}>
            {part}
          </Text>
        );
      }
      return (
        <Text key={index} style={styles.messageText}>
          {part}
        </Text>
      );
    });
  };

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const isMyMessage = item.from === currentUserId;
    const isSelected = selectedMessages.has(item.id);

    const handlePress = () => {
      if (selectionMode) {
        toggleMessageSelection(item.id);
      }
    };

    const handleLongPress = () => {
      showMessageMenu(item);
    };

    return (
      <TouchableOpacity
        style={[styles.messageWrapper, isMyMessage && styles.myMessageWrapper]}
        onLongPress={handleLongPress}
        onPress={handlePress}
        delayLongPress={300}
      >
        {selectionMode && (
          <View style={[styles.checkbox, isSelected && { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}>
            {isSelected && <Feather name="check" size={16} color="#FFFFFF" />}
          </View>
        )}

        {!isMyMessage && (
          <Image
            source={item.fromUser?.avatarUrl ? { uri: item.fromUser.avatarUrl } : { uri: 'https://via.placeholder.com/32' }}
            style={styles.avatar}
          />
        )}

        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble, { backgroundColor: isMyMessage ? (isLightMode ? '#DCF8C6' : '#056162') : (isLightMode ? '#FFFFFF' : '#2A3942') }]}>
          {!isMyMessage && (
            <Text style={[styles.senderName, { color: isMyMessage ? colors.text : colors.text }]}>
              {item.fromUser?.name}
            </Text>
          )}

          {item.replyTo && (
            <View
              style={[
                styles.repliedMessageContainer,
                {
                  backgroundColor: isMyMessage ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                  borderLeftColor: isMyMessage ? '#075E54' : '#00A884',
                },
              ]}
            >
              <View style={styles.repliedMessageContent}>
                <Text style={[styles.repliedMessageLabel, { color: isMyMessage ? '#075E54' : '#00A884' }]}>
                  {item.replyTo.fromUser?.name}
                </Text>
                <Text style={[styles.repliedMessageText, { color: colors.text }]} numberOfLines={2}>
                  {item.replyTo.message}
                </Text>
              </View>
            </View>
          )}

          {item.isForwarded && item.forwardedFrom && (
            <View
              style={[
                styles.repliedMessageContainer,
                {
                  backgroundColor: isMyMessage ? 'rgba(3, 100, 235, 0.15)' : 'rgba(3, 100, 235, 0.1)',
                  borderLeftColor: isMyMessage ? '#0364EB' : '#4A9EFF',
                },
              ]}
            >
              <View style={styles.repliedMessageContent}>
                <Text style={[styles.repliedMessageLabel, { color: isMyMessage ? '#0364EB' : '#4A9EFF' }]}>
                  ↪️ Forwarded from {item.forwardedFrom.name}
                </Text>
              </View>
            </View>
          )}

          {item.messageType === 'image' && item.imageUrl ? (
            <TouchableOpacity onPress={() => {
              setFullScreenImageUrl(item.imageUrl || null);
              // Track image view
              if (socket && item.from !== currentUserId) {
                socket.emit('imageViewed', { messageId: item.id, groupId });
              }
            }}>
              <Image source={{ uri: item.imageUrl }} style={styles.imageMessage} />
            </TouchableOpacity>
          ) : item.messageType === 'voice' && item.voiceUrl ? (
            <TouchableOpacity
              style={styles.voiceMessageBubble}
              onPress={() => {
                // Track voice message as listened
                if (socket && item.from !== currentUserId) {
                  socket.emit('voiceMessageListened', { messageId: item.id, groupId });
                }
              }}
            >
              <Feather name="volume-2" size={20} color={isMyMessage ? '#075E54' : '#00A884'} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.messageText, { color: isMyMessage ? '#000000' : colors.text }]}>
                  Voice message {item.voiceDuration ? `(${Math.round(item.voiceDuration)}s)` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, { color: isMyMessage ? '#000000' : colors.text }]}>
              {renderTextWithLinks(item.message)}
            </Text>
          )}

          <View style={styles.messageFooter}>
            {item.pinned && <Text style={{ marginRight: 4, color: isMyMessage ? '#075E54' : '#00A884' }}>📌</Text>}
            <Text style={[styles.messageTime, { color: isMyMessage ? '#666666' : isLightMode ? '#667781' : '#8696A0' }]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMyMessage && (
              <View style={styles.doubleCheck}>
                <Feather name={item.status === 'read' ? 'check' : 'check'} size={14} color={item.status === 'read' ? '#4FC3F7' : '#8696A0'} />
              </View>
            )}
          </View>
        </View>

      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}>
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerUserInfo}>
          {groupData?.avatarUrl ? (
            <Image source={{ uri: groupData.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: isLightMode ? '#DFE5E7' : '#2A3942', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={[styles.headerAvatarText, { color: isLightMode ? '#54656F' : '#8696A0' }]}>
                {groupData?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{groupData?.name}</Text>
            <Text style={styles.headerStatus}>{groupData?.members?.length || 0} members</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerActionButton} onPress={() => router.push((`/group-info?groupId=${groupId}`) as any)}>
          <Feather name="info" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {pinnedMessages.length > 0 && (
        <View style={[styles.pinnedMessagesContainer, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
          <View style={styles.pinnedMessagesHeader}>
            <Text style={{ marginRight: 8, fontSize: 16 }}>📌</Text>
            <Text style={[styles.pinnedMessagesTitle, { color: colors.text }]}>Pinned Messages ({pinnedMessages.length})</Text>
          </View>
        </View>
      )}

      {isLoadingMessages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isLightMode ? '#075E54' : '#00A884'} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="message-circle" size={48} color={colors.text} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No messages yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.text }]}>Start the conversation!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContent}
          onEndReachedThreshold={0.5}
        />
      )}

      {replyingTo && (
        <View style={[styles.replyContainer, { borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942', backgroundColor: colors.background }]}>
          <View style={[styles.replyContent, { backgroundColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
            <View style={[styles.replyLine, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]} />
            <View style={styles.replyTextContainer}>
              <Text style={[styles.replyLabel, { color: isLightMode ? '#075E54' : '#00A884' }]}>Replying to {replyingTo.fromUser?.name}</Text>
              <Text style={[styles.replyMessage, { color: colors.text }]} numberOfLines={1}>
                {replyingTo.message}
              </Text>
            </View>
            <TouchableOpacity style={styles.replyCloseButton} onPress={() => setReplyingTo(null)}>
              <Feather name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {forwardMessage && (
        <View style={[styles.replyContainer, { borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942', backgroundColor: colors.background }]}>
          <View style={[styles.replyContent, { backgroundColor: isLightMode ? 'rgba(3, 100, 235, 0.1)' : 'rgba(3, 100, 235, 0.15)' }]}>
            <View style={[styles.replyLine, { backgroundColor: isLightMode ? '#0364EB' : '#4A9EFF' }]} />
            <View style={styles.replyTextContainer}>
              <Text style={[styles.replyLabel, { color: isLightMode ? '#0364EB' : '#4A9EFF' }]}>Forwarding from {forwardMessage.fromUser?.name}</Text>
              <Text style={[styles.replyMessage, { color: colors.text }]} numberOfLines={1}>
                {forwardMessage.messageType === 'voice' ? '🎤 Voice Message' : forwardMessage.messageType === 'image' ? '🖼️ Image' : forwardMessage.message}
              </Text>
            </View>
            <TouchableOpacity style={styles.replyCloseButton} onPress={() => setForwardMessage(null)}>
              <Feather name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[styles.inputBar, { borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942', backgroundColor: colors.background }]}>
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
            <View style={[styles.inputWrapper, { backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942' }]}>
              <TouchableOpacity style={styles.emojiButton} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Feather name="smile" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              </TouchableOpacity>
              <TextInput
                style={[styles.messageInput, { color: colors.text }]}
                placeholder="Message..."
                placeholderTextColor={isLightMode ? '#667781' : '#8696A0'}
                value={inputMessage}
                onChangeText={setInputMessage}
                multiline
                editable={isConnected}
              />
              <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
                <Feather name="image" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraButton} onPress={openCamera}>
                <Feather name="camera" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
              </TouchableOpacity>
            </View>
            {inputMessage.trim() ? (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: isLightMode ? '#075E54' : '#00A884' }]}
                onPress={sendMessage}
                disabled={!isConnected}
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

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => {
          setMenuVisible(false);
          setSelectedMessageId(null);
          setSelectedMessage(null);
        }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.menuModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
              {selectedMessage && (
                <>
                  {/* Select Option */}
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

                  {/* Info Option */}
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

                  {/* Copy Option - Only for text messages */}
                  {selectedMessage?.messageType !== 'image' && selectedMessage?.messageType !== 'voice' && (
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
                  )}

                  {/* Pin/Unpin - Only for own messages */}
                  {selectedMessage.from === currentUserId && (
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
                  )}

                  {/* Favourite/Unfavourite */}
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

                  {/* Reply */}
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

                  {/* Forward */}
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                    onPress={() => {
                      const currentMessage = messages.find(msg => msg.id === selectedMessageId);
                      if (currentMessage) {
                        handleForwardMessage(currentMessage);
                      }
                    }}
                  >
                    <Feather name="share-2" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                    <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Forward</Text>
                  </TouchableOpacity>

                  {/* Delete for Me */}
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

                  {/* Delete for Everyone - Only for own messages */}
                  {selectedMessage.from === currentUserId && (
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
                  )}
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Message Info Modal */}
      <Modal visible={infoVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setInfoVisible(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.infoModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34', maxHeight: '85%' }]}>
                <Text style={[styles.infoTitle, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Message Info</Text>

                <ScrollView style={styles.infoScrollView}>
                  {/* Message Content Preview */}
                  <View style={[styles.infoSection, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.infoSectionTitle, { color: isLightMode ? '#00A884' : '#00A884', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }]}>Message</Text>
                    <View style={{ 
                      backgroundColor: isLightMode ? '#DCF8C6' : '#056162', 
                      padding: 12, 
                      borderRadius: 8,
                      marginTop: 8 
                    }}>
                      <Text style={[styles.infoValue, { color: isLightMode ? '#111B21' : '#E9EDEF', fontSize: 15, lineHeight: 22 }]}>
                        {messageInfo?.message || '📷 Image / 🎤 Voice Message'}
                      </Text>
                    </View>
                  </View>

                  {/* Sent Time */}
                  <View style={[styles.infoSection, { paddingTop: 16, paddingBottom: 8 }]}>
                    <View style={styles.infoRow}>
                      <View style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20, 
                        backgroundColor: isLightMode ? '#F0F2F5' : '#2A3942',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12
                      }}>
                        <Feather name="clock" size={20} color={isLightMode ? '#00A884' : '#00A884'} />
                      </View>
                      <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: isLightMode ? '#111B21' : '#E9EDEF', fontSize: 16, fontWeight: '500' }]}>Sent</Text>
                        <Text style={[styles.infoValue, { color: isLightMode ? '#667781' : '#8696A0', fontSize: 14, marginTop: 2 }]}>
                          {messageInfo?.createdAt || messageInfo?.timestamp ? new Date(messageInfo.createdAt || messageInfo.timestamp).toLocaleString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }) : 'N/A'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Read By - Group Chat - Only show for messages sent by current user */}
                  {messageInfo?.from?._id === currentUserId && (
                    <View style={[styles.infoSection, { borderTopWidth: 1, borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942', paddingTop: 16 }]}>
                      <Text style={[styles.infoSectionTitle, { color: isLightMode ? '#00A884' : '#00A884', fontSize: 13, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
                        Read Receipts
                      </Text>
                      {messageInfo?.readBy && messageInfo.readBy.length > 0 ? (
                        <>
                          {messageInfo.readBy.map((read: any, idx: number) => {
                            // Handle both populated and non-populated userId
                            const user = read.userId || read.user || {};
                            const userName = user.name || user.username || 'Unknown User';
                            const userAvatar = user.avatarUrl || user.avatar;
                            const readTime = read.readAt || read.timestamp;

                            return (
                              <View key={idx} style={[styles.readReceiptItem, { 
                                borderBottomWidth: idx < messageInfo.readBy.length - 1 ? 1 : 0,
                                borderBottomColor: isLightMode ? '#F0F2F5' : '#1F2C34',
                                paddingVertical: 12
                              }]}>
                                <View style={styles.readReceiptAvatar}>
                                  {userAvatar ? (
                                    <Image source={{ uri: userAvatar }} style={styles.readReceiptAvatarImage} />
                                  ) : (
                                    <View style={[styles.readReceiptAvatarImage, { backgroundColor: isLightMode ? '#00A884' : '#00A884', justifyContent: 'center', alignItems: 'center' }]}>
                                      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600' }}>
                                        {userName.charAt(0).toUpperCase()}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.readReceiptName, { color: isLightMode ? '#111B21' : '#E9EDEF', fontSize: 16, fontWeight: '500' }]}>
                                    {userName}
                                  </Text>
                                  <Text style={[styles.readReceiptTime, { color: isLightMode ? '#667781' : '#8696A0', fontSize: 13, marginTop: 2 }]}>
                                    {readTime ? new Date(readTime).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    }) : 'Just now'}
                                  </Text>
                                </View>
                                <Feather name="check-circle" size={20} color="#34B7F1" />
                              </View>
                            );
                          })}
                        </>
                      ) : (
                        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                          <View style={{ 
                            width: 64, 
                            height: 64, 
                            borderRadius: 32, 
                            backgroundColor: isLightMode ? '#F0F2F5' : '#2A3942',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 12
                          }}>
                            <Feather name="eye-off" size={28} color={isLightMode ? '#8696A0' : '#667781'} />
                          </View>
                          <Text style={[styles.infoValue, { color: isLightMode ? '#667781' : '#8696A0', textAlign: 'center', fontSize: 14 }]}>
                            No read receipts yet
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Voice Listened By */}
                  {messageInfo?.voiceListenedBy && messageInfo.voiceListenedBy.length > 0 && (
                    <View style={[styles.infoSection, { borderTopWidth: 1, borderTopColor: isLightMode ? '#ECECEC' : '#2A3942' }]}>
                      <Text style={[styles.infoSectionTitle, { color: isLightMode ? '#667781' : '#8696A0' }]}>Voice Played by {messageInfo.voiceListenedBy.length} {messageInfo.voiceListenedBy.length === 1 ? 'person' : 'people'}</Text>
                      {messageInfo.voiceListenedBy.map((listen: any, idx: number) => {
                        // Handle both populated and non-populated userId
                        const user = listen.userId || listen.user || {};
                        const userName = user.name || user.username || 'Unknown User';
                        const userAvatar = user.avatarUrl || user.avatar;
                        const listenTime = listen.listenedAt || listen.timestamp;

                        return (
                          <View key={idx} style={[styles.readReceiptItem, { borderBottomColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                            <View style={styles.readReceiptAvatar}>
                              {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={styles.readReceiptAvatarImage} />
                              ) : (
                                <View style={[styles.readReceiptAvatarImage, { backgroundColor: isLightMode ? '#075E54' : '#00A884', justifyContent: 'center', alignItems: 'center' }]}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                                    {userName.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.readReceiptName, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                                {userName}
                              </Text>
                              <Text style={[styles.readReceiptTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                                {listenTime ? new Date(listenTime).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Just now'}
                              </Text>
                            </View>
                            <Feather name="volume-2" size={18} color="#25D366" />
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Image Viewed By */}
                  {messageInfo?.imageViewedBy && messageInfo.imageViewedBy.length > 0 && (
                    <View style={[styles.infoSection, { borderTopWidth: 1, borderTopColor: isLightMode ? '#ECECEC' : '#2A3942' }]}>
                      <Text style={[styles.infoSectionTitle, { color: isLightMode ? '#667781' : '#8696A0' }]}>Image Viewed by {messageInfo.imageViewedBy.length} {messageInfo.imageViewedBy.length === 1 ? 'person' : 'people'}</Text>
                      {messageInfo.imageViewedBy.map((view: any, idx: number) => {
                        // Handle both populated and non-populated userId
                        const user = view.userId || view.user || {};
                        const userName = user.name || user.username || 'Unknown User';
                        const userAvatar = user.avatarUrl || user.avatar;
                        const viewTime = view.viewedAt || view.timestamp;

                        return (
                          <View key={idx} style={[styles.readReceiptItem, { borderBottomColor: isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                            <View style={styles.readReceiptAvatar}>
                              {userAvatar ? (
                                <Image source={{ uri: userAvatar }} style={styles.readReceiptAvatarImage} />
                              ) : (
                                <View style={[styles.readReceiptAvatarImage, { backgroundColor: isLightMode ? '#075E54' : '#00A884', justifyContent: 'center', alignItems: 'center' }]}>
                                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                                    {userName.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.readReceiptName, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
                                {userName}
                              </Text>
                              <Text style={[styles.readReceiptTime, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                                {viewTime ? new Date(viewTime).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Just now'}
                              </Text>
                            </View>
                            <Feather name="image" size={18} color="#FFB800" />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.infoCloseButton, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}
                  onPress={() => setInfoVisible(false)}
                >
                  <Text style={styles.infoCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {showCopyToast && (
        <View style={styles.copyToast}>
          <View style={[styles.copyToastContent, isLightMode ? styles.copyToastContentLight : styles.copyToastContentDark]}>
            <Feather name="check" size={20} color={isLightMode ? '#000000' : '#FFFFFF'} />
            <Text style={[styles.copyToastText, isLightMode ? styles.copyToastTextLight : styles.copyToastTextDark]}>Copied to clipboard</Text>
          </View>
        </View>
      )}

      {fullScreenImageUrl && (
        <Modal visible={true} transparent animationType="fade">
          <View style={styles.fullScreenImageContainer}>
            <TouchableOpacity style={styles.fullScreenImageCloseButton} onPress={() => setFullScreenImageUrl(null)}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Image source={{ uri: fullScreenImageUrl }} style={styles.fullScreenImage} />
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
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
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  theirMessageWrapper: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {},
  theirMessageBubble: {},
  voiceMessageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    flexWrap: 'wrap',
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
  messageTime: {
    fontSize: 11,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  messageMenu: {
    padding: 8,
    marginLeft: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8696A0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginVertical: 4,
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
    borderLeftWidth: 3,
  },
  repliedMessageContent: {
    flex: 1,
  },
  repliedMessageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  repliedMessageText: {
    fontSize: 13,
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
  },
  copyToastContentDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  copyToastText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
  copyToastTextLight: {
    color: '#000000',
  },
  copyToastTextDark: {
    color: '#FFFFFF',
  },
  pinnedMessagesContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  pinnedMessagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingHorizontal: 4,
  },
  pinnedMessagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenImageCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
  },
  infoModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoScrollView: {
    maxHeight: 450,
    paddingHorizontal: 20,
  },
  infoSection: {
    marginBottom: 12,
    paddingBottom: 12,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
  },
  readReceiptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  readReceiptAvatar: {
    marginRight: 16,
  },
  readReceiptAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  readReceiptName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  readReceiptTime: {
    fontSize: 13,
    marginTop: 2,
  },
  infoCloseButton: {
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
