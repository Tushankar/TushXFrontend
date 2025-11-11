import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Modal, TextInput, FlatList, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

// Mock posts data
const MOCK_POSTS = [
  {
    id: '1',
    author: {
      id: 'user1',
      name: 'Alice Johnson',
      avatar: 'https://i.pravatar.cc/150?img=1',
      username: '@alice_johnson',
      isVerified: true,
    },
    content: 'Just finished an amazing hike! The view from the top was absolutely breathtaking 🏔️',
    image: 'https://picsum.photos/400/500?random=1',
    timestamp: '2 hours ago',
    likes: 342,
    comments: 45,
    shares: 12,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Bob Smith', avatar: 'https://i.pravatar.cc/150?img=2', text: 'Wow, looks amazing!', timestamp: '1 hour ago', likes: 10 },
      { id: 'c2', author: 'Carol Williams', avatar: 'https://i.pravatar.cc/150?img=3', text: 'I want to go there!', timestamp: '1 hour ago', likes: 5 },
      { id: 'c3', author: 'David Brown', avatar: 'https://i.pravatar.cc/150?img=4', text: 'Perfect spot for sunset', timestamp: '45 minutes ago', likes: 8 },
    ]
  },
  {
    id: '2',
    author: {
      id: 'user2',
      name: 'Bob Smith',
      avatar: 'https://i.pravatar.cc/150?img=2',
      username: '@bob_smith',
      isVerified: false,
    },
    content: 'Coffee and code - my favorite combination ☕💻',
    image: 'https://picsum.photos/400/500?random=2',
    timestamp: '4 hours ago',
    likes: 218,
    comments: 32,
    shares: 8,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Emma Davis', avatar: 'https://i.pravatar.cc/150?img=5', text: 'Same here!', timestamp: '3 hours ago', likes: 6 },
      { id: 'c2', author: 'Frank Miller', avatar: 'https://i.pravatar.cc/150?img=6', text: 'Developer life ❤️', timestamp: '3 hours ago', likes: 12 },
    ]
  },
  {
    id: '3',
    author: {
      id: 'user3',
      name: 'Carol Williams',
      avatar: 'https://i.pravatar.cc/150?img=3',
      username: '@carol_design',
      isVerified: true,
    },
    content: 'New UI design for our upcoming app! What do you think? 🎨',
    image: 'https://picsum.photos/400/500?random=3',
    timestamp: '6 hours ago',
    likes: 567,
    comments: 89,
    shares: 45,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Grace Lee', avatar: 'https://i.pravatar.cc/150?img=7', text: 'Love this design!', timestamp: '5 hours ago', likes: 34 },
      { id: 'c2', author: 'Henry Wilson', avatar: 'https://i.pravatar.cc/150?img=8', text: 'The colors are perfect', timestamp: '4 hours ago', likes: 18 },
    ]
  },
  {
    id: '4',
    author: {
      id: 'user4',
      name: 'David Brown',
      avatar: 'https://i.pravatar.cc/150?img=4',
      username: '@david_travel',
      isVerified: false,
    },
    content: 'Beach day! Nothing beats the feeling of sand and sea 🏖️',
    image: 'https://picsum.photos/400/500?random=4',
    timestamp: '8 hours ago',
    likes: 421,
    comments: 54,
    shares: 23,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Isabella Garcia', avatar: 'https://i.pravatar.cc/150?img=10', text: 'Paradise! 😍', timestamp: '7 hours ago', likes: 22 },
      { id: 'c2', author: 'Jack Martinez', avatar: 'https://i.pravatar.cc/150?img=11', text: 'Wish I was there', timestamp: '6 hours ago', likes: 15 },
    ]
  },
  {
    id: '5',
    author: {
      id: 'user5',
      name: 'Emma Davis',
      avatar: 'https://i.pravatar.cc/150?img=5',
      username: '@emma_foodie',
      isVerified: true,
    },
    content: 'Homemade pizza night with friends! 🍕 Nothing beats homemade!',
    image: 'https://picsum.photos/400/500?random=5',
    timestamp: '10 hours ago',
    likes: 289,
    comments: 41,
    shares: 16,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Karen Lee', avatar: 'https://i.pravatar.cc/150?img=12', text: 'Looks delicious!', timestamp: '9 hours ago', likes: 11 },
    ]
  },
  {
    id: '6',
    author: {
      id: 'user6',
      name: 'Frank Miller',
      avatar: 'https://i.pravatar.cc/150?img=6',
      username: '@frank_tech',
      isVerified: false,
    },
    content: 'Just launched my new project! Excited to see what everyone thinks 🚀',
    image: 'https://picsum.photos/400/500?random=6',
    timestamp: '12 hours ago',
    likes: 156,
    comments: 28,
    shares: 9,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Grace Lee', avatar: 'https://i.pravatar.cc/150?img=7', text: 'Congrats on the launch!', timestamp: '11 hours ago', likes: 8 },
    ]
  },
  {
    id: '7',
    author: {
      id: 'user7',
      name: 'Grace Lee',
      avatar: 'https://i.pravatar.cc/150?img=7',
      username: '@grace_fitness',
      isVerified: true,
    },
    content: 'Morning workout done! 💪 Starting the day with energy!',
    image: 'https://picsum.photos/400/500?random=7',
    timestamp: '14 hours ago',
    likes: 523,
    comments: 76,
    shares: 34,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Henry Wilson', avatar: 'https://i.pravatar.cc/150?img=8', text: 'Keep it up!', timestamp: '13 hours ago', likes: 15 },
      { id: 'c2', author: 'Isabella Garcia', avatar: 'https://i.pravatar.cc/150?img=10', text: 'Motivation goals!', timestamp: '13 hours ago', likes: 12 },
    ]
  },
  {
    id: '8',
    author: {
      id: 'user8',
      name: 'Henry Wilson',
      avatar: 'https://i.pravatar.cc/150?img=8',
      username: '@henry_travel',
      isVerified: false,
    },
    content: 'Exploring the city streets 🏙️ Found amazing hidden spots!',
    image: 'https://picsum.photos/400/500?random=8',
    timestamp: '16 hours ago',
    likes: 387,
    comments: 62,
    shares: 28,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Isabella Garcia', avatar: 'https://i.pravatar.cc/150?img=10', text: 'Add these to my bucket list!', timestamp: '15 hours ago', likes: 18 },
    ]
  },
  {
    id: '9',
    author: {
      id: 'user9',
      name: 'Isabella Garcia',
      avatar: 'https://i.pravatar.cc/150?img=10',
      username: '@isabella_art',
      isVerified: true,
    },
    content: 'New art piece finished! Abstract expressionism at its finest 🎨✨',
    image: 'https://picsum.photos/400/500?random=9',
    timestamp: '18 hours ago',
    likes: 612,
    comments: 98,
    shares: 56,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Jack Martinez', avatar: 'https://i.pravatar.cc/150?img=11', text: 'This is incredible!', timestamp: '17 hours ago', likes: 24 },
      { id: 'c2', author: 'Karen Lee', avatar: 'https://i.pravatar.cc/150?img=12', text: 'Your talent is amazing', timestamp: '17 hours ago', likes: 19 },
    ]
  },
  {
    id: '10',
    author: {
      id: 'user10',
      name: 'Jack Martinez',
      avatar: 'https://i.pravatar.cc/150?img=11',
      username: '@jack_music',
      isVerified: false,
    },
    content: 'Music production session with amazing vibes 🎵🎧 New track coming soon!',
    image: 'https://picsum.photos/400/500?random=10',
    timestamp: '20 hours ago',
    likes: 445,
    comments: 54,
    shares: 31,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Karen Lee', avatar: 'https://i.pravatar.cc/150?img=12', text: 'Can\'t wait to hear it!', timestamp: '19 hours ago', likes: 13 },
    ]
  },
  {
    id: '11',
    author: {
      id: 'user11',
      name: 'Karen Lee',
      avatar: 'https://i.pravatar.cc/150?img=12',
      username: '@karen_fashion',
      isVerified: true,
    },
    content: 'Fashion show was incredible! 👗✨ Wearing the latest collection!',
    image: 'https://picsum.photos/400/500?random=11',
    timestamp: '22 hours ago',
    likes: 789,
    comments: 112,
    shares: 67,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Laura White', avatar: 'https://i.pravatar.cc/150?img=13', text: 'You look stunning!', timestamp: '21 hours ago', likes: 31 },
      { id: 'c2', author: 'Michael Brown', avatar: 'https://i.pravatar.cc/150?img=14', text: 'Fashion goals!', timestamp: '21 hours ago', likes: 22 },
    ]
  },
  {
    id: '12',
    author: {
      id: 'user12',
      name: 'Laura White',
      avatar: 'https://i.pravatar.cc/150?img=13',
      username: '@laura_books',
      isVerified: false,
    },
    content: 'Just finished reading an amazing book! 📚 Highly recommend it to all readers',
    image: 'https://picsum.photos/400/500?random=12',
    timestamp: '24 hours ago',
    likes: 234,
    comments: 39,
    shares: 14,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Michael Brown', avatar: 'https://i.pravatar.cc/150?img=14', text: 'What book is it?', timestamp: '23 hours ago', likes: 6 },
    ]
  },
  {
    id: '13',
    author: {
      id: 'user13',
      name: 'Michael Brown',
      avatar: 'https://i.pravatar.cc/150?img=14',
      username: '@michael_gaming',
      isVerified: true,
    },
    content: 'Got the new gaming setup! 🎮 Ready to conquer some games!',
    image: 'https://picsum.photos/400/500?random=13',
    timestamp: '1 day ago',
    likes: 567,
    comments: 71,
    shares: 42,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Nancy Green', avatar: 'https://i.pravatar.cc/150?img=15', text: 'That setup is insane!', timestamp: '1 day ago', likes: 20 },
    ]
  },
  {
    id: '14',
    author: {
      id: 'user14',
      name: 'Nancy Green',
      avatar: 'https://i.pravatar.cc/150?img=15',
      username: '@nancy_nature',
      isVerified: false,
    },
    content: 'Nature photography session by the lake 📸 Pure tranquility!',
    image: 'https://picsum.photos/400/500?random=14',
    timestamp: '1 day ago',
    likes: 456,
    comments: 58,
    shares: 26,
    liked: false,
    saved: false,
    comments_data: [
      { id: 'c1', author: 'Oliver Scott', avatar: 'https://i.pravatar.cc/150?img=16', text: 'These photos are breathtaking!', timestamp: '1 day ago', likes: 17 },
    ]
  },
];

