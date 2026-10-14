import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  signOut,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
}

export class AuthService {
  private isInitialized: boolean = false;
  private STORAGE_KEY = 'linguaflow_session_v1';
  private user: AuthUser | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    console.log("Firebase Identity Core: Initializing...");
    
    // We can set up an observer on the Auth object
    return new Promise((resolve) => {
      this.unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          this.user = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || undefined,
            emailVerified: firebaseUser.emailVerified
          };
          
          try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, {
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                createdAt: serverTimestamp(),
                uploadedFilesCount: 0
              });
            } else {
              await setDoc(userRef, {
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                lastLoginAt: serverTimestamp()
              }, { merge: true });
            }
          } catch (err) {
            console.error("Failed to sync user to Firestore", err);
          }
          // Sync with local storage for immediate synchronous access if needed
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.user));
        } else {
          this.user = null;
          localStorage.removeItem(this.STORAGE_KEY);
        }
        
        if (!this.isInitialized) {
          this.isInitialized = true;
          console.log("Firebase Identity Core: Ready.");
          resolve();
        }
      });
    });
  }

  getPersistedUser(): AuthUser | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as AuthUser;
      }
    } catch (e) {
      console.error("Failed to restore session", e);
    }
    return null;
  }

  async signInWithGoogle(selectedAccount?: { email: string; name: string; photoURL: string }): Promise<AuthUser> {
    const provider = new GoogleAuthProvider();
    // Custom parameters can be added to the provider if needed
    // provider.setCustomParameters({ login_hint: selectedAccount?.email });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const authUser: AuthUser = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || undefined,
        emailVerified: user.emailVerified
      };
      return authUser;
    } catch (error: any) {
      console.error("Google sign in failed:", error);
      throw error;
    }
  }

  /**
   * Registers a new user.
   */
  async signUpWithEmail(email: string, pass: string, name: string, photoURL?: string): Promise<AuthUser> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      await updateProfile(user, {
        displayName: name,
        photoURL: photoURL
      });
      
      return {
        uid: user.uid,
        email: user.email || email,
        displayName: name,
        photoURL: photoURL,
        emailVerified: user.emailVerified
      };
    } catch (error: any) {
      console.error("Registration failed:", error);
      throw error;
    }
  }

  /**
   * Signs in a user.
   */
  async signInWithEmail(email: string, pass: string): Promise<AuthUser> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      return {
        uid: user.uid,
        email: user.email || email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || undefined,
        emailVerified: user.emailVerified
      };
    } catch (error: any) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  async sendEmailVerification(email: string): Promise<void> {
    if (auth.currentUser && auth.currentUser.email === email) {
      await sendEmailVerification(auth.currentUser);
    } else {
      console.warn("No current user matches the email for verification.");
    }
  }

  /**
   * Simulates clicking the link in the email. Not really used in real Firebase,
   * user would click link in email and it updates on the backend.
   */
  async simulateVerifyUser(email: string): Promise<AuthUser | null> {
    console.warn("simulateVerifyUser is a mock method. Real Firebase requires the user to click the verification link.");
    return this.user;
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  }

  async signOut(): Promise<void> {
    await signOut(auth);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

export const authService = new AuthService();
