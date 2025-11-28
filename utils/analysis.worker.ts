// --- src/utils/analysis.worker.ts ---

import type { PostHealth, SemanticNode } from '../types';

// Simplified tokenizer for worker (no DOM access needed for pure text)
const tokenize = (text: string): Set<string> => {
  const stopWords = new Set(['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'with', 'on', 'at', 'by']);
  return new Set(
    text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w))
  );
};

// Listen for messages from the main thread
self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'ANALYZE_HEALTH') {
    const { content, modified, siteUrl } = payload;
    
    // Regex-based parsing is much faster and CPU efficient than DOMParser for huge datasets
    const wordCount = (content.match(/\b\w+\b/g) || []).length;
    const hasSchema = content.includes('application/ld+json');
    const hasVerdict = /verdict|conclusion|summary|pros and cons|bottom line/i.test(content);
    
    // Extract links via Regex
    const linkRegex = /href=["'](.*?)["']/g;
    let match;
    let internal = 0;
    let external = 0;
    const cleanSite = siteUrl.replace(/\/$/, '');

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      if (url.includes(cleanSite) || url.startsWith('/')) {
        internal++;
      } else if (url.startsWith('http')) {
        external++;
      }
    }

    const diffDays = Math.ceil(Math.abs(Date.now() - new Date(modified).getTime()) / (86400000));

    // Calculate Scores
    let seo = 100;
    let aeo = 100;

    if (diffDays > 365) seo -= 20;
    if (wordCount < 1000) seo -= 15;
    if (internal < 3) seo -= 15;
    if (external < 3) seo -= 10; // Penalty for low citations
    if (!hasSchema) seo -= 10;

    if (!hasVerdict) aeo -= 30;
    if (wordCount < 1500) aeo -= 10;
    if (!hasSchema) aeo -= 25;

    const result: PostHealth = {
      id: payload.id,
      score: Math.max(0, seo),
      aeoScore: Math.max(0, aeo),
      status: 'idle',
      metrics: {
        wordCount,
        hasSchema,
        hasVerdict,
        brokenMedia: 0,
        internalLinks: internal,
        externalLinks: external,
        entityDensity: 0, // Simplified for worker speed
        lastUpdatedDayCount: diffDays
      }
    };

    self.postMessage({ type: 'HEALTH_RESULT', result });
  }

  if (type === 'BUILD_MESH') {
    const { posts } = payload;
    const nodes: SemanticNode[] = posts.map((p: any) => ({
      id: p.id,
      title: p.title.rendered,
      url: p.link,
      tokens: Array.from(tokenize(p.title.rendered + " " + p.slug))
    }));
    self.postMessage({ type: 'MESH_RESULT', nodes });
  }
};