
import React, { useState, useMemo, useEffect } from 'react';
import { ProcessedItem, AIConfig } from '../types';
import { Edit2, Copy, Check, Search, Download, Loader2, Settings, Smartphone, Monitor, Send, FileText, BarChart3, Link2, Tag, ShoppingBag, ExternalLink, Image as ImageIcon, Plus } from 'lucide-react';
import { isValidAsin, constructAmazonUrl } from '../utils/helpers';

interface ReviewResultsProps {
  items: ProcessedItem[];
  config: AIConfig;
  onOpenSettings: () => void;
  onUpdateItem: (id: string, updates: Partial<ProcessedItem>) => void;
  customPublishHandler?: (item: ProcessedItem) => Promise<void>;
}

const ITEMS_PER_PAGE = 20;

export const ReviewResults: React.FC<ReviewResultsProps> = ({ items, config, onOpenSettings, onUpdateItem, customPublishHandler }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'preview' | 'strategy'>('preview');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  // Manual Product Input State
  const [newProductInput, setNewProductInput] = useState('');

  const filteredItems = useMemo(() => {
      if (!searchTerm) return items;
      return items.filter(item => 
          item.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.suggestion?.oldProductName.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [items, searchTerm]);

  const paginatedItems = filteredItems.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  const currentItem = filteredItems[selectedIndex] || filteredItems[0];
  const displaySuggestion = currentItem?.suggestion;

  // Calculate stats for the scorecard
  const stats = useMemo(() => {
      if (!currentItem?.aiResult || !currentItem?.draftHtml) return { keywordHits: 0, linkHits: 0, detectedLinks: [] };
      const html = currentItem.draftHtml;
      const keywordHits = (currentItem.aiResult.keywordsUsed || []).filter(k => html.toLowerCase().includes(k.toLowerCase())).length;
      
      const linkMatches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g)];
      const detectedLinks = linkMatches.map(match => ({ url: match[1], text: match[2] })).filter(l => l.url.startsWith('http') || l.url.startsWith('/'));
      const linkHits = detectedLinks.length;
      
      return { keywordHits, linkHits, detectedLinks };
  }, [currentItem]);

  // Compute Live Preview HTML (injecting manual affiliate links and image)
  const previewHtml = useMemo(() => {
      if (!currentItem?.draftHtml) return "";
      let html = currentItem.draftHtml;
      
      // Inject Custom Affiliate Links
      if (currentItem.productOverrides) {
         Object.entries(currentItem.productOverrides).forEach(([originalUrl, newUrl]) => {
             // Escape regex special chars in the original URL
             const safeOriginal = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             html = html.replace(new RegExp(safeOriginal, 'g'), newUrl);
         });
         
         // Inject Manual Products (if added via the "Add Product" feature, we might need to inject them or just store them. 
         // For now, productOverrides handles replacements. If a new product is added manually as a replacement key, it works.)
      }

      // Inject Custom Product Image
      if (currentItem.customImageUrl) {
          html = html.replace(
              /src="[^"]*placeholder[^"]*"/g,
              `src="${currentItem.customImageUrl}"`
          ).replace(
              /class="sota-product-image"/g,
              `class="sota-product-image" src="${currentItem.customImageUrl}"`
          );
      }

      return html;
  }, [currentItem]);

  const handlePublish = async () => {
      if (!currentItem || !customPublishHandler) return;
      setIsPublishing(true);
      setPublishStatus(null);
      try {
          await customPublishHandler(currentItem);
          setPublishStatus({ type: 'success', msg: 'Published Successfully!' });
      } catch (e: any) {
          setPublishStatus({ type: 'error', msg: e.message });
      } finally {
          setIsPublishing(false);
      }
  };

  const handleOverrideChange = (originalUrl: string, newValue: string) => {
      let finalUrl = newValue.trim();
      if (isValidAsin(finalUrl)) {
          finalUrl = constructAmazonUrl(finalUrl, config.amazonAffiliateTag);
      }
      onUpdateItem(currentItem.id, { 
          productOverrides: {
              ...(currentItem.productOverrides || {}),
              [originalUrl]: finalUrl
          }
      });
  };

  const handleAddManualProduct = () => {
      if (!newProductInput.trim()) return;
      // We add a manual entry to productOverrides. 
      // Since we don't have an original URL to replace, this might be used for 'global' fallback or specific injections if supported.
      // For this SOTA update, we'll allow adding it as a tracked item in overrides.
      const key = `manual_${Date.now()}`;
      handleOverrideChange(key, newProductInput);
      setNewProductInput('');
  };

  if (!currentItem || !displaySuggestion) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Search size={48} className="mb-4 opacity-50" />
          <p>No drafts available for review.</p>
      </div>
  );

  // Combine detected products and manually added overrides for the list
  const allProductKeys = new Set([
      ...(currentItem.aiResult?.detectedProducts?.map(p => p.url) || []),
      ...(Object.keys(currentItem.productOverrides || {}))
  ]);
  
  const displayProducts = Array.from(allProductKeys).map(key => {
      const detected = currentItem.aiResult?.detectedProducts?.find(p => p.url === key);
      return {
          name: detected?.name || 'Manual Entry',
          url: key,
          isManual: !detected
      };
  });

  return (
    <div className="flex h-[calc(100vh-240px)] gap-6 relative">
      
      {/* 1. Sidebar List */}
      <div className="w-80 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col shrink-0">
         <div className="p-4 border-b border-slate-100 bg-slate-50/50">
             <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search drafts..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 transition-colors"
                />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase tracking-wider">
                 <span>{filteredItems.length} Drafts Ready</span>
            </div>
        </div>
        <div className="overflow-y-auto flex-1 custom-scrollbar">
            {paginatedItems.map((item, idx) => (
                <div 
                    key={item.id}
                    onClick={() => setSelectedIndex((currentPage - 1) * ITEMS_PER_PAGE + idx)}
                    className={`p-4 border-b border-slate-50 cursor-pointer transition-all relative group ${item.id === currentItem.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                >
                    <div className="text-sm font-bold text-slate-800 truncate mb-1">{item.suggestion?.successorProductName || item.slug}</div>
                    <div className="text-xs text-slate-500 truncate opacity-70 font-mono mb-2">{item.slug}</div>
                    
                    <div className="flex items-center space-x-2">
                        {item.status === 'completed' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold flex items-center"><Check size={10} className="mr-1"/> Ready</span>}
                        {item.aiResult?.verdictData.score && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">Score: {item.aiResult.verdictData.score}</span>}
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
           {/* Toolbar */}
           <div className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6">
                <div className="flex items-center space-x-1 bg-slate-800/50 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('preview')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <FileText size={14} className="mr-2"/> Preview
                    </button>
                    <button 
                        onClick={() => setActiveTab('strategy')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center ${activeTab === 'strategy' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <BarChart3 size={14} className="mr-2"/> Strategy Map
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    {activeTab === 'preview' && (
                        <div className="flex bg-slate-800 rounded-lg p-1">
                            <button onClick={() => setPreviewMode('desktop')} className={`p-1.5 rounded ${previewMode === 'desktop' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Desktop View"><Monitor size={16}/></button>
                            <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded ${previewMode === 'mobile' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Mobile View"><Smartphone size={16}/></button>
                        </div>
                    )}
                    
                    <button 
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center disabled:opacity-50"
                    >
                        {isPublishing ? <Loader2 size={16} className="animate-spin mr-2"/> : <Send size={16} className="mr-2" />}
                        {isPublishing ? 'Pushing...' : 'Publish Live'}
                    </button>
                </div>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-hidden relative bg-slate-900">
               
               {/* PREVIEW TAB */}
               {activeTab === 'preview' && (
                   <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50 p-6">
                       <div className={`bg-white h-full overflow-y-auto custom-scrollbar transition-all duration-300 shadow-2xl ${previewMode === 'mobile' ? 'w-[375px] rounded-[3rem] border-[8px] border-slate-800' : 'w-full rounded-xl'}`}>
                          <div className="bg-slate-100 border-b border-slate-200 p-3 sticky top-0 flex items-center space-x-2 z-10">
                                <div className="flex space-x-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                                </div>
                                <div className="flex-1 bg-white rounded-md h-6 border border-slate-200 text-[10px] flex items-center px-2 text-slate-400 font-mono truncate">
                                    https://yoursite.com/{currentItem.slug}
                                </div>
                          </div>
                          
                          <div className="p-8 prose prose-slate max-w-none">
                              {previewHtml ? (
                                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                              ) : (
                                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                      <Loader2 className="animate-spin mb-2" /> Generating Preview...
                                  </div>
                              )}
                          </div>
                       </div>
                   </div>
               )}

               {/* STRATEGY TAB */}
               {activeTab === 'strategy' && (
                   <div className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar">
                       <div className="grid grid-cols-2 gap-8 max-w-5xl mx-auto">
                           
                           {/* Scorecard */}
                           <div className="col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700 flex justify-between items-center">
                               <div>
                                   <h3 className="text-xl font-bold text-white">SOTA Optimization Score</h3>
                                   <p className="text-slate-400 text-sm">Based on AEO & Semantic Density</p>
                               </div>
                               <div className="flex items-center space-x-8">
                                   <div className="text-center">
                                       <div className="text-3xl font-bold text-emerald-400">{stats.keywordHits}</div>
                                       <div className="text-xs text-slate-500 uppercase font-bold">Keywords</div>
                                   </div>
                                   <div className="text-center">
                                       <div className={`text-3xl font-bold ${stats.linkHits >= 6 ? 'text-emerald-400' : 'text-amber-400'}`}>{stats.linkHits}</div>
                                       <div className="text-xs text-slate-500 uppercase font-bold">Int. Links</div>
                                   </div>
                                   <div className="w-px h-12 bg-slate-700"></div>
                                   <div className="text-center">
                                       <div className="text-4xl font-bold text-white">{currentItem.aiResult?.verdictData.score || 0}</div>
                                       <div className="text-xs text-emerald-500 uppercase font-bold">/ 100</div>
                                   </div>
                               </div>
                           </div>

                           {/* Ghost Swap */}
                           <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                               <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center"><Search size={16} className="mr-2"/> Ghost Strategy</h4>
                               <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-3 opacity-50">
                                   <span className="text-sm font-mono text-slate-400 line-through">{displaySuggestion.oldProductName}</span>
                                   <span className="text-xs text-red-400 font-bold uppercase">Dead</span>
                               </div>
                               <div className="flex justify-center my-2 text-slate-600"><Download size={16} /></div>
                               <div className="flex items-center justify-between bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30 mb-4">
                                   <span className="text-sm font-bold text-emerald-400">{displaySuggestion.successorProductName}</span>
                                   <span className="text-xs text-emerald-500 font-bold uppercase">Live</span>
                               </div>

                               <div className="pt-4 border-t border-slate-700">
                                   <label className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center">
                                       <ImageIcon size={14} className="mr-2" /> Product Image URL
                                   </label>
                                   <input 
                                        type="text" 
                                        placeholder="Paste Image URL to update preview..."
                                        value={currentItem.customImageUrl || ''}
                                        onChange={(e) => onUpdateItem(currentItem.id, { customImageUrl: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-brand-500 outline-none transition-colors"
                                    />
                               </div>
                           </div>

                           {/* Keyword Cloud */}
                           <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                               <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center"><Tag size={16} className="mr-2"/> Semantic Keywords</h4>
                               <div className="flex flex-wrap gap-2">
                                   {(currentItem.aiResult?.keywordsUsed || []).slice(0, 20).map(k => (
                                       <span key={k} className="px-2 py-1 rounded bg-slate-900 text-xs text-slate-300 border border-slate-700">
                                           {k}
                                       </span>
                                   ))}
                               </div>
                           </div>

                           {/* MULTI-PRODUCT Monetization Card - SOTA REDESIGN */}
                           <div className="col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700 border-l-4 border-l-emerald-500 shadow-xl">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h4 className="text-lg font-bold text-white uppercase flex items-center">
                                            <ShoppingBag size={20} className="mr-2 text-emerald-500"/> 
                                            Monetization Engine
                                        </h4>
                                        <p className="text-sm text-slate-400 mt-1">
                                            Manage products detected in the generated content.
                                        </p>
                                    </div>
                                    <div className="text-right">
                                         <div className="text-xs font-bold text-slate-500 uppercase">Products Detected</div>
                                         <div className="text-2xl font-bold text-white">{displayProducts.length}</div>
                                    </div>
                                </div>
                                
                                <div className="grid gap-4">
                                    {displayProducts.length > 0 ? displayProducts.map((prod, idx) => (
                                        <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row md:items-center gap-4 group hover:border-emerald-500/50 transition-colors">
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-white flex items-center">
                                                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 mr-3 border border-slate-700">{idx + 1}</span>
                                                    {prod.name}
                                                    {prod.isManual && <span className="ml-2 text-[10px] bg-slate-700 px-1.5 rounded text-white border border-slate-600">Manual</span>}
                                                </div>
                                                <div className="flex items-center text-[10px] text-slate-500 mt-1 ml-9">
                                                    <div className="truncate max-w-[250px] font-mono opacity-70" title={prod.url}>
                                                        {prod.url}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="w-full md:w-2/5 flex items-center space-x-2">
                                                <div className="relative flex-1">
                                                     <div className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">ASIN:</div>
                                                     <input 
                                                        type="text" 
                                                        placeholder="e.g. B08..."
                                                        value={currentItem.productOverrides?.[prod.url] || ''}
                                                        onChange={(e) => handleOverrideChange(prod.url, e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-12 pr-3 text-sm text-emerald-400 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-xl">
                                            <ShoppingBag size={32} className="mx-auto text-slate-600 mb-2" />
                                            <p className="text-slate-500 text-sm">No products automatically detected.</p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Manual Add Input - Styled Better */}
                                <div className="mt-6 pt-4 border-t border-slate-700/50">
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Add Manual Product Override</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text"
                                            placeholder="Paste Amazon URL or ASIN here..."
                                            value={newProductInput}
                                            onChange={(e) => setNewProductInput(e.target.value)}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddManualProduct()}
                                        />
                                        <button 
                                            onClick={handleAddManualProduct} 
                                            className="flex items-center bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"
                                        >
                                            <Plus size={16} className="mr-2"/> Add
                                        </button>
                                    </div>
                                </div>
                           </div>

                           {/* Internal Links */}
                           <div className="col-span-2 bg-slate-800 rounded-2xl p-6 border border-slate-700">
                               <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center justify-between">
                                   <div className="flex items-center"><Link2 size={16} className="mr-2"/> Internal Link Validation</div>
                                   <div className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${stats.linkHits >= 6 ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-amber-900/30 text-amber-400 border-amber-500/30'}`}>
                                       {stats.linkHits} / 6 Target Met
                                   </div>
                               </h4>
                               <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                                   <div className="h-40 overflow-y-auto custom-scrollbar space-y-2">
                                       {stats.detectedLinks.length > 0 ? (
                                           stats.detectedLinks.map((link, i) => (
                                               <div key={i} className="flex flex-col border-b border-slate-800 pb-2 mb-2 last:border-0 last:mb-0">
                                                   <div className="flex items-center text-xs font-bold text-slate-300">
                                                       <Check size={10} className="mr-2 text-emerald-500 shrink-0" />
                                                       Anchor: "{link.text}"
                                                   </div>
                                                   <div className="text-[10px] text-indigo-400 font-mono truncate pl-5">
                                                       {link.url}
                                                   </div>
                                               </div>
                                           ))
                                       ) : (
                                           <div className="text-slate-500 text-xs italic p-4 text-center">No internal links detected in the draft.</div>
                                       )}
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>
               )}
           </div>

           {/* Status Bar */}
           {publishStatus && (
               <div className={`px-6 py-2 text-xs font-bold flex justify-center items-center ${publishStatus.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                   {publishStatus.msg}
               </div>
           )}
      </div>
    </div>
  );
};
