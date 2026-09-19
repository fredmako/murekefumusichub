// Auth module for Cloudflare Worker
// PBKDF2 password hashing + HS256 JWT

const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_LENGTH * 8
  );
  const combined = new Uint8Array([...salt, ...new Uint8Array(hash)]);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password, storedHash) {
  try {
    const combined = new Uint8Array(atob(storedHash).split('').map(c => c.charCodeAt(0)));
    const salt = combined.slice(0, SALT_LENGTH);
    const stored = combined.slice(SALT_LENGTH);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const hash = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      HASH_LENGTH * 8
    );
    const actual = new Uint8Array(hash);
    return stored.length === actual.length && stored.every((b, i) => b === actual[i]);
  } catch {
    return false;
  }
}

function base64url(input) {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return atob(input);
}

export async function createToken(payload, secret, expiresIn = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresIn };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(String.fromCharCode(...new Uint8Array(sig)))}`;
}

export async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sig = new Uint8Array(base64urlDecode(parts[2]).split('').map(c => c.charCodeAt(0)));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const body = JSON.parse(base64urlDecode(parts[1]));
    if (body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

export function generateId() {
  return crypto.randomUUID();
}
