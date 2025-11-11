import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import Svg, { Line } from 'react-native-svg';

interface VoiceMessageProps {
  messageId: string;
  voiceUrl: string;
  duration: number; // in seconds
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  isMine: boolean;
  isLightMode: boolean;
  voiceListenedBy?: string[]; // Array of user IDs who have listened
  currentUserId?: string; // Current user ID
  onVoiceListened?: (messageId: string) => void; // Callback when voice finishes playing
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  messageId,
  voiceUrl,
  duration,
  isPlaying,
  onPlay,
  onPause,
  isMine,
  isLightMode,
  voiceListenedBy = [],
  currentUserId = '',
  onVoiceListened,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [actualDuration, setActualDuration] = useState<number>(0);
  const [hasBeenListened, setHasBeenListened] = useState(
    voiceListenedBy.includes(currentUserId)
  );

  // Update hasBeenListened when voiceListenedBy prop changes
  useEffect(() => {
    const newListenedStatus = voiceListenedBy.includes(currentUserId);
    console.log('Voice message voiceListenedBy updated:', {
      messageId,
      voiceListenedBy,
      currentUserId,
      includes: newListenedStatus,
    });
    setHasBeenListened(newListenedStatus);
  }, [voiceListenedBy, currentUserId, messageId]);

  // Generate mock waveform data with better variation
  const generateWaveformData = (durationSecs: number): number[] => {
    // Ensure minimum duration of 1 second for display purposes
    const effectiveDuration = Math.max(1, durationSecs);
    const bars = Math.max(20, Math.min(50, Math.ceil(effectiveDuration * 3))); // 3 bars per second, 20-50 total
    const data: number[] = [];
    for (let i = 0; i < bars; i++) {
      // Create a more natural-looking waveform with smoother transitions
      const baseValue = Math.sin(i / bars * Math.PI) * 0.6; // Envelope
      const variation = Math.random() * 0.7;
      const value = Math.max(0.15, baseValue + variation * 0.4);
      data.push(Math.min(1, value));
    }
    return data;
  };

  useEffect(() => {
    const generatedData = generateWaveformData(duration);
    setWaveformData(generatedData);
    console.log('Waveform data generated:', { duration, bars: generatedData.length, data: generatedData });
    // If duration is 0, try to get actual duration from sound metadata
    if (duration <= 0 && voiceUrl) {
      loadSoundInfo();
    } else {
      setActualDuration(duration);
    }
  }, [duration, voiceUrl]);

  const loadSoundInfo = async () => {
    try {
      const { sound: tempSound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: false }
      );
      const status = await tempSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const durationSecs = status.durationMillis / 1000;
        setActualDuration(durationSecs);
        setWaveformData(generateWaveformData(durationSecs));
      }
      await tempSound.unloadAsync();
    } catch (error) {
      console.error('Error loading sound info:', error);
      setActualDuration(duration);
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Update current time while playing
  useEffect(() => {
    if (!isPlaying || !sound) return;

    const interval = setInterval(async () => {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          setCurrentTime(status.positionMillis / 1000);
          if (status.didJustFinish) {
            onPause();
            setCurrentTime(0);
            // Mark as listened when finished playing
            if (!isMine && !hasBeenListened) {
              setHasBeenListened(true);
              if (onVoiceListened) {
                onVoiceListened(messageId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error getting sound status:', error);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, sound, onPause, isMine, hasBeenListened, messageId, onVoiceListened]);

  const loadAndPlay = async () => {
    try {
      setIsLoading(true);
      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: voiceUrl },
          { shouldPlay: true }
        );
        setSound(newSound);
        // Get actual duration from loaded sound
        const status = await newSound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          const durationSecs = status.durationMillis / 1000;
          setActualDuration(durationSecs);
          setWaveformData(generateWaveformData(durationSecs));
        }
        onPlay();
      } else {
        await sound.playAsync();
        onPlay();
      }
    } catch (error) {
      console.error('Error playing voice message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying && sound) {
      await sound.pauseAsync();
      onPause();
    } else {
      await loadAndPlay();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayDuration = actualDuration > 0 ? actualDuration : duration;

  const textColor = isMine
    ? isLightMode ? '#000000' : '#E9EDEF'
    : isLightMode ? '#000000' : '#E9EDEF';

  const playButtonColor = isMine
    ? isLightMode ? '#075E54' : '#00A884'
    : isLightMode ? '#075E54' : '#00A884';

  // Green color if listened, otherwise normal gray color
  const waveformColor = hasBeenListened
    ? isLightMode ? '#25D366' : '#31A24C' // Green for listened
    : isMine
    ? isLightMode ? 'rgba(0,0,0,0.5)' : 'rgba(233,237,239,0.7)'
    : isLightMode ? 'rgba(0,0,0,0.5)' : 'rgba(134,150,160,0.7)';

  const activeWaveformColor = isPlaying
    ? playButtonColor
    : waveformColor;

  // Calculate progress for played bars
  const playProgress = displayDuration > 0 ? currentTime / displayDuration : 0;

  return (
    <View style={styles.voiceMessageContainer}>
      <TouchableOpacity
        style={[
          styles.playButton,
          { backgroundColor: playButtonColor },
          isLoading && styles.playButtonDisabled,
        ]}
        onPress={handlePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather
            name={isPlaying ? 'pause' : 'play'}
            size={16}
            color="#FFFFFF"
          />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {waveformData.length > 0 ? (
          <View style={{ flex: 1, width: '100%', height: 40, justifyContent: 'center' }}>
            <Svg width="100%" height="40" viewBox="0 0 280 40">
              {waveformData.map((value, index) => {
                const x = (index / waveformData.length) * 280;
                const barProgress = (index / waveformData.length);
                const isPlayed = barProgress <= playProgress;
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
                    stroke={isPlayed && isPlaying ? activeWaveformColor : waveformColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>
          </View>
        ) : (
          <Text style={[styles.loadingText, { color: textColor }]}>Loading...</Text>
        )}
      </View>

      <Text style={[styles.durationText, { color: textColor }]}>
        {formatTime(isPlaying ? currentTime : displayDuration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  playButtonDisabled: {
    opacity: 0.6,
  },
  waveformContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    backgroundColor: 'transparent',
    minWidth: 100,
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  durationText: {
    fontSize: 12,
    marginLeft: 8,
    minWidth: 40,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
});
