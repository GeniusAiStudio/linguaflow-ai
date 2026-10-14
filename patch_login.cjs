const fs = require('fs');

let code = fs.readFileSync('components/LoginView.tsx', 'utf8');

const targetToReplace = `import { doc, getDoc } from 'firebase/firestore';`;
const replacement = `import { doc, getDoc, setDoc } from 'firebase/firestore';`;

code = code.replace(targetToReplace, replacement);

const verifyLogic = `      if (membershipSnap.exists()) {
        const data = membershipSnap.data();
        if (data.isActive) {
          localStorage.setItem('isVipMember', 'true');
          sessionStorage.setItem('isGuestSession', 'false');
          
          if (onLoginSuccess) {
            onLoginSuccess({
              uid: membershipId.trim(),
              email: \`\${membershipId.trim()}@vip.user\`,
              name: 'VIP Member',
              emailVerified: true
            });
          }
        } else {
          setError('This Membership ID is inactive or expired.');
        }
      } else {`;

const newVerifyLogic = `      if (membershipSnap.exists()) {
        const data = membershipSnap.data();
        if (data.isActive) {
          // Device Binding Logic
          let localDeviceId = localStorage.getItem('genius_device_id');
          if (!localDeviceId) {
            localDeviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('genius_device_id', localDeviceId);
          }

          if (data.deviceId && data.deviceId !== localDeviceId) {
            setError('This Pass Key is already bound to another device.');
            setIsLoading(false);
            return;
          }

          if (!data.deviceId) {
            await setDoc(membershipRef, { deviceId: localDeviceId }, { merge: true });
          }

          localStorage.setItem('isVipMember', 'true');
          sessionStorage.setItem('isGuestSession', 'false');
          
          if (onLoginSuccess) {
            onLoginSuccess({
              uid: membershipId.trim(),
              email: \`\${membershipId.trim()}@vip.user\`,
              name: 'VIP Member',
              emailVerified: true
            });
          }
        } else {
          setError('This Membership ID is inactive or expired.');
        }
      } else {`;

code = code.replace(verifyLogic, newVerifyLogic);

fs.writeFileSync('components/LoginView.tsx', code);
console.log('Patched LoginView.tsx');
