// Connexion Google native pour l'APK Android (Credential Manager + Authorization API).
import { Capacitor } from '@capacitor/core';
import firebaseConfig from '../firebase-applet-config.json';

let initialized = false;

export const isAndroidApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

async function getPlugin() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!initialized) {
    await SocialLogin.initialize({
      google: { webClientId: firebaseConfig.oAuthClientId, mode: 'online' },
    });
    initialized = true;
  }
  return SocialLogin;
}

export async function nativeGoogleSignIn(scopes: string[], selectAccount = false): Promise<{ idToken: string; accessToken: string | null }> {
  const SocialLogin = await getPlugin();
  if (selectAccount) {
    try { await SocialLogin.logout({ provider: 'google' }); } catch { /* ignore */ }
  }
  const res = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile', ...scopes], forceRefreshToken: true },
  });
  const r = res.result as { idToken?: string | null; accessToken?: { token?: string } | null };
  if (!r?.idToken) throw new Error('Jeton Google manquant');
  return { idToken: r.idToken, accessToken: r.accessToken?.token ?? null };
}

export async function nativeGoogleSignOut(): Promise<void> {
  try {
    const SocialLogin = await getPlugin();
    await SocialLogin.logout({ provider: 'google' });
  } catch { /* ignore */ }
}
