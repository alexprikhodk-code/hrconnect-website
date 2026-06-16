// AI-HRconnect — Edge Function: AI-аналіз резюме через Anthropic Claude
// Set secrets: ANTHROPIC_API_KEY
// Deploy: Supabase Dashboard → Edge Functions → New function "analyze-resume"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Ти — HR-аналітик платформи AI-HRconnect. Твоя задача — отримати текст резюме кандидата і дати структуровану експертну оцінку за методологією 6 тестів продукту:

1) Продуктивність (методологія HRconnect/Performia) — здатність бачити свій "продукт посади", давати конкретні вимірювані результати, перевиконувати плани. Підсумок: вердикт Перформер (продуктивний та ефективний) або Делатель (виконавець).
2) Еннеаграма (9 типів) — оцінити домінантний тип за стилем формулювань, кар'єрною траєкторією, мотиваціями.
3) DISC (Dominance/Influence/Steadiness/Conscientiousness) — стиль робочої поведінки.
4) Big Five (OCEAN) — Відкритість досвіду / Сумлінність / Екстраверсія / Доброзичливість / Невротизм.
5) IQ — оцінити рівень: складність ролей, рівень освіти, аналітичні задачі, мовна точність. Шкала: 70-89 Низький, 90-109 Середній, 110-119 Вище середнього, 120-134 Високий, 135+ Дуже високий.
6) Здатність відтворення — точність формулювань, структура викладу. Шкала 0-100.

КРИТИЧНО ВАЖЛИВО:
- Це АНАЛІЗ НА ОСНОВІ РЕЗЮМЕ, не повноцінне тестування. Confidence знижуй на 1 рівень порівняно з тестом.
- НЕ вигадуй цифр, яких немає. Якщо в резюме мало даних — пиши "недостатньо даних", занижуй впевненість.
- Усі тексти ВИКЛЮЧНО українською мовою.
- Відповідай ВИКЛЮЧНО валідним JSON без жодного тексту до або після. Без \u0060\u0060\u0060 блоків. Без preamble. Без коментарів. Тільки JSON-об'єкт, який починається з { і закінчується }.

