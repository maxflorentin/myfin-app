import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

// Firebase config is public by design — security rules protect data
const firebaseConfig = {
  apiKey: 'AIzaSyAz80Cfgpniicf95p7BA-390pI1vXAUYOQ',
  authDomain: 'misgastos-rm.firebaseapp.com',
  projectId: 'misgastos-rm',
  storageBucket: 'misgastos-rm.firebasestorage.app',
  messagingSenderId: '349858888683',
  appId: '1:349858888683:web:7274fcffe12153243a37ae',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
export const googleProvider = new GoogleAuthProvider();
