const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

const targetToReplace = `  useEffect(() => {
    if (!isAuthLoading) {`;

const replacement = `  useEffect(() => {
    if (localStorage.getItem('isVipMember') === 'true' && user.id && user.id !== 'usr_guest') {
      const unsub = onSnapshot(doc(db, 'memberships', user.id), (docSnap) => {
        if (docSnap.exists()) {
           const data = docSnap.data();
           setUser(prev => ({ ...prev, credits: data.credits || 0 }));
        }
      });
      return () => unsub();
    }
  }, [user.id]);

  useEffect(() => {
    if (!isAuthLoading) {`;

code = code.replace(targetToReplace, replacement);
fs.writeFileSync('App.tsx', code);
console.log('Patched snapshot listener in App.tsx');
