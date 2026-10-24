import React, { useEffect, useState } from "react";
import { BadgeCheck, Check, ExternalLink, ShieldAlert, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import { supabase } from "./supabase";

const ADMIN_EMAIL = "vikashjagarwal08@gmail.com";
type RequestRow = {
  id: string; user_id: string; real_name: string; reason: string; identity_file_path: string;
  status: "pending" | "approved" | "declined"; decision_note: string | null; reviewed_at: string | null;
  created_at: string; email: string; identity_url: string | null; profile: any;
};
type UserRow = { id: string; email: string; created_at: string; banned_until: string | null; profile: any };

export default function VerificationCenter({ user, profile }: { user: any; profile: any }) {
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const [realName, setRealName] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [tab, setTab] = useState<"requests" | "users">("requests");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");

  async function adminCall(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("admin-console", { body });
    if (error) throw new Error(error.message || "Admin request failed.");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function loadAdmin() {
    if (!isAdmin) return;
    setBusy(true); setStatus("");
    try {
      const data = await adminCall({ action: "list" });
      setRequests(data.requests || []);
      setUsers(data.users || []);
      setSelected((current) => current ? (data.requests || []).find((r: RequestRow) => r.id === current.id) || null : null);
    } catch (e: any) { setStatus(e?.message || "Could not load admin data."); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (isAdmin) void loadAdmin(); }, [isAdmin]);

  async function submitRequest() {
    if (!user || !file) { setStatus("Enter your real name, reason, and attach an identity proof."); return; }
    if (realName.trim().length < 2 || reason.trim().length < 20) { setStatus("Use your full real name and write at least 20 characters explaining why you need the badge."); return; }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) { setStatus("Upload a JPG, PNG, WebP, or PDF identity document."); return; }
    if (file.size > 10 * 1024 * 1024) { setStatus("Identity document must be 10 MB or smaller."); return; }
    setBusy(true); setStatus("");
    try {
      const { data: existing, error: existingError } = await supabase.from("verification_requests").select("id,status").eq("user_id", user.id).eq("status", "pending").limit(1);
      if (existingError) throw existingError;
      if (existing?.length) throw new Error("You already have a pending verification request.");
      if (profile?.is_verified) throw new Error("Your account is already verified.");
      const id = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = user.id + "/" + id + "-" + safeName;
      const uploaded = await supabase.storage.from("verification-documents").upload(path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) throw uploaded.error;
      const inserted = await supabase.from("verification_requests").insert({
        id, user_id: user.id, real_name: realName.trim(), reason: reason.trim(), identity_file_path: path, status: "pending",
      });
      if (inserted.error) {
        await supabase.storage.from("verification-documents").remove([path]);
        throw inserted.error;
      }
      setRealName(""); setReason(""); setFile(null);
      setStatus("Verification request submitted. You can track its status here.");
    } catch (e: any) { setStatus(e?.message || "Could not submit request."); }
    finally { setBusy(false); }
  }

  async function decide(decision: "approved" | "declined") {
    if (!selected) return;
    const note = window.prompt(decision === "approved" ? "Optional note for the applicant:" : "Reason for declining (will be emailed):", "") || "";
    setBusy(true); setStatus("");
    try {
      const result = await adminCall({ action: "decide_verification", request_id: selected.id, decision, note });
      setStatus(result.email_sent ? "Decision saved and email sent." : "Decision saved, but email was not sent: " + (result.email_error || "email provider unavailable"));
      setSelected(null); await loadAdmin();
    } catch (e: any) { setStatus(e?.message || "Could not update request."); }
    finally { setBusy(false); }
  }

  async function userAction(action: string, target: UserRow) {
    const labels: Record<string, string> = { suspend_user: "Suspend this account for 24 hours?", ban_user: "Permanently ban this account?", unban_user: "Unban/reactivate this account?", delete_user: "PERMANENTLY delete this account and its data?", revoke_verification: "Remove this user's verified badge?" };
    if (!window.confirm(labels[action] || "Continue with this admin action?")) return;
    setBusy(true); setStatus("");
    try {
      await adminCall({ action, user_id: target.id, hours: 24 });
      setStatus(action === "delete_user" ? "User permanently deleted." : "Admin action completed.");
      await loadAdmin();
    } catch (e: any) { setStatus(e?.message || "Admin action failed."); }
    finally { setBusy(false); }
  }

  if (!user) return <section className="discover-card"><h3>Verification</h3><p>Sign in to request a verified badge.</p></section>;

  if (isAdmin) {
    const visibleUsers = users.filter((u) => ((u.email || "") + " " + (u.profile?.username || "") + " " + (u.profile?.display_name || "")).toLowerCase().includes(filter.toLowerCase()));
    return <section className="verification-center">
      <div className="section-title"><div><p className="eyebrow">ADMIN ONLY</p><h2>Verification & account control</h2></div><button className="outline" onClick={() => void loadAdmin()} disabled={busy}>Refresh</button></div>
      <div className="filters"><button className={tab === "requests" ? "chip active" : "chip"} onClick={() => { setTab("requests"); setSelected(null); }}>Verification requests ({requests.filter(r => r.status === "pending").length} pending)</button><button className={tab === "users" ? "chip active" : "chip"} onClick={() => { setTab("users"); setSelected(null); }}>User management ({users.length})</button></div>
      {status && <p className="status" role="status">{status}</p>}
      {tab === "requests" ? <div className="verification-admin-layout">
        <div className="verification-request-list">{requests.length === 0 ? <p>No verification requests yet.</p> : requests.map((r) => <button key={r.id} className={"verification-request-item" + (selected?.id === r.id ? " selected" : "")} onClick={() => setSelected(r)}>
          <span className="verification-status">{r.status}</span><b>{r.real_name}</b><small>{r.email}</small><small>Request ID: {r.id}</small><small>{new Date(r.created_at).toLocaleString()}</small>
        </button>)}</div>
        <div className="verification-request-detail">{!selected ? <div className="empty compact"><UserRound size={24}/><p>Select a request ID to review the full form.</p></div> : <>
          <p className="eyebrow">REQUEST DETAILS</p><h3>{selected.real_name}</h3><p><b>Request ID:</b> <code>{selected.id}</code></p><p><b>Account:</b> {selected.email} (@{selected.profile?.username || "no username"})</p><p><b>Reason for verification</b></p><p className="verification-reason">{selected.reason}</p><p><b>Identity proof</b></p>{selected.identity_url ? <a href={selected.identity_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Open private identity document</a> : <p>Could not create a secure document link.</p>}
          <p><b>Status:</b> {selected.status}</p>{selected.decision_note && <p><b>Previous note:</b> {selected.decision_note}</p>}
          {selected.status === "pending" && <div className="modal-actions"><button className="primary" disabled={busy} onClick={() => void decide("approved")}><Check size={15}/> Approve</button><button className="outline" disabled={busy} onClick={() => void decide("declined")}><X size={15}/> Decline</button></div>}
        </>}</div>
      </div> : <><input className="verification-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by email, username, or name…"/><div className="verification-users">{visibleUsers.map((u) => <article className="verification-user" key={u.id}>
        <div><b>{u.profile?.display_name || u.email}</b><small>{u.email}</small><small>@{u.profile?.username || "no username"} · {u.id}</small><div className="verification-user-flags">{u.profile?.is_verified && <span>Verified</span>}{u.profile?.is_suspended && <span>Suspended</span>}{u.profile?.is_banned && <span>Banned</span>}{u.banned_until && new Date(u.banned_until) > new Date() && <span>Auth restricted</span>}</div></div>
        <div className="verification-user-actions">{u.profile?.is_verified && <button className="outline" disabled={busy} onClick={() => void userAction("revoke_verification", u)}><BadgeCheck size={15}/> Revoke badge</button>}{u.profile?.is_suspended || u.profile?.is_banned || (u.banned_until && new Date(u.banned_until) > new Date()) ? <button className="outline" disabled={busy} onClick={() => void userAction("unban_user", u)}><ShieldCheck size={15}/> Unban</button> : <><button className="outline" disabled={busy} onClick={() => void userAction("suspend_user", u)}><ShieldAlert size={15}/> Suspend 24h</button><button className="outline" disabled={busy} onClick={() => void userAction("ban_user", u)}>Ban</button></>}<button className="outline danger" disabled={busy} onClick={() => void userAction("delete_user", u)}><Trash2 size={15}/> Delete</button></div>
      </article>)}</div></>}
    </section>;
  }

  const [history, setHistory] = useState<any[]>([]);
  return <VerificationRequestForm user={user} profile={profile} realName={realName} setRealName={setRealName} reason={reason} setReason={setReason} file={file} setFile={setFile} busy={busy} status={status} submitRequest={submitRequest} history={history} setHistory={setHistory}/>;
}

function VerificationRequestForm({user,profile,realName,setRealName,reason,setReason,file,setFile,busy,status,submitRequest,history,setHistory}:any) {
  useEffect(() => { let alive = true; (async () => {
    const { data, error } = await supabase.from("verification_requests").select("id,status,decision_note,created_at,reviewed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (alive && !error) setHistory(data || []);
  })(); return () => { alive = false; }; }, [user.id, status]);
  return <section className="verification-center">
    <div className="section-title"><div><p className="eyebrow">ACCOUNT STATUS</p><h2>Verification</h2></div>{profile?.is_verified && <span className="verified-badge"><BadgeCheck size={16}/> Verified</span>}</div>
    {profile?.is_verified ? <div className="discover-card"><BadgeCheck size={24}/><h3>Your account is verified</h3><p>Your verified badge is active.</p></div> : <div className="discover-card verification-form">
      <h3>Request a verified badge</h3><p>Submit your real name, one identity document, and a clear reason for requesting verification. Your document is stored privately and is visible only to you and the WAYSS admin.</p>
      <label>Real full name<input value={realName} onChange={(e) => setRealName(e.target.value)} maxLength={160} placeholder="Name shown on your identity document"/></label>
      <label>Why do you need a verified badge?<textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={20} maxLength={3000} rows={5} placeholder="Explain who you are and why people should be able to verify this account…"/></label>
      <label>Identity proof (JPG, PNG, WebP, PDF; max 10 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}/></label>
      {file && <small>Selected: {file.name}</small>}
      <button className="primary" disabled={busy} onClick={() => void submitRequest()}>{busy ? "Submitting…" : "Submit verification request"}</button>
    </div>}
    {status && <p className="status" role="status">{status}</p>}
    <div className="section-title"><h3>Your requests</h3></div>
    {!history.length ? <p>No requests submitted yet.</p> : history.map((r) => <article className="verification-history" key={r.id}><span className={"verification-status " + r.status}>{r.status}</span><small>Request ID: {r.id}</small><small>Submitted {new Date(r.created_at).toLocaleString()}</small>{r.decision_note && <p>Admin note: {r.decision_note}</p>}</article>)}
  </section>;
}
