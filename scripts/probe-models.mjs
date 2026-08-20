import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No GEMINI_API_KEY found!");
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey });

async function probe() {
  console.log("=== PROBING ALL GEMINI MODELS WITH REAL 'hi' REQUEST ===\n");
  
  const list = await client.models.list();
  const candidateModels = [];
  for await (const m of list) {
    const id = m.name.replace("models/", "");
    if (
      !id.includes("embedding") &&
      !id.includes("aqa") &&
      !id.includes("clip") &&
      !id.includes("robotics") &&
      !id.includes("native-audio") &&
      !id.includes("live") &&
      !id.includes("tts") &&
      !id.includes("veo") &&
      !id.includes("computer-use") &&
      !id.includes("preview-customtools")
    ) {
      candidateModels.push(id);
    }
  }

  console.log("Candidate text models found:", candidateModels);
  console.log("--------------------------------------------------");

  const workingModels = [];
  const failingModels = [];

  for (const model of candidateModels) {
    try {
      const start = Date.now();
      const res = await client.models.generateContent({
        model,
        contents: "hi",
      });
      const elapsed = Date.now() - start;
      const text = res.text?.trim() || "(empty response)";
      console.log(`✓ [${elapsed}ms] ${model} -> "${text.slice(0, 40)}"`);
      workingModels.push({ model, elapsed, text });
    } catch (err) {
      console.log(`✗ FAILED: ${model} -> status: ${err.status}, msg: ${err.message?.slice(0, 100)}`);
      failingModels.push({ model, status: err.status, message: err.message });
    }
  }

  console.log("\n--------------------------------------------------");
  console.log("Summary of working models:", workingModels.map(w => `${w.model} (${w.elapsed}ms)`));
  console.log("Summary of failing models:", failingModels.map(f => `${f.model} (${f.status})`));
}

probe().catch(console.error);
