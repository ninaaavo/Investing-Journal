// api/analyze.js
import OpenAI from "openai";
import admin from "firebase-admin";

import {
  initFirebaseAdmin,
  getBearerToken,
  promptSystem,
  promptUser,
  buildTimeframeKPIs,
  fetchUserBundle,
  buildBehaviorAndPortfolio,
  safeParseLLMJson,
  mergeAnalysis,
  normalizeSection,
} from "../lib/analysis.js"; // adjust path if api/ is at project root

initFirebaseAdmin(admin);
const db = admin.firestore();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const startedAt = Date.now();
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const idToken = getBearerToken(req);
    if (!idToken) return res.status(401).json({ error: "Missing token" });
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const userBundle = await fetchUserBundle(db, uid);
    const perTF = buildTimeframeKPIs(userBundle.dailySnapshots);
    const { behavior, portfolio } = buildBehaviorAndPortfolio(userBundle.stats);

    const r = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: promptSystem }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: promptUser },
            {
              type: "input_text",
              text:
                "PER_TIMEFRAME_AND_STATS_JSON:\n" +
                JSON.stringify({ perTimeframe: perTF, behavior, portfolio }),
            },
          ],
        },
      ],
      max_output_tokens: 1200,
    });

    const analysisLLM = safeParseLLMJson(r);
    const merged = mergeAnalysis(perTF, analysisLLM);

    const behaviorLLM = normalizeSection(analysisLLM?.behavior || {});
    const portfolioLLM = normalizeSection(analysisLLM?.portfolio || {});
    const behaviorOut =
      behaviorLLM.summary || behaviorLLM.insights.length || behaviorLLM.actions.length
        ? { ...behaviorLLM, stats: behavior }
        : { stats: behavior };
    const portfolioOut =
      portfolioLLM.summary || portfolioLLM.insights.length || portfolioLLM.actions.length
        ? { ...portfolioLLM, stats: portfolio }
        : { stats: portfolio };

    return res.status(200).json({
      analyzedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      analysis: merged,
      behavior: behaviorOut,
      portfolio: portfolioOut,
    });
  } catch (e) {
    console.error("[/api/analyze] error:", e);
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
