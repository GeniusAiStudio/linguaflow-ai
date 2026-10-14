import React, { useState, useRef, useEffect } from "react";
import { UserProfile, ViewMode, UserTier } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Coins, LogOut, User, ChevronDown, Sparkles, Shield, Wallet } from "lucide-react";

interface UserProfileDropdownProps {
  user: UserProfile;
  onLogout: () => void;
  onNavigate: (mode: ViewMode) => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  user,
  onLogout,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click-Outside to Close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : "U";
  };

  const handleItemClick = (mode: ViewMode) => {
    onNavigate(mode);
    setIsOpen(false);
  };

  const isGuest = user.id === "usr_guest";

  return (
    <div className="relative" ref={dropdownRef} id="user-profile-dropdown-root">
      {/* Clickable Trigger (Avatar Button) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 rounded-full border border-[var(--border-color)] bg-[var(--element-bg)] hover:bg-[var(--border-color)] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 group"
        aria-label="User menu"
        id="user-profile-trigger"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-xs font-black text-white shadow-md border border-white/10 select-none group-hover:scale-105 transition-transform duration-300">
          {getInitials(user.name)}
        </div>
        <span className="text-xs font-bold text-[var(--text-main)] hidden md:inline-block max-w-[100px] truncate">
          {isGuest ? "Guest" : user.name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-300 ${isOpen ? "rotate-180 text-blue-500" : ""}`} />
      </button>

      {/* Sleek Google-style Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-3.5 w-80 bg-[var(--card-bg)] border border-[var(--border-color)] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem] overflow-hidden z-[100] p-6 flex flex-col gap-5 text-left"
            id="user-profile-dropdown-menu"
          >
            {/* Dynamic User Info (Top Section) */}
            <div className="flex flex-col items-center text-center gap-3 py-2 border-b border-[var(--border-color)]">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-2xl font-black text-white shadow-lg border-2 border-white/20 select-none">
                  {getInitials(user.name)}
                </div>
                {!isGuest && (
                  <span className="absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full bg-green-500 border-2 border-[var(--card-bg)] flex items-center justify-center" title="Session active">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </span>
                )}
              </div>
              <div className="space-y-1 min-w-0 w-full">
                <h3 className="text-base font-black text-[var(--text-main)] truncate tracking-tight px-1">
                  {user.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] truncate px-1 font-medium">
                  {user.email}
                </p>
                <div className="flex justify-center mt-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    user.tier === UserTier.PRO 
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                      : user.tier === UserTier.ENTERPRISE 
                        ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  }`}>
                    <Shield className="w-2.5 h-2.5" />
                    {user.tier} MEMBER
                  </span>
                </div>
              </div>
            </div>

            {/* Credits Display (Prominent Center Section) */}
            <div className="bg-[var(--element-bg)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-blue-500/10 transition-all duration-700" />
              
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">
                    Production Credits
                  </span>
                </div>
                {user.tier !== UserTier.FREE && (
                  <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    PRO tier
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between relative z-10">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[var(--text-main)] tracking-tighter">
                    {user.credits}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    Units
                  </span>
                </div>

                <button
                  onClick={() => handleItemClick(ViewMode.WALLET)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 hover:scale-[1.03] text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-1 active:scale-95 cursor-pointer"
                >
                  <Wallet className="w-3 h-3" />
                  Wallet
                </button>
              </div>
            </div>

            {/* Dropdown Options (Menu List) */}
            <div className="flex flex-col gap-1 border-b border-[var(--border-color)] pb-2.5">
              <button
                onClick={() => handleItemClick(ViewMode.PROFILE)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-[var(--text-main)] hover:bg-[var(--element-bg)] transition-colors text-left cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">Account Profile</p>
                  <p className="text-[9px] text-[var(--text-secondary)]">Manage your preferences</p>
                </div>
              </button>
            </div>

            {/* Sign Out Section (Bottom) */}
            <div className="pt-1 flex flex-col gap-3">
              {isGuest ? (
                <button
                  onClick={() => handleItemClick(ViewMode.LOGIN)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 text-center cursor-pointer"
                >
                  Login Account
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 rounded-xl text-xs font-black text-red-500 uppercase tracking-widest transition-all duration-200 active:scale-95 text-center cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
