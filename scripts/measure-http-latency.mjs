import { performance } from "node:perf_hooks";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function measureHttpLatency() {
  console.log("=== MEASURING END-TO-END HTTP STREAMING LATENCY ===\n");

  // 1. Register a test user
  const email = `latency_tester_${Date.now()}@zerogen.app`;
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "TestPassword999!",
      name: "Latency Tester",
    }),
  });
  const setCookie = regRes.headers.get("set-cookie") || "";
  const sessionCookie = setCookie.split(";")[0];

  // 2. Fetch conversations
  const convsRes = await fetch(`${BASE_URL}/api/conversations`, {
    headers: { Cookie: sessionCookie },
  });
  const convsData = await convsRes.json();
  const conversationId = convsData.conversations[0].id;

  // 3. Send "hi" and measure precise timings
  console.log("Sending 'hi' to /api/chat...\n");
  const tRequestStart = performance.now();

  const chatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      conversationId,
      message: "hi",
      model: "zerogen-fast",
    }),
  });

  const tHeadersReceived = performance.now();
  const requestToHeaders = tHeadersReceived - tRequestStart;

  if (!chatRes.ok) {
    const err = await chatRes.json();
    throw new Error(`Chat request failed: ${JSON.stringify(err)}`);
  }

  const modelUsedHeader = chatRes.headers.get("X-ZeroGen-Model");
  const fallbackHeader = chatRes.headers.get("X-ZeroGen-Fallback");

  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();

  // 4. Measure First Token Time (TTFT)
  const firstChunk = await reader.read();
  const tFirstToken = performance.now();
  const ttftFromStart = tFirstToken - tRequestStart;
  const firstTokenText = decoder.decode(firstChunk.value || new Uint8Array());

  // 5. Read remaining stream
  let fullText = firstTokenText;
  let chunkCount = 1;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount++;
    fullText += decoder.decode(value, { stream: true });
  }
  const tStreamComplete = performance.now();
  const totalResponseTime = tStreamComplete - tRequestStart;

  console.log("=== LATENCY MEASUREMENT REPORT ===");
  console.log(`1. Request sent → HTTP Headers received:  ${requestToHeaders.toFixed(2)}ms`);
  console.log(`2. HTTP Headers → First Token read:       ${(tFirstToken - tHeadersReceived).toFixed(2)}ms`);
  console.log(`3. Total Time to First Token (TTFT):      ${ttftFromStart.toFixed(2)}ms`);
  console.log(`4. Full Stream Duration:                  ${(tStreamComplete - tFirstToken).toFixed(2)}ms`);
  console.log(`5. Total End-to-End Latency:             ${totalResponseTime.toFixed(2)}ms`);
  console.log(`6. Model used:                            ${modelUsedHeader} (Fallback: ${fallbackHeader})`);
  console.log(`7. Chunks received:                       ${chunkCount}`);
  console.log(`8. Response text:                         "${fullText.trim()}"`);
}

measureHttpLatency().catch(console.error);
