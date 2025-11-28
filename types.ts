
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

export interface WPConnection {
  url: string;
  username: string;
  appPassword: string;
}

export interface WPPostHeader {
  id: number;
  date: string;
  modified: string;
  title: { rendered: string };
  link: string;
  slug: string;
  categories?: number[];
}

export interface WPPostFull extends WPPostHeader {
  content: { rendered: string; protected: boolean };
  excerpt: { rendered: string };
  featured_media: number;
}

export interface PostHealth {
  id: number;
  score: number;
  aeoScore: number;
  metrics: {
    wordCount: number;
    hasSchema: boolean;
    hasVerdict: boolean;
    brokenMedia: number;
    internalLinks: number;
    externalLinks: number;
    entityDensity: number;
    lastUpdatedDayCount: number;
  };
  status: 'idle' | 'scanning' | 'optimizing' | 'review_pending' | 'published' | 'error';
  log?: string;
  draftHtml?: string;
  aiResult?: AIAnalysisResult;
  productOverrides?: Record<string, string>; // Map of Original URL/Name -> New URL
  customImageUrl?: string;      // User manual override for product image
  manualMapping?: ManualMapping;
}

export interface SemanticNode {
  id: number;
  title: string;
  url: string;
  tokens: Set<string>;
  relevance?: number;
}

export interface VerdictData {
  score: number;
  pros: string[];
  cons: string[];
  summary: string;
  targetAudience: string;
}

export interface ReferenceData {
  title: string;
  link: string;
  snippet: string;
}

export interface PAAData {
  question: string;
  snippet: string;
  link: string;
}

export interface SerperResult {
  organics: ReferenceData[];
  paa: PAAData[];
}

export interface ProductDetection {
  name: string;
  url: string;
  asin?: string;
}

export interface AIAnalysisResult {
  newTitle: string;
  metaDescription: string;
  blufSentence: string;
  sgeSummaryHTML: string;
  verdictData: VerdictData;
  productBoxHTML?: string;
  comparisonTableHTML: string;
  faqHTML: string;
  schemaJSON: string;
  contentWithLinks: string;
  referencesHTML: string;
  detectedOldProduct: string;
  identifiedNewProduct: string;
  newProductSpecs: { price: string; rating: number; reviewCount: number };
  keywordsUsed?: string[]; 
  
  // SOTA Monetization & Validation
  commercialIntent: boolean; 
  detectedProducts: ProductDetection[]; // List of all products found
  usedInternalLinks?: string[]; // Self-validation list from AI
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  concurrency?: number;
  amazonAffiliateTag?: string;
  serperApiKey?: string;
  wpUrl?: string;
  wpUsername?: string;
  wpAppPassword?: string;
}

// --- Legacy / UI Types ---

export interface ComparisonPoint {
  feature: string;
  oldValue: string;
  newValue: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ReferenceLink {
  title: string;
  url: string;
}

export interface ContentUpdateSuggestion {
  oldProductName: string;
  successorProductName: string;
  verdictSummary: string;
  intro: string;
  pros: string[];
  cons: string[];
  comparisonTable: ComparisonPoint[];
  faqs: FAQItem[];
}

export interface ProcessedItem {
  id: string;
  slug: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  decayScore?: number;
  errorMsg?: string;
  suggestion?: ContentUpdateSuggestion; 
  draftHtml?: string;
  aiResult?: AIAnalysisResult;
  productOverrides?: Record<string, string>;
  customImageUrl?: string;
}

export interface SitemapUrl {
  loc: string;
  lastmod: string;
  slug: string;
}

export interface ManualMapping {
  productName: string;
  asin: string;
}

export interface AnalyzedUrl extends SitemapUrl {
  id: string;
  decayScore: number;
  reasons: string[];
  manualMapping?: ManualMapping;
}
