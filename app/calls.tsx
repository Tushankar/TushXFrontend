import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

// Mock calls data
const MOCK_RECENT_CALLS: CallType[] = [
  {
    id: '1',
    userName: 'Alice Johnson',
    userAvatar: 'https://i.pravatar.cc/150?img=1',
    time: '2 minutes ago',
    type: 'incoming', // incoming, outgoing, missed
    callType: 'video', // video, audio
    duration: '5:23',
    missed: false,
  },
  {
    id: '2',
    userName: 'Bob Smith',
    userAvatar: 'https://i.pravatar.cc/150?img=2',
    time: '15 minutes ago',
    type: 'outgoing',
    callType: 'audio',
    duration: '2:45',
    missed: false,
  },
  {
    id: '3',
    userName: 'Carol Williams',
    userAvatar: 'https://i.pravatar.cc/150?img=3',
    time: '1 hour ago',
    type: 'missed',
    callType: 'video',
    duration: null,
    missed: true,
  },
  {
    id: '4',
    userName: 'David Brown',
    userAvatar: 'https://i.pravatar.cc/150?img=4',
    time: '2 hours ago',
    type: 'incoming',
    callType: 'audio',
    duration: '8:12',
    missed: false,
  },
  {
    id: '5',
    userName: 'Emma Davis',
    userAvatar: 'https://i.pravatar.cc/150?img=5',
    time: 'Yesterday',
    type: 'outgoing',
    callType: 'video',
    duration: '12:34',
    missed: false,
  },
  {
    id: '6',
    userName: 'Frank Miller',
    userAvatar: 'https://i.pravatar.cc/150?img=6',
    time: 'Yesterday',
    type: 'missed',
    callType: 'audio',
    duration: null,
    missed: true,
  },
  {
    id: '7',
    userName: 'Grace Lee',
    userAvatar: 'https://i.pravatar.cc/150?img=7',
    time: '2 days ago',
    type: 'incoming',
    callType: 'video',
    duration: '3:56',
    missed: false,
  },
  {
    id: '8',
    userName: 'Henry Wilson',
    userAvatar: 'https://i.pravatar.cc/150?img=8',
    time: '3 days ago',
    type: 'outgoing',
    callType: 'audio',
    duration: '1:23',
    missed: false,
  },
];

type CallType = {
  id: string;
  userName: string;
  userAvatar?: string | null;
  time: string;
  type: 'incoming' | 'outgoing' | 'missed';
  callType: 'video' | 'audio';
  duration: string | null;
  missed: boolean;
};