type Post = typeof MOCK_POSTS[0];

const CreatePostScreen = ({
  onBack,
  onPost,
}: {
  onBack: () => void;
  onPost: (text: string, image: string) => void;
}) => {
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState('');

  const handlePost = () => {
    if (postText.trim()) {
      onPost(postText, postImage);
      setPostText('');
      setPostImage('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.createScreenContainer}
    >
      <View style={styles.createTopBar}>
        <TouchableOpacity onPress={onBack} style={styles.createTopBarButton}>
          <Feather name="x" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.createTopBarTitle}>Create</Text>
        <TouchableOpacity
          onPress={handlePost}
          style={[
            styles.createTopBarButton,
            { opacity: postText.trim() ? 1 : 0.5 }
          ]}
          disabled={!postText.trim()}
        >
          <Text
            style={[
              styles.createTopBarPostText,
              { color: postText.trim() ? '#00A884' : '#000000' }
            ]}
          >
            Post
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.createScrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Author Preview - Instagram-like subtle header */}
        <View style={styles.authorPreview}>
          <Image source={{ uri: 'https://i.pravatar.cc/150?img=0' }} style={styles.authorPreviewAvatar} />
          <View>
            <Text style={[styles.authorPreviewName, { color: '#000000' }]}>You</Text>
            <Text style={[styles.authorPreviewHandle, { color: '#667781' }]}>@your_username</Text>
          </View>
        </View>

        {/* Post Text Input - Larger, Instagram caption style */}
        <TextInput
          style={[styles.postTextInput, { color: '#000000' }]}
          placeholder="What's on your mind?"
          placeholderTextColor="#8696A0"
          multiline
          maxLength={2200} // Instagram limit
          value={postText}
          onChangeText={setPostText}
          textAlignVertical="top"
          style={styles.instagramCaptionInput}
        />

        {/* Character Count - Bottom aligned like Instagram */}
        <Text style={[styles.charCount, { color: postText.length > 2000 ? '#E74C3C' : '#8696A0' }]}>
          {postText.length}/2200
        </Text>

        {/* Image Preview - Full width, with overlay controls like Instagram */}
        {postImage ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: postImage }} style={styles.imagePreviewImage} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setPostImage('')}
            >
              <Feather name="x" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mediaSelectionPlaceholder}>
            <Feather name="plus-circle" size={56} color="#CCCCCC" />
            <Text style={styles.mediaSelectionText}>Select from gallery or take a photo</Text>
          </View>
        )}

        {/* Action Buttons - Instagram-style bottom tray */}
        <View style={styles.createPostActions}>
          <TouchableOpacity
            onPress={() => setPostImage(`https://picsum.photos/400/500?random=${Date.now()}`)}
            style={styles.actionIconButton}
          >
            <Feather name="image" size={24} color="#00A884" />
            <Text style={styles.actionIconLabel}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton}>
            <Feather name="video" size={24} color="#00A884" />
            <Text style={styles.actionIconLabel}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton}>
            <Feather name="smile" size={24} color="#00A884" />
            <Text style={styles.actionIconLabel}>Emoji</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton}>
            <Feather name="tag" size={24} color="#00A884" />
            <Text style={styles.actionIconLabel}>Tag</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('community');
  const [currentScreen, setCurrentScreen] = useState<'community' | 'create'>('community');
  const router = useRouter();
  const isLightMode = true;

  if (currentScreen === 'create') {
    return (
      <CreatePostScreen
        onBack={() => setCurrentScreen('community')}
        onPost={(text, image) => {
          if (text.trim()) {
            const newPost: Post = {
              id: Date.now().toString(),
              author: {
                id: 'currentUser',
                name: 'You',
                avatar: 'https://i.pravatar.cc/150?img=0',
                username: '@your_username',
                isVerified: false,
              },
              content: text,
              image: image || 'https://picsum.photos/400/500?random=0',
              timestamp: 'Just now',
              likes: 0,
              comments: 0,
              shares: 0,
              liked: false,
              saved: false,
              comments_data: [],
            };
            setPosts([newPost, ...posts]);
            setCurrentScreen('community');
            Keyboard.dismiss();
          }
        }}
      />
    );
  }

  const handleLike = (postId: string) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? { ...post, liked: !post.liked, likes: post.liked ? post.likes - 1 : post.likes + 1 }
          : post
      )
    );
  };

  const handleSave = (postId: string) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId ? { ...post, saved: !post.saved } : post
      )
    );
  };

  const handleAddComment = () => {
    if (newComment.trim() && selectedPost) {
      const updatedPosts = posts.map(post => {
        if (post.id === selectedPost.id) {
          const updatedPost = {
            ...post,
            comments: post.comments + 1,
            comments_data: [
              ...post.comments_data,
              {
                id: `c${Date.now()}`,
                author: 'You',
                avatar: 'https://i.pravatar.cc/150?img=0',
                text: newComment,
                timestamp: 'Just now',
                likes: 0,
              },
            ],
          };
          setSelectedPost(updatedPost);
          return updatedPost;
        }
        return post;
      });
      setPosts(updatedPosts);
      setNewComment('');
    }
  };

  const PostCard = ({ post }: { post: Post }) => (
    <View style={[styles.postCard, { backgroundColor: '#FFFFFF' }]}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Image source={{ uri: post.author.avatar }} style={styles.authorAvatar} />
          <View style={styles.authorDetails}>
            <View style={styles.authorNameContainer}>
              <Text style={[styles.authorName, { color: '#000000' }]}>{post.author.name}</Text>
              {post.author.isVerified && (
                <Feather name="check-circle" size={14} color="#00A884" style={styles.verifiedBadge} />
              )}
            </View>
            <Text style={[styles.authorUsername, { color: '#667781' }]}>{post.author.username}</Text>
            <Text style={[styles.postTime, { color: '#8696A0' }]}>{post.timestamp}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Feather name="more-vertical" size={20} color="#667781" />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <View style={styles.postContent}>
        <Text style={[styles.postText, { color: '#000000' }]}>{post.content}</Text>
        {post.image && (
          <Image source={{ uri: post.image }} style={styles.postImage} />
        )}
      </View>

      {/* Post Stats */}
      <View style={[styles.postStats, { borderBottomColor: '#E9EDEF' }]}>
        <TouchableOpacity style={styles.statItem}>
          <Text style={[styles.statText, { color: '#667781' }]}>{post.likes} Likes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => {
            setSelectedPost(post);
            setShowCommentsModal(true);
          }}
        >
          <Text style={[styles.statText, { color: '#667781' }]}>{post.comments} Comments</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem}>
          <Text style={[styles.statText, { color: '#667781' }]}>{post.shares} Shares</Text>
        </TouchableOpacity>
      </View>

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(post.id)}
        >
          <Feather
            name={post.liked ? 'heart' : 'heart'}
            size={20}
            color={post.liked ? '#E74C3C' : '#667781'}
            fill={post.liked ? '#E74C3C' : 'none'}
          />
          <Text style={[styles.actionText, { color: post.liked ? '#E74C3C' : '#667781' }]}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedPost(post);
            setShowCommentsModal(true);
          }}
        >
          <Feather name="message-circle" size={20} color="#667781" />
          <Text style={[styles.actionText, { color: '#667781' }]}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Feather name="send" size={20} color="#667781" />
          <Text style={[styles.actionText, { color: '#667781' }]}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSave(post.id)}
        >
          <Feather
            name={post.saved ? 'bookmark' : 'bookmark'}
            size={20}
            color={post.saved ? '#00A884' : '#667781'}
            fill={post.saved ? '#00A884' : 'none'}
          />
          <Text style={[styles.actionText, { color: post.saved ? '#00A884' : '#667781' }]}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#075E54' }]}>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton}>
            <Feather name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => setCurrentScreen('create')}
          >
            <Feather name="plus-circle" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Posts Feed */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {posts.map((post) => (
          <View key={post.id}>
            <PostCard post={post} />
            <View style={{ height: 8, backgroundColor: '#F5F5F5' }} />
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Comments Modal */}
      <Modal visible={showCommentsModal} transparent animationType="slide">
        <View style={styles.commentsModalOverlay}>
          <View style={styles.commentsModalContent}>
            {selectedPost && (
              <>
                {/* Header */}
                <View style={styles.commentsModalHeader}>
                  <Text style={styles.commentsModalTitle}>Comments</Text>
                  <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                    <Feather name="x" size={24} color="#000000" />
                  </TouchableOpacity>
                </View>

                {/* Original Post Preview */}
                <View style={[styles.originalPostPreview, { backgroundColor: '#F5F5F5' }]}>
                  <View style={styles.postHeaderSmall}>
                    <Image source={{ uri: selectedPost.author.avatar }} style={styles.authorAvatarSmall} />
                    <View style={styles.authorDetailsSmall}>
                      <Text style={[styles.authorNameSmall, { color: '#000000' }]}>{selectedPost.author.name}</Text>
                      <Text style={[styles.postTimeSmall, { color: '#8696A0' }]}>{selectedPost.timestamp}</Text>
                    </View>
                  </View>
                  <Text style={[styles.postTextSmall, { color: '#000000' }]}>{selectedPost.content}</Text>
                </View>

                {/* Comments List */}
                <ScrollView style={styles.commentsList}>
                  {selectedPost.comments_data.map((comment) => (
                    <View key={comment.id} style={[styles.commentItem, { borderBottomColor: '#E9EDEF' }]}>
                      <Image source={{ uri: comment.avatar }} style={styles.commentAvatar} />
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <Text style={[styles.commentAuthor, { color: '#000000' }]}>{comment.author}</Text>
                          <Text style={[styles.commentTime, { color: '#8696A0' }]}>{comment.timestamp}</Text>
                        </View>
                        <Text style={[styles.commentText, { color: '#000000' }]}>{comment.text}</Text>
                        <View style={styles.commentActions}>
                          <TouchableOpacity>
                            <Text style={[styles.commentLikes, { color: '#00A884' }]}>❤️ {comment.likes}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity>
                            <Text style={[styles.commentReply, { color: '#00A884' }]}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Comment Input */}
                <View style={[styles.commentInputContainer, { borderTopColor: '#E9EDEF' }]}>
                  <Image source={{ uri: 'https://i.pravatar.cc/150?img=0' }} style={styles.commentInputAvatar} />
                  <View style={styles.commentInputField}>
                    <TextInput
                      style={[styles.commentInput, { color: '#000000' }]}
                      placeholder="Add a comment..."
                      placeholderTextColor="#8696A0"
                      value={newComment}
                      onChangeText={setNewComment}
                    />
                    {newComment.trim() && (
                      <TouchableOpacity onPress={handleAddComment}>
                        <Text style={[styles.commentSendButton, { color: '#00A884' }]}>Post</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: '#FFFFFF', borderTopColor: '#E9EDEF' }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('status'); router.push('/status' as any); }}>
          <Feather name="radio" size={24} color={activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'status' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('phone'); router.push('/calls' as any); }}>
          <Feather name="phone" size={24} color={activeTab === 'phone' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'phone' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Calls</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('community'); }}>
          <Feather name="globe" size={24} color={activeTab === 'community' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'community' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Community</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('chats'); router.push('/dashboard' as any); }}>
          <Feather name="message-circle" size={24} color={activeTab === 'chats' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'chats' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Chats</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => { setActiveTab('settings'); router.push('/settings' as any); }}>
          <Feather name="settings" size={24} color={activeTab === 'settings' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0')} />
          <Text style={[styles.navLabel, { color: activeTab === 'settings' ? (isLightMode ? '#075E54' : '#00A884') : (isLightMode ? '#667781' : '#8696A0') }]}>Settings</Text>
        </TouchableOpacity>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
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
    paddingBottom: 80,
  },
  postCard: {
    marginVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDEF',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  authorInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  authorUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  postTime: {
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  postContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  postStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statItem: {
    flex: 1,
    paddingVertical: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
  },
  postActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  commentsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  commentsModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  commentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  commentsModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  originalPostPreview: {
    padding: 16,
    marginBottom: 8,
  },
  postHeaderSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  authorDetailsSmall: {
    flex: 1,
  },
  authorNameSmall: {
    fontSize: 14,
    fontWeight: '600',
  },
  postTimeSmall: {
    fontSize: 12,
    marginTop: 2,
  },
  postTextSmall: {
    fontSize: 14,
    lineHeight: 18,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 6,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  commentLikes: {
    fontSize: 12,
    fontWeight: '500',
  },
  commentReply: {
    fontSize: 12,
    fontWeight: '500',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  commentInputAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  commentInputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
  },
  commentSendButton: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  fabButton: {
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
  // New styles for CreatePostScreen (Instagram-like)
  createScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  createTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
    backgroundColor: '#FFFFFF',
  },
  createTopBarButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  createTopBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  createTopBarPostText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createScrollView: {
    flex: 1,
  },
  authorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E1E1E1',
  },
  authorPreviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorPreviewName: {
    fontSize: 15,
    fontWeight: '600',
  },
  authorPreviewHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  instagramCaptionInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingBottom: 12,
    color: '#8696A0',
  },
  imagePreview: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreviewImage: {
    width: '100%',
    height: 300,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaSelectionPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: '#E1E1E1',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  mediaSelectionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8696A0',
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#E1E1E1',
  },
  actionIconButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionIconLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#667781',
    fontWeight: '500',
  },
});