const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const targetToReplace = `    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {`;

const replacement = `    const isVip = localStorage.getItem('isVipMember') === 'true';
    const vipId = localStorage.getItem('vip_membership_id');

    if (isVip && vipId) {
      setUser(prev => ({
        ...prev,
        id: vipId,
        name: 'VIP Member',
        email: \`\${vipId}@vip.user\`,
        emailVerified: true,
        tier: UserTier.PRO
      }));
      setIsAuthLoading(false);
      // We don't subscribe to authStateChanged if VIP. 
      // But we need to return a dummy unsubscribe function
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {`;

code = code.replace(targetToReplace, replacement);
fs.writeFileSync('App.tsx', code);
console.log('Patched onAuthStateChanged in App.tsx');
