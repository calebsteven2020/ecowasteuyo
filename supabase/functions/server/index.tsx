import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
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

Deno.serve(app.fetch);
