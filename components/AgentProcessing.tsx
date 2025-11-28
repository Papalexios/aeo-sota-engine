import React, { useEffect, useRef, useState } from 'react';
import { ProcessedItem } from '../types';
import { Loader2, CheckCircle2, Circle, AlertTriangle, Sparkles, Terminal, Cpu, Clock } from 'lucide-react';

interface AgentProcessingProps {
  items: ProcessedItem[];
  total: number;
  completed: number;
}

export const AgentProcessing: React.FC<AgentProcessingProps> = ({ items, total, completed }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initStep, setInitStep] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const [eta, setEta] = useState<string>('--:--');

  useEffect(() => {
    if (total > 0 && initStep < 3) {
        const timer = setInterval(() => {
            setInitStep(prev => prev + 1);
        }, 600);
        return () => clearInterval(timer);
    }
  }, [total, initStep]);

  // Calculate ETA
  useEffect(() => {
      if (completed > 0 && !startTimeRef.current) {
          startTimeRef.current = Date.now();
      }
      if (completed > 0 && startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current;
          const msPerItem = elapsed / completed;
          const remainingItems = total - completed;
          const remainingMs = remainingItems * msPerItem;
          
          if (remainingMs > 0) {
            const mins = Math.floor(remainingMs / 60000);
            const secs = Math.floor((remainingMs % 60000) / 1000);
            setEta(`${mins}:${secs.toString().padStart(2, '0')}`);
          }
      }
  }, [completed, total]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items]);

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Performance Optimization: Only render last 50 logs to prevent DOM explosion
  const recentItems = items.filter(i => i.status !== 'pending').slice(-50);

  if (items.length === 0 && total === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center">
         <div className="relative bg-white rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/50 p-16 flex flex-col items-center justify-center overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500 to-transparent animate-[shimmer_2s_infinite]"></div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-50 rounded-full blur-3xl opacity-50"></div>
            
            <div className="relative mb-8">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center relative z-10 shadow-inner border border-slate-100">
                    <Cpu size={48} className="text-brand-600 animate-pulse" strokeWidth={1.5} />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-brand-100 animate-[ping_3s_infinite]"></div>
                <div className="absolute -bottom-3 -right-3 bg-white p-2 rounded-full shadow-lg border border-slate-50 z-20">
                    <Loader2 size={24} className="text-brand-600 animate-spin" />
                </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Initializing AI Agent</h2>
            <div className="flex flex-col items-center space-y-2 mt-4 text-sm text-slate-500 font-medium">
                <span className={`transition-opacity duration-500 ${initStep >= 0 ? 'opacity-100' : 'opacity-0'}`}>Authenticating Provider...</span>
                <span className={`transition-opacity duration-500 delay-100 ${initStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>Loading Context Window...</span>
                <span className={`transition-opacity duration-500 delay-200 ${initStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>Preparing Analysis Queue...</span>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-12">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-50/50 px-8 py-8 border-b border-slate-200 backdrop-blur-sm relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-200">
                <div 
                    className="h-full bg-brand-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                        <Sparkles size={24} className="mr-3 text-brand-600 animate-pulse" /> 
                        AI Restoration in Progress
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Analyzing content context and generating modern successors.</p>
                </div>
                <div className="text-right">
                    <span className="block text-4xl font-bold text-brand-600 tracking-tight">{progress}%</span>
                    <div className="flex items-center justify-end text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                        <span>{completed}/{total} Items</span>
                        <span className="mx-2">•</span>
                        <span className="flex items-center text-brand-500">
                            <Clock size={12} className="mr-1" /> Est. {eta}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Live Logs Terminal */}
        <div className="bg-slate-950 p-6 relative overflow-hidden min-h-[400px] flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                <Terminal size={120} className="text-white" />
            </div>

            <div className="flex items-center text-slate-400 text-xs font-mono mb-4 border-b border-slate-800 pb-2">
                <span className="mr-4">root@seo-agent:~# tail -f process.log</span>
                <span className="ml-auto flex space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/50"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/50"></span>
                </span>
            </div>

            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto pr-2 font-mono text-xs md:text-sm space-y-3 custom-scrollbar"
            >
                {completed > 50 && (
                    <div className="text-slate-600 italic text-xs mb-4 text-center">
                        ... {completed - 50} previous logs hidden for performance ...
                    </div>
                )}
                
                {recentItems.map((item) => (
                    <div key={item.id} className="flex items-start animate-in fade-in slide-in-from-left-2 duration-300 group">
                        <div className="mr-3 mt-1 shrink-0 opacity-70">
                            {item.status === 'completed' ? (
                                <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : item.status === 'processing' ? (
                                <Loader2 size={14} className="text-brand-400 animate-spin" />
                            ) : item.status === 'error' ? (
                                <AlertTriangle size={14} className="text-red-400" />
                            ) : (
                                <Circle size={14} className="text-slate-700" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 border-l border-slate-800 pl-3 ml-1 group-hover:border-slate-700 transition-colors">
                            <div className={`truncate flex items-center ${
                                item.status === 'processing' ? 'text-brand-300' : 
                                item.status === 'completed' ? 'text-slate-400' : 
                                item.status === 'error' ? 'text-red-400' :
                                'text-slate-600'
                            }`}>
                                <span className="opacity-50 mr-2 text-[10px]">{new Date().toLocaleTimeString().split(' ')[0]}</span>
                                {item.status === 'processing' ? `[analyzing] ${item.slug}` : 
                                 item.status === 'completed' ? `[success] ${item.slug}` : 
                                 item.status === 'error' ? `[fail] ${item.slug}` :
                                 `[queued] ${item.slug}`}
                            </div>
                            
                            {item.status === 'error' && item.errorMsg && (
                                 <div className="mt-1 text-red-400/60 pl-8">
                                    Error: {item.errorMsg}
                                 </div>
                            )}

                            {item.status === 'completed' && item.suggestion && (
                                <div className="mt-1 text-emerald-400/60 pl-8 flex items-center">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
                                    Identified Successor: "{item.suggestion.successorProductName}"
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {completed === total && total > 0 && (
                    <div className="text-center py-8 text-brand-400 font-bold animate-pulse">
                        — BATCH ANALYSIS COMPLETE —
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};