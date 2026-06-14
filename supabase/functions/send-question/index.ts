// AI-HRconnect — Edge Function to forward "Задай питання" form submissions to admin email
// Deploy via Supabase Dashboard → Edge Functions → New function → paste this code.
// Set secrets: RESEND_API_KEY, ADMIN_EMAIL (where to forward), FROM_EMAIL

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, position, phone, email, question } = await req.json();

    if (!name || !email || !question) {
      return new Response(JSON.stringify({ error: "name, email and question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "info@hrconnect.com.ua";
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "AI-HRconnect <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `<!doctype html>
<html><body style="margin:0; padding:0; background:#f5f7fa; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#1a2332;">
  <div style="max-width:560px; margin:24px auto; background:white; border-radius:14px; overflow:hidden; box-shadow:0 4px 20px rgba(15,30,50,0.08);">
    <div style="background:linear-gradient(135deg,#D97706 0%,#B45309 100%); color:white; padding:24px 32px;">
      <div style="font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.06em; opacity:0.9;">AI-HRconnect</div>
      <h1 style="margin:6px 0 0; font-size:20px; font-weight:800;">💬 Нове питання з сайту</h1>
    </div>
    <div style="padding:28px 32px;">
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr><td style="padding:8px 0; color:#64748b; width:120px;">Імʼя:</td><td style="padding:8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
        ${position ? `<tr><td style="padding:8px 0; color:#64748b;">Посада:</td><td style="padding:8px 0;">${escapeHtml(position)}</td></tr>` : ""}
        ${phone ? `<tr><td style="padding:8px 0; color:#64748b;">Телефон:</td><td style="padding:8px 0;"><a href="tel:${escapeHtml(phone)}" style="color:#1f4e78;">${escapeHtml(phone)}</a></td></tr>` : ""}
        <tr><td style="padding:8px 0; color:#64748b;">Email:</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#1f4e78;">${escapeHtml(email)}</a></td></tr>
      </table>
      <div style="margin-top:20px; padding:16px 18px; background:#f8fafc; border-left:3px solid #1f4e78; border-radius:6px;">
        <div style="color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Питання</div>
        <div style="white-space:pre-wrap; line-height:1.55;">${escapeHtml(question)}</div>
      </div>
      <div style="margin-top:24px; text-align:center;">
        <a href="mailto:${escapeHtml(email)}?subject=Re: ваше питання до AI-HRconnect" style="background:#1f4e78; color:white; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">Відповісти</a>
      </div>
    </div>
    <div style="padding:14px 32px; background:#f8fafc; color:#94a3b8; font-size:11px; text-align:center; border-top:1px solid #e4e8ee;">
      Автоматичне повідомлення з форми «Задай питання» · AI-HRconnect
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
        to: ADMIN_EMAIL,
        reply_to: email,
        subject: `[Питання з сайту] ${name}${position ? " (" + position + ")" : ""}`,
        html: html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      return new Response(JSON.stringify({ error: "resend failed", details: err }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
