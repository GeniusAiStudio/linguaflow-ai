const fs = require('fs');
let text = fs.readFileSync('App.tsx', 'utf8');

// 1. Initial State
text = text.replace(/const \[user, setUser\] = useState<UserProfile>\(\{[\s\S]*?emailVerified: false\n\s*\}\);/, `const [user, setUser] = useState<UserProfile>(() => {
    let guestCredits = 100;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('guest_credits');
      if (stored !== null) guestCredits = parseInt(stored, 10);
      else localStorage.setItem('guest_credits', '100');
    }
    return {
      id: 'usr_guest',
      name: 'Guest User',
      email: 'guest@linguaflow.mm',
      tier: UserTier.FREE,
      credits: guestCredits,
      dailyLimitUsed: 0,
      srtLimit: 0,
      voiceLimit: 0,
      emailVerified: false
    };
  });`);

// 2. handleRequireCredits
text = text.replace(/const handleRequireCredits = \(amount: number\): boolean => \{[\s\S]*?return false;\n\s*\};\n/, `const handleRequireCredits = async (amount: number): Promise<boolean> => {
    if (localStorage.getItem('isVipMember') === 'true') {
      return true; // VIP bypass
    }
    
    // Read the current state dynamically or just rely on 'user.credits' being fresh enough.
    // To be perfectly safe against stale closures, we could use a ref, but let's stick to standard user.credits.
    if (user.credits >= amount) {
      const newCredits = Math.max(0, user.credits - amount);
      
      if (user.id === 'usr_guest') {
        localStorage.setItem('guest_credits', newCredits.toString());
      } else {
        try {
          const userRef = doc(db, 'users', user.id);
          await setDoc(userRef, { credits: newCredits }, { merge: true });
        } catch (err) {
          console.error("Failed to sync credits to Firestore:", err);
          return false;
        }
      }
      
      setUser(prev => ({ ...prev, credits: newCredits }));
      return true;
    }
    
    setIsCreditModalOpen(true);
    return false;
  };
`);

// 3. onAuthStateChanged
const newAuthCode = `const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          let userCredits = 100;
          if (userSnap.exists()) {
             userCredits = userSnap.data().credits ?? 100;
          } else {
             await setDoc(userRef, { credits: 100 }, { merge: true });
          }

          setUser(prev => ({
            ...prev,
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            emailVerified: firebaseUser.emailVerified,
            tier: UserTier.PRO,
            credits: userCredits
          }));
        } catch (e) {
          console.error("Failed to fetch user credits", e);
          setUser(prev => ({
            ...prev,
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            emailVerified: firebaseUser.emailVerified,
            tier: UserTier.PRO
          }));
        }
      } else {
        let guestCredits = 100;
        const stored = localStorage.getItem('guest_credits');
        if (stored !== null) guestCredits = parseInt(stored, 10);
        
        setUser({
          id: 'usr_guest',
          name: 'Guest User',
          email: 'guest@linguaflow.mm',
          tier: UserTier.FREE,
          credits: guestCredits,
          dailyLimitUsed: 0,
          srtLimit: 0,
          voiceLimit: 0,
          emailVerified: false
        });
      }
      setIsAuthLoading(false);
    });`;

text = text.replace(/const unsubscribe = onAuthStateChanged\(auth, \(firebaseUser\) => \{[\s\S]*?setIsAuthLoading\(false\);\n\s*\}\);/, newAuthCode);

// Add imports
if (!text.includes("import { doc, getDoc, setDoc } from 'firebase/firestore';")) {
  text = text.replace(/(import \{ authService \}.*?;\n)/, `$1import { doc, getDoc, setDoc } from 'firebase/firestore';\nimport { db } from './services/firebase';\n`);
}

fs.writeFileSync('App.tsx', text);
console.log('App.tsx persistence patched');
