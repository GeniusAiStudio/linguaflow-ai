import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../services/firebase';
import { collection, query, orderBy, getDocs, where, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Shield, FileVideo, Clock, User as UserIcon, ArrowLeft, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface FirestoreUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: any;
  lastLoginAt: any;
  uploadedFilesCount: number;
}

interface UploadedFile {
  id: string;
  fileName: string;
  type: string;
  timestamp: any;
  storagePath?: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [userFiles, setUserFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreUser));
      setUsers(userList);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: FirestoreUser) => {
    setSelectedUser(user);
    try {
      const q = query(
        collection(db, 'uploaded_files'),
        where('userId', '==', user.id),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const filesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UploadedFile));
      setUserFiles(filesList);
    } catch (error) {
      console.error("Failed to fetch user files", error);
    }
  };

  const handleDeleteFile = async (file: UploadedFile) => {
    setDeleteError(null);
    setIsDeleting(file.id);
    
    try {
      if (file.storagePath) {
        try {
          const fileRef = ref(storage, file.storagePath);
          await deleteObject(fileRef);
        } catch (e: any) {
          if (e.code !== 'storage/object-not-found') {
            throw new Error(`Storage deletion failed: ${e.message}`);
          } else {
            console.warn("File not found in storage, proceeding to delete database record.");
          }
        }
      }
      
      await deleteDoc(doc(db, 'uploaded_files', file.id));
      setUserFiles(prev => prev.filter(f => f.id !== file.id));
      
      if (selectedUser) {
        const userRef = doc(db, 'users', selectedUser.id);
        await updateDoc(userRef, {
          uploadedFilesCount: increment(-1)
        });
        const updatedCount = Math.max(0, (selectedUser.uploadedFilesCount || 0) - 1);
        setSelectedUser({
          ...selectedUser,
          uploadedFilesCount: updatedCount
        });
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, uploadedFilesCount: updatedCount } : u));
      }
    } catch (error: any) {
      console.error("Failed to delete file", error);
      setDeleteError(error.message || "Failed to delete file. Check console for details.");
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a]">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Loading administrative databanks...</p>
      </div>
    );
  }

  if (selectedUser) {
    return (
      <div className="w-full h-full bg-[#0a0a0a] text-slate-200 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Back to User Roster
          </button>
          
          <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{selectedUser.displayName || selectedUser.email}</h2>
              <p className="text-slate-400">{selectedUser.id}</p>
            </div>
          </div>

          <h3 className="text-xl font-medium text-white mb-6">Uploaded Files ({userFiles.length})</h3>
          
          {deleteError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {deleteError}
            </div>
          )}

          <div className="grid gap-4">
            {userFiles.length === 0 ? (
              <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5">
                <p className="text-slate-500">No files uploaded by this user.</p>
              </div>
            ) : (
              userFiles.map(file => (
                <div key={file.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <FileVideo className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{file.fileName}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{file.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-sm text-slate-400">
                      {file.timestamp ? new Date(file.timestamp.toDate()).toLocaleString() : 'Just now'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file);
                      }}
                      disabled={isDeleting === file.id}
                      className={`p-2 rounded-lg transition-colors ${
                        isDeleting === file.id 
                          ? 'text-slate-500 cursor-not-allowed' 
                          : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                      }`}
                      title="Delete file"
                    >
                      {isDeleting === file.id ? (
                        <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0a0a0a] text-slate-200 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Admin Operations</h1>
            <p className="text-slate-400 text-sm">System oversight and user management databanks.</p>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" /> Admin View
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-white/[0.02] border-b border-white/5 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <tr>
                <th className="p-6">User Identity</th>
                <th className="p-6">Creation Date</th>
                <th className="p-6">Last Login</th>
                <th className="p-6 text-right">Uploads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(user => (
                <tr 
                  key={user.id} 
                  onClick={() => handleSelectUser(user)}
                  className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  <td className="p-6">
                    <div className="font-medium text-white mb-1">{user.email}</div>
                    <div className="text-xs text-slate-500">{user.id}</div>
                  </td>
                  <td className="p-6 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {user.createdAt ? new Date(user.createdAt.toDate()).toLocaleDateString() : 'Unknown'}
                    </div>
                  </td>
                  <td className="p-6 text-sm text-slate-400">
                    {user.lastLoginAt ? new Date(user.lastLoginAt.toDate()).toLocaleDateString() : 'Unknown'}
                  </td>
                  <td className="p-6 text-right">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium text-sm group-hover:bg-blue-500/20 transition-colors">
                      {user.uploadedFilesCount || 0}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500">
                    No users found in databank.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
