const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const targetToReplace = `  const handleRequireCredits = async (amount: number): Promise<boolean> => {
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
      }`;

const replacement = `  const handleRequireCredits = async (amount: number): Promise<boolean> => {
    // Read the current state dynamically or just rely on 'user.credits' being fresh enough.
    // To be perfectly safe against stale closures, we could use a ref, but let's stick to standard user.credits.
    if (user.credits >= amount) {
      const newCredits = Math.max(0, user.credits - amount);
      
      if (user.id === 'usr_guest') {
        localStorage.setItem('guest_credits', newCredits.toString());
      } else if (localStorage.getItem('isVipMember') === 'true') {
        try {
          const membershipRef = doc(db, 'memberships', user.id);
          await setDoc(membershipRef, { credits: newCredits }, { merge: true });
        } catch (err) {
          console.error("Failed to sync VIP credits to Firestore:", err);
          return false;
        }
      } else {
        try {
          const userRef = doc(db, 'users', user.id);
          await setDoc(userRef, { credits: newCredits }, { merge: true });
        } catch (err) {
          console.error("Failed to sync credits to Firestore:", err);
          return false;
        }
      }`;

code = code.replace(targetToReplace, replacement);
fs.writeFileSync('App.tsx', code);
console.log('Patched handleRequireCredits in App.tsx');
