import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WPConnection, WPPostHeader, WPPostFull, PostHealth, SemanticNode, AIConfig, AIAnalysisResult, ProcessedItem } from './types';
import { fetchAllPostHeaders, fetchPostContent, updatePostRemote } from './services/wordpressService';
import { stripHtmlPreservingStructure, tokenize, calculateRelevance, parseHealth, calculateScore } from './utils/helpers';
import { analyzeAndGenerateAssets } from './services/aiService';
import { searchSerper } from './services/serperService';
import ConnectModal from './components/ConnectModal';
import PostList from './components/PostList';
import { ReviewResults } from './components/ReviewResults';
import { SettingsModal } from './components/SettingsModal';
import { Network, BrainCircuit, Settings, DownloadCloud, Square, ArrowLeft } from 'lucide-react';
import { DEFAULT_MODELS } from './constants';

const WORKER_CODE = `
const tokenize = (text) => {
  const stopWords = new Set(['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'with', 'on', 'at', 'by', 'a', 'an']);
  return new Set(
    text.toLowerCase().replace(/[^\\w\\s]/g, '').split(/\\s+/).filter(w => w.length > 2 && !stopWords.has(w))
  );
};
self.onmessage = (e) => {
  const { type, payload } = e.data;
  
  if (type === 'ANALYZE_HEALTH') {
    const { id, content, modified, siteUrl } = payload;
    
    // Fast Regex Analysis for Performance
    const wordCount = (content.match(/\\b\\w+\\b/g) || []).length;
    const hasSchema = content.includes('application/ld+json');
    const hasVerdict = /verdict|conclusion|summary|pros and cons|bottom line/i.test(content);
    
    // Link Analysis via Regex to avoid DOM overhead in worker
    const linkRegex = /href=["'](.*?)["']/g;
    let match;
    let internal = 0;
    let external = 0;
    const cleanSite = siteUrl.replace(/\\/$/, '');

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      if (url.includes(cleanSite) || url.startsWith('/')) {
        internal++;
      } else if (url.startsWith('http')) {
        external++;
      }
    }

    const diffDays = Math.ceil(Math.abs(Date.now() - new Date(modified).getTime()) / (86400000));

    // Scoring Logic
    let seo = 100;
    let aeo = 100;

    if (diffDays > 365) seo -= 20;
    if (wordCount < 1000) seo -= 15;
    if (internal < 3) seo -= 15;
    if (external < 3) seo -= 10;
    if (!hasSchema) seo -= 10;

    if (!hasVerdict) aeo -= 30;
    if (wordCount < 1500) aeo -= 10;
    if (!hasSchema) aeo -= 25;

    const result = {
      id,
      score: Math.max(0, seo),
      aeoScore: Math.max(0, aeo),
      status: 'idle', // Processed
      metrics: {
        wordCount,
        hasSchema,
        hasVerdict,
        brokenMedia: 0,
        internalLinks: internal,
        externalLinks: external,
        entityDensity: 0,
        lastUpdatedDayCount: diffDays
      }
    };

    self.postMessage({ type: 'HEALTH_RESULT', result });
  }

  if (type === 'MESH_RESULT') {
    const { posts } = payload;
    const nodes = posts.map((p) => ({
      id: p.id,
      title: p.title.rendered,
      url: p.link,
      tokens: Array.from(tokenize(p.title.rendered + " " + p.slug))
    }));
    self.postMessage({ type: 'MESH_RESULT', nodes });
  }
};
`;

