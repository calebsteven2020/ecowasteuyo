import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono().basePath("/server");

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "apikey"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

// Health check
app.get("/make-server-fdf6bf9b/health", (c) => c.json({ status: "ok" }));

// ── Create agent account ─────────────────────────────────────────
// Called from AdminDashboard — creates auth user + sets is_agent flag
app.post("/make-server-fdf6bf9b/create-agent", async (c) => {
  try {
    // Verify the caller is an admin by checking their JWT
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

    // Create admin Supabase client using service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is an admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.is_admin === true || user.email === "admin@admin.com";
    if (!isAdmin) return c.json({ error: "Forbidden — admin only" }, 403);

    // Get agent details from request body
    const { name, email, password } = await c.req.json();
    if (!name || !email || !password) {
      return c.json({ error: "name, email and password are required" }, 400);
    }

    // Create the auth user
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createErr) {
      return c.json({ error: createErr.message }, 400);
    }

    // Set is_agent + full_name on their profile
    // Profile is auto-created by the handle_new_user trigger
    // Wait a moment for the trigger to fire
    await new Promise(r => setTimeout(r, 800));

    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        full_name: name,
        is_agent: true,
      }, { onConflict: "id" });

    return c.json({ success: true, userId: newUser.user.id });

  } catch (err) {
    console.error("create-agent error:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ── Delete agent account ─────────────────────────────────────────
app.delete("/make-server-fdf6bf9b/delete-agent", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    if (user.email !== "admin@admin.com") {
      const { data: profile } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", user.id).single();
      if (!profile?.is_admin) return c.json({ error: "Forbidden" }, 403);
    }

    const { email } = await c.req.json();
    if (!email) return c.json({ error: "email required" }, 400);

    // Find user by email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const target = users.find(u => u.email === email);
    if (target) {
      await supabaseAdmin.auth.admin.deleteUser(target.id);
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ── AI support chat ─────────────────────────────────────────────
// Called from SupportChat.tsx (the floating widget). Uses Google's Gemini
// API, which has an ongoing free tier (rate-limited, no card required, no
// expiry) — unlike OpenAI's or Anthropic's APIs, which are pay-per-token
// with only a small expiring trial credit for new accounts.
//
// Get a free key at https://aistudio.google.com/apikey (sign in with a
// Google account, no billing setup needed for the free tier), then:
//   supabase secrets set GEMINI_API_KEY=your-key-here
//   supabase functions deploy server
//
// The system prompt below is the bot's entire knowledge of the business —
// keep it in sync by hand when plans, pricing copy, payment methods, or
// contact details actually change (pulled from Subscriptions.tsx, Home.tsx,
// and Contact.tsx as of when this was written). It deliberately does NOT
// hardcode the ₦100 / ₦200 test values in Subscriptions.tsx — those look
// like Korapay test-mode placeholders, not real prices — and instead
// points people to the live Subscriptions page for the actual number.
const SUPPORT_SYSTEM_PROMPT = `You are the customer support assistant for EcoWaste Uyo, a subscription waste-collection service currently operating in Uyo, Akwa Ibom State, Nigeria.

What EcoWaste Uyo does:
- Residents and businesses subscribe to a plan instead of booking pickups one at a time.
- Two plans: Basic Plan (residential, 1 fixed pickup per week) and Commercial Plan (shops/offices, 2 fixed pickups per week, with priority truck routing and an option for daily pickup). Both include automatic monthly billing and WhatsApp/SMS pickup reminders.
- For exact current prices, don't state a specific number from memory — tell the person to check the Subscriptions page in their dashboard, since prices are shown live there and can change. The homepage advertises pricing "from ₦8,000/month" as a rough starting point.
- How it works: 1) create an account with name, email, password, and address, 2) subscribe to a plan, 3) a verified agent shows up automatically on the fixed pickup day — no booking needed — and sends an impact report after collection.
- Payment methods: Korapay (card, bank, or USSD — instant confirmation, auto-charged monthly) or manual Bank Transfer (the person transfers the money themselves and uploads a receipt; an admin then reviews and confirms it, usually within 24 hours). The "awaiting verification" status only appears once a receipt has actually been uploaded, not just from picking bank transfer as the method.
- Dashboard: shows the person's active plan, next pickup, payment/receipt history, and a profile page to update their name/address.
- Mobile app: an Android app is available as a direct APK download from the website (no Google Play Store listing yet). There is no iOS app yet.
- Service area: Uyo only, for now.
- Support contact for anything you can't resolve: support@ecowaste.ng, +234 800 ECO WASTE, or Oron Road, Uyo, Akwa Ibom.

How to behave:
- Only answer questions about EcoWaste Uyo — its plans, how it works, payments, the app, account basics, and general waste-collection/recycling questions related to the service.
- You do not have access to any individual person's account, subscription status, or payment records. Never guess or invent account-specific details — if someone asks about their own subscription or a specific payment, tell them to check their dashboard or contact support with the details above.
- Be concise, warm, and plain-spoken. If you don't know something, say so and point to the support contact rather than guessing.
- Don't make promises about pricing, refunds, or timelines beyond what's stated above, and don't discuss unrelated topics.`;

const GEMINI_MODEL = "gemini-flash-latest"; // alias that always points to Google's current recommended Flash model — avoids breaking again when a specific dated model (like gemini-2.5-flash) gets retired

app.post("/make-server-fdf6bf9b/support-chat", async (c) => {
  try {
    const { messages } = await c.req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "messages array is required" }, 400);
    }

    // Basic guardrails so one request can't balloon usage: cap history
    // length and per-message size.
    const trimmed = messages.slice(-20).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "").slice(0, 2000),
    }));

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return c.json({ error: "Support chat is not configured yet" }, 503);

    // Gemini's chat format: "contents" instead of "messages", and the
    // assistant's role is called "model" instead of "assistant". The
    // system prompt goes in a separate top-level "systemInstruction" field
    // rather than mixed into the message list.
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SUPPORT_SYSTEM_PROMPT }] },
          contents: trimmed.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: 500 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      return c.json({ error: "Support chat is temporarily unavailable" }, 502);
    }

    const data = await geminiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      ?? "Sorry, I couldn't put together a reply — please try again or reach out to support@ecowaste.ng.";

    return c.json({ reply });
  } catch (err) {
    console.error("support-chat error:", err);
    return c.json({ error: String(err) }, 500);
  }
});

Deno.serve(app.fetch);