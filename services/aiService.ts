
import { GoogleGenAI } from '@google/genai';
import { AIAnalysisResult, SemanticNode, AIConfig, ReferenceData, PAAData, ProductDetection } from '../types';

interface AIResponseSchema {
  newTitle?: string;
  metaDescription?: string;
  blufSentence?: string;
  sgeSummaryHTML?: string;
  verdictData?: {
    score: number;
    pros: string[];
    cons: string[];
    summary: string;
    targetAudience: string;
  };
  productBoxHTML?: string;
  comparisonTableHTML?: string;
  faqHTML?: string;
  schemaJSON?: string;
  contentWithLinks?: string;
  detectedOldProduct?: string;
  identifiedNewProduct?: string;
  newProductSpecs?: { price: string; rating: number; reviewCount: number };
  commercialIntent?: boolean;
  detectedProducts?: ProductDetection[];
  usedInternalLinks?: string[];
}

// --- HELPER: SOTA Link Validator ---
const validateAndSanitizeLinks = (html: string, validNodes: SemanticNode[], siteUrl: string): string => {
  const validPaths = new Set<string>();
  
  const normalize = (u: string) => {
    try {
        if (u.startsWith('http')) {
            const urlObj = new URL(u);
            return urlObj.pathname.replace(/\/$/, '').toLowerCase();
        }
        return u.replace(/\/$/, '').toLowerCase();
    } catch {
        return u.replace(/\/$/, '').toLowerCase();
    }
  };

  validNodes.forEach(n => {
      validPaths.add(normalize(n.url));
  });

  // Regex matches HTML tags <a href="...">
  return html.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi, (match, quote, href, text) => {
    let cleanHref = href.trim();
    const lowerHref = cleanHref.toLowerCase();
    let isInternal = false;
    let pathToCheck = "";

    if (lowerHref.startsWith('/') || (siteUrl && lowerHref.includes(siteUrl))) {
        isInternal = true;
        pathToCheck = normalize(cleanHref);
    } else if (!lowerHref.startsWith('http') && !lowerHref.startsWith('#') && !lowerHref.startsWith('mailto')) {
        isInternal = true;
        pathToCheck = normalize(cleanHref);
    }

    if (isInternal) {
        // Validation: Must exist in our mesh
        const isValid = validPaths.has(pathToCheck) || 
                        Array.from(validPaths).some(vp => vp.endsWith(pathToCheck) || pathToCheck.endsWith(vp));

        if (isValid) {
            return `<a href="${cleanHref}" class="sota-internal-link" title="Read more: ${text.replace(/"/g, '')}">${text}</a>`;
        } else {
            // Strip hallucinated links, keep text
            return `<span class="sota-text-highlight" title="Link removed by validator (404 prevention)">${text}</span>`;
        }
    }
    return match;
  });
};

