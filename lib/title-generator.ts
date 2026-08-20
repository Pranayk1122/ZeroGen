import { GoogleGenAI } from "@google/genai";

const GREETING_REGEX = /^(hi|hello|hey|greetings|hola|yo|howdy|good\s+(morning|afternoon|evening|day)|sup|test|testing|ping|ok|okay|what'?s\s+up|help)\b[\s!.,?]*$/i;

const KNOWN_ACRONYMS = new Set([
  "AI",
  "API",
  "APIs",
  "UI",
  "UX",
  "HTML",
  "CSS",
  "JS",
  "TS",
  "SQL",
  "HTTP",
  "HTTPS",
  "REST",
  "JSON",
  "Next.js",
  "React",
  "Node.js",
  "Vue",
  "Python",
  "OpenAI",
  "ZeroGen",
  "OAuth",
  "JWT",
  "AWS",
  "GCP",
  "SDK",
  "CRUD",
  "URL",
  "URI",
  "SEO",
  "DOM",
]);

/**
 * Checks if message is a short greeting or trivial placeholder.
 */
export function isGreetingOrTrivial(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length <= 3 && !/\d/.test(trimmed)) return true;
  return GREETING_REGEX.test(trimmed);
}

/**
 * Sanitizes and formats a title string to be clean, 2-6 words, Title Case, no quotes or punctuation.
 */
