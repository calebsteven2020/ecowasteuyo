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

    const isAdmin = profile?.is_admin === true || user.email === (Deno.env.get("ADMIN_EMAIL") ?? "admin@admin.com");
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
    if (user.email !== (Deno.env.get("ADMIN_EMAIL") ?? "admin@admin.com")) {
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

// ── Push notifications (Firebase Cloud Messaging) ───────────────────
// Sends via FCM's current HTTP v1 API, which needs a short-lived OAuth2
// access token minted from a Firebase service account — Google retired
// the old "legacy server key" approach, so there's no simple static API
// key here. Set the *entire* service account JSON as one secret:
//
//   supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...",...}'
//
// Get that JSON from: Firebase console → Project settings → Service
// accounts → Generate new private key (downloads a .json file — paste its
// full contents as the secret value, on one line).
//
// Everything below is a no-op (logged, never throws) until that secret is
// set, so it never blocks the admin action or cron job that triggered it.

let cachedFcmToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getFcmAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) {
    console.error("[push] FCM_SERVICE_ACCOUNT_JSON is not set — skipping send");
    return null;
  }

  let serviceAccount: { project_id: string; client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    console.error("[push] FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
  const projectId = serviceAccount.project_id;

  // Reuse the token until shortly before it expires (Google issues them
  // valid for 1hr) instead of minting a fresh one on every single send.
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now() + 30_000) {
    return { token: cachedFcmToken.token, projectId };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const enc = new TextEncoder();
    const headerB64 = base64UrlEncode(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const claimsB64 = base64UrlEncode(enc.encode(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })));
    const signingInput = `${headerB64}.${claimsB64}`;

    const pemBody = serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s/g, "");
    const keyBytes = Uint8Array.from(atob(pemBody), ch => ch.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBytes.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(signingInput));
    const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[push] FCM token exchange failed:", tokenRes.status, await tokenRes.text());
      return null;
    }

    const tokenData = await tokenRes.json();
    cachedFcmToken = { token: tokenData.access_token, expiresAt: Date.now() + tokenData.expires_in * 1000 };
    return { token: tokenData.access_token, projectId };
  } catch (err) {
    console.error("[push] failed to mint FCM access token:", err);
    return null;
  }
}

async function sendPushToUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const auth = await getFcmAccessToken();
  if (!auth) return;

  const { data: tokens, error } = await supabaseAdmin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);

  if (error) { console.error("[push] failed to look up tokens:", error); return; }
  if (!tokens || tokens.length === 0) return;

  for (const { token } of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[push] send failed for a token:`, errText);
      // Token belongs to an uninstalled app / expired registration —
      // stop trying it so it doesn't just fail silently forever.
      if (errText.includes("UNREGISTERED") || errText.includes("NOT_FOUND")) {
        await supabaseAdmin.from("push_tokens").delete().eq("token", token);
      }
    }
  }
}

// ── Send a push notification to one person ──────────────────────────
// Called from AdminDashboard after approving/rejecting a bank-transfer
// receipt. Admin-only — verified the same way create-agent above is.
app.post("/make-server-fdf6bf9b/send-push", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return c.json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabaseAdmin.from("profiles").select("is_admin").eq("id", user.id).single();
    const isAdmin = profile?.is_admin === true || user.email === (Deno.env.get("ADMIN_EMAIL") ?? "admin@admin.com");
    if (!isAdmin) return c.json({ error: "Forbidden — admin only" }, 403);

    const { userId, title, body, data } = await c.req.json();
    if (!userId || !title || !body) return c.json({ error: "userId, title and body are required" }, 400);

    await sendPushToUser(supabaseAdmin, userId, title, body, data ?? {});
    return c.json({ success: true });
  } catch (err) {
    console.error("send-push error:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// ── Day-of pickup reminders (scheduled, not called from the app) ────
// Meant to be triggered once a day by Supabase's pg_cron (see the SQL at
// the bottom of supabase/schema.sql) rather than by a person, so it's
// protected by a shared secret instead of a login:
//   supabase secrets set CRON_SECRET=some-long-random-string
// Reminds everyone with a one-off pickup (see the `pickups` table —
// booked via BookPickup.tsx) scheduled for today. Subscriptions don't
// have a stored weekly pickup day in the schema (only a manual "trash
// ready" toggle), so there's nothing to remind subscribers about yet —
// that'd need a real pickup-day field added first.
app.post("/make-server-fdf6bf9b/send-pickup-reminders", async (c) => {
  try {
    const cronSecret = c.req.header("x-cron-secret");
    if (!cronSecret || cronSecret !== Deno.env.get("CRON_SECRET")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Matches the "MMM dd, yyyy" format BookPickup.tsx saves pickup_date
    // as (e.g. "Jul 16, 2026") — West Africa Time, since that's where the
    // service operates.
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const today = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, "0")}, ${now.getFullYear()}`;

    const { data: pickups, error } = await supabaseAdmin
      .from("pickups")
      .select("user_id, pickup_time")
      .eq("status", "scheduled")
      .eq("pickup_date", today);

    if (error) return c.json({ error: error.message }, 500);

    for (const p of pickups ?? []) {
      await sendPushToUser(
        supabaseAdmin,
        p.user_id,
        "Pickup today! 🗑️",
        `Your EcoWaste Uyo pickup is scheduled for today${p.pickup_time ? ` around ${p.pickup_time}` : ""} — please have your waste ready.`
      );
    }

    return c.json({ success: true, sent: pickups?.length ?? 0 });
  } catch (err) {
    console.error("send-pickup-reminders error:", err);
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
- Be concise, warm, and plain-spoken — 2-4 sentences for most answers, longer only if the person is asking for a genuine step-by-step or list. If you don't know something, say so and point to the support contact rather than guessing.
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
          generationConfig: {
            maxOutputTokens: 1024,
            // Gemini 2.5+/3 models "think" before answering by default, and
            // those thinking tokens count against maxOutputTokens — on
            // anything that needs a bit of reasoning, thinking could eat
            // most of a small budget and cut the actual reply off mid-
            // sentence. This is a simple FAQ-style bot with no need for
            // extended reasoning, so thinking is switched off entirely.
            thinkingConfig: { thinkingBudget: 0 },
          },
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

    if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      console.warn("support-chat: reply hit the token limit and may be truncated:", reply);
    }

    return c.json({ reply });
  } catch (err) {
    console.error("support-chat error:", err);
    return c.json({ error: String(err) }, 500);
  }
});

Deno.serve(app.fetch);