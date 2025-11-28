
import React, { useState } from 'react';
import { WPConnection } from '../types';
import { Zap, Lock, User, Globe, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { verifyConnection } from '../services/wordpressService';

interface ConnectModalProps {
  onConnect: (conn: WPConnection) => void;
}

const ConnectModal: React.FC<ConnectModalProps> = ({ onConnect }) => {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Sanitize Inputs: Trim spaces which are common copy-paste errors
    const cleanUrl = url.trim().replace(/\/$/, '');
    const cleanUser = username.trim();
    const cleanPass = appPassword.trim();

    if (!cleanUrl || !cleanUser || !cleanPass) {
        setError("All fields are required.");
        setIsLoading(false);
        return;
    }

    const conn: WPConnection = { url: cleanUrl, username: cleanUser, appPassword: cleanPass };

    try {
        // Strict Verification against /users/me to ensure permissions
        await verifyConnection(conn);
        onConnect(conn);
    } catch (err: any) {
        setError(err.message || "Connection Failed");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="flex items-center gap-3 mb-8 relative z-10">
             <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]">
               <Zap size={22} fill="currentColor" />
             </div>
             <div>
                <h1 className="font-bold text-xl tracking-tight text-white">Neural Mesh</h1>
                <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">WordPress Connector</p>
             </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Site URL</label>
                <div className="relative">
                    <Globe size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input 
                        type="url" 
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://mysite.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Username</label>
                <div className="relative">
                    <User size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input 
                        type="text" 
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">App Password</label>
                <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3.5 text-slate-500" />
                    <input 
                        type="password" 
                        required
                        value={appPassword}
                        onChange={(e) => setAppPassword(e.target.value)}
                        placeholder="abcd 1234 ...."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                    Generate via Users &gt; Profile &gt; Application Passwords.
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center text-red-400 text-xs">
                    <AlertCircle size={14} className="mr-2" />
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>Connect Node <ArrowRight size={18} className="ml-2" /></>}
            </button>
        </form>
      </div>
    </div>
  );
};

export default ConnectModal;
