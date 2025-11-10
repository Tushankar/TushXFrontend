import { useTheme } from '@/constants/ThemeContext';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiService } from '../utils/api';
import { authStorage } from '../utils/authStorage';
import { initializePushNotifications } from '../utils/notifications';

function Splash({ onPressSkip }: { onPressSkip?: () => void }) {
  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.content}>
        <View style={splashStyles.logoContainer}>
          <Feather name="message-circle" size={80} color="#FFFFFF" />
        </View>
        <Text style={splashStyles.title}>WhatsApp</Text>
      </View>

      <View style={splashStyles.footer}>
        <Text style={splashStyles.footerText}>from</Text>
        <View style={splashStyles.metaContainer}>
          <Feather name="circle" size={16} color="#FFFFFF" />
          <Text style={splashStyles.metaText}>META</Text>
        </View>
      </View>
    </View>
  );
}

function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const { colors, theme } = useTheme();
  const isLightMode = theme === 'light';
  const router = useRouter();

  const handleSignup = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await apiService.signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      setStatusMessage(response.message);
      setPendingEmail(email.trim());
      setShowOTPVerification(true);
      setEmail('');
      setPassword('');
      setName('');
    } catch (error: any) {
      setErrorMessage(error.message || 'Signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPVerification = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await apiService.verifyOTP({
        email: pendingEmail,
        otp: otp.trim(),
      });

      setStatusMessage(response.message);
      setTimeout(() => {
        setShowOTPVerification(false);
        setOtp('');
        setPendingEmail('');
        setStatusMessage('');
        setIsLogin(true);
      }, 2000);
    } catch (error: any) {
      setErrorMessage(error.message || 'OTP verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await apiService.login({
        email: email.trim(),
        password,
      });

      setStatusMessage(response.message);
      // Store token
      if (response.token) {
        await authStorage.setToken(response.token);
      }

      // Initialize push notifications after login
      try {
        await initializePushNotifications();
      } catch (pushError) {
        console.warn('Failed to initialize push notifications:', pushError);
        // Don't block login if push notifications fail
      }

      setEmail('');
      setPassword('');
      router.replace('/dashboard');
    } catch (error: any) {
      setErrorMessage(error.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    setStatusMessage('');

    if (showOTPVerification) {
      if (!otp.trim()) {
        setErrorMessage('Please enter the OTP.');
        return;
      }
      await handleOTPVerification();
      return;
    }

    if (!email.trim() || !password.trim() || (!isLogin && !name.trim())) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (isLogin) {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  const handleBackToLogin = () => {
    setShowOTPVerification(false);
    setOtp('');
    setPendingEmail('');
    setErrorMessage('');
    setStatusMessage('');
    setIsLogin(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[styles.wrapper, { backgroundColor: isLightMode ? '#FFFFFF' : '#0B141A' }]}
    >
      <View style={styles.container}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: isLightMode ? '#00A884' : '#00A884' }]}>
            <Feather name="message-circle" size={56} color="#FFFFFF" />
          </View>
          <Text style={[styles.logoText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
            WhatsApp
          </Text>
        </View>

        {/* OTP Verification Screen */}
        {showOTPVerification ? (
          <View style={styles.formSection}>
            <Text style={[styles.welcomeText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
              Verify Your Email
            </Text>
            <Text style={[styles.subtitleText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              Enter the 6-digit code sent to {pendingEmail}
            </Text>

            <View style={styles.form}>
              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, {
                  backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942',
                  borderColor: isLightMode ? '#E9EDEF' : '#2A3942'
                }]}>
                  <Feather name="lock" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
                  <TextInput
                    style={[styles.input, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                    placeholder="Enter OTP"
                    placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              </View>

              {errorMessage ? (
                <View style={[styles.messageContainer, styles.errorContainer]}>
                  <Feather name="alert-circle" size={16} color="#E53935" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {statusMessage ? (
                <View style={[styles.messageContainer, styles.successContainer]}>
                  <Feather name="check-circle" size={16} color="#00A884" />
                  <Text style={styles.successText}>{statusMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: isLightMode ? '#00A884' : '#00A884',
                    opacity: isSubmitting ? 0.7 : 1
                  },
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={handleBackToLogin}
              >
                <Text style={[styles.switchText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                  Back to{' '}
                  <Text style={[styles.switchTextBold, { color: isLightMode ? '#00A884' : '#00A884' }]}>
                    Sign In
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Login/Signup Form */
          <View style={styles.formSection}>
            <Text style={[styles.welcomeText, { color: isLightMode ? '#000000' : '#E9EDEF' }]}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={[styles.subtitleText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
              {isLogin ? 'Sign in to continue messaging' : 'Sign up to get started'}
            </Text>
            <View style={styles.form}>
              {!isLogin && (
                <View style={styles.inputWrapper}>
                  <View style={[styles.inputContainer, {
                    backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942',
                    borderColor: isLightMode ? '#E9EDEF' : '#2A3942'
                  }]}>
                    <Feather name="user" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
                    <TextInput
                      style={[styles.input, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                      placeholder="Full name"
                      placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>
              )}
              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, {
                  backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942',
                  borderColor: isLightMode ? '#E9EDEF' : '#2A3942'
                }]}>
                  <Feather name="mail" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
                  <TextInput
                    style={[styles.input, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                    placeholder="Email address"
                    placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <View style={styles.inputWrapper}>
                <View style={[styles.inputContainer, {
                  backgroundColor: isLightMode ? '#F7F8FA' : '#2A3942',
                  borderColor: isLightMode ? '#E9EDEF' : '#2A3942'
                }]}>
                  <Feather name="lock" size={20} color={isLightMode ? '#8696A0' : '#667781'} />
                  <TextInput
                    style={[styles.input, { color: isLightMode ? '#000000' : '#E9EDEF' }]}
                    placeholder="Password"
                    placeholderTextColor={isLightMode ? '#8696A0' : '#667781'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={isLightMode ? '#8696A0' : '#667781'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {errorMessage ? (
                <View style={[styles.messageContainer, styles.errorContainer]}>
                  <Feather name="alert-circle" size={16} color="#E53935" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {statusMessage ? (
                <View style={[styles.messageContainer, styles.successContainer]}>
                  <Feather name="check-circle" size={16} color="#00A884" />
                  <Text style={styles.successText}>{statusMessage}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: isLightMode ? '#00A884' : '#00A884',
                    opacity: isSubmitting ? 0.7 : 1
                  },
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>
                    {isLogin ? 'Sign In' : 'Sign Up'}
                  </Text>
                )}
              </TouchableOpacity>
              {isLogin && (
                <TouchableOpacity style={styles.forgotButton}>
                  <Text style={[styles.forgotText, { color: isLightMode ? '#00A884' : '#00A884' }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} />
              <Text style={[styles.dividerText, { color: isLightMode ? '#8696A0' : '#667781' }]}>OR</Text>
              <View style={[styles.divider, { backgroundColor: isLightMode ? '#E9EDEF' : '#2A3942' }]} />
            </View>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => {
                setIsLogin(!isLogin);
                setErrorMessage('');
                setStatusMessage('');
              }}
            >
              <Text style={[styles.switchText, { color: isLightMode ? '#667781' : '#8696A0' }]}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={[styles.switchTextBold, { color: isLightMode ? '#00A884' : '#00A884' }]}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: isLightMode ? '#8696A0' : '#667781' }]}>
            from
          </Text>
          <View style={styles.footerBrand}>
            <Feather name="circle" size={14} color={isLightMode ? '#00A884' : '#00A884'} />
            <Text style={[styles.footerBrandText, { color: isLightMode ? '#00A884' : '#00A884' }]}>
              META
            </Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  formSection: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorContainer: {
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
  },
  successContainer: {
    backgroundColor: 'rgba(0, 168, 132, 0.1)',
  },
  errorText: {
    color: '#E53935',
    fontSize: 13,
    flex: 1,
  },
  successText: {
    color: '#00A884',
    fontSize: 13,
    flex: 1,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchText: {
    fontSize: 14,
  },
  switchTextBold: {
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 11,
    marginBottom: 4,
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBrandText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00A884',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
});

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(t);
  }, []);
  if (showSplash) return <Splash onPressSkip={() => setShowSplash(false)} />;
  return <LoginScreen />;
}