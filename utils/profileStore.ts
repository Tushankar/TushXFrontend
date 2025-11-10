// Simple in-memory profile store with subscribe support
let currentProfile: any = null;
const listeners = new Set<(profile: any) => void>();

export function setProfileLocal(profile: any) {
  currentProfile = profile;
  for (const l of Array.from(listeners)) {
    try {
      l(currentProfile);
    } catch (err) {
      console.error('profileStore listener error', err);
    }
  }
}

export function getProfileLocal() {
  return currentProfile;
}

export function subscribeProfile(cb: (profile: any) => void) {
  listeners.add(cb);
  // Immediately call with current value
  try {
    cb(currentProfile);
  } catch (err) {
    console.error('profileStore subscribe initial callback error', err);
  }
  return () => { listeners.delete(cb); };
}
