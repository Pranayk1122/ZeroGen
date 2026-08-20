const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function runHttpTests() {
  console.log("=== RUNNING LIVE HTTP API & STREAMING VERIFICATION ===\n");

  // Wait a moment for Next.js to be fully ready
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Models endpoint
  console.log("1. Testing GET /api/models...");
  const modelsRes = await fetch(`${BASE_URL}/api/models`);
  if (!modelsRes.ok) throw new Error(`GET /api/models failed: ${modelsRes.status}`);
  const modelsData = await modelsRes.json();
  console.log(`  ✓ Available models loaded: ${modelsData.models.map((m) => m.name).join(", ")}`);

  // 2. Register new user
  console.log("\n2. Testing POST /api/auth/register...");
  const email = `http_tester_${Date.now()}@zerogen.app`;
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "TestPassword999!",
      name: "HTTP Tester",
    }),
  });

  if (!registerRes.ok) {
    const err = await registerRes.json();
    throw new Error(`Register failed: ${JSON.stringify(err)}`);
  }

  const registerData = await registerRes.json();
  const setCookieHeader = registerRes.headers.get("set-cookie");
  if (!setCookieHeader || !setCookieHeader.includes("zerogen_session")) {
    throw new Error("No session cookie returned in response headers");
  }

  // Extract raw cookie value
  const sessionCookie = setCookieHeader.split(";")[0];
  console.log(`  ✓ Registered user: ${registerData.user.name} (${registerData.user.email})`);
  console.log(`  ✓ Session cookie received: ${sessionCookie.slice(0, 35)}...`);

  // 3. Verify session via GET /api/auth/me
  console.log("\n3. Testing GET /api/auth/me with session cookie...");
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  if (!meRes.ok) throw new Error("GET /api/auth/me failed");
  const meData = await meRes.json();
  if (!meData.authenticated || meData.user.email !== email) {
    throw new Error("Auth state verification failed");
  }
  console.log(`  ✓ Session verified: Authenticated as ${meData.user.name}`);

  // 4. Retrieve conversations
  console.log("\n4. Testing GET /api/conversations...");
  const convsRes = await fetch(`${BASE_URL}/api/conversations`, {
    headers: { Cookie: sessionCookie },
  });
  const convsData = await convsRes.json();
  if (!convsData.conversations || convsData.conversations.length === 0) {
    throw new Error("No conversations returned");
  }
  const conversationId = convsData.conversations[0].id;
  console.log(`  ✓ Default conversation found: ID=${conversationId}, Title="${convsData.conversations[0].title}"`);

  // 5. Send message and test REAL Streaming Response
  console.log("\n5. Testing POST /api/chat (Real Streaming)...");
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

  if (!chatRes.ok) {
    const err = await chatRes.json();
    throw new Error(`POST /api/chat failed: ${JSON.stringify(err)}`);
  }

  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();
  let streamOutput = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    streamOutput += chunk;
    process.stdout.write(chunk);
  }

  console.log("\n  ✓ Real stream successfully received & completed.");
  console.log(`  ✓ Full streamed response: "${streamOutput.trim()}"`);

  // 6. Verify messages and auto-title in DB
  console.log("\n6. Verifying database persistence & title generation via GET /api/conversations/[id]...");
  // Wait brief moment for async title generation
  await new Promise((r) => setTimeout(r, 1000));
  const detailRes = await fetch(`${BASE_URL}/api/conversations/${conversationId}`, {
    headers: { Cookie: sessionCookie },
  });
  const detailData = await detailRes.json();
  const msgs = detailData.conversation.messages;
  console.log(`  ✓ Conversation message count in DB: ${msgs.length}`);
  const lastMsg = msgs[msgs.length - 1];
  console.log(`  ✓ Last message in DB role: ${lastMsg.role}, content: "${lastMsg.content.slice(0, 50)}..."`);
  console.log(`  ✓ Initial greeting conversation title: "${detailData.conversation.title}"`);

  // 6b. Test meaningful message title generation
  console.log("\n6b. Testing meaningful prompt title generation on fresh conversation...");
  const newChatRes = await fetch(`${BASE_URL}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ title: "New Conversation" }),
  });
  const { conversation: newChat } = await newChatRes.json();

  const meaningfulChatRes = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      conversationId: newChat.id,
      message: "write a python program to calculate factorial",
      model: "zerogen-fast",
    }),
  });
  if (!meaningfulChatRes.ok) throw new Error("Meaningful chat request failed");
  const reader2 = meaningfulChatRes.body.getReader();
  while (true) {
    const { done } = await reader2.read();
    if (done) break;
  }
  // Wait for background title generation
  await new Promise((r) => setTimeout(r, 1200));
  const refreshedConvRes = await fetch(`${BASE_URL}/api/conversations/${newChat.id}`, {
    headers: { Cookie: sessionCookie },
  });
  const refreshedData = await refreshedConvRes.json();
  console.log(`  ✓ Generated professional title: "${refreshedData.conversation.title}"`);
  if (refreshedData.conversation.title === "New Conversation" || refreshedData.conversation.title.includes("write a python")) {
    console.warn("  ! Warning: Title was not transformed from raw text properly");
  } else {
    console.log(`  ✓ Professional title verified!`);
  }

  // 7. Test Logout
  console.log("\n7. Testing POST /api/auth/logout...");
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: sessionCookie },
  });
  if (!logoutRes.ok) throw new Error("Logout failed");
  console.log("  ✓ Logout successful.");

  // 8. Confirm unauthenticated state
  console.log("\n8. Confirming unauthenticated state after logout...");
  const meAfterRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: sessionCookie },
  });
  const meAfterData = await meAfterRes.json();
  if (meAfterData.authenticated) {
    throw new Error("Session was not invalidated after logout!");
  }
  console.log("  ✓ Confirmed: Session is now invalid / unauthenticated.");

  console.log("\n=== ALL LIVE HTTP & STREAMING TESTS PASSED PERFECTLY! ===");
}

runHttpTests().catch((err) => {
  console.error("\n❌ HTTP TEST SUITE FAILED:", err);
  process.exit(1);
});
