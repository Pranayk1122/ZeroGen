import { performance } from "node:perf_hooks";
import { findSessionByToken, createUser, getDb } from "../lib/db.ts";
import { createChatStream } from "../lib/ai.ts";
import { buildSystemPrompt } from "../lib/system-prompt.ts";

async function benchmark() {
  console.log("=== BENCHMARKING AI STREAMING LATENCY BREAKDOWN ===\n");

  const db = getDb();
  
  // 1. Create / find benchmark user
  const t0 = performance.now();
  const testUser = createUser({
    id: `bench_user_${Date.now()}`,
    email: `bench_${Date.now()}@zerogen.app`,
    name: "Benchmarker",
    password_hash: "dummy_hash",
  });
  const tUser = performance.now();
  console.log(`[1] User setup / DB creation: ${(tUser - t0).toFixed(2)}ms`);

  // 2. Conversation ownership check & message history read
  const tConvStart = performance.now();
  const convStmt = db.prepare("SELECT id, title FROM conversations WHERE user_id = ? LIMIT 1");
  const conv = convStmt.get(testUser.id);
  const msgStmt = db.prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 8");
  const recentMsgs = msgStmt.all(conv.id);
  const tConvEnd = performance.now();
  console.log(`[2] Lean DB Ownership & History Read: ${(tConvEnd - tConvStart).toFixed(2)}ms`);

  // 3. User message insert
  const tInsertStart = performance.now();
  db.prepare("INSERT INTO messages (id, conversation_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(`msg_bench_${Date.now()}`, conv.id, testUser.id, "user", "hi", new Date().toISOString());
  const tInsertEnd = performance.now();
  console.log(`[3] DB User Message Insert: ${(tInsertEnd - tInsertStart).toFixed(2)}ms`);

  // 4. Prompt building
  const tPromptStart = performance.now();
  const prompt = buildSystemPrompt({ persona: "helper" });
  const tPromptEnd = performance.now();
  console.log(`[4] System Prompt Assembly: ${(tPromptEnd - tPromptStart).toFixed(2)}ms`);

  // 5. Provider Stream Initiation (server -> Gemini API)
  const tGeminiCallStart = performance.now();
  const { stream, modelUsed, zerogenTier, fallbackUsed } = await createChatStream({
    messages: [{ role: "user", content: "hi" }],
    systemPrompt: prompt,
    model: "zerogen-fast",
  });
  const tGeminiConnected = performance.now();
  console.log(`[5] Server -> Gemini Connection established: ${(tGeminiConnected - tGeminiCallStart).toFixed(2)}ms (Model: ${modelUsed})`);

  // 6. Time to First Token (TTFT)
  const tFirstTokenStart = performance.now();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  
  const firstChunk = await reader.read();
  const tFirstTokenEnd = performance.now();
  const firstTokenLatency = tFirstTokenEnd - tGeminiConnected;
  const firstTokenText = decoder.decode(firstChunk.value || new Uint8Array());
  console.log(`[6] Gemini -> First Token received: ${firstTokenLatency.toFixed(2)}ms -> "${firstTokenText.slice(0, 30)}"`);
  console.log(`    >>> TOTAL TIME TO FIRST TOKEN FROM START: ${(tFirstTokenEnd - t0).toFixed(2)}ms <<<`);

  // 7. Full stream reading
  let totalText = firstTokenText;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalText += decoder.decode(value, { stream: true });
  }
  const tStreamComplete = performance.now();
  console.log(`[7] Full response generation finished: ${(tStreamComplete - tFirstTokenEnd).toFixed(2)}ms (Length: ${totalText.length} chars)`);

  // 8. DB Response Persistence
  const tPersistStart = performance.now();
  db.prepare("INSERT INTO messages (id, conversation_id, user_id, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(`msg_asst_${Date.now()}`, conv.id, testUser.id, "assistant", totalText, modelUsed, new Date().toISOString());
  const tPersistEnd = performance.now();
  console.log(`[8] DB Final Response Persistence: ${(tPersistEnd - tPersistStart).toFixed(2)}ms`);

  const totalTime = tPersistEnd - t0;
  console.log(`\n=== TOTAL END-TO-END LATENCY: ${totalTime.toFixed(2)}ms ===`);
}

benchmark().catch(console.error);
