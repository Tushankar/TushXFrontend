import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, TextInput, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

// Mock status data with viewers
const MOCK_MY_STATUS = {
  id: '1',
  userName: 'My status',
  userAvatar: null,
  time: '45 minutes ago',
  statusCount: 2,
  viewed: false,
  viewers: [
    { id: 'v1', name: 'Alice Johnson', avatar: 'https://i.pravatar.cc/150?img=1', viewedAt: new Date(Date.now() - 10 * 60 * 1000) },
    { id: 'v2', name: 'Bob Smith', avatar: 'https://i.pravatar.cc/150?img=2', viewedAt: new Date(Date.now() - 20 * 60 * 1000) },
    { id: 'v3', name: 'Carol Williams', avatar: 'https://i.pravatar.cc/150?img=3', viewedAt: new Date(Date.now() - 30 * 60 * 1000) },
  ],
  statuses: [
    { id: '1', type: 'image', content: 'https://picsum.photos/400/600?random=1', timestamp: new Date(Date.now() - 45 * 60 * 1000) },
    { id: '2', type: 'text', content: 'Hello World!', bgColor: '#00A884', timestamp: new Date(Date.now() - 30 * 60 * 1000) }
  ]
};

const MOCK_RECENT_STATUSES = [
  {
    id: '2',
    userName: 'Alice Johnson',
    userAvatar: 'https://i.pravatar.cc/150?img=1',
    time: '10 minutes ago',
    statusCount: 3,
    viewed: false,
    statuses: [
      { id: '1', type: 'image', content: 'https://picsum.photos/400/600?random=2', timestamp: new Date(Date.now() - 10 * 60 * 1000) },
      { id: '2', type: 'text', content: 'Loving this weather! 🌤️', bgColor: '#FF6B6B', timestamp: new Date(Date.now() - 8 * 60 * 1000) },
      { id: '3', type: 'image', content: 'https://picsum.photos/400/600?random=8', timestamp: new Date(Date.now() - 5 * 60 * 1000) }
    ]
  },
  {
    id: '3',
    userName: 'Bob Smith',
    userAvatar: 'https://i.pravatar.cc/150?img=2',
    time: '23 minutes ago',
    statusCount: 2,
    viewed: false,
    statuses: [
      { id: '1', type: 'text', content: 'Having a great day! 🌟', bgColor: '#7F66FF', timestamp: new Date(Date.now() - 23 * 60 * 1000) },
      { id: '2', type: 'image', content: 'https://picsum.photos/400/600?random=9', timestamp: new Date(Date.now() - 20 * 60 * 1000) }
    ]
  },
  {
    id: '4',
    userName: 'Carol Williams',
    userAvatar: 'https://i.pravatar.cc/150?img=3',
    time: '35 minutes ago',
    statusCount: 1,
    viewed: false,
    statuses: [
      { id: '1', type: 'image', content: 'https://picsum.photos/400/600?random=3', timestamp: new Date(Date.now() - 35 * 60 * 1000) }
    ]
  }
];

const MOCK_VIEWED_STATUSES = [
  {
    id: '7',
    userName: 'Frank Miller',
    userAvatar: 'https://i.pravatar.cc/150?img=6',
    time: '5 hours ago',
    statusCount: 1,
    viewed: true,
    statuses: [
      { id: '1', type: 'image', content: 'https://picsum.photos/400/600?random=5', timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000) }
    ]
  },
  {
    id: '8',
    userName: 'Grace Lee',
    userAvatar: 'https://i.pravatar.cc/150?img=7',
    time: '8 hours ago',
    statusCount: 2,
    viewed: true,
    statuses: [
      { id: '1', type: 'text', content: 'Weekend vibes! 🎉', bgColor: '#4ECDC4', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000) }
    ]
  }
];

const TEXT_BG_COLORS = ['#00A884', '#7F66FF', '#FF6B6B', '#4ECDC4', '#FFB74D', '#E91E63', '#00BCD4'];

type StatusType = {
  id: string;
  userName: string;
  userAvatar?: string | null;
  time: string;
  statusCount: number;
  viewed: boolean;
  viewers?: any[];
  statuses: {
    id: string;
    type: string;
    content: string;
    timestamp: Date;
    bgColor?: string | null;
  }[];
};

