// Google OAuth for Cloudflare Worker
// Verifies Google ID token and issues our own JWT

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_JWKS_CACHE_KEY = 'google_jwks_cache';
const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

let cachedJWKS = null;
let cachedJWKSExpiry = 0;

async function getGooglePublicKeys() {
  const now = Date.now();
  if (cachedJWKS && now < cachedJWKSExpiry) {
    return cachedJWKS;
  }

  try {
    const res = await fetch(GOOGLE_CERTS_URL);
    const jwks = await res.json();
    cachedJWKS = jwks;
    cachedJWKSExpiry = now + JWKS_CACHE_TTL;
    return jwks;
  } catch {
    return null;
  }
}

async function verifyGoogleToken(idToken, clientId) {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Verify issuer
    if (!GOOGLE_ISSUERS.includes(payload.iss)) return null;

    // Verify audience matches our client ID
    if (payload.aud !== clientId) return null;

    // Check token hasn't expired
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verify signature using Google's public keys
    const jwks = await getGooglePublicKeys();
    if (!jwks || !jwks.keys) return null;

    const key = jwks.keys.find(k => k.kid === header.kid);
    if (!key) return null;

    // Import the public key and verify signature
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sig = new Uint8Array(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0)));
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      sig,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );

    if (!valid) return null;

    return {
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
    };
  } catch {
    return null;
  }
}

export { verifyGoogleToken };
