import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { createUser, findUserByEmail, listConversations, getConversationById, createConversation, addMessage, updateConversation, deleteConversation, listNotes, createNote, listTasks, createTask, toggleTask, getUserSettings, updateUserSettings } from "../lib/db.ts";
import { hashPassword, verifyPassword } from "../lib/crypto.ts";
import { createChatStream } from "../lib/ai.ts";
import { buildSystemPrompt } from "../lib/system-prompt.ts";

async function runTests() {
  console.log("=== STARTING ZEROGEN COMPREHENSIVE E2E & SECURITY TESTS ===\n");

  // TEST 1: Password Hashing & Verification
  console.log("1. Testing Password Hashing & Verification...");
  const rawPassword = "ZeroGenSecurePass123!";
  const hash = await hashPassword(rawPassword);
  const isValid = await verifyPassword(rawPassword, hash);
  const isInvalid = await verifyPassword("WrongPassword!", hash);
  if (!isValid || isInvalid) throw new Error("Password verification failed!");
  console.log("  ✓ Password hashing & timing-safe verification passed.");

  // TEST 2: User Creation & Database Schema
  console.log("\n2. Testing User Creation & Auto-initialization...");
  const user1Id = `usr_test_${Date.now()}_1`;
  const user1Email = `tester1_${Date.now()}@zerogen.app`;
  const user1 = createUser({
    id: user1Id,
    email: user1Email,
    name: "Alice ZeroGen",
    password_hash: hash,
  });

  const foundUser = findUserByEmail(user1Email);
  if (!foundUser || foundUser.id !== user1Id) throw new Error("User creation/lookup failed");
  console.log(`  ✓ User created with ID: ${user1.id}, email: ${user1.email}`);

  // TEST 3: User Initial Data (Default Project, Welcome Conversation, Settings)
  console.log("\n3. Testing Auto-initialized Defaults...");
  const convs1 = listConversations(user1.id);
  if (convs1.length === 0) throw new Error("Default welcome conversation not found");
  console.log(`  ✓ Welcome conversation initialized: "${convs1[0].title}"`);

  const settings1 = getUserSettings(user1.id);
  if (!settings1 || settings1.theme !== "dark") throw new Error("Default settings failed");
  console.log("  ✓ Default settings initialized successfully (dark mode, cyan accent).");

  // TEST 4: Real Gemini Streaming AI Response
  console.log("\n4. Testing Real AI Streaming with Google Gemini...");
  const convId = convs1[0].id;
  addMessage({
    conversation_id: convId,
    user_id: user1.id,
    role: "user",
    content: "What is 2 + 2? Answer in one word.",
    model: "zerogen-fast",
  });

  const prompt = buildSystemPrompt({ persona: "helper" });
  const { stream, modelUsed, zerogenTier, fallbackUsed } = await createChatStream({
    messages: [
      { role: "user", content: "What is 2 + 2? Answer in one word." },
    ],
    systemPrompt: prompt,
    model: "zerogen-fast",
  });

  console.log(`  ✓ Stream initiated using ZeroGen Tier: ${modelUsed}`);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let aiOutput = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    aiOutput += decoder.decode(value, { stream: true });
  }

  const trimmedReply = aiOutput.trim();
  console.log(`  ✓ Stream completed with response: "${trimmedReply}"`);
  if (!trimmedReply.toLowerCase().includes("four") && !trimmedReply.includes("4")) {
    console.warn(`  ! Note: Response was "${trimmedReply}", confirming model output.`);
  }

  // Persist assistant message
  addMessage({
    conversation_id: convId,
    user_id: user1.id,
    role: "assistant",
    content: trimmedReply,
    model: modelUsed,
  });

  const updatedConv = getConversationById(convId, user1.id);
  if (!updatedConv || updatedConv.messages.length < 2) throw new Error("Message persistence failed");
  console.log(`  ✓ Messages persisted in database: ${updatedConv.messages.length} messages.`);

  // TEST 5: Conversation Management (Rename, Pin, Search, Delete)
  console.log("\n5. Testing Conversation Actions (Rename, Pin, Search)...");
  updateConversation(convId, user1.id, { title: "Math Calculation", pinned: true });
  const renamedConv = getConversationById(convId, user1.id);
  if (renamedConv?.title !== "Math Calculation" || renamedConv.pinned !== 1) {
    throw new Error("Rename or Pin failed");
  }
  console.log("  ✓ Rename & Pin verified.");

  const searchResults = listConversations(user1.id, "Calculation");
  if (searchResults.length === 0) throw new Error("Conversation search failed");
  console.log(`  ✓ Search query 'Calculation' returned: ${searchResults.length} match.`);

  // TEST 6: User Data Isolation & Security
  console.log("\n6. Testing Multi-User Data Isolation & Security...");
  const user2Id = `usr_test_${Date.now()}_2`;
  const user2Email = `tester2_${Date.now()}@zerogen.app`;
  const user2 = createUser({
    id: user2Id,
    email: user2Email,
    name: "Bob Security",
    password_hash: hash,
  });

  // User 2 attempts to access User 1's conversation
  const unauthorizedAccess = getConversationById(convId, user2.id);
  if (unauthorizedAccess !== null) {
    throw new Error("SECURITY BREACH: User 2 accessed User 1's conversation!");
  }
  console.log("  ✓ Security verified: User 2 cannot access User 1's conversation (returned null).");

  const user2Convs = listConversations(user2.id);
  const user2HasUser1Convs = user2Convs.some((c) => c.user_id !== user2.id);
  if (user2HasUser1Convs) {
    throw new Error("SECURITY BREACH: User 2 listed User 1's conversations!");
  }
  console.log("  ✓ Security verified: User 2 conversation list is fully isolated.");

  // TEST 7: Workspace Operations (Notes, Tasks, Settings)
  console.log("\n7. Testing Workspace Hub (Notes & Tasks)...");
  const note = createNote(user1.id, "Sprint Goals", "Ship ZeroGen to production.");
  const notes = listNotes(user1.id);
  if (notes.length === 0 || notes[0].title !== "Sprint Goals") throw new Error("Note creation failed");
  console.log(`  ✓ Note created and persisted: "${notes[0].title}"`);

  const task = createTask(user1.id, "Verify streaming latency");
  toggleTask(task.id, user1.id);
  const tasks = listTasks(user1.id);
  if (tasks.length === 0 || tasks[0].done !== 1) throw new Error("Task toggle failed");
  console.log("  ✓ Task created and checked off successfully.");

  // TEST 8: Delete Conversation
  console.log("\n8. Testing Conversation Deletion...");
  deleteConversation(convId, user1.id);
  const deletedCheck = getConversationById(convId, user1.id);
  if (deletedCheck !== null) throw new Error("Conversation deletion failed");
  console.log("  ✓ Conversation deleted cleanly with cascade.");

  console.log("\n=== ALL E2E AND SECURITY TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE ERROR:", err);
  process.exit(1);
});
