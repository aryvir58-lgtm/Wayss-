import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const ADMIN_EMAIL = "vikashjagarwal08@gmail.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST required." });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(500, { error: "Server configuration is incomplete." });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Sign in required." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const actor = authData.user;
  if (authError || !actor || actor.email?.toLowerCase() !== ADMIN_EMAIL || !actor.email_confirmed_at) {
    return reply(403, { error: "Admin access denied. Use the verified admin email." });
  }

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON body." }); }
  const action = String(body?.action || "");
  const audit = async (actionName: string, targetId: string | null, details: Record<string, unknown> = {}) => {
    await admin.from("admin_audit_log").insert({ actor_id: actor.id, target_user_id: targetId, action: actionName, details });
  };
  const removeUserFiles = async (bucket: string, userId: string) => {
    const walk = async (folder: string): Promise<void> => {
      let offset = 0;
      while (true) {
        const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
        if (error) throw error;
        if (!data?.length) break;
        const files: string[] = [];
        for (const item of data as any[]) {
          const path = folder ? folder + "/" + item.name : item.name;
          if (item.id == null && !item.metadata) await walk(path);
          else files.push(path);
        }
        if (files.length) { const { error: removeError } = await admin.storage.from(bucket).remove(files); if (removeError) throw removeError; }
        if (data.length < 100) break;
        offset += 100;
      }
    };
    await walk(userId);
  };

  try {
    if (action === "list") {
      const [{ data: requests, error: requestError }, usersResult, { data: profiles, error: profileError }] = await Promise.all([
        admin.from("verification_requests").select("id,user_id,real_name,reason,identity_file_path,status,decision_note,reviewed_at,created_at").order("created_at", { ascending: false }).limit(200),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("profiles").select("id,username,display_name,avatar_url,is_verified,is_suspended,is_banned,active_status,created_at"),
      ]);
      if (requestError) throw requestError;
      if (profileError) throw profileError;
      if (usersResult.error) throw usersResult.error;
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const userMap = new Map((usersResult.data.users || []).map((u: any) => [u.id, u]));
      const enriched = await Promise.all((requests || []).map(async (r: any) => {
        const user = userMap.get(r.user_id);
        const { data: signed } = await admin.storage.from("verification-documents").createSignedUrl(r.identity_file_path, 600);
        return { ...r, email: user?.email || "", profile: profileMap.get(r.user_id) || null, identity_url: signed?.signedUrl || null };
      }));
      return reply(200, {
        requests: enriched,
        users: (usersResult.data.users || []).map((u: any) => ({
          id: u.id, email: u.email, email_confirmed_at: u.email_confirmed_at,
          banned_until: u.banned_until, created_at: u.created_at,
          profile: profileMap.get(u.id) || null,
        })),
      });
    }

    if (action === "decide_verification") {
      const requestId = String(body?.request_id || "");
      const decision = String(body?.decision || "");
      const note = String(body?.note || "").trim().slice(0, 1000);
      if (!requestId || !["approved", "declined"].includes(decision)) return reply(400, { error: "A request ID and approved/declined decision are required." });
      const { data: request, error: readError } = await admin.from("verification_requests").select("*").eq("id", requestId).maybeSingle();
      if (readError || !request) return reply(404, { error: "Verification request not found." });
      const { data: target } = await admin.auth.admin.getUserById(request.user_id);
      if (!target.user) return reply(404, { error: "Applicant account not found." });
      const now = new Date().toISOString();
      const { error: updateRequestError } = await admin.from("verification_requests").update({
        status: decision, decision_note: note || null, reviewed_by: actor.id, reviewed_at: now, updated_at: now,
      }).eq("id", requestId);
      if (updateRequestError) throw updateRequestError;
      const { error: profileError } = await admin.from("profiles").update({ is_verified: decision === "approved" }).eq("id", request.user_id);
      if (profileError) throw profileError;
      await admin.from("notifications").insert({
        recipient_id: request.user_id, actor_id: actor.id,
        type: decision === "approved" ? "verification_approved" : "verification_declined",
        payload: { request_id: requestId, note },
      });
      await audit("verification_" + decision, request.user_id, { request_id: requestId, note });

      let emailSent = false;
      let emailError: string | null = null;
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("VERIFICATION_EMAIL_FROM") || "WAYSS <onboarding@resend.dev>";
      if (resendKey && target.user.email) {
        const subject = decision === "approved" ? "Your WAYSS verification is approved" : "Update on your WAYSS verification request";
        const heading = decision === "approved" ? "You're verified on WAYSS" : "Your verification request was declined";
        const message = decision === "approved"
          ? "Your profile now has the WAYSS verified badge."
          : "Your verification request was reviewed and was not approved this time.";
        const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#15131e"><h1>${heading}</h1><p>${message}</p>${note ? `<p><b>Admin note:</b> ${esc(note)}</p>` : ""}<p>— WAYSS Team</p></div>`;
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [target.user.email], subject, html }),
        });
        emailSent = mail.ok;
        if (!mail.ok) emailError = (await mail.text()).slice(0, 500);
      } else {
        emailError = "Email provider is not configured. Add RESEND_API_KEY and VERIFICATION_EMAIL_FROM to Supabase Edge Function secrets.";
      }
      return reply(200, { ok: true, decision, email_sent: emailSent, email_error: emailError });
    }

    const targetId = String(body?.user_id || "");
    if (!targetId || targetId === actor.id) return reply(400, { error: "A different target user is required." });
    const { data: targetResult } = await admin.auth.admin.getUserById(targetId);
    if (!targetResult.user) return reply(404, { error: "Target user not found." });
    if (targetResult.user.email?.toLowerCase() === ADMIN_EMAIL) return reply(403, { error: "The admin account is protected." });

    if (action === "suspend_user") {
      const hours = Math.max(1, Math.min(720, Number(body?.hours) || 24));
      const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: `${hours}h` });
      if (error) throw error;
      const { error: profileError } = await admin.from("profiles").update({ is_suspended: true, is_banned: false, active_status: false }).eq("id", targetId);
      if (profileError) throw profileError;
      await audit("user_suspended", targetId, { hours });
      return reply(200, { ok: true, action, hours });
    }
    if (action === "ban_user") {
      const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" });
      if (error) throw error;
      const { error: profileError } = await admin.from("profiles").update({ is_suspended: false, is_banned: true, active_status: false }).eq("id", targetId);
      if (profileError) throw profileError;
      await audit("user_banned", targetId);
      return reply(200, { ok: true, action });
    }
    if (action === "unban_user") {
      const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
      if (error) throw error;
      const { error: profileError } = await admin.from("profiles").update({ is_suspended: false, is_banned: false, active_status: true }).eq("id", targetId);
      if (profileError) throw profileError;
      await audit("user_unbanned", targetId);
      return reply(200, { ok: true, action });
    }
    if (action === "delete_user") {
      await removeUserFiles("wayss-media", targetId);
      await removeUserFiles("verification-documents", targetId);
      await audit("user_deleted", targetId, { email: targetResult.user.email || "" });
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) throw error;
      return reply(200, { ok: true, action });
    }
    if (action === "revoke_verification") {
      const { error } = await admin.from("profiles").update({ is_verified: false }).eq("id", targetId);
      if (error) throw error;
      await audit("verification_revoked", targetId);
      return reply(200, { ok: true, action });
    }
    return reply(400, { error: "Unknown admin action." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin action failed.";
    return reply(500, { error: message });
  }
});
