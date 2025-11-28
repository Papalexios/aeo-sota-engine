
import { PostHealth, WPPostFull } from '../types';

export const tokenize = (text: string): Set<string> => {
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'by']);
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
};

export const calculateRelevance = (tokensA: Set<string>, tokensB: Set<string>): number => {
  let intersection = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

export const stripHtmlPreservingStructure = (html: string): string => {
  let clean = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "");
  clean = clean.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "");
  clean = clean.replace(/<\/p>|<\/h\d>|<\/div>|<\/li>/gi, "\n");
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  return doc.body.textContent || "";
};

// SOTA Health Parser
export const parseHealth = (post: WPPostFull | null, dateStr: string, siteUrl: string): PostHealth['metrics'] => {
  const diffDays = post ? Math.ceil(Math.abs(new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  if (!post) {
    return {
      wordCount: 0, hasSchema: false, hasVerdict: false, brokenMedia: 0, internalLinks: 0, externalLinks: 0, entityDensity: 0, lastUpdatedDayCount: diffDays
    };
  }

  const doc = new DOMParser().parseFromString(post.content.rendered, 'text/html');
  const text = doc.body.textContent || '';
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');

  const hasSchema = post.content.rendered.includes('application/ld+json');
  const hasVerdict = /verdict|conclusion|summary|pros and cons|bottom line/i.test(text);
  
  const links = Array.from(doc.querySelectorAll('a'));
  const internalLinks = links.filter(a => a.href.includes(cleanSiteUrl) || a.href.startsWith('/')).length;
  const externalLinks = links.filter(a => !a.href.includes(cleanSiteUrl) && !a.href.startsWith('/') && a.href.startsWith('http')).length;

  const words = text.split(/\s+/);
  const capitalized = words.filter(w => /^[A-Z][a-z]+/.test(w)).length;
  const entityDensity = words.length > 0 ? (capitalized / words.length) * 100 : 0;

  return {
    wordCount: words.length,
    hasSchema,
    hasVerdict,
    brokenMedia: 0,
    internalLinks,
    externalLinks, // New Metric
    entityDensity,
    lastUpdatedDayCount: diffDays
  };
};

export const calculateScore = (metrics: PostHealth['metrics']): { seo: number, aeo: number } => {
  let seo = 100;
  let aeo = 100;

  if (metrics.lastUpdatedDayCount > 365) seo -= 20;
  if (metrics.wordCount < 800) seo -= 10;
  if (metrics.internalLinks < 3) seo -= 15;
  if (metrics.externalLinks < 2) seo -= 10; // Penalty for no references
  if (!metrics.hasSchema) seo -= 10;

  if (!metrics.hasVerdict) aeo -= 30;
  if (metrics.entityDensity < 10) aeo -= 20;
  if (metrics.wordCount < 1200) aeo -= 10;
  if (!metrics.hasSchema) aeo -= 25;

  return { seo: Math.max(0, seo), aeo: Math.max(0, aeo) };
};

// --- SOTA Monetization Helpers ---

export const isValidAsin = (text: string): boolean => {
  return /^[B0-9][A-Z0-9]{9}$/.test(text.toUpperCase());
};

export const constructAmazonUrl = (asin: string, tag?: string): string => {
  const cleanAsin = asin.toUpperCase().trim();
  const affiliateTag = tag ? `?tag=${tag}` : '';
  return `https://www.amazon.com/dp/${cleanAsin}${affiliateTag}`;
};
