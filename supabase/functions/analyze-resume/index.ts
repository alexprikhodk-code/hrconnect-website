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
- Відповідай ТІЛЬКИ валідним JSON без додаткових пояснень навколо. Без markdown-блоків.

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

    const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5";
    const userPrompt = `Проаналізуй наступне резюме:

${position_context ? `КОНТЕКСТ: HR розглядає кандидата на посаду — "${position_context}".\n\n` : ""}${candidate_name_hint ? `Підказка по імені: ${candidate_name_hint}\n\n` : ""}--- РЕЗЮМЕ ---
${resume_text.slice(0, 25000)}
--- КІНЕЦЬ РЕЗЮМЕ ---

Поверни лише валідний JSON за вказаною схемою.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
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
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Anthropic API error", aiResp.status, errText);
      let errParsed = null;
      try { errParsed = JSON.parse(errText); } catch(e) {}
      const errMsg = errParsed?.error?.message || errText.slice(0, 400);
      return new Response(JSON.stringify({
        error: `Anthropic ${aiResp.status}: ${errMsg}`,
        status: aiResp.status,
        details: errParsed || errText.slice(0, 800),
        model_used: MODEL
      }), {
        status: 200, // return 200 so Supabase SDK doesn't wrap error
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const result = await aiResp.json();
    const rawText = result.content?.[0]?.text || "";
    // Extract JSON (model sometimes wraps in code blocks despite instructions)
    let jsonStr = rawText.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fence) jsonStr = fence[1].trim();

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch (e) {
      return new Response(JSON.stringify({ error: "AI returned non-JSON", raw: rawText.slice(0, 1500) }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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
