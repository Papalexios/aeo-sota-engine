
import { SitemapUrl } from '../types';

// Helper to extract clean slug from a URL
const extractSlug = (urlStr: string): string => {
  try {
    const url = new URL(urlStr);
    // Remove leading/trailing slashes and get the last segment
    const path = url.pathname.replace(/^\/|\/$/g, '');
    return path || 'home';
  } catch {
    // Fallback if invalid URL string
    return urlStr.split('/').pop() || urlStr;
  }
};

export const parseSitemapXml = (rawInput: string): SitemapUrl[] => {
  let cleanXml = rawInput.trim();
  if (!cleanXml) return [];

  // --- 0. JSON Unwrapping (Proxy Support) ---
  // Some proxies return JSON { "contents": "..." } or { "data": "..." }
  if (cleanXml.startsWith('{')) {
    try {
        const parsed = JSON.parse(cleanXml);
        if (parsed.contents && typeof parsed.contents === 'string') {
            cleanXml = parsed.contents;
        } else if (parsed.data && typeof parsed.data === 'string') {
            cleanXml = parsed.data;
        }
    } catch (e) {
        // Not JSON, continue as string
    }
  }

  const urls: SitemapUrl[] = [];
  const seenUrls = new Set<string>();

  // Helper to add URLs safely
  const addUrl = (loc: string, lastmod: string = new Date().toISOString()) => {
    let cleanLoc = loc.trim();
    
    // Clean up common XML/HTML debris if regex grabbed too much
    cleanLoc = cleanLoc.replace(/['"<>\s]+$/, '').replace(/^['"<>\s]+/, '');

    // Ensure protocol and basic validity
    if (!cleanLoc.startsWith('http') || cleanLoc.length < 10) return;

    // --- Filter out non-content assets & common junk ---
    if (cleanLoc.match(/\.(jpg|jpeg|png|gif|webp|svg|css|js|json|xml|rss|atom|woff|woff2|ttf|eot|ico|mp4|mp3)$/i)) return;
    if (cleanLoc.includes('google.com') || cleanLoc.includes('cloudflare.com') || cleanLoc.includes('w3.org')) return;

    if (!seenUrls.has(cleanLoc)) {
      seenUrls.add(cleanLoc);
      urls.push({
        loc: cleanLoc,
        lastmod,
        slug: extractSlug(cleanLoc)
      });
    }
  };

  // --- Strategy 1: DOM Parser (Best for valid XML) ---
  let domSuccess = false;
  try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(cleanXml, "text/xml");
      
      // Check for parser errors
      const parserError = xmlDoc.getElementsByTagName("parsererror");
      if (parserError.length === 0) {
          // 1a. Standard Sitemap
          const urlElements = xmlDoc.getElementsByTagName("url");
          if (urlElements.length > 0) {
            for (let i = 0; i < urlElements.length; i++) {
              const locNode = urlElements[i].getElementsByTagName("loc")[0];
              const lastmodNode = urlElements[i].getElementsByTagName("lastmod")[0];
              if (locNode && locNode.textContent) {
                addUrl(locNode.textContent, lastmodNode?.textContent || undefined);
              }
            }
            domSuccess = true;
          }

          // 1b. RSS/Atom
          if (urls.length === 0) {
            const items = xmlDoc.getElementsByTagName("item");
            const entries = xmlDoc.getElementsByTagName("entry");
            const nodes = items.length > 0 ? items : entries;

            for (let i = 0; i < nodes.length; i++) {
              const linkNode = nodes[i].getElementsByTagName("link")[0];
              let loc = '';
              if (linkNode) {
                 loc = linkNode.getAttribute("href") || linkNode.textContent || '';
              }
              const dateNode = nodes[i].getElementsByTagName("pubDate")[0] 
                            || nodes[i].getElementsByTagName("updated")[0];
              
              if (loc) {
                  addUrl(loc, dateNode?.textContent || undefined);
                  domSuccess = true;
              }
            }
          }
      }
  } catch (e) {
      console.warn("DOM Parsing failed", e);
  }

  // --- Strategy 2: Loose XML Regex (For broken XML namespaces) ---
  if (urls.length === 0) {
    const locRegex = /<loc>(.*?)<\/loc>/gi;
    let match;
    let foundRegex = false;
    while ((match = locRegex.exec(cleanXml)) !== null) {
      if (match[1]) {
          addUrl(match[1]);
          foundRegex = true;
      }
    }
  }

  // --- Strategy 3: The "Nuclear" Option (Extract ANYTHING looking like a URL) ---
  // This handles HTML pages, text lists, or severely malformed XML/JSON
  if (urls.length === 0) {
    console.warn("Standard parsing found 0 URLs. Engaging Nuclear Regex extraction.");
    // Improved regex to handle URLs inside quotes or brackets
    const urlRegex = /https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]+/g;
    let match;
    while ((match = urlRegex.exec(cleanXml)) !== null) {
       const candidate = match[0];
       // Post-regex validation
       if (!candidate.includes('<') && !candidate.includes('>') && !candidate.includes('{')) {
           addUrl(candidate);
       }
    }
  }

  return urls;
};

export const calculateDecayScore = (url: SitemapUrl): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];
  const currentYear = new Date().getFullYear();
  
  // 1. Check for old years in slug
  const yearMatch = url.slug.match(/(20\d\d)/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year < currentYear - 1) { // Older than last year
      score += 50;
      reasons.push(`Outdated Year in Slug: ${year}`);
    }
  }

  // 2. Check Last Modified Date
  const lastModDate = new Date(url.lastmod);
  if (!isNaN(lastModDate.getTime())) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(currentYear - 2);
      
      if (lastModDate < twoYearsAgo) {
        score += 30;
        reasons.push(`Not updated since ${lastModDate.getFullYear()}`);
      }
  }

  // 3. Keywords indicating high value content that needs freshness
  const hasKeyword = ['review', 'best', 'vs', 'top', 'guide', 'comparison'].some(k => url.slug.toLowerCase().includes(k));
  if (hasKeyword) {
    score += 20;
    reasons.push('High-value comparison keyword detected');
  }

  return { score: Math.min(score, 100), reasons };
};
