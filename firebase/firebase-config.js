const firebaseConfig = {
  apiKey: "AIzaSyA5m3ulc4EVlxaD-cBqFFUmzy5BFHEd9i0",
  authDomain: "toko-azizah.firebaseapp.com",
  projectId: "toko-azizah",
  storageBucket: "toko-azizah.firebasestorage.app",
  messagingSenderId: "485956704453",
  appId: "1:485956704453:web:96bf4f07103385bf50b8ac",
  measurementId: "G-LDY7BHEB1R"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Inisialisasi services
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Enable offline persistence
db.enablePersistence()
    .then(() => console.log('✅ Firebase persistence enabled'))
    .catch(err => console.warn('⚠️ Persistence error:', err));

// Export ke window untuk akses global
window.db = db;
window.auth = auth;
window.storage = storage;

console.log('🔥 Firebase initialized successfully!');