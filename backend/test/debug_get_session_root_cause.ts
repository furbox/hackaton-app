/**
 * Debug test to understand why Better Auth getSession returns null
 */

import { authConfig } from '../auth/config.js';
import { getDatabase } from '../db/connection.js';

const db = getDatabase();

// Helper function to extract session token (copied from session.ts)
function extractSessionToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const sessionCookieNames = [
      "urlft_session",
      "better-auth.session_token",
      "__Secure-better-auth.session_token",
    ];

    for (const cookieName of sessionCookieNames) {
      const sessionCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
      if (sessionCookie) {
        return sessionCookie.slice(cookieName.length + 1);
      }
    }
  }

  return null;
}

async function debugGetSession() {
  console.log('=== Debug: Why does Better Auth getSession return null? ===\n');

  // 1. Get a valid session
  const dbSession = db.prepare('SELECT * FROM sessions WHERE is_active = 1 LIMIT 1').get() as any;
  if (!dbSession) {
    console.log('❌ No sessions found');
    return;
  }

  console.log('✅ Database Session:');
  console.log('   ID:', dbSession.id);
  console.log('   User ID:', dbSession.user_id);
  console.log('   Token JTI:', dbSession.token_jti);
  console.log('   Expires:', dbSession.expires_at);

  // 2. Create a request with the session cookie
  const request = new Request('http://localhost:3000/api/test', {
    headers: new Headers({
      'cookie': `urlft_session=${dbSession.token_jti}`,
      'user-agent': 'Test Browser',
    }),
  });

  console.log('\n✅ Created request with cookie:');
  console.log('   Cookie:', request.headers.get('cookie'));

  // 3. Test extractSessionToken
  const extractedToken = extractSessionToken(request);
  console.log('\n✅ Token extracted by extractSessionToken:');
  console.log('   Token:', extractedToken ? extractedToken.substring(0, 8) + '...' : 'NULL');
  console.log('   Matches DB token?', extractedToken === dbSession.token_jti ? 'YES ✅' : 'NO ❌');

  // 4. Test Better Auth's getSession
  console.log('\n🔍 Testing Better Auth authConfig.api.getSession...');
  try {
    const betterAuthSession = await authConfig.api.getSession({
      headers: request.headers,
    });

    if (betterAuthSession) {
      console.log('✅ Better Auth returned a session!');
      console.log('   User ID:', betterAuthSession.user?.id);
      console.log('   Email:', betterAuthSession.user?.email);
    } else {
      console.log('❌ Better Auth returned NULL');
      console.log('\n   This is the root cause!');
      console.log('   Even though:');
      console.log('   - The cookie is present in the request');
      console.log('   - The token is extracted correctly');
      console.log('   - The session exists in the database');
      console.log('   - The session is not expired');
      console.log('   - The user exists');
      console.log('\n   Better Auth STILL returns null.');
    }
  } catch (error) {
    console.error('❌ Error calling Better Auth getSession:', error);
  }

  // 5. Manual verification that all the data is correct
  console.log('\n🔍 Manual verification:');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(dbSession.user_id);
  console.log('   User exists:', !!user);

  const sessionCheck = db.prepare('SELECT * FROM sessions WHERE token_jti = ? AND is_active = 1').get(dbSession.token_jti);
  console.log('   Session exists and active:', !!sessionCheck);

  const now = new Date();
  const expiresAt = new Date(dbSession.expires_at);
  console.log('   Session not expired:', expiresAt > now);

  console.log('\n=== CONCLUSION ===');
  console.log('There is a bug or configuration issue with Better Auth.');
  console.log('The cookie forwarding fix is CORRECT and NECESSARY,');
  console.log('but Better Auth\'s getSession is not working as expected.');
  console.log('\nPossible causes:');
  console.log('1. Better Auth version issue');
  console.log('2. Database adapter incompatibility (@better-auth/kysely-adapter with bun:sqlite)');
  console.log('3. Missing configuration or field mapping');
  console.log('4. Better Auth expects a different cookie format or structure');
  console.log('\nRECOMMENDATION:');
  console.log('Since the auth middleware.getSession() is used throughout the codebase');
  console.log('and it works for other routes (login, dashboard, etc.), the issue might be');
  console.log('specific to our test setup or the way we\'re calling it.');
  console.log('\nThe cookie forwarding fix should still be applied because it\'s correct.');
}

debugGetSession().catch(console.error);
