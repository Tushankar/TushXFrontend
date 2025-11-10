import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { authStorage } from '@/utils/authStorage';
import { apiService } from '@/utils/api';

interface Message {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  deliveredAt?: Date;
  readAt?: Date;
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
  const { colors } = useTheme();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [emojis, setEmojis] = useState<string[]>([]);
  const isLightMode = colors.background === '#FFFFFF' || colors.background === '#fff';
  const flatListRef = useRef<FlatList>(null);
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
          id: msg.id,
          timestamp: new Date(msg.timestamp),
          status: msg.status || 'sent',
          deliveredAt: msg.deliveredAt ? new Date(msg.deliveredAt) : undefined,
          readAt: msg.readAt ? new Date(msg.readAt) : undefined,
        })).sort((a: Message, b: Message) => {
          const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return tb - ta; // Newest first
        });
        setMessages(parsedMessages);
        
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
        //   if (!verified) {
        //     setShowPasswordModal(true);
        //   }
        // }

        // Initialize Socket.IO connection
        console.log('Initializing socket with token:', token ? 'present' : 'missing');
        
        const newSocket = io('http://192.168.0.150:8080', {
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
          setMessages(prev => prev.map(msg => 
            msg.id === data.messageId ? { ...msg, id: data.dbId, status: 'sent' as const } : msg
          ));
        });

        newSocket.on('receiveMessage', (messageData: any) => {
          console.log('Received message:', messageData);
          const processedMessage = {
            id: messageData.id,
            from: messageData.from,
            to: messageData.to,
            message: messageData.message,
            timestamp: new Date(messageData.timestamp),
            status: messageData.status || 'delivered',
            deliveredAt: messageData.deliveredAt ? new Date(messageData.deliveredAt) : undefined,
          };
          setMessages(prev => mergeMessages(prev, processedMessage));

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

      if (userId && currentUserId) {
        loadMessages();
        fetchOtherUser();
        checkUserOnlineStatus();
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
  useEffect(() => {
    // Mock connection status - always connected
    setIsConnected(true);
  }, []);
  const sendMessage = () => {
    if (!socket || !inputMessage.trim()) return;
    const messageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const messageData = {
      id: messageId,
      from: currentUserId,
      to: userId,
      message: inputMessage.trim(),
      timestamp: new Date(),
      status: 'sending' as const
    };
    setMessages(prev => mergeMessages(prev, messageData));
    socket.emit('sendMessage', { to: userId, message: inputMessage.trim(), messageId });
    setInputMessage('');
    
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
    // Use a comprehensive static list of emojis instead of API call for reliability
    const emojiList = [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '�', '�', '�', '�', '�', '🤨', '🧐', '🤓', '😎', '�',
      '🥳', '�', '�', '�', '�', '😟', '�', '🙁', '☹️', '😣',
      '😖', '�', '�', '🥺', '�', '�', '�', '�', '😡', '�',
      '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
      '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
      '😦', '😧', '😮', '😲', '�', '�', '🤤', '�', '�', '🤐',
      '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
      '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
      '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
      '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗',
      '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚',
      '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦',
      '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤',
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
      '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
      '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
      '💋', '🩸', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔',
      '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋',
      '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴',
      '👸', '👳', '👲', '🧕', '🤵', '🤰', '🤱', '👼', '🎅', '🤶',
      '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆',
      '💇', '🚶', '🧍', '🧎', '👨‍🦯', '👩‍🦯', '👨‍🦼', '👩‍🦼', '👨‍🦽', '👩‍🦽',
      '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗', '🤺', '🏇', '⛷️',
      '🏂', '🏌️', '🏄', '🚣', '🏊', '⛹️', '🏋️', '🚴', '🚵', '🤸',
      '🤼', '🤽', '🤾', '🧘', '🛀', '🛌', '👭', '👫', '👬', '💏',
      '💑', '👪', '🗣️', '👤', '👥', '🫂', '🐶', '🐱', '🐭', '🐹',
      '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽',
      '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
      '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
      '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🦂', '🐢',
      '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
      '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓',
      '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃',
      '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕',
      '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢',
      '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀',
      '🐿️', '🦔', '🐾', '🐉', '🐊', '🌵', '🎄', '🌲', '🌳', '🌴',
      '🪵', '🌱', '🌿', '☘️', '🍀', '🎋', '🎍', '🌾', '🌵', '🇮🇳',
      '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇯🇵', '🇨🇳', '🇰🇷', '🇧🇷', '🇷🇺', '🇮🇹',
      '🇪🇸', '🇲🇽', '🇨🇦', '🇦🇺', '🇳🇱', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇱',
      '🏴‍☠️', '🏁', '🚩', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🎌', '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', '❤️', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
      '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
      '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️',
      '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏',
      '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴',
      '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐',
      '㊙️', '㊗️', '🈴', '🔞', '📵', '🚭', '♿', '⚕️', '🈲', '🉑',
      '🛑', '⛔', '🚫', '❌', '⭕', '🟢', '🟡', '🔴', '🟠', '🟣',
      '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛',
      '⬜', '🟫', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘',
      '🔳', '🔲', '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️'
    ];
    setEmojis(emojiList);
  };
  const deleteForMe = async (message: Message) => {
    if (socket && message.id) {
      socket.emit('deleteForMe', { messageId: message.id });
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
  };

  const deleteForEveryone = (message: Message) => {
    if (socket && message.id) {
      socket.emit('deleteForEveryone', { messageId: message.id });
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
    }
    setMenuVisible(false);
    setSelectedMessageId(null);
  };
  const showMessageMenu = async (message: Message) => {
    setSelectedMessage(message);
    setSelectedMessageId(message.id || '');
    setMenuVisible(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }
  };
  const showMessageInfo = async (message: Message) => {
    setMessageInfo(message);
    setInfoVisible(true);
    setMenuVisible(false);
    setSelectedMessageId(null);
  };
  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.from === currentUserId;
    const isSelected = selectedMessageId === item.id;
    const renderStatusTicks = () => {
      if (!isMine) return null;
      if (!isConnected) {
        return <Feather name="clock" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />;
      }
      switch (item.status) {
        case 'sending':
          return <Feather name="clock" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />;
        case 'sent':
          return <Feather name="check" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />;
        case 'delivered':
          return (
            <View style={styles.doubleCheck}>
              <Feather name="check" size={14} color="rgba(255,255,255,0.6)" />
              <Feather name="check" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: -8 }} />
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
          return <Feather name="clock" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />;
      }
    };
    return (
      <TouchableOpacity
        style={[
          styles.messageWrapper,
          isMine ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}
        onLongPress={() => showMessageMenu(item)}
        delayLongPress={300}
      >
        <View
          style={[
            styles.messageBubble,
            isMine
              ? [styles.myMessageBubble, { backgroundColor: isLightMode ? '#DCF8C6' : '#005C4B' }]
              : [styles.theirMessageBubble, { backgroundColor: isLightMode ? '#FFFFFF' : '#202C33' }],
            isSelected && styles.selectedMessage
          ]}
        >
          <Text style={[
            styles.messageText,
            { color: isMine ? (isLightMode ? '#000000' : '#E9EDEF') : (isLightMode ? '#000000' : '#E9EDEF') }
          ]}>
            {item.message}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              { color: isMine ? (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(233,237,239,0.6)') : (isLightMode ? 'rgba(0,0,0,0.45)' : 'rgba(134,150,160,0.8)') }
            ]}>
              {item.timestamp instanceof Date ? item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid time'}
            </Text>
            {renderStatusTicks()}
          </View>
        </View>
        {/* WhatsApp-style tail */}
        {isMine ? (
          <View style={[styles.tailRight, { borderLeftColor: isLightMode ? '#DCF8C6' : '#005C4B' }]} />
        ) : (
          <View style={[styles.tailLeft, { borderRightColor: isLightMode ? '#FFFFFF' : '#202C33' }]} />
        )}
      </TouchableOpacity>
    );
  };
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isLightMode ? '#EFEAE2' : '#0B141A' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* WhatsApp-style Header */}
      <View style={[styles.header, { backgroundColor: isLightMode ? '#075E54' : '#1F2C34' }]}>
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
      </View>
      {/* Messages Area */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
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
      {/* WhatsApp-style Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: isLightMode ? '#F0F2F5' : '#1F2C34', borderTopColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}>
        <View style={[styles.inputWrapper, { backgroundColor: isLightMode ? '#FFFFFF' : '#2A3942' }]}>
          <TouchableOpacity style={styles.emojiButton} onPress={() => {
            setShowEmojiPicker(!showEmojiPicker);
            if (!showEmojiPicker && emojis.length === 0) {
              fetchEmojis();
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
          <TouchableOpacity style={[styles.voiceButton, { backgroundColor: isLightMode ? '#25D366' : '#00A884' }]}>
            <Feather name="mic" size={22} color="#FFFFFF" />
          </TouchableOpacity>
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
            <FlatList
              data={emojis}
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
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMenuVisible(false);
            setSelectedMessageId(null);
          }}
        >
          <View style={[styles.menuModal, { backgroundColor: isLightMode ? '#FFFFFF' : '#1F2C34' }]}>
            {selectedMessage && selectedMessage.from === currentUserId ? (
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => showMessageInfo(selectedMessage)}
                >
                  <Feather name="info" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Info</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => deleteForMe(selectedMessage)}
                >
                  <Feather name="trash-2" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Delete for me</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => deleteForEveryone(selectedMessage)}
                >
                  <Feather name="trash" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Delete for everyone</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: isLightMode ? '#E9EDEF' : '#2A3942' }]}
                  onPress={() => showMessageInfo(selectedMessage!)}
                >
                  <Feather name="info" size={20} color={isLightMode ? '#667781' : '#8696A0'} />
                  <Text style={[styles.menuItemText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>Info</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => deleteForMe(selectedMessage!)}
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
  },
  messagesContent: {
    paddingHorizontal: 8,
    paddingVertical: 12,
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
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    borderTopRightRadius: 0,
  },
  theirMessageBubble: {
    borderTopLeftRadius: 0,
  },
  selectedMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
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
    right: -6,
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderTopWidth: 10,
    borderTopColor: 'transparent',
  },
  tailLeft: {
    position: 'absolute',
    left: -6,
    top: 0,
    width: 0,
    height: 0,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderTopColor: 'transparent',
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
    height: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
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
});