// Google Search Console & SEO optimization for Cloudflare Worker
// Uses service account for API access

const SEARCH_CONSOLE_API = 'https://www.googleapis.com/webmasters/v3';
const INDEXING_API = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

let cachedAccessToken = null;
let tokenExpiry = 0;

async function getAccessToken(serviceAccount) {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiry) {
    return cachedAccessToken;
  }

  const { client_email, private_key } = serviceAccount;
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const nowSec = Math.floor(now / 1000);
  const claim = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedClaim = btoa(JSON.stringify(claim)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signingInput = `${encodedHeader}.${encodedClaim}`;

  const keyData = atob(private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\n/g, ''));
  const keyArray = new Uint8Array(keyData.length);
  for (let i = 0; i < keyData.length; i++) {
    keyArray[i] = keyData.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyArray.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 300) * 1000;
  return cachedAccessToken;
}

async function submitUrlForIndexing(serviceAccount, url) {
  const token = await getAccessToken(serviceAccount);
  
  const res = await fetch(INDEXING_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      type: 'URL_UPDATED',
    }),
  });

  return res.ok;
}

async function getSitemapUrls(baseUrl) {
  const urls = [
    `${baseUrl}/`,
    `${baseUrl}/marketplace`,
    `${baseUrl}/enroll`,
    `${baseUrl}/login`,
    `${baseUrl}/help`,
    `${baseUrl}/about`,
    `${baseUrl}/contact`,
    `${baseUrl}/privacy-policy`,
  ];

  // Add composition URLs from D1
  // This would need DB access from the caller

  return urls;
}

function generateSitemap(baseUrl, urls) {
  const urlEntries = urls.map(url => `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url === baseUrl ? '1.0' : '0.8'}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

function generateRobotsTxt(baseUrl) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: ${baseUrl}/sitemap.xml`;
}

export { submitUrlForIndexing, getSitemapUrls, generateSitemap, generateRobotsTxt, getAccessToken };