export function cleanAndFormatTitle(raw: string): string {
  if (!raw) return "New Conversation";

  // Remove markdown, code fences, quotes, backticks, brackets
  let title = raw
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~#>[\]]/g, "")
    .replace(/["'“”‘’]/g, "")
    .replace(/^(title|topic|subject):\s*/i, "")
    .trim();

  // Remove trailing and leading punctuation
  title = title.replace(/^[-–—:;,\s]+/, "").replace(/[-–—:;,.?!*#\s]+$/, "");

  // Collapse repeated whitespace
  title = title.replace(/\s+/g, " ");

  if (!title || isGreetingOrTrivial(title)) {
    return "New Conversation";
  }

  // Convert to natural Title Case while preserving special acronyms
  const words = title.split(" ");
  const formattedWords = words.map((w, idx) => {
    const cleanWord = w.replace(/[^a-zA-Z0-9.+]/g, "");
    
    // Check known acronyms/proper nouns
    for (const acronym of KNOWN_ACRONYMS) {
      if (cleanWord.toLowerCase() === acronym.toLowerCase()) {
        return acronym;
      }
    }

    // Lowercase small words unless first word
    const smallWords = new Set(["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", "of"]);
    if (idx > 0 && smallWords.has(w.toLowerCase())) {
      return w.toLowerCase();
    }

    // Standard Capitalization
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  let result = formattedWords.join(" ").trim();

  // Hard length limit (~40 characters) at clean word boundary
  if (result.length > 40) {
    const truncated = result.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(" ");
    result = lastSpace > 15 ? truncated.slice(0, lastSpace) : truncated;
  }

  return result.replace(/[-–—:;,.?!*#\s]+$/, "").trim() || "New Conversation";
}

/**
 * Deterministic local fallback title generator based on rule patterns.
 */
export function generateLocalFallbackTitle(userMessage: string): string {
  if (isGreetingOrTrivial(userMessage)) {
    return "New Conversation";
  }

  let text = userMessage.trim();

  // Pattern: "what is 2 + 2", "2+2", "calculate 5 * 10"
  if (/^\s*(?:what\s+is\s+)?(?:\d+\s*[-+*/^%]\s*\d+|\d+\s*\+\s*\d+)/i.test(text) || /what\s+is\s+\d+\s*\+\s*\d+/i.test(text)) {
    return "Simple Arithmetic Question";
  }

  // Pattern: "explain photosynthesis", "explain quantum computing like I'm 15"
  const explainMatch = text.match(/^explain\s+(.+?)(?:\s+(?:like|to|in|for|step|with|as)\b.*)?$/i);
  if (explainMatch && explainMatch[1]) {
    const topic = explainMatch[1].trim();
    if (topic.length > 2) {
      return cleanAndFormatTitle(`${topic} Explained`);
    }
  }

  // Pattern: "write a python program to calculate factorial" -> "Python Factorial Program"
  const langMatch = text.match(/(?:write|create|build|implement|make)\s+(?:me\s+a|me\s+an|me\s+the|a|an|the|me)?\s*(python|javascript|typescript|react|vue|node|html|css|sql|rust|go|c\+\+|java|swift|kotlin|php)?\s*(?:program|script|code|function|app|page)?\s*(?:to|for)?\s*(calculate|compute|find|generate|parse)?\s*(.+)/i);
  if (langMatch) {
    const lang = langMatch[1] ? langMatch[1].trim() : "";
    const action = langMatch[2] ? langMatch[2].trim() : "";
    const subject = langMatch[3] ? langMatch[3].trim() : "";
    const combined = [lang, subject, action].filter(Boolean).join(" ");
    if (combined.length >= 3) {
      return cleanAndFormatTitle(combined);
    }
  }

  // Pattern: "why am I getting a 401 error from OpenAI?" -> "OpenAI 401 Error"
  const errorMatch = text.match(/(?:getting|fix|encountering|resolving)?\s*(?:a|an)?\s*(\d{3}\s*error|error\s*\d{3}|[A-Za-z0-9_.-]+\s+error)\s*(?:from|in|with)?\s*([A-Za-z0-9_.-]+)?/i);
  if (errorMatch) {
    const errPart = errorMatch[1] || "";
    const sourcePart = errorMatch[2] || "";
    if (sourcePart && !/the|a|an|this|my|me|i/i.test(sourcePart)) {
      return cleanAndFormatTitle(`${sourcePart} ${errPart}`);
    }
    return cleanAndFormatTitle(errPart);
  }

  // Strip common prompt prefixes: "build me a login page in react" -> "React Login Page"
  const cleanedPrefix = text
    .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:help\s+me\s+)?(?:write|create|build|generate|make|code|implement|design|draft|give)\s+(?:me\s+a|me\s+an|me\s+the|a|an|the|me)?\s*/i, "")
    .replace(/^(?:what\s+is|what\s+are|how\s+to|how\s+do\s+i|tell\s+me\s+about|why\s+is|why\s+am\s+i)\s+(?:a|an|the)?\s*/i, "")
    .replace(/(?:like\s+i['’]?m\s+\d+|in\s+detail|step\s+by\s+step|for\s+beginners).*/i, "")
    .trim();

  // Pattern: "login page in react" -> "React Login Page"
  const inFrameworkMatch = cleanedPrefix.match(/^(.+?)\s+in\s+([a-zA-Z0-9.+]+)$/i);
  if (inFrameworkMatch) {
    return cleanAndFormatTitle(`${inFrameworkMatch[2]} ${inFrameworkMatch[1]}`);
  }

  if (cleanedPrefix && cleanedPrefix.length >= 3) {
    return cleanAndFormatTitle(cleanedPrefix);
  }

  return cleanAndFormatTitle(text);
}

/**
 * Generates a ChatGPT-style professional conversation title asynchronously.
 * Uses fast internal AI generation with deterministic fallback.
 */
export async function generateConversationTitle(userMessage: string): Promise<string> {
  const text = (userMessage || "").trim();
  if (isGreetingOrTrivial(text)) {
    return "New Conversation";
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) {
    return generateLocalFallbackTitle(text);
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    
    // Fast, lightweight prompt with 2.5-second timeout
    const prompt = `Generate a concise, high-quality, professional title (2 to 4 words in Title Case) summarizing the topic of this user query:
"${text.slice(0, 200)}"

Rules:
- 2 to 4 words max
- Natural Title Capitalization
- Describe the topic/goal directly (e.g. "React Login Page", "Python Factorial Program", "Quantum Computing Explained")
- Absolutely NO conversational prefixes like "Build Me A", "Write A", or "Create A"
- Absolutely NO quotes, NO markdown, NO emojis, NO punctuation at end
- Output ONLY the title text on one single line.`;

    const titlePromise = client.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 20,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Title generation timeout")), 2500)
    );

    const result = await Promise.race([titlePromise, timeoutPromise]);
    const rawGenerated = result.text?.trim() || "";

    if (rawGenerated) {
      const sanitized = cleanAndFormatTitle(rawGenerated);
      if (sanitized && sanitized !== "New Conversation" && sanitized.length >= 3) {
        return sanitized;
      }
    }
  } catch (err) {
    // Silently fall back to deterministic generator
  }

  return generateLocalFallbackTitle(text);
}
