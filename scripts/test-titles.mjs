import { generateConversationTitle, generateLocalFallbackTitle, isGreetingOrTrivial } from "../lib/title-generator.ts";

const testCases = [
  { input: "hi", expected: "New Conversation" },
  { input: "hello!", expected: "New Conversation" },
  { input: "what is 2 + 2?", expected: "Simple Arithmetic Question" },
  { input: "write a python program to calculate factorial", expected: "Python Factorial Program" },
  { input: "help me build a futuristic landing page", expected: "Futuristic Landing Page" },
  { input: "why am I getting a 401 error from OpenAI?", expected: "OpenAI 401 Error" },
  { input: "explain photosynthesis", expected: "Photosynthesis Explained" },
  { input: "explain quantum computing like I'm 15", expected: "Quantum Computing Explained" },
  { input: "build me a login page in react", expected: "React Login Page" },
];

async function runTests() {
  console.log("=== TESTING ZERO-GEN PROFESSIONAL TITLE GENERATION ===\n");

  console.log("1. Testing Local Fallback Generator:");
  for (const { input, expected } of testCases) {
    const title = generateLocalFallbackTitle(input);
    console.log(`  Input:    "${input}"`);
    console.log(`  Result:   "${title}" (Expected: "${expected}")\n`);
  }

  console.log("\n2. Testing Asynchronous AI Title Generation (Live Gemini):");
  for (const { input, expected } of testCases) {
    const title = await generateConversationTitle(input);
    console.log(`  Input:    "${input}"`);
    console.log(`  Result:   "${title}"\n`);
  }
}

runTests().catch(console.error);
