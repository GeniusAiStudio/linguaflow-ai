import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

// We need an ID token. Let's just write the script to show how we'd do it.
const uploadToFirebaseStorage = async (bucket, filePath, fileBuffer, idToken) => {
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(filePath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'video/mp4'
    },
    body: fileBuffer
  });
  const data = await res.json();
  console.log(data);
};
