const SUPABASE_URL = 'https://unytaslvyaytlqdmwavm.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZmtqY29zamllbWtlbGxrZG1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDczMzA0NSwiZXhwIjoyMTAwMzA5MDQ1fQ.ScgTwXFLKNYrkGMY_C2yilCvEOKnqAIS8fXlWY3EkrI';
const ADMIN_TOKEN='a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZmtqY29yamllbWtlbGxrZG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MzMwNDUsImV4cCI6MjEwMDMwOTA0NX0.Abc123XYZ';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    };
    
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    
    const adminToken = request.headers.get('X-Admin-Token');
    const needsAuth = url.pathname.includes('settings') || 
                      url.pathname.includes('admins') ||
                      url.pathname.includes('orders') && adminToken;
    
    if (needsAuth && (!adminToken || adminToken !== ADMIN_TOKEN)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname.startsWith('/storage/)) {
      const path = request.url.replace(/.*workers\.dev/, '').split('?')[0];
      const response = await fetch(`${SUPABASE_URL}${path}`, {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
          ...Object.fromEntries(request.headers),
        },
        body: request.method !== 'GET' ? request.body : null,
      });
      return new Response(response.body, {
        status: response.status,
        headers: { ...headers, 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' }
      });
    }
    
    const apiKey = needsAuth ? SUPABASE_SERVICE_KEY : ANON_KEY;
    const response = await fetch(`${SUPABASE_URL}/rest/v1${url.pathname}${url.search}`, {
      method: request.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'apikey': apiKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...Object.fromEntries(request.headers),
      },
      body: request.method !== 'GET' ? request.body : null,
    });
    
    return new Response(response.body, {
      status: response.status,
      headers: { ...headers, 'Content-Type': response.headers.get('Content-Type') || 'application/json' }
    });
  }
};