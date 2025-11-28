
import { GoogleGenAI, Type } from '@google/genai';
import { AIAnalysisResult, SemanticNode } from '../types';

const initGenAI = () => {
  const apiKey = process.env.API_KEY || ''; 
  return new GoogleGenAI({ apiKey });
};

export const analyzeAndGenerateAssets = async (
  currentTitle: string,
  rawText: string,
  semanticNeighbors: SemanticNode[] // The filtered "Smart Mesh" links
): Promise<AIAnalysisResult> => {
  const ai = initGenAI();
  const nextYear = new Date().getFullYear() + 1;

  // Prepare the Contextual Links (RAG-lite)
  const meshContext = semanticNeighbors
    .map(n => `[Title: "${n.title}" | URL: ${n.url}]`)
    .join('\n');

  const prompt = `
    ROLE: You are a SOTA "Answer Engine Optimization" (AEO) Engineer.
    GOAL: Refactor content to dominate Google SGE (Search Generative Experience) and Perplexity AI.

    INPUT CONTENT:
    Title: "${currentTitle}"
    Body (Truncated): "${rawText.substring(0, 25000)}..."

    NEURAL MESH (INTERNAL LINKS TO USE):
    ${meshContext}

    INSTRUCTIONS:
    1. **SGE Snippet**: Write a <200 word HTML "Direct Answer" box. Use <b> tags for entities.
    2. **Verdict**: Analyze objectively. Assign a score (0-100). List 4 Pros/Cons. Define Target Audience.
    3. **Content Rewrite**:
       - Keep original meaning but boost "Information Gain".
       - Use <h3> headers for questions.
       - **MANDATORY**: Integrate 3-5 hyperlinks from the "NEURAL MESH" provided. Contextually weave them in.
    4. **Schema**: Generate comprehensive JSON-LD (Article + FAQPage).

    OUTPUT SCHEMA (Strict JSON):
    {
      "newTitle": "Click-worthy title including ${nextYear}",
      "metaDescription": "SEO optimized, under 160 chars",
      "sgeSummaryHTML": "HTML for the quick answer box",
      "verdictData": { "score": number, "pros": [], "cons": [], "summary": "string", "targetAudience": "string" },
      "faqHTML": "HTML <details> list",
      "schemaJSON": "Stringified JSON-LD",
      "contentWithLinks": "Full HTML body content with embedded mesh links"
    }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          newTitle: { type: Type.STRING },
          metaDescription: { type: Type.STRING },
          sgeSummaryHTML: { type: Type.STRING },
          verdictData: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.NUMBER },
                pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                cons: { type: Type.ARRAY, items: { type: Type.STRING } },
                summary: { type: Type.STRING },
                targetAudience: { type: Type.STRING }
            },
            required: ['score', 'pros', 'cons', 'summary', 'targetAudience']
          },
          faqHTML: { type: Type.STRING },
          schemaJSON: { type: Type.STRING },
          contentWithLinks: { type: Type.STRING }
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("AI Empty Response");
  
  return JSON.parse(text) as AIAnalysisResult;
};

// Legacy support if needed by other components, although analyzeAndGenerateAssets is the primary engine now.
export const generateHtmlSnippet = (suggestion: any, year: number, tag?: string): string => {
  return "Deprecated in favor of full content rewrite";
}