// --- HELPER: HTML Auto-Corrector & Markdown Stripper ---
// Ensures output is pure HTML, not Markdown artifacts
const forceHtmlStructure = (text: string): string => {
  let clean = text;

  // 1. Remove Word Count Metadata (e.g. "(278 words, total 1077)")
  clean = clean.replace(/\(\d+\s*words,?\s*total\s*\d+\)/gi, '');
  
  // 2. Convert Markdown Headers to HTML
  clean = clean.replace(/^##\s+(.*$)/gim, '<h2>$1</h2>');
  clean = clean.replace(/^###\s+(.*$)/gim, '<h3>$1</h3>');
  clean = clean.replace(/^####\s+(.*$)/gim, '<h4>$1</h4>');

  // 3. Convert Bold
  clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 4. Convert Lists (Basic)
  // If we see lines starting with - or *, wrap them. 
  // (This is a naive parser but robust enough for cleanup)
  if (!clean.includes('<ul>') && (clean.includes('\n- ') || clean.includes('\n* '))) {
      clean = clean.replace(/(?:^|\n)[-*]\s+(.*)/g, '<li>$1</li>');
      // Wrap floating lis in ul (simplified)
      clean = clean.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  }

  // 5. Cleanup
  return clean.trim();
};

const parseAIResponse = (text: string | undefined, references: ReferenceData[], topKeywords: string[], validNodes: SemanticNode[], config: AIConfig): AIAnalysisResult => {
  if (!text) throw new Error("AI returned empty text");

  try {
    let cleanJson = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) cleanJson = codeBlockMatch[1];

    const start = cleanJson.indexOf('{');
    const end = cleanJson.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
       cleanJson = cleanJson.substring(start, end + 1);
    }

    const parsed = JSON.parse(cleanJson) as AIResponseSchema;

    // --- SOTA SANITIZATION PIPELINE ---
    // 1. Force HTML Structure (fix Markdown leaks)
    const structuredContent = forceHtmlStructure(parsed.contentWithLinks || "");
    
    // 2. Validate Links (fix 404s)
    const sanitizedContent = validateAndSanitizeLinks(
        structuredContent, 
        validNodes, 
        config.wpUrl || ""
    );

    const referencesHTML = references.length > 0 ? `
      <section class="sota-references" style="margin-top: 60px; padding: 30px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-bottom: 20px; display: flex; align-items: center;">
            <span style="background: #0f172a; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; margin-right: 12px; text-transform: uppercase; letter-spacing: 1px;">Fact Checked</span> 
            Sources & Citations
        </h2>
        <ul style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; list-style: none; padding: 0;">
          ${references.slice(0, 8).map(ref => `
            <li style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
              <a href="${ref.link}" target="_blank" rel="nofollow noopener" style="text-decoration: none; display: block;">
                <span style="color: #2563eb; font-weight: 800; font-size: 1rem; display: block; margin-bottom: 8px; line-height: 1.3;">${ref.title}</span>
                <span style="font-size: 0.85rem; color: #64748b; line-height: 1.6; display: block;">${ref.snippet.substring(0, 120)}...</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </section>
    ` : '';

    return {
      newTitle: parsed.newTitle || "Updated Guide 2026",
      metaDescription: parsed.metaDescription || "",
      blufSentence: parsed.blufSentence || "",
      sgeSummaryHTML: parsed.sgeSummaryHTML || "",
      verdictData: parsed.verdictData || { score: 0, pros: [], cons: [], summary: "", targetAudience: "" },
      productBoxHTML: parsed.productBoxHTML || "",
      comparisonTableHTML: parsed.comparisonTableHTML || "",
      faqHTML: parsed.faqHTML || "",
      schemaJSON: parsed.schemaJSON || "{}",
      contentWithLinks: sanitizedContent, 
      referencesHTML,
      detectedOldProduct: parsed.detectedOldProduct || "Unknown",
      identifiedNewProduct: parsed.identifiedNewProduct || "New Model",
      newProductSpecs: parsed.newProductSpecs || { price: "Check", rating: 0, reviewCount: 0 },
      keywordsUsed: topKeywords, 
      commercialIntent: parsed.commercialIntent ?? false,
      detectedProducts: parsed.detectedProducts || [],
      usedInternalLinks: parsed.usedInternalLinks || []
    };
  } catch (e) {
    console.error("AI Parse Error", e);
    throw new Error("Failed to parse AI JSON response");
  }
};

const extractTopKeywords = (refs: ReferenceData[]): string[] => {
  const text = refs.map(r => r.title + " " + r.snippet).join(" ").toLowerCase();
  const words = text.replace(/[^\w\s]/g, '').split(/\s+/);
  const freq: Record<string, number> = {};
  const stopWords = new Set(['the', 'best', 'review', 'guide', 'top', 'with', 'what', 'how', 'check', 'price', 'amazon', 'for', 'and', 'is', 'in', 'to', 'of', 'a', 'an', 'review', 'vs', 'comparison', '2024', '2025', '2023', 'buy', 'shop', 'online']);
  words.forEach(w => { if (w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40).map(e => e[0]);
};

// --- API ADAPTERS ---
const callOpenAICompatible = async (url: string, model: string, apiKey: string, system: string, prompt: string) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://neuralmesh.ai',
            'X-Title': 'Neural Mesh SOTA Engine'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 8192
        })
    });
    if (!response.ok) throw new Error(`Provider Error (${response.status})`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
};

const callGemini = async (model: string, apiKey: string, system: string, prompt: string) => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { 
            systemInstruction: system, 
            responseMimeType: "application/json",
            maxOutputTokens: 8192 
        }
    });
    return response.text;
};

// --- MAIN ENGINE ---

export const analyzeAndGenerateAssets = async (
  currentTitle: string,
  rawText: string,
  semanticNeighbors: SemanticNode[],
  externalRefs: ReferenceData[],
  paaQuestions: PAAData[],
  config: AIConfig
): Promise<AIAnalysisResult> => {
  
  if (!config.apiKey) throw new Error("Missing API Key");

  const affiliateTag = config.amazonAffiliateTag || 'tag-20';
  const semanticKeywords = extractTopKeywords(externalRefs);
  const targetYear = new Date().getFullYear() + 1;

  const PRODUCT_BOX_DESIGN = `
    DESIGN INSTRUCTION:
    Generate 'productBoxHTML' using EXACTLY this DOM structure (No Markdown, pure HTML):
    <div class="sota-product-card" style="font-family: sans-serif; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; background: white; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1); margin: 60px 0; max-width: 850px; margin-left: auto; margin-right: auto; position: relative;">
       <div style="background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
          <div style="color: white; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.9rem; display: flex; align-items: center;">
             <span style="font-size: 1.2rem; margin-right: 10px;">🏆</span> Top Pick ${targetYear}
          </div>
          <div style="background: #22c55e; color: #022c22; padding: 5px 14px; border-radius: 99px; font-size: 0.8rem; font-weight: 800; box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);">
             9.8/10 SOTA Score
          </div>
       </div>
       <div style="padding: 35px; display: flex; flex-wrap: wrap; gap: 40px; align-items: center;">
          <div style="flex: 1; min-width: 280px; text-align: center; position: relative;">
             <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, #f8fafc 0%, transparent 70%); z-index: 0;"></div>
             <img src="placeholder.jpg" alt="[Product Name]" class="sota-product-image" style="position: relative; z-index: 1; max-width: 100%; height: auto; max-height: 320px; object-fit: contain; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.1)); transform: scale(1.02); transition: transform 0.3s;">
          </div>
          <div style="flex: 1.4; min-width: 300px;">
             <h3 style="margin: 0 0 15px; font-size: 2rem; font-weight: 900; color: #1e293b; line-height: 1.1; letter-spacing: -1px;">[Product Name]</h3>
             <p style="color: #64748b; font-size: 1.1rem; margin-bottom: 25px; font-weight: 500; line-height: 1.6;">"[The One-Sentence Hook]"</p>
             <ul style="list-style: none; padding: 0; margin: 0 0 30px 0;">
                <li style="margin-bottom: 10px; padding-left: 30px; position: relative; color: #475569; font-size: 1rem; font-weight: 500;"><span style="position: absolute; left: 0; color: #22c55e; font-weight: 900; font-size: 1.1rem;">✓</span> [Key Benefit 1]</li>
                <li style="margin-bottom: 10px; padding-left: 30px; position: relative; color: #475569; font-size: 1rem; font-weight: 500;"><span style="position: absolute; left: 0; color: #22c55e; font-weight: 900; font-size: 1.1rem;">✓</span> [Key Benefit 2]</li>
                <li style="margin-bottom: 10px; padding-left: 30px; position: relative; color: #475569; font-size: 1rem; font-weight: 500;"><span style="position: absolute; left: 0; color: #22c55e; font-weight: 900; font-size: 1.1rem;">✓</span> [Key Benefit 3]</li>
             </ul>
             <a href="https://www.amazon.com/s?k=[Product Name]&tag=${affiliateTag}" class="sota-buy-button" style="display: block; width: 100%; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-align: center; padding: 20px; border-radius: 14px; font-weight: 800; text-decoration: none; font-size: 1.2rem; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.5); transition: all 0.2s; border: 1px solid #1e40af;">Check Best Price &rarr;</a>
          </div>
       </div>
    </div>
  `;

  // --- NEURAL MESH CONTEXT ---
  const meshInventory = semanticNeighbors
      .map((n, i) => `[ID:${i}] URL: ${n.url} (Topic: ${n.title})`)
      .join('\n');

  const refContext = externalRefs.slice(0, 20).map(r => `FACT: ${r.title} - ${r.snippet}`).join('\n');

  const systemPrompt = `
    ROLE: You are the World's #1 SEO Copywriter (Alex Hormozi Style).
    STYLE: 
    - **Grade 5 Reading Level.** Simple words. Big ideas.
    - **High Agency.** "Do this." "Don't do that."
    - **Short Sentences.** Punchy. Fast.
    - **BLUF (Bottom Line Up Front).** Answer the user's question immediately.
    - **NO FLUFF.** No "In this article...", No "Let's dive in...".
    - **NO MARKDOWN IN HTML:** Do not use '##'. Use '<h2>'. Do not use '**'. Use '<strong>'.
    
    OBJECTIVE: Write a comprehensive, 2500-word "State-of-the-Art" (SOTA) Guide that dominates Google SERPs.

    ---------------------------------------------------
    MANDATE 1: INTERNAL LINKING (ZERO TOLERANCE)
    ---------------------------------------------------
    I have provided an INVENTORY of valid URLs from this website.
    You MUST include 8 to 12 links from this inventory.
    
    RULES:
    1. **ACCURACY:** You may ONLY link to URLs listed in the Inventory. Copy the URL exactly.
    2. **FORMAT:** Use HTML anchor tags: <a href="URL">Rich Text</a>. NO MARKDOWN LINKS.
    3. **PLACEMENT:** Weave them naturally into the body paragraphs.

    INVENTORY:
    ${meshInventory}

    ---------------------------------------------------
    MANDATE 2: KEYWORD SATURATION
    ---------------------------------------------------
    Naturally incorporate these top semantic keywords into the text:
    ${semanticKeywords.slice(0, 30).join(', ')}

    ---------------------------------------------------
    MANDATE 3: CONTENT STRUCTURE (2500+ WORDS)
    ---------------------------------------------------
    You must write a deep, exhaustive guide. Use <h2> and <h3> tags for headers.
    
    Structure:
    1. **The Hook (BLUF):** Answer the main search intent in the first 50 words.
    2. **SOTA Product Box:** (Use the provided HTML structure).
    3. **Comparison Table:** Old vs New. Feature vs Feature.
    4. **Deep Dive Section 1 (H2):** The Core Problem / Technology Explained.
    5. **Deep Dive Section 2 (H2):** Real World Performance Analysis.
    6. **Deep Dive Section 3 (H2):** Competitor Landscape & Alternatives.
    7. **Deep Dive Section 4 (H2):** Advanced Tips & Hidden Features.
    8. **Deep Dive Section 5 (H2):** Long-term Durability & Value.
    9. **The Verdict:** Final decision.
    10. **FAQs:** Answer the PAA questions.

    ${PRODUCT_BOX_DESIGN}

    ---------------------------------------------------
    GHOST PROTOCOL (OBSOLETE PRODUCT CHECK)
    ---------------------------------------------------
    1. Compare the INPUT CONTENT vs COMPETITOR DATA.
    2. Is the main product older than 1 year? Is there a successor (e.g. iPhone 15 vs 16)?
    3. IF YES: The entire article MUST be about the NEW successor. Frame it as "The ${targetYear} Update".
    4. The 'Product Box' MUST feature the NEW product.

    OUTPUT JSON SCHEMA (STRICT):
    {
      "newTitle": "Viral, High-CTR Title (60 chars)",
      "metaDescription": "Action-oriented description",
      "blufSentence": "The one sentence that answers the user's intent perfectly.",
      "sgeSummaryHTML": "<p><b>Quick Verdict:</b> [Direct Answer].</p>",
      "productBoxHTML": "THE EXACT HTML STRUCTURE PROVIDED ABOVE (Filled with NEW Product Data)",
      "comparisonTableHTML": "<table class='sota-table'>...</table>",
      "verdictData": {
          "score": 98,
          "pros": ["Pro 1", "Pro 2", "Pro 3", "Pro 4"],
          "cons": ["Con 1", "Con 2"],
          "summary": "The final decision.",
          "targetAudience": "Specific user persona"
      },
      "contentWithLinks": "The FULL 2500+ word article body. PURE HTML (h2, h3, p, ul, li). NO MARKDOWN headers.",
      "faqHTML": "<details><summary>Q</summary>A</details>",
      "detectedOldProduct": "Name of old product",
      "identifiedNewProduct": "Name of new successor",
      "newProductSpecs": { "price": "$XX", "rating": 4.9, "reviewCount": 100 },
      "commercialIntent": true,
      "detectedProducts": [{ "name": "Prod Name", "url": "Amazon Link" }],
      "usedInternalLinks": ["List of URLs you actually used"]
    }
  `;

  const userMessage = `
    INPUT TOPIC/CONTENT:
    "${currentTitle}"
    "${rawText.substring(0, 5000)}..."

    LIVE COMPETITOR DATA (USE FOR FACT CHECKING):
    ${refContext}

    PAA QUESTIONS (ANSWER IN FAQ):
    ${paaQuestions.map(q => q.question).join('\n')}
  `;

  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        let responseText = "";
        
        // Priority: Configured Model -> Flash Fallback
        const model = i === 0 ? config.model : 'gemini-1.5-flash';
        const provider = i === 0 ? config.provider : 'gemini';
        
        console.log(`[AI Engine] Generating... Attempt ${i+1} using ${model} (${provider})`);

        if (provider === 'gemini') {
            responseText = await callGemini(model, config.apiKey, systemPrompt, userMessage);
        } else {
            const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 
                        provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 
                        'https://api.openai.com/v1/chat/completions';
            responseText = await callOpenAICompatible(url, model, config.apiKey, systemPrompt, userMessage);
        }

        return parseAIResponse(responseText, externalRefs, semanticKeywords, semanticNeighbors, config);

      } catch (e: any) {
         console.warn(`[AI Engine] Error on attempt ${i+1}:`, e.message);
         if (e.message.includes("401") || e.message.includes("403")) throw e;
         if (i === MAX_RETRIES - 1) throw new Error(`AI Generation Failed: ${e.message}`);
         await new Promise(r => setTimeout(r, 2000 + (i * 1000))); 
      }
  }
  throw new Error("AI Generation Failed after retries.");
};
