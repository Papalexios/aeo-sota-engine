
import { SerperResult, ReferenceData } from '../types';

// Helper to validate if a link is alive (Status 200)
const validateLink = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000); // 2s timeout
    await fetch(url, { 
      method: 'HEAD', 
      mode: 'no-cors', 
      signal: controller.signal 
    });
    clearTimeout(id);
    return true;
  } catch (e) {
    return false;
  }
};

export const searchSerper = async (query: string, apiKey: string): Promise<SerperResult> => {
  if (!apiKey) return { organics: [], paa: [] };

  try {
    // SMART QUERY ENGINEERING: FUTURE-PROOFING
    // explicitly targeting "2025" and "2026" to find forward-looking comparisons
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const smartQuery = `${query} successor vs new model ${currentYear} ${nextYear} review comparison`;

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: smartQuery,
        num: 20, 
        tbs: "qdr:y", // STRICT: Past Year Only to ensure freshness
        gl: "us",
        hl: "en"
      })
    });

    if (!response.ok) throw new Error("Serper API Failed");
    const data = await response.json();

    const rawOrganics = data.organic || [];
    const validatedOrganics: ReferenceData[] = [];

    // Parallel validation (Batch of 5)
    for (let i = 0; i < rawOrganics.length; i += 5) {
      const batch = rawOrganics.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (item: any) => {
         const isAlive = await validateLink(item.link);
         return isAlive ? {
           title: item.title,
           link: item.link,
           snippet: item.snippet
         } : null;
      }));
      validatedOrganics.push(...results.filter((r): r is ReferenceData => r !== null));
      if (validatedOrganics.length >= 10) break;
    }

    const paa = (data.peopleAlsoAsk || []).map((item: any) => ({
      question: item.question,
      snippet: item.snippet,
      link: item.link
    }));

    return { organics: validatedOrganics, paa };
  } catch (error) {
    console.error("Serper Logic Error:", error);
    return { organics: [], paa: [] };
  }
};