Структура відповіді:
{
  "name": "повне ім'я з резюме або null",
  "position": "поточна/остання посада або null",
  "age": число або null,
  "email": "email з резюме або null",
  "phone": "телефон з резюме або null",
  "verdict": "Перформер" | "Делатель",
  "verdict_confidence": "низька" | "помірна" | "висока",
  "verdict_score": число від -5 до +10,
  "verdict_reasons": ["причина 1", "причина 2", ...],
  "product_self": "як кандидат бачить свій продукт посади (цитата або переказ)",
  "iq": число 70-145,
  "iq_band": "Низький" | "Середній" | "Вище середнього" | "Високий" | "Дуже високий",
  "iq_summary": "обґрунтування оцінки IQ за резюме",
  "reproduction": число 0-100,
  "reproduction_band": "Низький" | "Прийнятний" | "Середній" | "Високий",
  "reproduction_summary": "обґрунтування",
  "enneagram_type": число 1-9,
  "enneagram_summary": "обґрунтування домінантного типу",
  "disc_dominant": "D" | "I" | "S" | "C",
  "disc_profile": "опис профілю в один-два слова",
  "disc_summary": "обґрунтування",
  "bigfive_dominant": "O" | "C" | "E" | "A" | "N",
  "bigfive_scores": {"O": число 0-100, "C": число 0-100, "E": число 0-100, "A": число 0-100, "N": число 0-100},
  "bigfive_summary": "обґрунтування",
  "points": {
    "A": {"label": "Стабільність", "score": -100..100, "level": "Низький|Середній|Високий", "thesis": "коротка теза", "full": "повний опис"},
    "B": {"label": "Щастя", "score": ..., ...},
    "C": {"label": "Самоволодіння", ...},
    "D": {"label": "Впевненість", ...},
    "E": {"label": "Активність", ...},
    "F": {"label": "Наполегливість", ...},
    "G": {"label": "Відповідальність", ...},
    "H": {"label": "Правильність оцінки", ...},
    "I": {"label": "Чуйність", ...},
    "J": {"label": "Спілкування", ...}
  },
  "strengths": ["сильна сторона 1", "сильна сторона 2", ...],
  "risks": ["ризик / зона уваги 1", "ризик 2", ...],
  "recommendation": "Загальна рекомендація на 2-3 речення — кого шукати, на яку роль, з якими застереженнями",
  "missing_data": ["чого бракує в резюме, щоб дати точнішу оцінку"]
}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { resume_text, position_context, candidate_name_hint } = await req.json();
    if (!resume_text || resume_text.trim().length < 100) {
      return new Response(JSON.stringify({ error: "resume_text занадто короткий (мінімум 100 символів)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY не сконфігуровано в Edge Function secrets" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const MODEL_OVERRIDE = Deno.env.get("ANTHROPIC_MODEL");
const MODEL_CHAIN = MODEL_OVERRIDE ? [MODEL_OVERRIDE] : [
  "claude-opus-4-8",        // newest, most capable
  "claude-sonnet-4-6",      // balanced
  "claude-haiku-4-5",       // fastest fallback
];
let MODEL = MODEL_CHAIN[0]; // will be updated in loop
    const userPrompt = `Проаналізуй наступне резюме:

${position_context ? `КОНТЕКСТ: HR розглядає кандидата на посаду — "${position_context}".\n\n` : ""}${candidate_name_hint ? `Підказка по імені: ${candidate_name_hint}\n\n` : ""}--- РЕЗЮМЕ ---
${resume_text.slice(0, 25000)}
--- КІНЕЦЬ РЕЗЮМЕ ---

Поверни лише валідний JSON за вказаною схемою.`;

    let aiResp: Response | null = null;
    let lastErrText = "";
    let lastErrStatus = 0;
    for (const modelTry of MODEL_CHAIN) {
      MODEL = modelTry;
      console.log(`Trying model: ${MODEL}`);
      aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{
          name: "submit_candidate_analysis",
          description: "Submit the structured analysis of the candidate based on the resume",
          input_schema: {
            type: "object",
            properties: {
              name: { type: ["string","null"], description: "Full name from resume" },
              position: { type: ["string","null"], description: "Current/last position" },
              age: { type: ["number","null"] },
              email: { type: ["string","null"] },
              phone: { type: ["string","null"] },
              verdict: { type: "string", enum: ["Перформер","Делатель"] },
              verdict_confidence: { type: "string", enum: ["низька","помірна","висока"] },
              verdict_score: { type: "number" },
              verdict_reasons: { type: "array", items: { type: "string" } },
              product_self: { type: ["string","null"] },
              iq: { type: ["number","null"], minimum: 70, maximum: 145 },
              iq_band: { type: ["string","null"] },
              iq_summary: { type: ["string","null"] },
              reproduction: { type: ["number","null"], minimum: 0, maximum: 100 },
              reproduction_band: { type: ["string","null"] },
              reproduction_summary: { type: ["string","null"] },
              enneagram_type: { type: ["number","null"], minimum: 1, maximum: 9 },
              enneagram_summary: { type: ["string","null"] },
              disc_dominant: { type: ["string","null"], enum: ["D","I","S","C", null] },
              disc_profile: { type: ["string","null"] },
              disc_summary: { type: ["string","null"] },
              bigfive_dominant: { type: ["string","null"], enum: ["O","C","E","A","N", null] },
              bigfive_scores: { type: ["object","null"] },
              bigfive_summary: { type: ["string","null"] },
              points: { type: ["object","null"], description: "10 traits A-J with score/level/thesis/full" },
              strengths: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              recommendation: { type: "string" },
              missing_data: { type: "array", items: { type: "string" } }
            },
            required: ["verdict","verdict_confidence","verdict_score","verdict_reasons","strengths","risks","recommendation"]
          }
        }],
        tool_choice: { type: "tool", name: "submit_candidate_analysis" },
        messages: [{ role: "user", content: userPrompt }],
      }),
      });
      // If success or non-model-related error → break
      if (aiResp.ok) break;
      lastErrText = await aiResp.text();
      lastErrStatus = aiResp.status;
      console.warn(`Model ${MODEL} failed:`, aiResp.status, lastErrText.slice(0, 300));
      // Only continue to next model on 404 (model not found) or 400 (bad model)
      if (aiResp.status !== 404 && aiResp.status !== 400) break;
    }
    if (!aiResp) {
      return new Response(JSON.stringify({ error: "No model attempted (chain empty)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!aiResp.ok) {
      console.error("All models failed. Last error:", aiResp.status, lastErrText.slice(0, 500));
      let errParsed: any = null;
      try { errParsed = JSON.parse(lastErrText); } catch(e) {}
      const errMsg = errParsed?.error?.message || lastErrText.slice(0, 400);
      return new Response(JSON.stringify({
        error: `Жодна з моделей не відповіла. Остання помилка (${aiResp.status}): ${errMsg}`,
        tried_models: MODEL_CHAIN,
        last_model: MODEL,
        details: errParsed || lastErrText.slice(0, 800)
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = await aiResp.json();
    console.log("AI response stop_reason:", result.stop_reason, "content blocks:", result.content?.length);

    // Find the tool_use block in the response
    const toolUseBlock = result.content?.find((b: any) => b.type === "tool_use" && b.name === "submit_candidate_analysis");
    if (!toolUseBlock) {
      console.error("No tool_use block found. Full response:", JSON.stringify(result).slice(0, 1500));
      return new Response(JSON.stringify({
        error: "AI не викликав tool_use. Можливо модель не підтримує tools.",
        raw_response: result,
        model_used: MODEL
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const analysis = toolUseBlock.input;
    console.log("Analysis extracted via tool_use:", Object.keys(analysis));

    const meta = {
      model: MODEL,
      input_tokens: result.usage?.input_tokens,
      output_tokens: result.usage?.output_tokens,
      prompt_version: "v1.0",
      analyzed_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ ok: true, analysis, meta }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("analyze-resume crash:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
