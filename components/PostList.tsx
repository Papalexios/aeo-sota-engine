
import React, { useState, useMemo } from 'react';
import { WPPostHeader, PostHealth } from '../types';
import { AlertTriangle, CheckCircle2, Circle, ExternalLink, Activity, Loader2, Sparkles, Database, CheckSquare, Square, ScanSearch, AlertCircle, FileText, Play } from 'lucide-react';

interface PostListProps {
  posts: WPPostHeader[];
  healthData: Record<number, PostHealth>;
  onOptimize: (ids: number[]) => void;
  onScan: (ids: number[]) => void;
  onReview?: (id: number) => void;
  isProcessing: boolean;
}

const PostList: React.FC<PostListProps> = ({ posts, healthData, onOptimize, onScan, onReview, isProcessing }) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  const handleSelect = (id: number, shiftKey: boolean) => {
      const newSet = new Set(selectedIds);
      if (shiftKey && lastSelectedId !== null) {
          const startIdx = posts.findIndex(p => p.id === lastSelectedId);
          const endIdx = posts.findIndex(p => p.id === id);
          const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
          for (let i = min; i <= max; i++) { newSet.add(posts[i].id); }
      } else {
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      }
      setSelectedIds(newSet);
      setLastSelectedId(id);
  };

  const handleSelectAll = () => {
      if (selectedIds.size === posts.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(posts.map(p => p.id)));
  };

  const handleBatchOptimize = () => {
      onOptimize(Array.from(selectedIds));
      setSelectedIds(new Set());
  };

  const handleBatchScan = () => {
      onScan(Array.from(selectedIds));
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      {selectedIds.size > 0 && (
          <div className="bg-indigo-900/30 border-b border-indigo-500/30 p-4 flex justify-between items-center animate-in slide-in-from-top-2">
              <span className="text-indigo-200 font-bold text-sm flex items-center">
                  <CheckSquare size={16} className="mr-2" /> {selectedIds.size} Selected
              </span>
              <div className="flex gap-3">
                  <button onClick={handleBatchScan} disabled={isProcessing} className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition-all flex items-center border border-slate-700 disabled:opacity-50">
                      <ScanSearch size={14} className="mr-2" /> Deep Scan
                  </button>
                  <button onClick={handleBatchOptimize} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center disabled:opacity-50">
                      <Sparkles size={14} className="mr-2" /> Generate Drafts
                  </button>
              </div>
          </div>
      )}

      <div className="overflow-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-800 bg-[#020617] text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
              <th className="px-6 py-5 w-12">
                  <button onClick={handleSelectAll} className="text-slate-500 hover:text-white">
                      {selectedIds.size === posts.length && posts.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                  </button>
              </th>
              <th className="px-6 py-5 whitespace-nowrap">Status</th>
              <th className="px-6 py-5 whitespace-nowrap">Entity / Post</th>
              <th className="px-6 py-5 whitespace-nowrap">Metrics</th>
              <th className="px-6 py-5 whitespace-nowrap">AEO Readiness</th>
              <th className="px-6 py-5 text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {posts.map(post => {
              const health = healthData[post.id];
              const isOptimizing = health?.status === 'optimizing' || health?.status === 'scanning';
              const isReviewReady = health?.status === 'review_pending';
              const isPublished = health?.status === 'published';
              const isSelected = selectedIds.has(post.id);
              const isPendingScan = health?.metrics.wordCount === 0 && health?.status === 'idle';
              
              return (
                <tr key={post.id} className={`group transition-colors duration-200 ${isSelected ? 'bg-indigo-900/20' : 'hover:bg-slate-800/40'}`} onClick={(e) => handleSelect(post.id, e.shiftKey)}>
                  <td className="px-6 py-4">
                      <button className={`text-slate-600 hover:text-indigo-400 ${isSelected ? 'text-indigo-500' : ''}`}>
                          {isSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                      </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap w-16">
                     {isPublished ? (
                         <CheckCircle2 className="text-emerald-500" size={18} />
                     ) : isReviewReady ? (
                         <div className="flex items-center justify-center w-5 h-5 bg-amber-500/20 rounded-full">
                             <FileText className="text-amber-500" size={12} />
                         </div>
                     ) : health?.status === 'error' ? (
                         <div className="group/err relative">
                             <AlertTriangle className="text-red-500 cursor-help" size={18} />
                             <div className="absolute left-full ml-2 top-0 w-48 bg-red-900/90 text-red-100 text-[10px] p-2 rounded z-50 hidden group-hover/err:block shadow-xl border border-red-700">
                                 {health.log || "Unknown Error"}
                             </div>
                         </div>
                     ) : isOptimizing ? (
                         <Loader2 className="text-cyan-400 animate-spin" size={18} />
                     ) : (
                         <Circle className="text-slate-700" size={18} />
                     )}
                  </td>

                  <td className="px-6 py-4 max-w-xs">
                     <div className="font-bold text-slate-200 truncate text-sm mb-1" title={post.title.rendered}>{post.title.rendered}</div>
                     <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                        <a href={post.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex items-center hover:text-cyan-400 transition-colors">
                            <ExternalLink size={10} className="mr-1" /> View
                        </a>
                        <span className="flex items-center text-slate-600">ID: {post.id}</span>
                     </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                     {isPendingScan ? (
                         <span className="text-xs text-slate-600 flex items-center font-mono bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
                             <ScanSearch size={12} className="mr-1.5" /> HEADER ONLY
                         </span>
                     ) : health ? (
                         <div className="w-24">
                             <div className="flex justify-between text-[10px] font-bold mb-1 text-slate-400">
                                 <span className={health.score > 80 ? 'text-emerald-400' : 'text-amber-400'}>{health.score}</span>
                             </div>
                             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full transition-all duration-1000 ${health.score > 80 ? 'bg-emerald-500' : health.score > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${health.score}%` }}></div>
                             </div>
                         </div>
                     ) : <span className="text-slate-700">--</span>}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                     {health ? (
                         <div className="w-24">
                             <div className="flex justify-between text-[10px] font-bold mb-1 text-indigo-300">
                                 <span>{health.aeoScore}%</span>
                             </div>
                             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full transition-all duration-1000 ${health.aeoScore > 80 ? 'bg-indigo-500' : 'bg-indigo-900'}`} style={{ width: `${health.aeoScore}%` }}></div>
                             </div>
                         </div>
                     ) : <span className="text-slate-700">--</span>}
                  </td>

                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      {isReviewReady ? (
                          <button
                              onClick={() => onReview?.(post.id)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all shadow shadow-amber-900/20 uppercase tracking-wide flex items-center ml-auto"
                          >
                              <FileText size={12} className="mr-1.5"/> Review
                          </button>
                      ) : isPublished ? (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Published</span>
                      ) : (
                          <button
                              onClick={() => onOptimize([post.id])}
                              disabled={isProcessing || health?.status === 'scanning'}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed uppercase tracking-wide ml-auto flex items-center"
                          >
                              <Sparkles size={12} className="mr-1.5"/> Generate
                          </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PostList;
