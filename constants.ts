import { Home, BarChart2, Wand2, FileText } from 'lucide-react';
import { AIProvider } from './types';

export const NAV_ITEMS = [
  { id: 'ingest', label: 'Ingest Sitemap', icon: Home },
  { id: 'analyze', label: 'Analyze Decay', icon: BarChart2 },
  { id: 'processing', label: 'AI Agent', icon: Wand2 },
  { id: 'review', label: 'Review & Export', icon: FileText },
];

export const CURRENT_YEAR = new Date().getFullYear();
export const DECAY_KEYWORDS = ['review', 'best', 'vs', 'guide'];

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4-turbo',
  anthropic: 'claude-3-opus-20240229',
  groq: 'llama3-70b-8192',
  openrouter: 'openai/gpt-4-turbo'
};

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini 2.5 Flash (SOTA & Fast)',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  groq: 'Groq (Llama/Mixtral)',
  openrouter: 'OpenRouter'
};