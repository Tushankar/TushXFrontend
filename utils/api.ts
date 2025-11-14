// For mobile development, use your computer's IP address instead of localhost
// Replace with your actual IP address (run `ipconfig` on Windows to find it)
const API_BASE_URL = 'http://192.168.0.150:8080/api'; // Your computer's IP address

export interface SignupData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface OTPData {
  email: string;
  otp: string;
}

export interface UpdateProfileData {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  pinned?: string[];
  archived?: string[];
  favourites?: string[];
  locked?: string[];
}

export interface AuthResponse {
  message: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    bio: string;
    isVerified: boolean;
    pinned: string[];
    archived: string[];
    favourites: string[];
    locked: string[];
  };
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // If body is FormData (for file uploads), do not set Content-Type so the
    // browser/React Native runtime can add the correct multipart boundary.
    const isFormData = options.body &&
      // In React Native, FormData is available globally
      (options.body instanceof FormData || (typeof (options.body as any).append === 'function' && !(options.body as string)));

    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Ensure our computed headers (including Content-Type when appropriate)
    // are applied last so they are not overwritten by options.headers.
    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      console.log('API Request:', { url, method: options.method || 'GET' });
      const response = await fetch(url, config);
      let data;

      try {
        data = await response.json();
      } catch (parseError) {
        // If response is not JSON, create a generic error message
        data = { message: `HTTP ${response.status}: ${response.statusText}` };
      }

      console.log('API Response:', { status: response.status, data });

      if (!response.ok) {
        const errorMessage = data.message || data.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('API Error Response:', errorMessage);
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      // Re-throw with more specific error message
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Network request failed');
    }
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyOTP(data: OTPData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProfile(token: string): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async get(endpoint: string, token?: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });
  }

  async put(endpoint: string, data: any, token?: string): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  }

  async updateProfile(token: string, data: UpdateProfileData): Promise<ProfileResponse> {
    return this.request<ProfileResponse>('/auth/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  }

  // Upload avatar file as multipart/form-data. Expects `fileUri` to be a local
  // file URI (expo FileSystem documentDirectory). Returns object with avatarUrl and user info.
  async uploadAvatar(token: string, fileUri: string): Promise<any> {
    const form = new FormData();
    const fileName = fileUri.split('/').pop() || `avatar_${Date.now()}.jpg`;
    // assume jpeg; if you need to detect mime type, add a helper
    form.append('avatar', {
      uri: fileUri,
      name: fileName,
      type: 'image/jpeg',
    } as any);

    return this.request<any>('/auth/avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: form,
    });
  }

  async favouriteMessage(token: string, messageId: string): Promise<any> {
    return this.request<any>(`/auth/messages/${messageId}/favourite`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async unfavouriteMessage(token: string, messageId: string): Promise<any> {
    return this.request<any>(`/auth/messages/${messageId}/unfavourite`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async getFavouriteMessages(token: string): Promise<any> {
    return this.request<any>('/auth/messages/favourites', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  async getChatStats(token: string, userId: string): Promise<any> {
    return this.request<any>(`/auth/chat-stats/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  }
}

export const apiService = new ApiService();