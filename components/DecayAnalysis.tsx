
import React, { useState, useMemo, useEffect } from 'react';
import { AnalyzedUrl, ManualMapping, ProcessedItem } from '../types';
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Filter, X, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, FileSpreadsheet, Upload, ShieldCheck, Trash2, CheckSquare } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface DecayAnalysisProps {
  data: AnalyzedUrl[];
  processedItems?: ProcessedItem[];
  onProceed: (selectedIds: string[]) => void;
}

const ITEMS_PER_PAGE = 50;

// CSV Modal Component
const MappingModal = ({ isOpen, onClose, onMap }: { isOpen: boolean; onClose: () => void; onMap: (mappings: {slug: string, mapping: ManualMapping}[]) => void }) => {
    const [csvText, setCsvText] = useState('');
    const [preview, setPreview] = useState<{slug: string, mapping: ManualMapping}[]>([]);

    if (!isOpen) return null;

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setCsvText(text);
        
        // --- SMART PARSER (CSV / TSV / Excel Copy-Paste) ---
        const lines = text.split(/\r?\n/); // Handle Windows/Unix line endings
        const parsed = lines.map(line => {
            const cleanLine = line.trim();
            if (!cleanLine) return null;

            // Detect Delimiter: Check for Tab first (Excel/Sheets), then Comma
            let parts: string[] = [];
            if (cleanLine.includes('\t')) {
                parts = cleanLine.split('\t');
            } else {
                // Simple comma split, handling potential quotes roughly if needed, 
                // but for this specific use case, simple split is usually sufficient.
                parts = cleanLine.split(',');
            }

            // We need at least 3 parts: Slug/URL, Product Name, ASIN
            // Some copies might have empty columns, filter out empty strings
            const activeParts = parts.map(p => p.trim()).filter(p => p !== '');

            if (activeParts.length >= 3) {
                let rawUrlOrSlug = activeParts[0];
                
                // 1. URL CLEANING: Convert "https://site.com/slug/" to "slug"
                let cleanSlug = rawUrlOrSlug;
                try {
                    // If it looks like a full URL, parse it
                    if (rawUrlOrSlug.startsWith('http')) {
                        const url = new URL(rawUrlOrSlug);
                        // Extract pathname, remove leading/trailing slashes
                        cleanSlug = url.pathname.replace(/^\/|\/$/g, '');
                    } else {
                        // Just strip slashes
                         cleanSlug = rawUrlOrSlug.replace(/^\/|\/$/g, '');
                    }
                } catch (e) {
                    // Fallback cleanup if URL parse fails
                    cleanSlug = rawUrlOrSlug.replace(/^\/|\/$/g, '');
                }

                // 2. PRODUCT NAME CLEANING
                // Usually the second column
                const productName = activeParts[1];

                // 3. ASIN CLEANING
                // Usually the last or 3rd column
                const asin = activeParts[activeParts.length - 1].toUpperCase();

                // Basic ASIN Validation (10 chars) - Optional, but good for preview
                // We map it regardless, but we prioritize valid looking rows
                
                if (cleanSlug && productName && asin) {
                    return {
                        slug: cleanSlug,
                        mapping: {
                            productName: productName,
                            asin: asin
                        }
                    };
                }
            }
            return null;
        }).filter(Boolean) as {slug: string, mapping: ManualMapping}[];

        setPreview(parsed);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center">
                            <FileSpreadsheet size={20} className="text-emerald-600 mr-2" />
                            Upload ASIN Mapping
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Paste data from Excel, Google Sheets, or CSV.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18}/></button>
                </div>
                
                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    {/* Input Side */}
                    <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">
                         <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3 text-xs text-blue-800 leading-relaxed">
                            <strong>Instructions:</strong> Copy columns directly from your spreadsheet.<br/>
                            Format: <code>URL (or Slug)</code> | <code>New Product Name</code> | <code>ASIN</code>
                        </div>
                        <textarea 
                            value={csvText}
                            onChange={handleTextChange}
                            placeholder={`Example Paste:\nhttps://site.com/review/watch-5  Galaxy Watch 6   B0C...\nhttps://site.com/review/ipad-9    iPad 10th Gen    B0B...`}
                            className="flex-1 w-full p-4 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none bg-slate-50 hover:bg-white transition-colors whitespace-pre"
                        />
                         <div className="flex justify-between items-center mt-3">
                            <span className="text-xs text-slate-400">Supports TSV (Tab) & CSV</span>
                            {csvText && (
                                <button onClick={() => { setCsvText(''); setPreview([]); }} className="text-xs text-red-500 hover:text-red-700 flex items-center">
                                    <Trash2 size={12} className="mr-1"/> Clear
                                </button>
                            )}
                         </div>
                    </div>

                    {/* Preview Side */}
                    <div className="w-full md:w-1/2 p-6 bg-slate-50/30 flex flex-col">
                        <div className="flex justify-between items-center mb-3">
                             <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Preview ({preview.length} Valid Rows)</h4>
                             {preview.length > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Ready to Map</span>}
                        </div>
                        
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 shadow-sm relative">
                             {preview.length === 0 ? (
                                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                                     <FileSpreadsheet size={48} className="mb-2 opacity-20" />
                                     <p className="text-sm font-medium">Waiting for data...</p>
                                 </div>
                             ) : (
                                <div className="overflow-y-auto absolute inset-0 custom-scrollbar">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-3 w-1/3">Extracted Slug</th>
                                                <th className="p-3 w-1/3">New Product</th>
                                                <th className="p-3 w-1/3 text-right">ASIN</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {preview.map((p, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-3 font-mono text-slate-600 truncate max-w-[120px]" title={p.slug}>
                                                        {p.slug}
                                                    </td>
                                                    <td className="p-3 text-slate-900 font-medium truncate max-w-[120px]" title={p.mapping.productName}>
                                                        {p.mapping.productName}
                                                    </td>
                                                    <td className="p-3 font-mono text-emerald-600 text-right">
                                                        {p.mapping.asin}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             )}
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={() => { onMap(preview); onClose(); }}
                                disabled={preview.length === 0}
                                className="flex items-center px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <Upload size={18} className="mr-2" /> 
                                Apply {preview.length} Mappings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DecayAnalysis: React.FC<DecayAnalysisProps> = ({ data, processedItems = [], onProceed }) => {
  const [localData, setLocalData] = useState(data); // Store local data to handle updates
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: keyof AnalyzedUrl; direction: 'asc' | 'desc' }>({ key: 'decayScore', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState<string | null>(null);
  
  // Mapping State
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);

  // Filtering State
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Derived Set of Processed IDs for quick lookup (exclude errors so they can be retried if needed, but standard flow includes them)
  const processedIds = useMemo(() => {
      return new Set(processedItems.filter(p => p.status !== 'error').map(p => p.id));
  }, [processedItems]);

  // Automatic Deselection & Notification Logic
  useEffect(() => {
    // Check if any selected items are already in the processed list
    const intersection = [...selectedIds].filter(id => processedIds.has(id));
    
    if (intersection.length > 0) {
        const newSelected = new Set(selectedIds);
        intersection.forEach(id => newSelected.delete(id));
        setSelectedIds(newSelected);
        
        setNotification(`${intersection.length} items were automatically deselected because they have already been processed.`);
        setTimeout(() => setNotification(null), 8000); // Hide after 8s
    }
  }, [selectedIds, processedIds]);

  // Initialize selection with high decay items once
  React.useEffect(() => {
    if (selectedIds.size === 0 && data.length > 0) {
        // Initial auto-select: exclude already processed items
        const initialSelection = new Set(
            localData
                .filter(item => item.decayScore > 50 && !processedIds.has(item.id))
                .map(item => item.id)
        );
        setSelectedIds(initialSelection);
    }
  }, []);

  const allReasons = useMemo(() => {
    const reasons = new Set<string>();
    localData.forEach(item => item.reasons.forEach(r => reasons.add(r)));
    return Array.from(reasons).sort();
  }, [localData]);

  const filteredData = useMemo(() => {
    if (selectedReasons.size === 0) return localData;
    return localData.filter(item => 
        item.reasons.some(r => selectedReasons.has(r))
    );
  }, [localData, selectedReasons]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [filteredData, sortConfig]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      // Only select items that are NOT processed
      const availableIds = filteredData
        .filter(d => !processedIds.has(d.id))
        .map(d => d.id);
      setSelectedIds(new Set(availableIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    if (processedIds.has(id)) return; // Prevent selection of processed items
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const requestSort = (key: keyof AnalyzedUrl) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleReasonFilter = (reason: string) => {
    const newReasons = new Set(selectedReasons);
    if (newReasons.has(reason)) {
      newReasons.delete(reason);
    } else {
      newReasons.add(reason);
    }
    setSelectedReasons(newReasons);
    setCurrentPage(1); // Reset to page 1 on filter
  };

  const handleApplyMapping = (mappings: {slug: string, mapping: ManualMapping}[]) => {
      const newData = [...localData];
      const newSelected = new Set(selectedIds);
      let matchCount = 0;

      mappings.forEach(m => {
          // Normalize the map slug (ensure no leading/trailing slashes for comparison)
          const mapSlug = m.slug.toLowerCase().replace(/^\/|\/$/g, '');

          // Try exact match or containment
          // We look for the item where the slug (normalized) includes the map slug or vice versa
          const idx = newData.findIndex(item => {
              const itemSlug = item.slug.toLowerCase().replace(/^\/|\/$/g, '');
              return itemSlug === mapSlug || itemSlug.endsWith(mapSlug) || mapSlug.endsWith(itemSlug);
          });

          if (idx !== -1) {
              const item = newData[idx];
              newData[idx] = {
                  ...item,
                  manualMapping: m.mapping
              };
              
              // Only auto-select if NOT already processed
              if (!processedIds.has(item.id)) {
                  newSelected.add(item.id);
              }
              matchCount++;
          }
      });

      setLocalData(newData);
      setSelectedIds(newSelected);
      
      // Force refresh/notify user
      if (matchCount > 0) {
          // Optional: Filter view to show mapped items?
          // alert(`Successfully mapped ${matchCount} items!`);
      } else {
          alert("No matching slugs found in your current sitemap. Please check the URL/Slug format.");
      }
  };

  const handleProceed = () => {
     // Propagate manual mappings back to the parent data reference (Hackish but effective for this architecture)
     localData.forEach(localItem => {
         if (localItem.manualMapping) {
             const originalItem = data.find(d => d.id === localItem.id);
             if (originalItem) {
                 originalItem.manualMapping = localItem.manualMapping;
             }
         }
     });
     
     // Final safeguard: Filter out any processed IDs just in case
     const safeSelectedIds = Array.from(selectedIds).filter(id => !processedIds.has(id));
     onProceed(safeSelectedIds);
  };

  const chartData = [
    { name: 'Low Risk', value: localData.filter(x => x.decayScore < 30).length, color: '#22c55e' },
    { name: 'Medium Risk', value: localData.filter(x => x.decayScore >= 30 && x.decayScore < 60).length, color: '#eab308' },
    { name: 'High Risk', value: localData.filter(x => x.decayScore >= 60).length, color: '#ef4444' },
  ];

  const highRiskCount = localData.filter(d => d.decayScore > 50).length;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <MappingModal isOpen={isMappingModalOpen} onClose={() => setIsMappingModalOpen(false)} onMap={handleApplyMapping} />
      
      {/* Header Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
        {/* Chart Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm col-span-2 relative overflow-hidden group">
           <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center">
                        <BarChart3 size={18} className="mr-2 text-brand-600" />
                        Decay Distribution Analysis
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Risk assessment breakdown across {localData.length} URLs</p>
                </div>
           </div>
           
           <div className="h-32 w-full relative z-10">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, bottom: 0, top: 0 }}>
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fontWeight: 500, fill: '#64748b'}} axisLine={false} tickLine={false} />
                 <Tooltip 
                    cursor={{fill: 'transparent'}} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                 />
                 <Bar dataKey="value" barSize={24} radius={[0, 6, 6, 0]}>
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Action Card */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-8 rounded-3xl border border-brand-600 shadow-lg shadow-brand-500/20 text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <h3 className="text-brand-100 font-medium mb-2 relative z-10 flex items-center">
                <AlertCircle size={16} className="mr-2" />
                Critical Updates Needed
            </h3>
            <div className="flex items-baseline space-x-2 relative z-10">
                <span className="text-5xl font-bold tracking-tight">{highRiskCount}</span>
                <span className="text-lg text-brand-200 font-medium">URLs</span>
            </div>
            <p className="text-sm text-brand-100/80 mt-4 leading-relaxed relative z-10">
                {Math.round((highRiskCount / Math.max(1, localData.length)) * 100)}% of your content is showing significant signs of decay.
            </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        
        {/* Automatic Deselection Notification */}
        {notification && (
            <div className="absolute top-16 left-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl shadow-lg flex items-start justify-between">
                    <div className="flex items-center">
                        <ShieldCheck size={18} className="mr-3 text-amber-600 flex-shrink-0" />
                        <span className="text-sm font-medium">{notification}</span>
                    </div>
                    <button onClick={() => setNotification(null)} className="text-amber-500 hover:text-amber-700">
                        <X size={16} />
                    </button>
                </div>
            </div>
        )}

        {/* Toolbar */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white sticky top-0 z-20">
            <div className="flex items-center space-x-4">
                <div className="relative">
                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                            isFilterOpen || selectedReasons.size > 0 
                            ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-inner' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                        }`}
                    >
                        <Filter size={16} />
                        <span>Filter</span>
                        {selectedReasons.size > 0 && (
                            <span className="ml-1 bg-brand-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {selectedReasons.size}
                            </span>
                        )}
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsFilterOpen(false)} />
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-30 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-50">
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Filter by Reason</span>
                                    {selectedReasons.size > 0 && (
                                        <button 
                                            onClick={() => setSelectedReasons(new Set())}
                                            className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center bg-red-50 px-2 py-1 rounded-md transition-colors"
                                        >
                                            <X size={10} className="mr-1" /> Clear
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                                    {allReasons.map(reason => (
                                        <label key={reason} className="flex items-start p-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors">
                                            <div className="relative flex items-center mt-0.5">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedReasons.has(reason)}
                                                    onChange={() => toggleReasonFilter(reason)}
                                                    className="peer h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 transition duration-150 ease-in-out"
                                                />
                                            </div>
                                            <span className="ml-3 text-sm text-slate-600 group-hover:text-slate-900 leading-tight peer-checked:text-brand-700 peer-checked:font-medium">
                                                {reason}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={() => setIsMappingModalOpen(true)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors"
                >
                    <FileSpreadsheet size={16} />
                    <span>Upload Mapping</span>
                </button>

                <div className="h-6 w-px bg-slate-200"></div>

                <span className="text-sm font-medium text-slate-500">
                    {filteredData.length} URLs
                </span>
            </div>

            <button
                onClick={handleProceed}
                disabled={selectedIds.size === 0}
                className="group flex items-center px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300 transform active:scale-95"
            >
                Process Selected ({selectedIds.size})
                <ArrowUpRight size={16} className="ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
        </div>

        {/* Table Content */}
        <div className="overflow-y-auto flex-1 relative bg-slate-50/50">
            <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                <th scope="col" className="px-6 py-4 text-left w-16">
                    <input
                    type="checkbox"
                    className="rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                    checked={filteredData.length > 0 && filteredData.filter(d => !processedIds.has(d.id)).every(d => selectedIds.has(d.id))}
                    onChange={handleSelectAll}
                    />
                </th>
                <th
                    scope="col"
                    className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-brand-600 transition-colors select-none group"
                    onClick={() => requestSort('decayScore')}
                >
                    <div className="flex items-center">
                    Decay Score
                    <span className="ml-1 text-slate-300 group-hover:text-brand-500 transition-colors">
                        {sortConfig.key === 'decayScore' && (
                            sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>
                        )}
                    </span>
                    </div>
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    URL Slug
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Detected Decay Factors
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Last Modified
                </th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
                {sortedData.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                    <Filter size={20} className="text-slate-300" />
                                </div>
                                <p>No URLs match your current filters.</p>
                            </div>
                        </td>
                     </tr>
                ) : (
                    paginatedData.map((row) => {
                        const isSelected = selectedIds.has(row.id);
                        const isProcessed = processedIds.has(row.id);

                        return (
                            <tr 
                                key={row.id} 
                                className={`transition-colors duration-150 ${
                                    isProcessed ? 'bg-slate-50/50 grayscale opacity-70' :
                                    isSelected ? 'bg-brand-50/50' : 'hover:bg-slate-50'
                                }`}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).tagName !== 'INPUT') {
                                        handleSelectRow(row.id);
                                    }
                                }}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center h-full" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="rounded-md border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            checked={isSelected}
                                            disabled={isProcessed}
                                            onChange={() => handleSelectRow(row.id)}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                                        isProcessed ? 'bg-slate-200 text-slate-500 border border-slate-300' :
                                        row.decayScore > 60 ? 'bg-red-50 text-red-600 border border-red-100' :
                                        row.decayScore > 30 ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    }`}>
                                        {row.decayScore}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col">
                                        <div className="text-sm font-semibold text-slate-700 truncate max-w-xs hover:text-brand-600 transition-colors flex items-center" title={row.slug}>
                                            /{row.slug}
                                            {row.manualMapping && (
                                                <span className="ml-2 flex items-center text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200" title={`Mapped to: ${row.manualMapping.productName}`}>
                                                    <ShieldCheck size={10} className="mr-1" /> Mapped
                                                </span>
                                            )}
                                        </div>
                                        {isProcessed && (
                                            <div className="mt-1 flex items-center text-[10px] font-bold text-slate-400">
                                                <CheckSquare size={10} className="mr-1" /> Already Processed
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col space-y-1.5">
                                        {row.reasons.length > 0 ? (
                                            row.reasons.slice(0, 2).map((reason, idx) => (
                                                <span key={idx} className="inline-flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md w-fit">
                                                    <AlertCircle size={10} className="mr-1.5 text-slate-400" /> 
                                                    <span className="truncate max-w-[200px]">{reason}</span>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-emerald-600 flex items-center font-medium">
                                                <CheckCircle size={12} className="mr-1.5" /> Healthy
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                    {new Date(row.lastmod).toLocaleDateString()}
                                </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
            </table>
        </div>

        {/* Pagination Controls */}
        <div className="border-t border-slate-100 bg-slate-50 p-3 flex items-center justify-between">
            <div className="text-xs text-slate-500 pl-2">
                Page <span className="font-bold text-slate-900">{currentPage}</span> of {totalPages || 1}
            </div>
            <div className="flex space-x-2">
                <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-brand-600 hover:border-brand-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft size={16} />
                </button>
                <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-brand-600 hover:border-brand-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