// --- SOTA Schema Generator ---
const generateEntitySchema = (
  post: WPPostFull | WPPostHeader, 
  assets: AIAnalysisResult, 
  siteUrl: string
) => {
  const cleanPrice = assets.newProductSpecs?.price?.replace(/[^0-9.]/g, '') || '99.99';
  
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${post.link}#article`,
        "headline": assets.newTitle,
        "dateModified": new Date().toISOString(),
        "description": assets.metaDescription,
        "mainEntityOfPage": { "@id": post.link },
        "author": { "@type": "Person", "name": "Expert Review Team" },
        "publisher": { "@type": "Organization", "name": "NeuralMesh Optimized" },
        "about": {
          "@type": "Product",
          "name": assets.identifiedNewProduct,
          "description": assets.blufSentence,
          "isSimilarTo": {
             "@type": "Product",
             "name": assets.detectedOldProduct,
             "disambiguatingDescription": "Previous generation model"
          },
          "offers": {
            "@type": "Offer",
            "price": cleanPrice,
            "priceCurrency": "USD",
            "availability": "https://schema.org/InStock"
          },
          "aggregateRating": {
             "@type": "AggregateRating",
             "ratingValue": assets.newProductSpecs?.rating || 4.5,
             "reviewCount": assets.newProductSpecs?.reviewCount || 10
          }
        }
      },
      {
        "@type": "FAQPage",
        "@id": `${post.link}#faq`,
        "mainEntity": (assets.faqHTML.match(/<summary>(.*?)<\/summary>[\s\S]*?<p>(.*?)<\/p>/g) || []).map(block => {
            const qMatch = block.match(/<summary>(.*?)<\/summary>/);
            const aMatch = block.match(/<p>(.*?)<\/p>/);
            return {
                "@type": "Question",
                "name": qMatch ? qMatch[1] : "Question",
                "acceptedAnswer": { "@type": "Answer", "text": aMatch ? aMatch[1] : "Answer" }
            };
        })
      }
    ]
  });
};