export default function CallsScreen() {
  const [recentCalls, setRecentCalls] = useState<CallType[]>(MOCK_RECENT_CALLS);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showCallInfoModal, setShowCallInfoModal] = useState(false);
  const [selectedCallForInfo, setSelectedCallForInfo] = useState<CallType | null>(null);
  const router = useRouter();
  const isLightMode = true;
  const [activeTab, setActiveTab] = useState('phone');

  const filteredCalls = recentCalls.filter(call =>
    call.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const CallItem = ({ call }: { call: CallType }) => (
    <TouchableOpacity style={styles.callItem}>
      <View style={styles.callAvatarContainer}>
        {call.userAvatar ? (
          <Image source={{ uri: call.userAvatar }} style={styles.callAvatar} />
        ) : (
          <View style={[styles.callAvatar, { backgroundColor: '#00A884' }]}>
            <Feather name="user" size={24} color="#FFFFFF" />
          </View>
        )}
      </View>

      <View style={styles.callInfo}>
        <Text style={[styles.callName, { color: call.missed ? '#E74C3C' : '#000000' }]}>
          {call.userName}
        </Text>
        <View style={styles.callDetails}>
          <View style={styles.callTypeContainer}>
            {call.type === 'incoming' && (
              <Feather
                name="arrow-down-left"
                size={16}
                color={call.missed ? '#E74C3C' : '#00A884'}
                style={styles.callDirectionIcon}
              />
            )}
            {call.type === 'outgoing' && (
              <Feather
                name="arrow-up-right"
                size={16}
                color="#00A884"
                style={styles.callDirectionIcon}
              />
            )}
            {call.type === 'missed' && (
              <Feather
                name="phone-missed"
                size={16}
                color="#E74C3C"
                style={styles.callDirectionIcon}
              />
            )}
          </View>
          <Text style={[styles.callTime, { color: call.missed ? '#E74C3C' : '#667781' }]}>
            {call.time}
          </Text>
        </View>
      </View>

      <View style={styles.callActions}>
        <TouchableOpacity style={styles.callActionButton}>
          <Feather
            name={call.callType === 'video' ? 'video' : 'phone'}
            size={20}
            color="#00A884"
          />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.callActionButton}
          onPress={() => {
            setSelectedCallForInfo(call);
            setShowCallInfoModal(true);
          }}
        >
          <Feather name="info" size={20} color="#667781" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const makeCall = (contactName: string, callType: 'video' | 'audio') => {
    // Mock call functionality
    const newCall: CallType = {
      id: Date.now().toString(),
      userName: contactName,
      userAvatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 10) + 1}`,
      time: 'Just now',
      type: 'outgoing',
      callType,
      duration: null,
      missed: false,
    };

    setRecentCalls(prev => [newCall, ...prev]);
    setShowNewCallModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#075E54' }]}>
        <TouchableOpacity style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calls</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Feather name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="more-vertical" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Recent Calls */}
        <View style={[styles.section, { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: '#667781' }]}>
              Recent
            </Text>
          </View>
          {filteredCalls.map((call) => (
            <CallItem key={call.id} call={call} />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fabPrimary, { backgroundColor: '#00A884' }]}
        onPress={() => setShowNewCallModal(true)}
      >
        <Feather name="phone" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* New Call Modal */}
      <Modal visible={showNewCallModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Call</Text>
              <TouchableOpacity onPress={() => setShowNewCallModal(false)}>
                <Feather name="x" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.callTypeSelector}>
              <TouchableOpacity
                style={[styles.callTypeButton, styles.callTypeButtonActive]}
                onPress={() => makeCall('New Contact', 'audio')}
              >
                <Feather name="phone" size={20} color="#FFFFFF" />
                <Text style={styles.callTypeButtonText}>Audio Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.callTypeButton, styles.callTypeButtonActive]}
                onPress={() => makeCall('New Contact', 'video')}
              >
                <Feather name="video" size={20} color="#FFFFFF" />
                <Text style={styles.callTypeButtonText}>Video Call</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.contactInput}
              placeholder="Enter contact name or number..."
              placeholderTextColor="#8696A0"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

              {recentCalls.slice(0, 3).map((call) => (
                <TouchableOpacity
                  key={call.id}
                  style={styles.quickContactItem}
                  onPress={() => makeCall(call.userName, 'audio')}
                >
                  <Image source={{ uri: call.userAvatar || 'https://i.pravatar.cc/150?img=0' }} style={styles.quickContactAvatar} />
                  <Text style={styles.quickContactName}>{call.userName}</Text>
                  <Feather name="phone" size={20} color="#00A884" />
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal visible={showSearchModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Calls</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Feather name="x" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search calls..."
              placeholderTextColor="#8696A0"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />

            <ScrollView style={styles.searchResults}>
              {filteredCalls.map((call) => (
                <TouchableOpacity key={call.id} style={styles.searchResultItem}>
                  <Image source={{ uri: call.userAvatar || 'https://i.pravatar.cc/150?img=0' }} style={styles.searchResultAvatar} />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{call.userName}</Text>
                    <Text style={styles.searchResultTime}>{call.time}</Text>
                  </View>
                  <Feather
                    name={call.callType === 'video' ? 'video' : 'phone'}
                    size={20}
                    color="#00A884"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Call Info Modal */}
      <Modal visible={showCallInfoModal} transparent animationType="slide">
        <View style={styles.callInfoModalOverlay}>
          <View style={styles.callInfoModalContent}>
            {/* Header */}
            <View style={[styles.callInfoHeader, { backgroundColor: '#075E54' }]}>
              <TouchableOpacity 
                style={styles.callInfoBackButton}
                onPress={() => setShowCallInfoModal(false)}
              >
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.callInfoHeaderTitle}>Call info</Text>
              <View style={styles.callInfoHeaderPlaceholder} />
            </View>

            <ScrollView style={styles.callInfoScrollView} showsVerticalScrollIndicator={false}>
              {/* Profile Section */}
              <View style={[styles.callInfoProfileSection, { backgroundColor: '#FFFFFF' }]}>
                <View style={styles.callInfoAvatarContainer}>
                  {selectedCallForInfo?.userAvatar ? (
                    <Image source={{ uri: selectedCallForInfo.userAvatar }} style={styles.callInfoAvatar} />
                  ) : (
                    <View style={[styles.callInfoAvatar, { backgroundColor: '#00A884' }]}>
                      <Text style={styles.callInfoAvatarText}>
                        {selectedCallForInfo?.userName.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.callInfoUserName}>
                  {selectedCallForInfo?.userName}
                </Text>
                <Text style={styles.callInfoUserStatus}>
                  {selectedCallForInfo?.time}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.callInfoSectionGap} />
              <View style={[styles.callInfoActionsSection, { backgroundColor: '#FFFFFF' }]}>
                <TouchableOpacity style={styles.callInfoActionButton}>
                  <View style={[styles.callInfoActionIconContainer, { backgroundColor: '#00A884' }]}>
                    <Feather name="phone" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.callInfoActionText}>Audio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.callInfoActionButton}>
                  <View style={[styles.callInfoActionIconContainer, { backgroundColor: '#00A884' }]}>
                    <Feather name="video" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.callInfoActionText}>Video</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.callInfoActionButton}>
                  <View style={[styles.callInfoActionIconContainer, { backgroundColor: '#00A884' }]}>
                    <Feather name="message-circle" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.callInfoActionText}>Message</Text>
                </TouchableOpacity>
              </View>

              {/* Call History */}
              <View style={styles.callInfoSectionGap} />
              <View style={[styles.callInfoSection, { backgroundColor: '#FFFFFF' }]}>
                <View style={styles.callInfoSectionHeader}>
                  <Text style={styles.callInfoSectionTitle}>
                    Call history
                  </Text>
                </View>
                
                {/* Current Call */}
                <View style={styles.callHistoryItem}>
                  <View style={styles.callHistoryLeft}>
                    <Feather 
                      name={selectedCallForInfo?.callType === 'video' ? 'video' : 'phone'} 
                      size={20} 
                      color="#54656F" 
                    />
                    <View style={styles.callHistoryInfo}>
                      <Text style={styles.callHistoryType}>
                        {selectedCallForInfo?.callType === 'video' ? 'Video call' : 'Voice call'}
                      </Text>
                      <Text style={styles.callHistoryTime}>
                        {selectedCallForInfo?.time}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.callHistoryRight}>
                    <Text style={styles.callHistoryDuration}>
                      {selectedCallForInfo?.duration || 'Missed'}
                    </Text>
                    <Feather name="info" size={16} color="#8696A0" />
                  </View>
                </View>

                {/* Mock additional calls */}
                <View style={styles.callHistoryItem}>
                  <View style={styles.callHistoryLeft}>
                    <Feather name="phone" size={20} color="#54656F" />
                    <View style={styles.callHistoryInfo}>
                      <Text style={styles.callHistoryType}>Voice call</Text>
                      <Text style={styles.callHistoryTime}>Yesterday</Text>
                    </View>
                  </View>
                  <View style={styles.callHistoryRight}>
                    <Text style={styles.callHistoryDuration}>4:23</Text>
                    <Feather name="info" size={16} color="#8696A0" />
                  </View>
                </View>
              </View>

              {/* Media Section */}
              <View style={styles.callInfoSectionGap} />
              <View style={[styles.callInfoSection, { backgroundColor: '#FFFFFF' }]}>
                <TouchableOpacity style={styles.callInfoListItem}>
                  <View style={styles.callInfoListItemLeft}>
                    <Feather name="image" size={20} color="#54656F" />
                    <Text style={styles.callInfoListItemText}>
                      Media, links and docs
                    </Text>
                  </View>
                  <View style={styles.callInfoListItemRight}>
                    <Text style={styles.callInfoListItemCount}>0</Text>
                    <Feather name="chevron-right" size={20} color="#8696A0" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Notifications */}
              <View style={styles.callInfoSectionGap} />
              <View style={[styles.callInfoSection, { backgroundColor: '#FFFFFF' }]}>
                <TouchableOpacity style={styles.callInfoListItem}>
                  <View style={styles.callInfoListItemLeft}>
                    <Feather name="bell" size={20} color="#54656F" />
                    <Text style={styles.callInfoListItemText}>
                      Mute notifications
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#8696A0" />
                </TouchableOpacity>
              </View>

              {/* Encryption */}
              <View style={styles.callInfoSectionGap} />
              <View style={[styles.callInfoSection, { backgroundColor: '#FFFFFF' }]}>
                <TouchableOpacity style={styles.callInfoEncryptionItem}>
                  <View style={styles.callInfoEncryptionLeft}>
                    <Feather name="lock" size={20} color="#54656F" />
                    <View style={styles.callInfoEncryptionTextContainer}>
                      <Text style={styles.callInfoEncryptionTitle}>
                        Encryption
                      </Text>
                      <Text style={styles.callInfoEncryptionDesc}>
                        Messages and calls are end-to-end encrypted. Tap to verify.
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color="#8696A0" />
                </TouchableOpacity>
              </View>

              {/* Block Contact */}
              <View style={styles.callInfoSectionGap} />
              <View style={[styles.callInfoSection, { backgroundColor: '#FFFFFF' }]}>
                <TouchableOpacity style={styles.callInfoListItem}>
                  <View style={styles.callInfoListItemLeft}>
                    <Feather name="slash" size={20} color="#E53935" />
                    <Text style={styles.callInfoDangerText}>
                      Block {selectedCallForInfo?.userName}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#8696A0" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.callInfoListItem}>
                  <View style={styles.callInfoListItemLeft}>
                    <Feather name="alert-triangle" size={20} color="#E53935" />
                    <Text style={styles.callInfoDangerText}>
                      Report {selectedCallForInfo?.userName}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#8696A0" />
                </TouchableOpacity>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BlurView intensity={80} tint={isLightMode ? 'light' : 'dark'} style={[styles.bottomNav, { borderTopColor: isLightMode ? 'rgba(233, 237, 239, 0.3)' : 'rgba(42, 57, 66, 0.3)' }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('status'); router.push('/status' as any); }}>
          <Feather name="radio" size={24} color={activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('phone')}>
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
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callAvatarContainer: {
    marginRight: 16,
  },
  callAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 2,
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callTypeContainer: {
    marginRight: 8,
  },
  callDirectionIcon: {
    marginRight: 4,
  },
  callTime: {
    fontSize: 14,
  },
  callActions: {
    flexDirection: 'row',
    gap: 12,
  },
  callActionButton: {
    padding: 8,
  },
  fabPrimary: {
    position: 'absolute',
    bottom: 100,
    right: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  callTypeSelector: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  callTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#00A884',
  },
  callTypeButtonActive: {
    backgroundColor: '#00A884',
  },
  callTypeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  contactInput: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    fontSize: 16,
    color: '#000000',
  },
  quickContacts: {
    paddingHorizontal: 20,
  },
  quickContactsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  quickContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  quickContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  quickContactName: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  searchInput: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    fontSize: 16,
    color: '#000000',
  },
  searchResults: {
    maxHeight: 400,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  searchResultTime: {
    fontSize: 14,
    color: '#667781',
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
  callInfoModalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  callInfoModalContent: {
    flex: 1,
  },
  callInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  callInfoBackButton: {
    padding: 4,
  },
  callInfoHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 16,
  },
  callInfoHeaderPlaceholder: {
    width: 32,
  },
  callInfoScrollView: {
    flex: 1,
  },
  callInfoProfileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  callInfoAvatarContainer: {
    marginBottom: 16,
  },
  callInfoAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callInfoAvatarText: {
    fontSize: 48,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  callInfoUserName: {
    fontSize: 24,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  callInfoUserStatus: {
    fontSize: 16,
    color: '#667781',
    textAlign: 'center',
  },
  callInfoSectionGap: {
    height: 8,
  },
  callInfoActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  callInfoActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  callInfoActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  callInfoActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#00A884',
  },
  callInfoSection: {
    paddingVertical: 0,
  },
  callInfoSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  callInfoSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#667781',
  },
  callHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callHistoryInfo: {
    marginLeft: 16,
    flex: 1,
  },
  callHistoryType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  callHistoryTime: {
    fontSize: 14,
    color: '#667781',
  },
  callHistoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callHistoryDuration: {
    fontSize: 14,
    color: '#667781',
  },
  callInfoListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDEF',
  },
  callInfoListItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },
  callInfoListItemText: {
    fontSize: 16,
    color: '#000000',
  },
  callInfoListItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callInfoListItemCount: {
    fontSize: 14,
    color: '#667781',
  },
  callInfoEncryptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  callInfoEncryptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    flex: 1,
  },
  callInfoEncryptionTextContainer: {
    flex: 1,
  },
  callInfoEncryptionTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 2,
  },
  callInfoEncryptionDesc: {
    fontSize: 13,
    color: '#667781',
    lineHeight: 18,
  },
  callInfoDangerText: {
    fontSize: 16,
    color: '#E53935',
  },
});