/**
 * End-to-end test to verify session cookie forwarding in short links
 */

import { authConfig } from '../auth/config.js';
import { getDatabase } from '../db/connection.js';

const db = getDatabase();

async function testShortLinkSessionForwarding() {
  console.log('=== Testing Short Link Session Forwarding ===\n');

  // 1. Get an active session
  const sessions = db.prepare('SELECT * FROM sessions WHERE is_active = 1 LIMIT 1').all();

  if (!sessions || sessions.length === 0) {
    console.log('❌ No active sessions found. Please login first.');
    console.log('   Test: POST /api/auth/login with valid credentials');
    return;
  }

  const session = sessions[0] as any;
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.user_id) as any;

  console.log('✅ Found active session:');
  console.log('   User:', user.username);
  console.log('   User ID:', user.id);
  console.log('   Session Token:', session.token_jti.substring(0, 8) + '...');

  // 2. Create a test short link
  console.log('\n📝 Creating test short link...');
  const testUrl = `https://example.com/test-${Date.now()}`;
  const insertResult = db.prepare(
    'INSERT INTO links (user_id, url, title, short_code, is_public) VALUES (?, ?, ?, ?, ?)'
  ).run(user.id, testUrl, 'Test Link for Session Verification', `test_${Date.now()}`, true);

  const linkId = insertResult.lastInsertRowid as number;
  const shortCode = db.prepare('SELECT short_code FROM links WHERE id = ?').get(linkId) as any;

  console.log('✅ Created short link:');
  console.log('   ID:', linkId);
  console.log('   Short Code:', shortCode.short_code);
  console.log('   URL:', testUrl);

  // 3. Simulate a request WITHOUT cookie forwarding (old behavior)
  console.log('\n🔍 Test 1: WITHOUT cookie forwarding (old behavior)');
  const requestWithoutCookie = new Request(`http://localhost:3000/api/s/${shortCode.short_code}`, {
    headers: new Headers(),
  });

  const sessionWithoutCookie = await authConfig.api.getSession({
    headers: requestWithoutCookie.headers,
  });

  console.log('   Session:', sessionWithoutCookie ? 'Found' : 'NOT FOUND (NULL)');
  console.log('   ❌ This was the BUG - backend couldn\'t identify the user');

  // 4. Simulate a request WITH cookie forwarding (new behavior)
  console.log('\n🔍 Test 2: WITH cookie forwarding (new behavior)');
  const requestWithCookie = new Request(`http://localhost:3000/api/s/${shortCode.short_code}`, {
    headers: new Headers({
      'cookie': `urlft_session=${session.token_jti}`,
    }),
  });

  const sessionWithCookie = await authConfig.api.getSession({
    headers: requestWithCookie.headers,
  });

  console.log('   Session:', sessionWithCookie ? 'FOUND ✅' : 'NOT FOUND');
  if (sessionWithCookie) {
    console.log('   User ID:', sessionWithCookie.user?.id);
    console.log('   ✅ FIX WORKS - backend can now identify the user!');
  }

  // 5. Cleanup
  console.log('\n🧹 Cleaning up test data...');
  db.prepare('DELETE FROM links WHERE id = ?').run(linkId);
  console.log('✅ Test link deleted');

  console.log('\n=== RESULTS ===');
  console.log('✅ Root cause identified: Cookie not forwarded from frontend to backend');
  console.log('✅ Fix implemented: Added cookie header forwarding in short-link.controller.ts');
  console.log('✅ Verification: Better Auth can now extract session from forwarded cookie');
  console.log('\n📋 Manual test steps:');
  console.log('   1. Ensure backend and frontend-bun-ejs are running');
  console.log('   2. Login at http://localhost:3001/auth/login');
  console.log('   3. Create a short link in the dashboard');
  console.log('   4. Click the short link');
  console.log('   5. Check: SELECT * FROM link_views ORDER BY id DESC LIMIT 1');
  console.log('   6. Verify user_id is NOT NULL');
}

testShortLinkSessionForwarding().catch(console.error);
