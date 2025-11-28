
import React, { useState } from 'react';
import { Search, Upload, AlertTriangle, FileCode, ArrowRight, Globe, UploadCloud, Wifi, ShieldAlert, Terminal, ExternalLink } from 'lucide-react';
import { SitemapUrl } from '../types';
import { parseSitemapXml } from '../services/sitemapService';

interface SitemapIngestProps {
  onIngest: (urls: SitemapUrl[]) => void;
}

export const SitemapIngest: React.FC<SitemapIngestProps> = ({ onIngest }) => {
  const [inputMethod, setInputMethod] = useState<'url' | 'paste'>('url');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string>('');

  const fetchWithTimeout = async (url: string, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  const handleFetch = async () => {
    setIsLoading(true);
    setError(null);
    setDebugInfo('');
    setStatusMessage('Initiating connection...');

    try {
      let xmlContent = inputValue.trim();
      
      // SMART DETECTION: URL vs Paste
      const isUrlLike = xmlContent.match(/^https?:\/\//i) && !xmlContent.includes('<') && !xmlContent.includes('\n');
      const shouldFetch = inputMethod === 'url' || isUrlLike;

      if (shouldFetch) {
        let targetUrl = xmlContent;
        if (!targetUrl.match(/^https?:\/\//i)) {
            targetUrl = 'https://' + targetUrl;
        }

        // 5-Stage Proxy Rotation Strategy
        const strategies = [
            { 
                name: 'Direct Connection', 
                url: targetUrl 
            },
            { 
                name: 'Routing Node Alpha', 
                url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` 
            },
            { 
                name: 'Routing Node Beta', 
                url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}` 
            },
            { 
                name: 'Routing Node Gamma', 
                url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}` 
            },
            {
                name: 'Routing Node Delta',
                url: `https://thingproxy.freeboard.io/fetch/${targetUrl}`
            }
        ];

        let fetched = false;
        let fetchErrorDetails = [];

        for (const strategy of strategies) {
            try {
                setStatusMessage(`Attempting via ${strategy.name}...`);
                const res = await fetchWithTimeout(strategy.url, 8000);
                
                if (!res.ok) {
                    throw new Error(`Status ${res.status}`);
                }
                
                const text = await res.text();
                
                // Validate content length to ensure we didn't just get an empty proxy response
                if (!text || text.length < 50) {
                    throw new Error("Response too empty");
                }

                xmlContent = text;
                fetched = true;
                setStatusMessage(`${strategy.name} successful.`);
                break; // Exit loop on success
            } catch (e: any) {
                console.warn(`${strategy.name} failed:`, e.message);
                fetchErrorDetails.push(`${strategy.name}: ${e.message}`);
            }
        }

        if (!fetched) {
             // AUTO-FAILOVER HANDLER
             setInputMethod('paste');
             
             // Attempt to open the URL for the user
             try {
                window.open(targetUrl, '_blank');
             } catch (e) {
                console.error("Popup blocked", e);
             }

             throw new Error("Firewall Detected. We have opened the sitemap in a new tab for you. Please Copy (Ctrl+A, Ctrl+C) the content and Paste it below.");
        }
      }

      setStatusMessage('Scanning content for URLs...');
      
      // Store snippet for debug if parsing fails
      setDebugInfo(xmlContent.substring(0, 300));

      const urls = parseSitemapXml(xmlContent);
      
      if (urls.length === 0) {
          throw new Error("No valid URLs found in the content.");
      }
      
      onIngest(urls);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
        const text = await file.text();
        setInputMethod('paste');
        setInputValue(text);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        
        <div className="bg-slate-50 border-b border-slate-100 p-10 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-50"></div>
           <div className="relative z-10">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center mx-auto mb-6 transform rotate-3 transition-transform hover:rotate-0 duration-500">
                    <Search size={36} className="text-brand-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">Import Content Sitemap</h2>
                <p className="text-slate-500 text-lg max-w-md mx-auto">
                    Connect your content source to begin the automated decay analysis and restoration process.
                </p>
           </div>
        </div>

        <div className="p-8 md:p-10">
            <div className="flex justify-center mb-8">
                <div className="bg-slate-100 p-1.5 rounded-xl flex shadow-inner">
                    <button
                        onClick={() => setInputMethod('url')}
                        className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        inputMethod === 'url' 
                            ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Globe size={16} className="mr-2" />
                        Fetch from URL
                    </button>
                    <button
                        onClick={() => setInputMethod('paste')}
                        className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        inputMethod === 'paste' 
                            ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <FileCode size={16} className="mr-2" />
                        Paste / Drop XML
                    </button>
                </div>
            </div>

            <div className="mb-8">
                {inputMethod === 'url' ? (
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Wifi className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        </div>
                        <input
                            type="url"
                            className="block w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all duration-200 text-slate-900"
                            placeholder="https://site.com/sitemap.xml"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                        />
                        <p className="text-xs text-slate-500 mt-3 flex items-center ml-1">
                            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></span>
                            Multi-Node Proxy Routing Active (5 Strategies)
                        </p>
                    </div>
                ) : (
                    <div 
                        className={`relative group transition-all duration-300 ${isDragging ? 'scale-[1.02]' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                    >
                        <div className="absolute top-4 left-4 pointer-events-none">
                            <FileCode className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        </div>
                        <textarea
                            className={`block w-full pl-12 pr-4 py-4 border rounded-2xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition-all duration-200 h-48 font-mono text-sm leading-relaxed resize-none ${
                                isDragging ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20' : 'border-slate-200'
                            }`}
                            placeholder={isDragging ? "Drop file here..." : 'Paste your XML here... (Ctrl+V)'}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {error && (
                <div className={`mb-6 border p-4 rounded-xl animate-in fade-in slide-in-from-top-2 shadow-sm ${
                    error.includes("Firewall Detected") 
                    ? 'bg-amber-50 border-amber-200 text-amber-800' 
                    : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                    <div className="flex items-start">
                        <div className={`p-2 rounded-full mr-3 shrink-0 ${
                            error.includes("Firewall Detected") ? 'bg-amber-100' : 'bg-red-100'
                        }`}>
                             <ShieldAlert className={`h-5 w-5 ${
                                 error.includes("Firewall Detected") ? 'text-amber-600' : 'text-red-600'
                             }`} />
                        </div>
                        <div className="w-full">
                            <h4 className="font-bold text-sm mb-1">
                                {error.includes("Firewall Detected") ? "Manual Action Required" : "Ingestion Failed"}
                            </h4>
                            <p className="text-sm leading-relaxed opacity-90">{error}</p>
                            
                            {debugInfo && !error.includes("Firewall Detected") && (
                                <div className="mt-3 bg-white/50 rounded p-3 border border-black/5">
                                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1 flex items-center">
                                        <Terminal size={10} className="mr-1" /> Response Preview
                                    </p>
                                    <p className="font-mono text-xs break-all">{debugInfo}...</p>
                                </div>
                            )}

                            {inputMethod === 'url' && !error.includes("Firewall Detected") && (
                                <button 
                                    onClick={() => setInputMethod('paste')}
                                    className="mt-3 text-xs font-bold bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                    Switch to Manual Paste
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={handleFetch}
                disabled={isLoading || !inputValue}
                className="w-full group relative flex justify-center py-4 px-6 border border-transparent rounded-2xl shadow-lg shadow-brand-500/30 text-base font-bold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 overflow-hidden"
            >
                <div className="absolute inset-0 w-full h-full bg-white/20 group-hover:translate-x-full transition-transform duration-500 ease-out -translate-x-full transform skew-x-12"></div>
                <span className="relative flex items-center">
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {statusMessage}
                        </>
                    ) : (
                        <>
                            Start Analysis <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </span>
            </button>
        </div>
      </div>
    </div>
  );
};
