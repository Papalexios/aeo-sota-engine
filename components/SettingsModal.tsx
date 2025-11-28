
import React, { useState } from 'react';
import { AIConfig, AIProvider } from '../types';
import { PROVIDER_LABELS } from '../constants';
import { X, Save, Key, Server, ShoppingBag, Globe, Lock, User, Wifi, Zap, Edit3, Search } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (config: AIConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [activeTab, setActiveTab] = useState<'ai' | 'monetization' | 'wordpress'>('ai');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-50/80 backdrop-blur-md px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Server size={18} className="mr-2 text-brand-600" /> Configuration
            </h2>
            <button onClick={onClose}><X size={18}/></button>
        </div>

        <div className="flex border-b border-slate-100 px-6 space-x-6">
             {['ai', 'monetization', 'wordpress'].map(tab => (
                 <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-3 text-sm font-bold border-b-2 uppercase ${activeTab === tab ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400'}`}>{tab}</button>
             ))}
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {activeTab === 'ai' && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Provider</label>
                        <select value={localConfig.provider} onChange={(e) => setLocalConfig({ ...localConfig, provider: e.target.value as AIProvider })} className="block w-full p-3 border rounded-xl">
                            {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((key) => (
                                <option key={key} value={key}>{PROVIDER_LABELS[key]}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">LLM API Key</label>
                        <input type="password" value={localConfig.apiKey} onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })} className="block w-full p-3 border rounded-xl" placeholder="sk-..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Serper.dev API Key (For Live Research)</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
                            <input type="password" value={localConfig.serperApiKey || ''} onChange={(e) => setLocalConfig({ ...localConfig, serperApiKey: e.target.value })} className="block w-full pl-10 p-3 border rounded-xl" placeholder="Get key from serper.dev" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Model ID</label>
                        <input type="text" value={localConfig.model} onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })} className="block w-full p-3 border rounded-xl font-mono" />
                    </div>
                </div>
            )}

            {activeTab === 'monetization' && (
                <div className="space-y-5">
                    <div className="bg-amber-50 p-4 rounded-xl text-xs text-amber-900">Enter Amazon Tag to enable automated product boxes.</div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amazon Tag</label>
                        <input type="text" value={localConfig.amazonAffiliateTag || ''} onChange={(e) => setLocalConfig({ ...localConfig, amazonAffiliateTag: e.target.value })} className="block w-full p-3 border rounded-xl" />
                    </div>
                </div>
            )}

            {activeTab === 'wordpress' && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Site URL</label>
                        <input type="url" value={localConfig.wpUrl || ''} onChange={(e) => setLocalConfig({ ...localConfig, wpUrl: e.target.value })} className="block w-full p-3 border rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" value={localConfig.wpUsername || ''} onChange={(e) => setLocalConfig({ ...localConfig, wpUsername: e.target.value })} className="block w-full p-3 border rounded-xl" placeholder="Username" />
                        <input type="password" value={localConfig.wpAppPassword || ''} onChange={(e) => setLocalConfig({ ...localConfig, wpAppPassword: e.target.value })} className="block w-full p-3 border rounded-xl" placeholder="App Password" />
                    </div>
                </div>
            )}
        </div>

        <div className="bg-slate-50 px-6 py-4 border-t flex justify-end">
            <button onClick={handleSave} className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold">Save</button>
        </div>
      </div>
    </div>
  );
};
