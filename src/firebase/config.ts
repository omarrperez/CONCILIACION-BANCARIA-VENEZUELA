import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import appletConfig from './firebase-applet-config.json';

const projectId =
  import.meta.env.VITE_FIREBASE_PROJECT_ID ||
  appletConfig?.projectId ||
  'shaped-extension-qptg6';

const databaseId =
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  appletConfig?.firestoreDatabaseId ||
  'ai-studio-8e50d3b3-47bc-4226-b17c-67741752ed3c';

const activeConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    appletConfig?.apiKey ||
    'AIzaSyD_xiPV0GQEnSmHF3O1VSj0fyJ0JOhGjRU',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    appletConfig?.authDomain ||
    `${projectId}.firebaseapp.com`,
  projectId: projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    appletConfig?.storageBucket ||
    `${projectId}.firebasestorage.app`,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    appletConfig?.messagingSenderId ||
    '16349165750',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    appletConfig?.appId ||
    '1:16349165750:web:ae4040cf609541beeace17',
  firestoreDatabaseId: databaseId,
};

const app = initializeApp(activeConfig);

// CRITICAL: Must use firestoreDatabaseId
export const db = getFirestore(app, activeConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation connection test required by skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is currently offline or unreachable.');
    }
    return false;
  }
}

// Helper for Google Sign-in with popup (preferred by skill)
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout Error:', error);
    throw error;
  }
}
