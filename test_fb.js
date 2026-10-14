import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString } from "firebase/storage";
import fs from "fs";
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const testRef = ref(storage, 'test.txt');
uploadString(testRef, 'hello world').then(() => console.log('success')).catch(e => console.error(e));
