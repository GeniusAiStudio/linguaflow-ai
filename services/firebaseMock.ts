export const collection = (...args: any[]) => ({});
export const addDoc = async (...args: any[]) => ({ id: 'mock-id' });
export const serverTimestamp = () => Date.now();
export const doc = (...args: any[]) => ({});
export const updateDoc = async (...args: any[]) => {};
export const increment = (n: number) => n;
export const query = (...args: any[]) => ({});
export const where = (...args: any[]) => ({});
export const orderBy = (...args: any[]) => ({});
export const onSnapshot = (q: any, callback: any) => {
  callback({ forEach: () => {} });
  return () => {};
};
export const deleteDoc = async (...args: any[]) => {};

export const ref = (...args: any[]) => ({});
export const uploadBytesResumable = (...args: any[]) => {
  return {
    on: (event: string, progress: any, error: any, complete: any) => {
      progress({ bytesTransferred: 100, totalBytes: 100 });
      complete();
    },
    snapshot: { ref: {} }
  };
};
export const getDownloadURL = async (...args: any[]) => "https://example.com/mock-url";
export const uploadString = async (...args: any[]) => {};
export const uploadBytes = async (...args: any[]) => {};

export const onAuthStateChanged = (auth: any, cb: any) => {
  cb({ uid: 'mock-uid', email: 'test@example.com', displayName: 'Mock User' });
  return () => {};
};
