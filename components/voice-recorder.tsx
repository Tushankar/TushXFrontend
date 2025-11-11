import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  Animated,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Line } from 'react-native-svg';

interface VoiceRecorderProps {
  onVoiceRecorded: (uri: string, duration: number) => void;
  isLightMode: boolean;
  onRecordingStart: () => void;
  onRecordingEnd: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onVoiceRecorded,
  isLightMode,
  onRecordingStart,
  onRecordingEnd,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const waveformTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Swipe detection for recording
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isRecording, // Only allow swipe when not recording
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Detect swipe if vertical movement is significant and upward
        return Math.abs(gestureState.dy) > 10 && gestureState.dy < 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Track if user is swiping up
        if (gestureState.dy < -50) {
          // Significant upward swipe detected
          startRecording();
        }
      },
    })
  ).current;

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clean up any active recording
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(e => {
          console.log('Cleanup recording error:', e);
        });
        recordingRef.current = null;
      }
      // Clear any active timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (waveformTimerRef.current) {
        clearInterval(waveformTimerRef.current);
      }
    };
  }, []);

  // Setup audio
  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const startRecording = async () => {
    try {
      // Clean up any previous recording object
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          console.log('Previous recording cleanup:', e);
        }
        recordingRef.current = null;
      }

      await setupAudio();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);
      setWaveformData([]);
      onRecordingStart();

      // Haptic feedback - stronger vibration for swipe
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Play audio feedback sound using tone generation
      playRecordingStartSound();

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Update timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000) as any;

      // Update waveform data every 100ms
      waveformTimerRef.current = setInterval(() => {
        const randomValue = Math.random() * 0.8 + 0.2;
        setWaveformData((prev) => {
          const newData = [...prev, randomValue];
          // Keep max 50 bars visible
          if (newData.length > 50) {
            return newData.slice(-50);
          }
          return newData;
        });
      }, 100) as any;
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start voice recording');
    }
  };

  // Play simple tone feedback when recording starts
  const playRecordingStartSound = async () => {
    try {
      // Try to load the recording-start sound
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/recording-start.mp3')
      );
      await sound.playAsync();
      // Unload after playing
      setTimeout(() => sound.unloadAsync(), 300);
    } catch (error) {
      // Fallback: if sound file doesn't exist, just use haptic feedback
      console.log('Recording sound not available, using haptic only');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current || !isRecording) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (!uri) {
        throw new Error('Recording URI is null');
      }

      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (waveformTimerRef.current) {
        clearInterval(waveformTimerRef.current);
      }

      // Get the actual duration from the recorded file
      let duration = recordingTime;
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          duration = Math.round(status.durationMillis / 1000); // Convert to seconds
          console.log('Got actual audio duration:', duration);
        }
        await sound.unloadAsync();
      } catch (error) {
        console.warn('Could not get actual duration, using timer:', error);
        duration = recordingTime;
      }

      // Ensure minimum duration of 1 second
      duration = Math.max(1, duration);

      setIsRecording(false);
      setRecordingTime(0);
      setWaveformData([]);
      onRecordingEnd();

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Call callback with URI and duration
      onVoiceRecorded(uri, duration);

      recordingRef.current = null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Recording Error', 'Failed to stop voice recording');
      setIsRecording(false);
      onRecordingEnd();
    }
  };

  const cancelRecording = async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (waveformTimerRef.current) {
        clearInterval(waveformTimerRef.current);
      }

      setIsRecording(false);
      setRecordingTime(0);
      setWaveformData([]);
      onRecordingEnd();

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <TouchableOpacity
        style={[
          styles.recordButton,
          {
            backgroundColor: isLightMode ? '#25D366' : '#00A884',
          },
        ]}
        onPress={startRecording}
        activeOpacity={0.7}
        {...panResponder.panHandlers}
      >
        <Feather name="mic" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    );
  }

  // Recording UI with waveform
  const waveformColor = isLightMode ? '#075E54' : '#00A884';

  return (
    <View
      style={[
        styles.recordingContainer,
        {
          backgroundColor: isLightMode ? '#E8F5E9' : 'rgba(0, 168, 132, 0.1)',
        },
      ]}
    >
      <Animated.View
        style={[
          styles.recordingPulse,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View
          style={[
            styles.recordingDot,
            {
              backgroundColor: isLightMode ? '#25D366' : '#00A884',
            },
          ]}
        />
      </Animated.View>

      {/* Waveform Display */}
      <View style={styles.waveformRecordingContainer}>
        {waveformData.length > 0 ? (
          <Svg width="100%" height="40" viewBox="0 0 280 40" preserveAspectRatio="none">
            {waveformData.map((value, index) => {
              const x = (index / waveformData.length) * 280;
              const height = value * 30;
              const y1 = 20 - height / 2;
              const y2 = 20 + height / 2;

              return (
                <Line
                  key={`bar-${index}`}
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke={waveformColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        ) : (
          <Text style={[styles.recordingTimeSmall, { color: waveformColor }]}>
            {formatTime(recordingTime)}
          </Text>
        )}
      </View>

      <Text
        style={[
          styles.recordingTime,
          {
            color: isLightMode ? '#075E54' : '#00A884',
          },
        ]}
      >
        {formatTime(recordingTime)}
      </Text>

      <View style={styles.recordingActions}>
        <TouchableOpacity
          style={[
            styles.recordingButton,
            {
              backgroundColor: isLightMode ? '#FFEBEE' : 'rgba(255, 87, 34, 0.1)',
            },
          ]}
          onPress={cancelRecording}
        >
          <Feather
            name="x"
            size={24}
            color={isLightMode ? '#C62828' : '#FF5722'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.recordingButton,
            {
              backgroundColor: isLightMode ? '#C8E6C9' : 'rgba(0, 168, 132, 0.2)',
            },
          ]}
          onPress={stopRecording}
        >
          <Feather
            name="check"
            size={24}
            color={isLightMode ? '#1B5E20' : '#00A884'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  recordButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 168, 132, 0.3)',
  },
  recordingPulse: {
    marginRight: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  waveformRecordingContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    marginHorizontal: 8,
    minWidth: 100,
  },
  recordingTime: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 45,
  },
  recordingTimeSmall: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  recordingActions: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: 8,
  },
  recordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});
