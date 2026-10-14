import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp({
  storageBucket: firebaseConfig.storageBucket
});
const bucket = getStorage(app).bucket();
bucket.file('test-admin.txt').save('hello from admin').then(() => console.log('success')).catch(e => console.error(e));
