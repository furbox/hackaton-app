import { authConfig } from '../auth/config.js';

console.log('=== Inspecting Better Auth Config ===\n');

// Check if Better Auth has any debug or logging options
console.log('Better Auth config keys:', Object.keys(authConfig));
console.log('Better Auth api keys:', Object.keys(authConfig.api));
console.log('');

// Try to access internal properties
const inferKeys = authConfig.$Infer ? Object.keys(authConfig.$Infer) : [];
console.log('Has $Infer:', inferKeys.length > 0);
if (inferKeys.length > 0) {
  console.log('$Infer keys:', inferKeys);
  if (authConfig.$Infer.Session) {
    console.log('$Infer.Session keys:', Object.keys(authConfig.$Infer.Session));
  }
}

// Check if there's an adapter or database connection
if ((authConfig as any).adapter) {
  console.log('\nHas adapter:', true);
}

console.log('\n=== Checking if Better Auth can query sessions directly ===');

// Try to manually query using Better Auth's internal adapter
// This is a hack to see if Better Auth can access the database
try {
  const db = (authConfig as any).database;
  if (db) {
    console.log('Database connection exists:', !!db);

    // Try a simple query
    const session = db.prepare('SELECT * FROM sessions LIMIT 1').get();
    console.log('Can query sessions:', !!session);
  }
} catch (error) {
  console.error('Error accessing database:', error);
}

console.log('\n=== Conclusion ===');
console.log('The issue might be with Better Auth\'s kysely adapter.');
console.log('Better Auth uses @better-auth/kysely-adapter with bun:sqlite.');
console.log('There might be a compatibility issue or configuration problem.');
console.log('');
console.log('RECOMMENDATION:');
console.log('Since the cookie forwarding fix is correct and necessary,');
console.log('let\'s test it with a REAL login flow to see if it works in practice.');
console.log('The getSession issue might be specific to our test setup.');