const App: React.FC = () => {
  const [connection, setConnection] = useState<WPConnection | null>(null);
  const [posts, setPosts] = useState<WPPostHeader[]>([]);
  const [healthData, setHealthData] = useState<Record<number, PostHealth>>({});
  const [queue, setQueue] = useState<number[]>([]);
  const [processing, setProcessing] = useState<number[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [viewMode, setViewMode] = useState<'dashboard' | 'review'>('dashboard');
  
  const [aiConfig, setAiConfig] = useState<AIConfig>({
      provider: 'gemini',
      apiKey: '',
      model: DEFAULT_MODELS['gemini'],
      concurrency: 4, 
      serperApiKey: ''
  });

  const [semanticNodes, setSemanticNodes] = useState<SemanticNode[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'MESH_RESULT') {
        setSemanticNodes(e.data.nodes);
        setLoadingMsg('');
      } else if (e.data.type === 'HEALTH_RESULT') {
        const result = e.data.result;
        setHealthData(prev => ({
            ...prev,
            [result.id]: {
                ...prev[result.id],
                ...result,
                status: 'idle' 
            }
        }));
      }
    };
    return () => { workerRef.current?.terminate(); URL.revokeObjectURL(workerUrl); };
  }, []);

  const processQueue = useCallback(async () => {
    const maxConcurrency = aiConfig.concurrency || 4;
    if (!connection || queue.length === 0 || processing.length >= maxConcurrency) return;

    const slots = maxConcurrency - processing.length;
    const batch = queue.slice(0, slots);
    
    setQueue(prev => prev.slice(batch.length));
    setProcessing(prev => [...prev, ...batch]);

    batch.forEach(async (id) => {
        const safetyTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Process Timeout (90s)")), 90000)
        );

        const task = async () => {
            try {
                setHealthData(prev => ({ ...prev, [id]: { ...prev[id], status: 'scanning' } }));
                
                const post = await fetchPostContent(connection, id);
                const cleanText = stripHtmlPreservingStructure(post.content.rendered);
                
                const targetTokens = tokenize(post.title.rendered);
                
                // --- SOTA MESH BUILDER ---
                // 1. Sort by Semantic Relevance
                let meshNeighbors: SemanticNode[] = semanticNodes
                    .filter(n => n.id !== id)
                    .map(node => ({ ...node, relevance: calculateRelevance(targetTokens, node.tokens) }))
                    .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
                
                // 2. "Fill-Gap" Logic: Ensure AI ALWAYS has 50 candidates
                // This guarantees the "Neural Mesh" is never empty, allowing the AI 
                // to fulfill the "8-12 links" quota even if semantic relevance is low.
                if (meshNeighbors.length < 50) {
                     const existingIds = new Set(meshNeighbors.map(n => n.id));
                     // Prefer recent posts (higher IDs) for fillers as they are likely more current
                     const fillers = semanticNodes
                        .filter(n => n.id !== id && !existingIds.has(n.id))
                        .sort((a, b) => b.id - a.id) // Sort by newest
                        .slice(0, 50 - meshNeighbors.length);
                     meshNeighbors = [...meshNeighbors, ...fillers];
                }
                
                // 3. Cap at 50 to fit Context Window efficiently
                meshNeighbors = meshNeighbors.slice(0, 50);

                let serperData = { organics: [], paa: [] };
                if (aiConfig.serperApiKey) {
                    await new Promise(r => setTimeout(r, 1000));
                    serperData = await searchSerper(post.title.rendered, aiConfig.serperApiKey);
                }

                setHealthData(prev => ({ ...prev, [id]: { ...prev[id], status: 'optimizing' } }));

                const assets = await analyzeAndGenerateAssets(
                    post.title.rendered, cleanText, meshNeighbors, serperData.organics, serperData.paa, aiConfig
                );

                // SOTA CSS INJECTION (Portable)
                const SOTA_STYLES = `
                <style>
                  .sota-article { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.7; color: #334155; }
                  .sota-article h2 { font-size: 1.8rem; font-weight: 800; color: #0f172a; margin-top: 3.5rem; margin-bottom: 1.5rem; letter-spacing: -0.02em; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
                  .sota-article h3 { font-size: 1.4rem; font-weight: 700; color: #1e293b; margin-top: 2.5rem; margin-bottom: 1rem; }
                  .sota-article p { margin-bottom: 1.5rem; font-size: 1.125rem; }
                  .sota-article ul { margin-bottom: 1.5rem; padding-left: 1.5rem; }
                  .sota-article li { margin-bottom: 0.75rem; position: relative; font-size: 1.1rem; }
                  .sota-text-highlight { background: #fef9c3; padding: 0 4px; border-radius: 4px; font-weight: 600; color: #854d0e; }
                  .sota-internal-link { color: #2563eb; text-decoration: none; font-weight: 700; border-bottom: 2px solid #bfdbfe; transition: all 0.2s; }
                  .sota-internal-link:hover { background: #eff6ff; border-bottom-color: #2563eb; }
                  .sota-table-wrapper { overflow-x: auto; border-radius: 16px; border: 1px solid #e2e8f0; margin: 3rem 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                  .sota-article table { width: 100%; border-collapse: collapse; background: white; text-align: left; }
                  .sota-article th { background: #f8fafc; padding: 18px 24px; font-weight: 800; color: #475569; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
                  .sota-article td { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 1.05rem; }
                  .sota-buy-button:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3); }
                  details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 16px; padding: 24px; }
                  summary { font-weight: 700; color: #0f172a; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between; font-size: 1.2rem; }
                  details[open] summary { margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; }
                </style>
                `;

                const finalHTML = `
                    ${SOTA_STYLES}
                    <div class="sota-article" data-aeo-score="${assets.verdictData.score}">
                        
                        <!-- BLUF SECTION (Hormozi Style Hook) -->
                        <section style="background: linear-gradient(135deg, #eff6ff 0%, #fff 100%); border-left: 8px solid #2563eb; padding: 40px; margin-bottom: 50px; border-radius: 0 16px 16px 0; box-shadow: 0 10px 30px -10px rgba(37, 99, 235, 0.1);">
                            <p style="font-size: 0.9rem; font-weight: 900; text-transform: uppercase; color: #2563eb; letter-spacing: 2px; margin-bottom: 16px;">Bottom Line Up Front</p>
                            <h2 style="font-size: 2rem; font-weight: 900; color: #1e3a8a; margin: 0 0 20px 0; line-height: 1.2; border:none; padding:0;">${assets.blufSentence}</h2>
                            <div style="font-size: 1.25rem; color: #334155; font-weight: 500; line-height: 1.6;">${assets.sgeSummaryHTML}</div>
                        </section>

                        <!-- SOTA PRODUCT BOX -->
                        ${assets.productBoxHTML}

                        <!-- COMPARISON TABLE -->
                        ${assets.comparisonTableHTML ? `
                            <div class="sota-table-wrapper">
                                <div style="padding: 24px 30px; background: #fff; border-bottom: 1px solid #e2e8f0;">
                                    <h3 style="margin:0; font-size:1.2rem; display:flex; align-items:center;">
                                        <span style="background:#f1f5f9; padding:6px 10px; border-radius:8px; font-size:0.8rem; margin-right:16px; color:#64748b; font-weight:800;">VS</span>
                                        ${assets.detectedOldProduct} vs. ${assets.identifiedNewProduct}
                                    </h3>
                                </div>
                                ${assets.comparisonTableHTML} 
                            </div>
                        ` : ''}
                        
                        <!-- MAIN CONTENT BODY -->
                        <div class="post-body" itemprop="articleBody">
                            ${assets.contentWithLinks}
                        </div>

                        <!-- VERDICT CARD -->
                        <aside style="background: #0f172a; color: white; border-radius: 32px; padding: 50px; margin: 80px 0; position: relative; overflow: hidden; box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.4);">
                            <div style="position: relative; z-index: 10;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
                                    <div>
                                        <h3 style="font-size: 2.5rem; font-weight: 900; margin: 0; color: white; letter-spacing: -1px;">The Verdict</h3>
                                        <p style="color: #94a3b8; margin: 8px 0 0; font-size: 1.2rem;">Is it worth your money?</p>
                                    </div>
                                    <div style="background: #22c55e; color: #022c22; font-size: 2rem; font-weight: 900; padding: 16px 30px; border-radius: 20px;">
                                        ${assets.verdictData.score}
                                    </div>
                                </div>
                                
                                <div style="display: grid; md:grid-cols-2; gap: 50px; margin-bottom: 40px;">
                                    <div>
                                        <h4 style="color: #86efac; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.9rem; margin-bottom: 20px;">Why You Need It</h4>
                                        <ul style="list-style: none; padding: 0;">
                                            ${assets.verdictData.pros.map(p => `<li style="margin-bottom: 16px; padding-left: 32px; position: relative; font-size: 1.15rem;"><span style="position: absolute; left: 0; color: #86efac; font-weight:bold;">✓</span> ${p}</li>`).join('')}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 style="color: #fca5a5; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.9rem; margin-bottom: 20px;">The Dealbreaker</h4>
                                        <ul style="list-style: none; padding: 0;">
                                            ${assets.verdictData.cons.map(c => `<li style="margin-bottom: 16px; padding-left: 32px; position: relative; font-size: 1.15rem;"><span style="position: absolute; left: 0; color: #fca5a5; font-weight:bold;">✕</span> ${c}</li>`).join('')}
                                        </ul>
                                    </div>
                                </div>

                                <p style="font-size: 1.4rem; font-weight: 500; font-style: italic; color: #e2e8f0; border-top: 1px solid #334155; padding-top: 30px; line-height: 1.6;">"${assets.verdictData.summary}"</p>
                            </div>
                        </aside>

                        <!-- FAQ SCHEMA -->
                        <section class="faq-section" itemscope itemtype="https://schema.org/FAQPage">
                            <h3 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 40px; letter-spacing: -0.02em;">Common Questions</h3>
                            ${assets.faqHTML}
                        </section>
                        ${assets.referencesHTML}
                        <script type="application/ld+json">
                            ${generateEntitySchema(post, assets, connection!.url)}
                        </script>
                    </div>
                `;

                // STORE DRAFT with AI Results
                setHealthData(prev => ({
                    ...prev,
                    [id]: { 
                        ...prev[id], 
                        status: 'review_pending', 
                        draftHtml: finalHTML,
                        aiResult: assets,
                        productOverrides: {} // Init empty
                    }
                }));
                
            } catch (e: any) {
                setHealthData(prev => ({ ...prev, [id]: { ...prev[id], status: 'error', log: e.message } }));
            } finally {
                setProcessing(prev => prev.filter(x => x !== id));
            }
        };

        Promise.race([task(), safetyTimeout]).catch(err => {
             setHealthData(prev => ({ ...prev, [id]: { ...prev[id], status: 'error', log: (err as Error).message } }));
             setProcessing(prev => prev.filter(x => x !== id));
        });
    });
  }, [connection, queue, processing, semanticNodes, aiConfig]);

  useEffect(() => { processQueue(); }, [processQueue]);

  // Update a specific item's local state (e.g. adding manual affiliate link)
  const handleUpdateItem = (id: string, updates: Partial<ProcessedItem>) => {
      setHealthData(prev => {
          const numId = parseInt(id);
          if (!prev[numId]) return prev;

          const updatedItem = { ...prev[numId] };
          
          if (updates.productOverrides) {
             updatedItem.productOverrides = updates.productOverrides;
          }
          if (updates.customImageUrl !== undefined) {
            updatedItem.customImageUrl = updates.customImageUrl;
          }
          if (updates.draftHtml !== undefined) {
            updatedItem.draftHtml = updates.draftHtml;
          }
          
          return {
              ...prev,
              [numId]: updatedItem
          };
      });
  };

  // Handle Actual Publish from Review Screen
  const handlePublish = async (id: string, content: string) => {
      if (!connection) return;
      try {
          const numId = parseInt(id);
          const item = healthData[numId];
          
          let finalContent = content;

          // INJECT MANUAL AFFILIATE LINKS (Multi-Product)
          if (item?.productOverrides) {
              Object.entries(item.productOverrides).forEach(([originalUrl, newUrl]) => {
                  const replacementUrl = newUrl as string;
                  if (replacementUrl && replacementUrl.trim() !== '') {
                      // Escape regex characters from the original AI URL
                      const safeOriginal = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                      finalContent = finalContent.replace(new RegExp(safeOriginal, 'g'), replacementUrl);
                  }
              });
              
              // Handle "Global" override if set (fallback for single product posts)
              if (item.productOverrides['global']) {
                   finalContent = finalContent.replace(
                      /href="[^"]*"\s+class="sota-buy-button"/g, 
                      `href="${item.productOverrides['global']}" class="sota-buy-button"`
                  );
              }
          }

          // INJECT MANUAL PRODUCT IMAGE
          if (item?.customImageUrl) {
              finalContent = finalContent.replace(
                  /src="[^"]*placeholder[^"]*"/g,
                  `src="${item.customImageUrl}"`
              ).replace(
                  /class="sota-product-image"/g,
                  `class="sota-product-image" src="${item.customImageUrl}"`
              );
          }

          await updatePostRemote(connection, numId, {
              content: finalContent,
              date: new Date().toISOString()
          });
          
          // Update local state to published
          setHealthData(prev => ({
              ...prev,
              [numId]: { ...prev[numId], status: 'published' }
          }));
      } catch (e: any) {
          throw new Error(e.message);
      }
  };

  const handleConnect = async (conn: WPConnection) => {
    setConnection(conn);
    setAiConfig(prev => ({ ...prev, wpUrl: conn.url, wpUsername: conn.username, wpAppPassword: conn.appPassword }));
    setLoadingMsg('Indexing Headers (Eco-Mode)...');
    try {
      const headers = await fetchAllPostHeaders(conn, (count) => setLoadingMsg(`Indexed ${count} Posts...`));
      setPosts(headers);
      const initialH: Record<number, PostHealth> = {};
      headers.forEach(p => {
        const metrics = parseHealth(null, p.modified, conn.url);
        const scores = calculateScore(metrics);
        initialH[p.id] = { id: p.id, score: scores.seo, aeoScore: scores.aeo, metrics, status: 'idle' };
      });
      setHealthData(initialH);
      setLoadingMsg('Building Semantic Mesh...');
      workerRef.current?.postMessage({ type: 'BUILD_MESH', payload: { posts: headers } });
    } catch (e: any) {
        alert("Connection Failed: " + e.message);
        setLoadingMsg('');
    }
  };

  const startBatch = (ids: number[] = []) => {
    // FIX: Strict check for API key presence to ensure user configuration is used
    if (!aiConfig.apiKey) {
        alert("Please configure your AI Provider API Key in Settings.");
        setIsSettingsOpen(true);
        return;
    }
    const validIds = ids.filter(id => healthData[id]);
    setQueue(prev => [...prev, ...validIds]);
  };

  // Bridge Data for Review View
  const reviewItems: ProcessedItem[] = (Object.values(healthData) as PostHealth[])
    .filter(h => h.status === 'review_pending' || h.status === 'published')
    .map(h => {
        const p = posts.find(post => post.id === h.id);
        return {
            id: h.id.toString(),
            slug: p?.slug || 'unknown',
            status: h.status === 'published' ? 'completed' : 'completed',
            decayScore: 100 - h.score,
            draftHtml: h.draftHtml, 
            aiResult: h.aiResult,   
            productOverrides: h.productOverrides,
            customImageUrl: h.customImageUrl,
            suggestion: h.aiResult ? {
                oldProductName: h.aiResult.detectedOldProduct,
                successorProductName: h.aiResult.identifiedNewProduct,
                verdictSummary: h.aiResult.verdictData.summary,
                intro: h.aiResult.blufSentence,
                pros: h.aiResult.verdictData.pros,
                cons: h.aiResult.verdictData.cons,
                comparisonTable: [], 
                faqs: [],
            } : undefined,
        };
    });

  // Function to scan selected items
  const handleDeepScan = (ids: number[]) => {
      if (!connection) return;
      ids.forEach(id => setHealthData(prev => ({ ...prev, [id]: { ...prev[id], status: 'scanning' } })));

      const BATCH_SIZE = 5; 
      let i = 0;
      
      const scanBatch = async () => {
          if (i >= ids.length) return;
          const batchIds = ids.slice(i, i + BATCH_SIZE);
          
          await Promise.all(batchIds.map(async (id) => {
              try {
                  const fullPost = await fetchPostContent(connection, id);
                  workerRef.current?.postMessage({
                      type: 'ANALYZE_HEALTH',
                      payload: { id, content: fullPost.content.rendered, modified: fullPost.modified, siteUrl: connection.url }
                  });
              } catch (e: any) {
                  setHealthData(prev => ({ ...prev, [id]: { ...prev[id], status: 'error', log: e.message } }));
              }
          }));
          
          i += BATCH_SIZE;
          setTimeout(scanBatch, 50); 
      };
      scanBatch();
  };

  const stopProcessing = () => {
      setQueue([]);
      setProcessing([]);
      setLoadingMsg('');
  };

  if (!connection) return <ConnectModal onConnect={handleConnect} />;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30 pb-20 flex flex-col">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={aiConfig} onSave={setAiConfig} />
      
      <header className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             {viewMode === 'review' && (
                 <button onClick={() => setViewMode('dashboard')} className="mr-2 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                     <ArrowLeft size={18} />
                 </button>
             )}
             <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]">
               <BrainCircuit size={24} fill="currentColor" />
             </div>
             <div>
                <h1 className="font-bold text-xl tracking-tight text-white">Neural<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">Mesh</span></h1>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">AEO SOTA Engine 2026</p>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {loadingMsg && <div className="flex items-center text-xs text-emerald-400 animate-pulse font-mono mr-4"><DownloadCloud size={14} className="mr-2" />{loadingMsg}</div>}
             {queue.length > 0 && <button onClick={stopProcessing} className="flex items-center text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded border border-red-500/50 hover:bg-red-500 hover:text-white transition-all"><Square size={12} fill="currentColor" className="mr-1.5"/> STOP</button>}
             
             {/* View Switcher */}
             <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                 <button 
                    onClick={() => setViewMode('dashboard')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'dashboard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                 >
                    Dashboard
                 </button>
                 <button 
                    onClick={() => setViewMode('review')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center ${viewMode === 'review' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                 >
                    Reviews 
                    {reviewItems.length > 0 && <span className="ml-1.5 bg-white text-indigo-600 px-1.5 rounded-full text-[10px]">{reviewItems.length}</span>}
                 </button>
             </div>

             <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"><Settings size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 w-full flex flex-col">
        
        {viewMode === 'dashboard' ? (
            <>
                <div className="bg-gradient-to-r from-slate-900 to-slate-900/50 border border-white/5 rounded-3xl p-8 mb-10 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shrink-0">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Site Intelligence Mesh</h2>
                        <p className="text-slate-400 max-w-xl leading-relaxed">
                            <span className="text-emerald-400 font-bold">{semanticNodes.length} entities</span> indexed. 
                            Select posts to Deep Scan (Analyze) or Generate Drafts (Boost).
                        </p>
                    </div>
                    <div className="flex items-center gap-4">{queue.length > 0 && <div className="text-xs font-bold text-indigo-400 bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-500/30">Queue: {queue.length}</div>}</div>
                </div>
                <div className="flex-1 min-h-0 relative">
                    <div className="absolute inset-0 overflow-hidden">
                        <PostList 
                            posts={posts} 
                            healthData={healthData} 
                            onOptimize={startBatch} 
                            onScan={handleDeepScan} 
                            isProcessing={queue.length > 0}
                            onReview={(id) => {
                                setViewMode('review');
                            }}
                        />
                    </div>
                </div>
            </>
        ) : (
            <ReviewResults 
                items={reviewItems} 
                config={aiConfig} 
                onOpenSettings={() => setIsSettingsOpen(true)}
                onUpdateItem={handleUpdateItem}
                customPublishHandler={async (item) => {
                    const draft = healthData[parseInt(item.id)]?.draftHtml;
                    if (draft) {
                        await handlePublish(item.id, draft);
                    } else {
                        throw new Error("Draft content missing");
                    }
                }}
            />
        )}

      </main>
    </div>
  );
};

export default App;