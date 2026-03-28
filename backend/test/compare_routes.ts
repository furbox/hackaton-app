/**
 * Compare how getSession behaves for different routes
 */

import { handleCategoriesRoute } from '../routes/api/categories.js';
import { handleShortRoute } from '../routes/api/short.js';
import { getDatabase } from '../db/connection.js';

const db = getDatabase();

async function compareGetSessionBehavior() {
  console.log('=== Comparing getSession Behavior Across Routes ===\n');

  // Get a valid session
  const dbSession = db.prepare('SELECT * FROM sessions WHERE is_active = 1 LIMIT 1').get() as any;
  if (!dbSession) {
    console.log('❌ No sessions found');
    return;
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(dbSession.user_id) as any;

  console.log('✅ Test User:', user.username, '(ID:', user.id + ')');
  console.log('   Session Token:', dbSession.token_jti.substring(0, 8) + '...');

  // Test 1: Categories route (authenticated endpoint)
  console.log('\n📝 Test 1: GET /api/categories (authenticated)');
  const catRequest = new Request('http://localhost:3000/api/categories', {
    method: 'GET',
    headers: new Headers({
      'cookie': `urlft_session=${dbSession.token_jti}`,
    }),
  });

  const catResponse = await handleCategoriesRoute(catRequest, '/api/categories');
  console.log('   Response Status:', catResponse?.status);
  if (catResponse?.status === 401) {
    console.log('   ❌ Unauthorized - getSession returned null');
  } else if (catResponse?.status === 200) {
    console.log('   ✅ Authorized - getSession worked!');
  }

  // Test 2: Short link route
  console.log('\n📝 Test 2: GET /api/s/test (short link)');

  // Create a test link
  const testUrl = `https://example.com/test-${Date.now()}`;
  const insertResult = db.prepare(
    'INSERT INTO links (user_id, url, title, short_code, is_public) VALUES (?, ?, ?, ?, ?)'
  ).run(user.id, testUrl, 'Test', `test_${Date.now()}`, true);

  const linkId = insertResult.lastInsertRowid as number;
  const link = db.prepare('SELECT short_code FROM links WHERE id = ?').get(linkId) as any;

  const shortRequest = new Request(`http://localhost:3000/api/s/${link.short_code}`, {
    method: 'GET',
    headers: new Headers({
      'cookie': `urlft_session=${dbSession.token_jti}`,
    }),
  });

  const shortResponse = await handleShortRoute(shortRequest, `/api/s/${link.short_code}`);
  console.log('   Response Status:', shortResponse?.status);

  // Check if user_id was captured
  const view = db.prepare('SELECT user_id FROM link_views WHERE link_id = ? ORDER BY id DESC LIMIT 1').get(linkId) as any;
  console.log('   link_views.user_id:', view?.user_id === null ? 'NULL ❌' : `${view?.user_id} ✅`);

  // Cleanup
  db.prepare('DELETE FROM links WHERE id = ?').run(linkId);
  db.prepare('DELETE FROM link_views WHERE link_id = ?').run(linkId);

  console.log('\n=== RESULTS ===');
  console.log('If both routes return 401:');
  console.log('  → Better Auth getSession is broken globally (unlikely)');
  console.log('If categories works but shortlink doesn\'t:');
  console.log('  → There\'s a specific issue with the shortlink flow');
  console.log('\nActual behavior will tell us if the cookie forwarding fix is sufficient.');
}

compareGetSessionBehavior().catch(console.error);