export default function StatusScreen() {
  const [myStatus, setMyStatus] = useState<StatusType>(MOCK_MY_STATUS as StatusType);
  const [recentStatuses, setRecentStatuses] = useState<StatusType[]>(MOCK_RECENT_STATUSES as StatusType[]);
  const [viewedStatuses, setViewedStatuses] = useState<StatusType[]>(MOCK_VIEWED_STATUSES as StatusType[]);
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [newStatusType, setNewStatusType] = useState('photo');
  const [newStatusText, setNewStatusText] = useState('');
  const [selectedBgColor, setSelectedBgColor] = useState(TEXT_BG_COLORS[0]);
  const [showModalViewers, setShowModalViewers] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [showStatusViewers, setShowStatusViewers] = useState(false);
  const progressInterval = useRef<number | null>(null);
  const isLightMode = true;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('status');

  const STATUS_DURATION = 5000; // 5 seconds per status

  useEffect(() => {
    if (showStatusModal && selectedStatus) {
      startStatusProgress();
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [showStatusModal, currentStatusIndex, selectedStatus]);

  const startStatusProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    setProgress(0);
    
    let startTime = Date.now();
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / STATUS_DURATION) * 100;
      
      if (newProgress >= 100) {
        moveToNextStatus();
      } else {
        setProgress(newProgress);
      }
    }, 50) as any;
  };

  const moveToNextStatus = () => {
    if (!selectedStatus) return;
    
    const nextIndex = currentStatusIndex + 1;
    if (nextIndex < selectedStatus.statuses.length) {
      setCurrentStatusIndex(nextIndex);
      setProgress(0);
    } else {
      // Close modal when all statuses are viewed
      closeStatusModal();
      
      // Mark as viewed if not already
      if (!selectedStatus.viewed) {
        markStatusAsViewed(selectedStatus.id);
      }
    }
  };

  const moveToPreviousStatus = () => {
    if (currentStatusIndex > 0) {
      setCurrentStatusIndex(currentStatusIndex - 1);
      setProgress(0);
    }
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setCurrentStatusIndex(0);
    setProgress(0);
    setShowStatusViewers(false);
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const markStatusAsViewed = (statusId: string) => {
    setRecentStatuses(prev => {
      const status = prev.find(s => s.id === statusId);
      if (status) {
        const updatedRecent = prev.filter(s => s.id !== statusId);
        setViewedStatuses(prevViewed => [{ ...status, viewed: true }, ...prevViewed]);
        return updatedRecent;
      }
      return prev;
    });
  };

  const openStatus = (status: StatusType) => {
    setSelectedStatus(status);
    setCurrentStatusIndex(0);
    setProgress(0);
    setShowStatusViewers(false);
    setShowStatusModal(true);
  };

  const addNewStatus = () => {
    if (newStatusType === 'text' && !newStatusText.trim()) return;

    const newStatus = {
      id: Date.now().toString(),
      type: newStatusType,
      content: newStatusType === 'text' ? newStatusText : previewImage,
      bgColor: newStatusType === 'text' ? selectedBgColor : null,
      timestamp: new Date()
    };

    setMyStatus(prev => ({
      ...prev,
      statuses: [...prev.statuses, newStatus],
      statusCount: prev.statusCount + 1,
      time: 'Just now'
    }));

    setShowAddModal(false);
    setNewStatusText('');
    setNewStatusType('photo');
    setPreviewImage('');
  };

  const openAddModal = (type: string) => {
    setNewStatusType(type);
    if (type === 'photo') {
      // Generate a new preview image
      setPreviewImage(`https://picsum.photos/400/600?random=${Date.now()}`);
    }
    setShowAddModal(true);
  };

  const StatusItem = ({ status, isMyStatus = false }: { status: StatusType; isMyStatus?: boolean }) => (
    <View style={styles.statusItemContainer}>
      <TouchableOpacity
        style={styles.statusItem}
        onPress={() => openStatus(status)}
      >
        <View style={styles.statusAvatarContainer}>
          {status.userAvatar ? (
            <Image source={{ uri: status.userAvatar }} style={styles.statusAvatar} />
          ) : (
            <View style={[styles.statusAvatar, { backgroundColor: '#00A884' }]}>
              <Feather name="user" size={24} color="#FFFFFF" />
            </View>
          )}
          {!status.viewed && !isMyStatus && (
            <View style={[styles.statusRing, { borderColor: '#00A884' }]} />
          )}
          {status.viewed && !isMyStatus && (
            <View style={[styles.statusRing, { borderColor: '#8696A0' }]} />
          )}
          {isMyStatus && status.statuses.length > 0 && (
            <View style={[styles.statusRing, { borderColor: '#00A884' }]} />
          )}
          {isMyStatus && (
            <TouchableOpacity 
              style={[styles.addBadge, { backgroundColor: '#00A884' }]}
              onPress={(e) => {
                e.stopPropagation();
                openAddModal('photo');
              }}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statusInfo}>
          <Text style={[styles.statusName, { color: '#000000' }]}>
            {status.userName}
          </Text>
          <Text style={[styles.statusTime, { color: '#667781' }]}>
            {status.time}
          </Text>
        </View>
        
        {isMyStatus && (
          <TouchableOpacity 
            style={styles.viewersButton}
            onPress={(e) => {
              e.stopPropagation();
              setShowViewersModal(true);
            }}
          >
            <Feather name="eye" size={20} color="#667781" />
            <Text style={styles.viewersCount}>{status.viewers?.length || 0}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#075E54' }]}>
        <TouchableOpacity style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Status</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="more-vertical" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* My Status */}
        <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
          <StatusItem status={myStatus} isMyStatus />
        </View>

        {/* Recent Updates */}
        {recentStatuses.length > 0 && (
          <>
            <View style={styles.sectionGap} />
            <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#667781' }]}>
                  Recent updates
                </Text>
              </View>
              {recentStatuses.map((status) => (
                <StatusItem key={status.id} status={status} />
              ))}
            </View>
          </>
        )}

        {/* Viewed Updates */}
        {viewedStatuses.length > 0 && (
          <>
            <View style={styles.sectionGap} />
            <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: '#667781' }]}>
                  Viewed updates
                </Text>
              </View>
              {viewedStatuses.map((status) => (
                <StatusItem key={status.id} status={status} />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fabSecondary, { backgroundColor: '#FFFFFF' }]}
          onPress={() => openAddModal('text')}
        >
          <Feather name="edit-3" size={20} color="#667781" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.fabPrimary, { backgroundColor: '#00A884' }]}
          onPress={() => openAddModal('photo')}
        >
          <Feather name="camera" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Status Viewer Modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <PanGestureHandler
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.END && nativeEvent.translationY > 100) {
              if (!showStatusViewers) {
                closeStatusModal();
              }
            }
          }}
        >
          <View style={styles.statusModal}>
            <TouchableOpacity 
              style={styles.statusModalTouchLeft}
              onPress={moveToPreviousStatus}
              activeOpacity={1}
            />
            <TouchableOpacity 
              style={styles.statusModalTouchRight}
              onPress={moveToNextStatus}
              activeOpacity={1}
            />

            {/* Status Header */}
            <View style={styles.statusModalHeader}>
              <View style={styles.statusUserInfo}>
                {selectedStatus?.userAvatar ? (
                  <Image source={{ uri: selectedStatus.userAvatar }} style={styles.statusModalAvatar} />
                ) : (
                  <View style={[styles.statusModalAvatar, { backgroundColor: '#00A884' }]}>
                    <Feather name="user" size={20} color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.statusUserText}>
                  <Text style={styles.statusModalName}>{selectedStatus?.userName}</Text>
                  <Text style={styles.statusModalTime}>{selectedStatus?.time}</Text>
                </View>
              </View>
            </View>

            {/* Status Progress Bars */}
            <View style={styles.statusProgressContainer}>
              {selectedStatus?.statuses?.map((_, index) => (
                <View key={index} style={styles.statusProgressBar}>
                  <View 
                    style={[
                      styles.statusProgressFill, 
                      { 
                        width: index < currentStatusIndex ? '100%' : 
                               index === currentStatusIndex ? `${progress}%` : '0%'
                      }
                    ]} 
                  />
                </View>
              ))}
            </View>

            {/* Status Content */}
            <View style={[styles.statusContent, showStatusViewers && styles.statusContentBlurred]}>
              {selectedStatus?.statuses?.[currentStatusIndex]?.type === 'text' ? (
                <View style={[styles.textStatusContainer, { backgroundColor: selectedStatus.statuses[currentStatusIndex].bgColor || '#00A884' }]}>
                  <Text style={styles.textStatusContent}>{selectedStatus.statuses[currentStatusIndex].content}</Text>
                </View>
              ) : (
                <Image
                  source={{ uri: selectedStatus?.statuses?.[currentStatusIndex]?.content }}
                  style={styles.statusImage}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Status Input or Viewers */}
            {selectedStatus?.id === '1' ? (
              !showStatusViewers ? (
                <View style={styles.statusViewersButtonContainer}>
                  <TouchableOpacity 
                    style={styles.statusViewersButton}
                    onPress={() => setShowStatusViewers(true)}
                  >
                    <Feather name="eye" size={20} color="#FFFFFF" />
                    <Text style={styles.statusViewersButtonText}>View {selectedStatus.viewers?.length || 0} viewers</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            ) : (
              !showStatusViewers && (
                <View style={styles.statusInputContainer}>
                  <View style={styles.statusInput}>
                    <Feather name="smile" size={24} color="#8696A0" />
                    <Text style={styles.statusInputPlaceholder}>Reply to {selectedStatus?.userName}...</Text>
                  </View>
                  <TouchableOpacity style={styles.statusSendButton}>
                    <Feather name="arrow-up" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )
            )}

            {/* Viewers Bottom Sheet Modal */}
            {showStatusViewers && (
              <PanGestureHandler
                onHandlerStateChange={({ nativeEvent }) => {
                  if (nativeEvent.state === State.END && nativeEvent.translationY > 100) {
                    setShowStatusViewers(false);
                  }
                }}
              >
                <View style={styles.statusViewersBottomSheet}>
                  {/* Handle Bar */}
                  <View style={styles.bottomSheetHandle}>
                    <View style={styles.handleBar} />
                  </View>

                  {/* Viewers Header */}
                  <View style={styles.viewersBottomSheetHeader}>
                    <Text style={styles.viewersBottomSheetTitle}>
                      {selectedStatus?.viewers?.length || 0} views
                    </Text>
                    <TouchableOpacity 
                      onPress={() => setShowStatusViewers(false)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Feather name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Viewers List */}
                  <ScrollView style={styles.viewersBottomSheetList}>
                    {selectedStatus?.viewers?.map((viewer) => (
                      <View key={viewer.id} style={styles.viewerBottomSheetItem}>
                        <Image source={{ uri: viewer.avatar }} style={styles.viewerBottomSheetAvatar} />
                        <View style={styles.viewerBottomSheetInfo}>
                          <Text style={styles.viewerBottomSheetName}>{viewer.name}</Text>
                          <Text style={styles.viewerBottomSheetTime}>
                            {Math.floor((Date.now() - viewer.viewedAt.getTime()) / (1000 * 60))} minutes ago
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </PanGestureHandler>
            )}
          </View>
        </PanGestureHandler>
      </Modal>

      {/* Add Status Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalFullContent}>
            {/* Preview Area */}
            <View style={styles.addModalPreview}>
              {newStatusType === 'text' ? (
                <View style={[styles.previewTextContainer, { backgroundColor: selectedBgColor }]}>
                  <Text style={styles.previewTextContent}>
                    {newStatusText || 'Type your status...'}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: previewImage }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}
              
              {/* Close Button */}
              <TouchableOpacity 
                style={styles.previewCloseButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewStatusText('');
                  setPreviewImage('');
                }}
              >
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Drawing Tools (Mock) */}
              <View style={styles.previewTools}>
                <TouchableOpacity style={styles.previewToolButton}>
                  <Feather name="type" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.previewToolButton}>
                  <Feather name="edit-2" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.previewToolButton}>
                  <Feather name="smile" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom Controls */}
            <View style={styles.addModalBottom}>
              {newStatusType === 'text' ? (
                <>
                  {/* Color Selector */}
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.colorSelectorHorizontal}
                  >
                    {TEXT_BG_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOptionCircle,
                          { backgroundColor: color },
                          selectedBgColor === color && styles.colorOptionCircleSelected
                        ]}
                        onPress={() => setSelectedBgColor(color)}
                      >
                        {selectedBgColor === color && (
                          <Feather name="check" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Text Input */}
                  <TextInput
                    style={styles.statusTextInput}
                    placeholder="Type your status..."
                    placeholderTextColor="#8696A0"
                    multiline
                    maxLength={200}
                    value={newStatusText}
                    onChangeText={setNewStatusText}
                    autoFocus
                  />
                </>
              ) : (
                <View style={styles.captionInputContainer}>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption..."
                    placeholderTextColor="#8696A0"
                  />
                </View>
              )}

              {/* Send Button */}
              <TouchableOpacity 
                style={styles.sendStatusButton}
                onPress={addNewStatus}
              >
                <Feather name="send" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Viewers Modal */}
      <Modal visible={showViewersModal} transparent animationType="slide">
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalContent}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>
                <Feather name="eye" size={20} color="#000000" /> {myStatus.viewers?.length || 0} views
              </Text>
              <TouchableOpacity onPress={() => setShowViewersModal(false)}>
                <Feather name="x" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.viewersList}>
              {myStatus.viewers?.map((viewer) => (
                <View key={viewer.id} style={styles.viewerItem}>
                  <Image source={{ uri: viewer.avatar }} style={styles.viewerAvatar} />
                  <View style={styles.viewerInfo}>
                    <Text style={styles.viewerName}>{viewer.name}</Text>
                    <Text style={styles.viewerTime}>
                      {Math.floor((Date.now() - viewer.viewedAt.getTime()) / (1000 * 60))} minutes ago
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BlurView intensity={80} tint={isLightMode ? 'light' : 'dark'} style={[styles.bottomNav, { borderTopColor: isLightMode ? 'rgba(233, 237, 239, 0.3)' : 'rgba(42, 57, 66, 0.3)' }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('status'); }}>
          <Feather name="radio" size={24} color={activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('phone'); router.push('/calls' as any); }}>
          <Feather name="phone" size={24} color={activeTab === 'phone' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'phone' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Calls</Text>
        </TouchableOpacity>
                
        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('chats'); router.push('/dashboard' as any); }}>
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
    flexDirection: 'row',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  section: {
    paddingVertical: 8,
  },
  sectionGap: {
    height: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
  },
  statusItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  statusAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 31,
    borderWidth: 3,
  },
  addBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusInfo: {
    flex: 1,
  },
  statusName: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 2,
  },
  statusTime: {
    fontSize: 14,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    gap: 16,
    alignItems: 'flex-end',
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statusModal: {
    flex: 1,
    backgroundColor: '#000000',
  },
  statusModalTouchLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    zIndex: 1,
  },
  statusModalTouchRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    zIndex: 1,
  },
  statusModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  statusCloseButton: {
    padding: 4,
  },
  statusUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
  },
  statusModalAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusUserText: {
    flex: 1,
  },
  statusModalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusModalTime: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  statusMoreButton: {
    padding: 4,
  },
  statusProgressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 4,
    marginBottom: 16,
    zIndex: 2,
  },
  statusProgressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  statusProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  statusContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  textStatusContainer: {
    width: '100%',
    padding: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  textStatusContent: {
    fontSize: 28,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  statusImage: {
    width: '100%',
    height: '100%',
  },
  statusInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    zIndex: 2,
  },
  statusInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  statusInputPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  addModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  addModalFullContent: {
    flex: 1,
    backgroundColor: '#000000',
  },
  addModalPreview: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTextContainer: {
    width: '90%',
    padding: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  previewTextContent: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTools: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  previewToolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addModalBottom: {
    backgroundColor: '#1F1F1F',
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  colorSelectorHorizontal: {
    marginBottom: 16,
  },
  colorOptionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  statusTextInput: {
    backgroundColor: 'transparent',
    color: '#FFFFFF',
    fontSize: 18,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  captionInputContainer: {
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
  },
  sendStatusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  addModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  addModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  typeSelector: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  typeButtonActive: {
    backgroundColor: '#00A884',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#667781',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  colorSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  textInput: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    color: '#000000',
  },
  photoPreview: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  photoPreviewImage: {
    width: '100%',
    height: 200,
  },
  photoPreviewText: {
    padding: 12,
    textAlign: 'center',
    color: '#667781',
    fontSize: 14,
  },
  addButton: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#00A884',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewersList: {
    maxHeight: 400,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  viewerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  viewerTime: {
    fontSize: 14,
    color: '#667781',
  },
  viewersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 16,
  },
  viewersCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667781',
  },
  statusViewersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    maxHeight: 200,
  },
  statusViewersContent: {
    flex: 1,
  },
  statusViewersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  statusViewersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusViewersList: {
    maxHeight: 150,
  },
  statusViewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusViewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  statusViewerInfo: {
    flex: 1,
  },
  statusViewerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  statusViewerTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statusViewersBackButton: {
    padding: 4,
  },
  statusViewersCloseButton: {
    padding: 4,
  },
  statusViewersButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 2,
  },
  statusViewersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusViewersButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
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
  statusContentBlurred: {
    opacity: 0.6,
  },
  statusViewersBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#111111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 10,
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  viewersBottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  viewersBottomSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewersBottomSheetList: {
    flex: 1,
  },
  viewerBottomSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  viewerBottomSheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  viewerBottomSheetInfo: {
    flex: 1,
  },
  viewerBottomSheetName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  viewerBottomSheetTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});