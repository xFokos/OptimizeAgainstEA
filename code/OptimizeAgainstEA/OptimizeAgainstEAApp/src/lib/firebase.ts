import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey:            'AIzaSyAWpkMXd5sN_8OMBUyug3vrSo1aFWP7FAU',
    authDomain:        'optimizeagainstea.firebaseapp.com',
    projectId:         'optimizeagainstea',
    storageBucket:     'optimizeagainstea.firebasestorage.app',
    messagingSenderId: '451874482413',
    appId:             '1:451874482413:web:b8e726b9ab1ee020d804e4',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db          = getFirestore(firebaseApp);
