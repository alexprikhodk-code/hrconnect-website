// AI-HRconnect — Edge Function to notify HR when candidate completes a test.
// Deploy via Supabase Dashboard → Edge Functions → New function → paste this code.
// Set secrets: RESEND_API_KEY, SITE_URL, FROM_EMAIL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TEST_LABELS: Record<string, string> = {
  main: "Основний тест продуктивності",
  productivity: "Тест на продуктивність",
  enneagram: "Тест Еннеаграма",
  disc: "Тест DISC",
  bigfive: "Тест Big Five",
  iq: "IQ-тест",
  reproduction: "Тест на відтворення",
  all: "Усі призначені тести",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { candidate_id, test_type } = await req.json();
    console.log("notify-test-complete called", { candidate_id, test_type });

    if (!candidate_id) {
      return new Response(JSON.stringify({ error: "candidate_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up candidate
    const { data: candidate, error: cErr } = await supabase
      .from("candidates")
      .select("id, name, position, user_id")
      .eq("id", candidate_id)
      .single();

    if (cErr || !candidate) {
      return new Response(JSON.stringify({ error: "candidate not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up owner profile
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", candidate.user_id)
      .single();

    if (pErr || !profile || !profile.email) {
      console.error("profile not found or no email", { pErr, profile });
      return new Response(JSON.stringify({ error: "owner profile not found", details: pErr?.message, profile }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("sending to:", profile.email);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SITE_URL = Deno.env.get("SITE_URL") || "https://hrconnect-website.vercel.app";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "AI-HRconnect <onboarding@resend.dev>";
    const testLabel = TEST_LABELS[test_type] || "Тест";
    const candidateUrl = `${SITE_URL}/app/candidate.html?id=${candidate.id}`;

    const html = `<!doctype html>
<html><body style="margin:0; padding:0; background:#f5f7fa; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#1a2332;">
  <div style="max-width:560px; margin:24px auto; background:white; border-radius:14px; overflow:hidden; box-shadow:0 4px 20px rgba(15,30,50,0.08);">
    <div style="background:linear-gradient(135deg,#1f4e78 0%,#2e7d8f 100%); color:white; padding:28px 32px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <span style="font-size:22px;">🎉</span>
        <span style="font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.06em; opacity:0.9;">AI-HRconnect</span>
      </div>
      <h1 style="margin:0; font-size:22px; font-weight:800;">Кандидат завершив тест</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 14px; font-size:15px;">Привіт, ${escapeHtml(profile.full_name || "HR")}!</p>
      <p style="margin:0 0 18px; font-size:15px; line-height:1.55;">
        <strong>${escapeHtml(candidate.name)}</strong> щойно завершив(-ла) <strong>${escapeHtml(testLabel)}</strong>.
      </p>
      ${candidate.position ? `<div style="background:#f8fafc; border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:14px;"><span style="color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Посада</span><br>${escapeHtml(candidate.position)}</div>` : ""}
      <div style="text-align:center; margin:28px 0 14px;">
        <a href="${candidateUrl}" style="background:#1f4e78; color:white; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:700; display:inline-block; font-size:15px;">Переглянути результат →</a>
      </div>
      <p style="color:#64748b; font-size:13px; text-align:center; margin:14px 0 0;">або відкрийте посилання: <br><a href="${candidateUrl}" style="color:#2e7d8f;">${candidateUrl}</a></p>
    </div>
    <div style="padding:16px 32px; background:#f8fafc; color:#94a3b8; font-size:11px; text-align:center; border-top:1px solid #e4e8ee;">
      Автоматичне повідомлення · AI-HRconnect
    </div>
  </div>
</body></html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: profile.email,
        subject: `${candidate.name} завершив(-ла) ${testLabel}`,
        html: html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("Resend API error", resendRes.status, err);
      return new Response(JSON.stringify({ error: "resend failed", status: resendRes.status, details: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
