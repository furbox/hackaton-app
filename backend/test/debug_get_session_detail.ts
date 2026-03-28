import { authConfig } from '../auth/config.js';
import { getDatabase } from '../db/connection.js';

const db = getDatabase();

console.log('=== Debugging Better Auth getSession ===\n');

// Get the most recent session
const session = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1').get() as any;

if (!session) {
  console.log('❌ No sessions found in database');
  process.exit(1);
}

console.log('Session from database:');
console.log('  ID:', session.id);
console.log('  User ID:', session.user_id);
console.log('  Token JTI:', session.token_jti);
console.log('  Created:', session.created_at);
console.log('  Expires:', session.expires_at);
console.log('  Is Active:', session.is_active);

const now = new Date();
const expiresAt = new Date(session.expires_at);
const isExpired = expiresAt < now;

console.log('\nSession validity:');
console.log('  Current time:', now.toISOString());
console.log('  Expires at:', expiresAt.toISOString());
console.log('  Is expired:', isExpired ? 'YES ❌' : 'NO ✅');

if (isExpired) {
  console.log('\n⚠️  Session is expired! Better Auth will reject it.');
  console.log('   This is why getSession returns null even with the cookie.');
  console.log('   Solution: Login again to get a fresh session.');
} else {
  console.log('\n✅ Session is valid. Testing getSession...');

  const testRequest = new Request('http://localhost:3000/api/test', {
    headers: new Headers({
      'cookie': `urlft_session=${session.token_jti}`,
    }),
  });

  const retrievedSession = await authConfig.api.getSession({
    headers: testRequest.headers,
  });

  console.log('getSession result:', retrievedSession ? 'FOUND ✅' : 'NULL ❌');

  if (retrievedSession) {
    console.log('Session details:', {
      userId: retrievedSession.user?.id,
      email: retrievedSession.user?.email,
      name: retrievedSession.user?.name,
    });
  } else {
    console.log('\n⚠️  Session is valid but getSession still returns null.');
    console.log('   Possible causes:');
    console.log('   1. Better Auth configuration mismatch');
    console.log('   2. Cookie name mismatch (check authConfig advanced.cookies.sessionToken.name)');
    console.log('   3. Database field mapping issue');
  }
}
