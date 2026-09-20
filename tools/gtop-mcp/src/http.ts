import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createMcpServer } from './index.js';
import { createHttpApp } from './http-app.js';
import { FirestoreAuthStore } from './auth-store.js';
import { GtopOAuthProvider } from './oauth.js';

const configured = process.env['GTOP_MCP_PUBLIC_URL'];
if (!configured) throw new Error('GTOP_MCP_PUBLIC_URL is required');
const parsed = new URL(configured);
if (parsed.protocol !== 'https:' || parsed.origin !== configured) throw new Error('GTOP_MCP_PUBLIC_URL must be a canonical HTTPS origin');
const db = getFirestore();
const auth = getAuth();
const allowedEmails = new Set((process.env['GTOP_MCP_ADMIN_EMAILS'] || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean));
if (!allowedEmails.size) throw new Error('GTOP_MCP_ADMIN_EMAILS must explicitly identify authorized administrators');
const checkAdmin = async (uid: string, authenticatedAt: number) => {
  const [user, profile] = await Promise.all([auth.getUser(uid), db.doc(`users/${uid}`).get()]);
  if (!user.email || !allowedEmails.has(user.email.toLowerCase()) || user.disabled || profile.get('role') !== 'admin' || Date.parse(user.tokensValidAfterTime || '1970-01-01T00:00:00Z') / 1000 > authenticatedAt) {
    throw new Error('Active administrator access required');
  }
};
const origins = (process.env['GTOP_MCP_REDIRECT_ORIGINS'] || 'https://chatgpt.com,https://chat.openai.com').split(',');
const provider = new GtopOAuthProvider(new FirestoreAuthStore(db), configured, checkAdmin, origins);
const app = createHttpApp({
  provider, createServer:createMcpServer,
  verifyIdentity:async token => {
    const decoded = await auth.verifyIdToken(token,true);
    if (!decoded.email_verified || !decoded.email) throw new Error('Verified email required');
    return {uid:decoded.uid,email:decoded.email,authenticatedAt:decoded.auth_time};
  },
  firebaseConfig:{
    apiKey:'AIzaSyATxEIUYY7rPgJriy_0q7yjfcP-QyBMZkM',
    authDomain:'gtop-app.firebaseapp.com',projectId:'gtop-app',appId:'1:78765581239:web:25b3433cd1192a50673e32',
  },
});
const listener=app.listen(Number(process.env['PORT'] || 8080), '0.0.0.0', ()=>console.log('GTOP MCP HTTP server ready'));
process.on('SIGTERM',()=>listener.close(()=>process.exit(0)));
