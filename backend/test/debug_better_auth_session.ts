import { authConfig } from '../auth/config.js';
import { getDatabase } from '../db/connection.js';

const db = getDatabase();

console.log('=== Checking Better Auth Session Field Mappings ===\n');

// Get a valid session from the database
const session = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1').get() as any;

if (!session) {
  console.log('❌ No sessions found');
  process.exit(1);
}

console.log('Database session fields:');
Object.entries(session).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n=== Better Auth Configuration ===');
console.log('Session model name:', 'sessions');
console.log('Session field mappings:');
console.log('  userId → user_id');
console.log('  token → token_jti');
console.log('  expiresAt → expires_at');
console.log('  ipAddress → ip_address');
console.log('  userAgent → user_agent');
console.log('  createdAt → created_at');
console.log('  updatedAt → created_at');

console.log('\nCookie name: urlft_session');
console.log('Cookie value from DB (token_jti):', session.token_jti);

// Now let's manually check what Better Auth is doing
console.log('\n=== Manual getSession Test ===');

const testRequest = new Request('http://localhost:3000/api/test', {
  headers: new Headers({
    'cookie': `urlft_session=${session.token_jti}`,
  }),
});

console.log('Request cookie:', testRequest.headers.get('cookie'));

// Try to call the Better Auth internal API
try {
  const result = await authConfig.api.getSession({
    headers: testRequest.headers,
  });

  console.log('getSession returned:', result);

  if (!result) {
    console.log('\n⚠️  getSession returned null. Checking database directly...');

    // Check if Better Auth can find the session by token
    const dbSession = db.prepare(
      'SELECT * FROM sessions WHERE token_jti = ? AND is_active = 1'
    ).get(session.token_jti);

    console.log('Database query result:', dbSession ? 'FOUND ✅' : 'NOT FOUND ❌');

    if (dbSession) {
      console.log('\n✅ Session exists in database');
      console.log('❌ But Better Auth cannot retrieve it');
      console.log('\nPossible issue: Better Auth is using a different query or field mapping');
    }
  }
} catch (error) {
  console.error('❌ Error calling getSession:', error);
}

// Let's also check if there's a user associated with this session
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
console.log('\n=== User Data ===');
if (user) {
  console.log('✅ User found:');
  console.log('  ID:', user.id);
  console.log('  Username:', user.username);
  console.log('  Email:', user.email);
} else {
  console.log('❌ User NOT found for user_id:', session.user_id);
  console.log('   This would cause Better Auth to reject the session!');
}
