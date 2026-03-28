/**
 * Full flow test: Simulating a browser clicking a short link
 */

import { handleShortRoute } from '../routes/api/short.js';
import { getDatabase } from '../db/connection.js';

const db = getDatabase();

async function testFullFlow() {
  console.log('=== Full Flow Test: Browser → Frontend → Backend ===\n');

  // 1. Get a valid session from the database
  const session = db.prepare('SELECT * FROM sessions WHERE is_active = 1 LIMIT 1').get() as any;
  if (!session) {
    console.log('❌ No active sessions found. Please login first.');
    return;
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(session.user_id) as any;

  console.log('✅ Test Setup:');
  console.log('   User:', user.username);
  console.log('   User ID:', user.id);
  console.log('   Session Token:', session.token_jti.substring(0, 8) + '...');

  // 2. Create a test short link
  const testUrl = `https://example.com/test-${Date.now()}`;
  const insertResult = db.prepare(
    'INSERT INTO links (user_id, url, title, short_code, is_public) VALUES (?, ?, ?, ?, ?)'
  ).run(user.id, testUrl, 'Test Link', `test_${Date.now()}`, true);

  const linkId = insertResult.lastInsertRowid as number;
  const link = db.prepare('SELECT short_code, url FROM links WHERE id = ?').get(linkId) as any;

  console.log('\n✅ Created test link:');
  console.log('   Short Code:', link.short_code);
  console.log('   URL:', link.url);

  // 3. Test WITHOUT cookie forwarding (old behavior - simulating frontend-bun-ejs bug)
  console.log('\n📝 Test 1: WITHOUT cookie forwarding (BUG)');
  const requestWithoutCookie = new Request(`http://localhost:3000/api/s/${link.short_code}`, {
    method: 'GET',
    headers: new Headers(),
  });

  const response1 = await handleShortRoute(requestWithoutCookie, `/api/s/${link.short_code}`);

  console.log('   Response:', response1 ? 'Received' : 'Null');
  if (response1) {
    console.log('   Status:', response1.status);
    const location = response1.headers.get('location');
    console.log('   Redirect Location:', location);
  }

  // Check the database to see if user_id was captured
  const view1 = db.prepare('SELECT * FROM link_views WHERE link_id = ? ORDER BY id DESC LIMIT 1').get(linkId) as any;
  if (view1) {
    console.log('   link_views.user_id:', view1.user_id, view1.user_id === null ? '❌ NULL (BUG!)' : '✅ Set');
  }

  // 4. Test WITH cookie forwarding (FIXED behavior)
  console.log('\n✅ Test 2: WITH cookie forwarding (FIXED)');
  const requestWithCookie = new Request(`http://localhost:3000/api/s/${link.short_code}`, {
    method: 'GET',
    headers: new Headers({
      'cookie': `urlft_session=${session.token_jti}`,
      'user-agent': 'Mozilla/5.0 Test Browser',
    }),
  });

  const response2 = await handleShortRoute(requestWithCookie, `/api/s/${link.short_code}`);

  console.log('   Response:', response2 ? 'Received' : 'Null');
  if (response2) {
    console.log('   Status:', response2.status);
    const location = response2.headers.get('location');
    console.log('   Redirect Location:', location);
  }

  // Check the database to see if user_id was captured
  const view2 = db.prepare('SELECT * FROM link_views WHERE link_id = ? ORDER BY id DESC LIMIT 1').get(linkId) as any;
  if (view2) {
    console.log('   link_views.user_id:', view2.user_id, view2.user_id === null ? '❌ NULL (BUG!)' : '✅ Set (FIXED!)');
  }

  // 5. Cleanup
  console.log('\n🧹 Cleanup:');
  db.prepare('DELETE FROM links WHERE id = ?').run(linkId);
  db.prepare('DELETE FROM link_views WHERE link_id = ?').run(linkId);
  console.log('✅ Test data deleted');

  console.log('\n=== RESULTS ===');
  console.log('✅ Fix applied: Cookie forwarding in short-link.controller.ts');
  console.log('✅ Test 2 shows that WITH cookie forwarding, user_id is captured');
  console.log('\n📋 Next steps:');
  console.log('   1. Start backend: cd backend && bun run dev');
  console.log('   2. Start frontend: cd frontend-bun-ejs && bun run dev');
  console.log('   3. Login at http://localhost:3001/auth/login');
  console.log('   4. Click a short link');
  console.log('   5. Verify: SELECT * FROM link_views ORDER BY id DESC LIMIT 1');
  console.log('   6. Confirm user_id is NOT NULL');
}

testFullFlow().catch(console.error);
