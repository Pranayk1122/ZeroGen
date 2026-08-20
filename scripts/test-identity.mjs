import { createChatStream } from "../lib/ai.ts";
import { buildSystemPrompt } from "../lib/system-prompt.ts";

const identityQuestions = [
  "Who are you?",
  "Who created you?",
  "Who made you?",
  "What model are you?",
  "Are you Gemini?",
  "Are you made by Google?",
  "What powers you?",
];

async function runIdentityTests() {
  console.log("=== TESTING ZEROGEN AI IDENTITY INTEGRITY ===\n");

  const systemPrompt = buildSystemPrompt({ persona: "helper" });
  let allPassed = true;

  for (const question of identityQuestions) {
    console.log(`Query: "${question}"`);

    const { stream, modelUsed, zerogenTier } = await createChatStream({
      messages: [{ role: "user", content: question }],
      systemPrompt,
      model: "zerogen-fast",
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let response = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response += decoder.decode(value, { stream: true });
    }

    const trimmed = response.trim();
    console.log(`Response:\n${trimmed}\n`);

    // Strict validation assertions
    const lower = trimmed.toLowerCase();

    // Check 1: Must never affirm "created by Google", "trained by Google", or "Google created me"
    const forbiddenGoogleCreated =
      /(?<!not\s+|never\s+)(?:i am|i was|i'm)\s+(?:created|trained|made|built)\s+by\s+google/i.test(lower) ||
      /(?<!not\s+|never\s+)google\s+(?:created|trained|made|built)\s+me/i.test(lower);

    // Check 2: Must never affirm "I am Gemini"
    const forbiddenGeminiIdentity =
      /(?<!not\s+|never\s+)\bi am gemini\b/i.test(lower) ||
      /(?<!not\s+|never\s+)\bi'm gemini\b/i.test(lower) ||
      /(?<!not\s+|never\s+)\bmy name is gemini\b/i.test(lower);

    // Check 3: Must never leak raw internal model IDs
    const forbiddenRawIDs =
      /gemini-3\.\d/i.test(lower) ||
      /gemini-flash/i.test(lower) ||
      /gpt-4o/i.test(lower);

    // Check 4: Must identify as ZeroGen
    const identifiesAsZeroGen = /zerogen/i.test(lower);

    if (forbiddenGoogleCreated) {
      console.error(`❌ FAILED: Response incorrectly claims Google created ZeroGen!`);
      allPassed = false;
    } else if (forbiddenGeminiIdentity) {
      console.error(`❌ FAILED: Response incorrectly claims identity is Gemini!`);
      allPassed = false;
    } else if (forbiddenRawIDs) {
      console.error(`❌ FAILED: Response leaks internal model ID!`);
      allPassed = false;
    } else if (!identifiesAsZeroGen) {
      console.error(`❌ FAILED: Response does not mention ZeroGen!`);
      allPassed = false;
    } else {
      console.log(`✓ PASSED: Identified correctly as ZeroGen without provider leaks.\n--------------------------------------------------`);
    }
  }

  if (!allPassed) {
    console.error("\n❌ IDENTITY TEST SUITE FAILED.");
    process.exit(1);
  } else {
    console.log("\n=== ALL IDENTITY TESTS PASSED PERFECTLY! ===");
  }
}

runIdentityTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
