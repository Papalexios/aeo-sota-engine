
import { WPConnection, WPPostHeader, WPPostFull } from '../types';

const getAuthHeader = (conn: WPConnection) => {
  // Safe encoding for special characters in passwords
  const str = `${conn.username}:${conn.appPassword}`;
  return 'Basic ' + btoa(unescape(encodeURIComponent(str)));
};

const cleanUrl = (url: string) => url.replace(/\/$/, '');

// Robust fetch with retry and timeout
const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout per request
  const fetchOptions = { ...options, signal: controller.signal };

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      // If 429 (Too Many Requests) or 5xx (Server Error), we throw to retry
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
            throw new Error(`HTTP ${res.status}`);
        }
        // For 4xx errors (client errors), return immediately (don't retry)
        // 401 = Unauthorized (Bad Password)
        return res;
      }
      return res;
    } catch (error: any) {
      if (i === retries - 1) {
        clearTimeout(timeoutId);
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
    }
  }
  return new Response(null, { status: 504, statusText: "Gateway Timeout" });
};

// Strict verification of credentials using /users/me
export const verifyConnection = async (conn: WPConnection): Promise<void> => {
  const res = await fetchWithRetry(`${cleanUrl(conn.url)}/wp-json/wp/v2/users/me`, {
    headers: { 'Authorization': getAuthHeader(conn) }
  });
  
  if (!res.ok) {
      if (res.status === 401) throw new Error("401 Unauthorized: Check Username/App Password.");
      if (res.status === 403) throw new Error("403 Forbidden: User does not have permission.");
      if (res.status === 404) throw new Error("404 Not Found: JSON API not enabled on site.");
      throw new Error(`Connection Error: ${res.status} ${res.statusText}`);
  }
};

export const fetchAllPostHeaders = async (conn: WPConnection, onProgress?: (count: number) => void): Promise<WPPostHeader[]> => {
  const allPosts: WPPostHeader[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
        // Fetch 100 items per page (WP API max)
        const res = await fetchWithRetry(`${cleanUrl(conn.url)}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=id,date,modified,title,link,slug,categories&status=publish`, {
            headers: { 'Authorization': getAuthHeader(conn) }
        });

        if (!res.ok) {
            // If 400 error usually means "page out of bounds", so we stop
            if (res.status === 400) break; 
            throw new Error(`WP Error: ${res.status} ${res.statusText}`);
        }

        const posts = await res.json();
        if (posts.length === 0) {
            hasMore = false;
        } else {
            allPosts.push(...posts);
            if (onProgress) onProgress(allPosts.length);
            page++;
        }
    } catch (e) {
        console.warn(`Fetch loop interrupted at page ${page}:`, e);
        hasMore = false;
    }
  }
  return allPosts;
};

export const fetchRecentPostHeaders = async (conn: WPConnection): Promise<WPPostHeader[]> => {
    const res = await fetchWithRetry(`${cleanUrl(conn.url)}/wp-json/wp/v2/posts?per_page=5&_fields=id,date,modified,title,link,slug,categories&status=publish`, {
        headers: { 'Authorization': getAuthHeader(conn) }
    });

    if (!res.ok) {
        throw new Error(`WP Connection Error: ${res.status} ${res.statusText}`);
    }

    return await res.json();
};

export const fetchPostContent = async (conn: WPConnection, id: number): Promise<WPPostFull> => {
  // Optimized: Only fetch essential fields (id, content, modified, title, link, slug)
  // Context=edit is CRITICAL for raw data, requires Auth
  const res = await fetchWithRetry(`${cleanUrl(conn.url)}/wp-json/wp/v2/posts/${id}?context=edit&_fields=id,content,modified,title,link,slug`, {
    headers: { 'Authorization': getAuthHeader(conn) }
  });
  
  if (!res.ok) {
      if (res.status === 401) throw new Error("WP Error 401: Authorization Failed. Reconnect with valid credentials.");
      throw new Error(`WP Error: ${res.status} ${res.statusText}`);
  }
  return await res.json();
};

export const updatePostRemote = async (conn: WPConnection, id: number, data: any): Promise<void> => {
  const res = await fetchWithRetry(`${cleanUrl(conn.url)}/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: {
      'Authorization': getAuthHeader(conn),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`WP Update Error: ${res.status} ${res.statusText}`);
};
