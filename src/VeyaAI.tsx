import React, { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Sparkles, Maximize2, Minimize2, Pencil, ImagePlus } from "lucide-react";
import { supabase } from "./supabase";

type Msg = { id?: string; role: "user" | "assistant"; content: string; imageUrl?: string };
const welcome = "Hey, I'm WAYSS AI. ✦ Your personal AI assistant. What are we working on?";
const cannedReply = /i’m listening\. say it exactly how you’d say it to a real person|i'm listening\. say it exactly how you'd say it to a real person/i;
const fallback = (_text: string) => "I couldn't get a response from the AI service. Please try again in a moment.";
export default function VeyaAI() {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [nickname, setNickname] = useState("WAYSS AI");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: welcome }]);
  const [userId, setUserId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("WAYSS AI");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);
  useEffect(() => {
    if (!supabase) { setHistoryLoaded(true); return; }
    let alive = true;
    const loadUser = async (id: string | null) => {
      if (!alive) return;
      setUserId(id);
      setHistoryLoaded(false);
      if (!id) {
        setNickname("Veya");
        setMessages([{ role: "assistant", content: welcome }]);
        setHistoryLoaded(true);
        return;
      }
      const [pref, history] = await Promise.all([
        supabase.from("veya_preferences").select("nickname").eq("user_id", id).maybeSingle(),
        supabase.from("veya_messages").select("id,role,content,image_url,created_at").eq("user_id", id).order("created_at", { ascending: true }).limit(80)
      ]);
      if (!alive) return;
      const name = String((pref.data?.nickname && pref.data.nickname !== "Veya" ? pref.data.nickname : "WAYSS AI")).slice(0, 32);
      setNickname(name);
      setNameDraft(name);
      const rows = (history.data || []).filter((m: any) => !(m.role === "assistant" && cannedReply.test(String(m.content || ""))));
      setMessages(rows.length ? rows.map((m: any) => ({ id: m.id, role: m.role, content: m.content || "", imageUrl: m.image_url || undefined })) : [{ role: "assistant", content: welcome }]);
      setHistoryLoaded(true);
    };
    supabase.auth.getUser().then(({ data }) => loadUser(data.user?.id || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void loadUser(session?.user?.id || null); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  async function saveMessage(m: Msg, uid = userId) {
    if (!supabase || !uid) return;
    const row: any = { user_id: uid, role: m.role, content: m.content || "", image_url: m.imageUrl && !m.imageUrl.startsWith("data:") ? m.imageUrl : null };
    const { data, error } = await supabase.from("veya_messages").insert(row).select("id").single();
    if (!error && data?.id) return data.id as string;
  }
  async function rename() {
    const next = nameDraft.trim().slice(0, 32);
    if (!next) return;
    setNickname(next);
    setRenameOpen(false);
    if (supabase && userId) {
      const { error } = await supabase.from("veya_preferences").upsert({ user_id: userId, nickname: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) setMessages(v => [...v, { role: "assistant", content: "Nickname changed on this screen, but I couldn't save it to your account. Please try again." }]);
    }
  }
  async function persistGeneratedImage(uid: string, image: { mimeType?: string; data?: string }) {
    if (!supabase || !image.data || !uid) return undefined;
    try {
      const mime = image.mimeType || "image/png";
      const bytes = Uint8Array.from(atob(image.data), c => c.charCodeAt(0));
      const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
      const path = `${uid}/veya/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("wayss-media").upload(path, new Blob([bytes], { type: mime }), { contentType: mime, upsert: false });
      if (error) return `data:${mime};base64,${image.data}`;
      return supabase.storage.from("wayss-media").getPublicUrl(path).data.publicUrl;
    } catch { return `data:${image.mimeType || "image/png"};base64,${image.data}`; }
  }
  async function send() {
    const text = input.trim();
    if (!text || sending || !historyLoaded) return;
    setInput("");
    const userMessage: Msg = { role: "user", content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setSending(true);
    void saveMessage(userMessage);
    try {
      const { data: { session } } = supabase ? await supabase.auth.getSession() : { data: { session: null } } as any;
      const base = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!base || !anonKey) throw new Error("Supabase configuration is missing. Please refresh the app or check deployment settings.");
      if (!session?.access_token) throw new Error("Please log in to WAYSS first, then reopen your AI assistant.");
      const r = await fetch(`${base}/functions/v1/veya-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": anonKey, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next.filter(m => !(m.role === "assistant" && cannedReply.test(m.content))).slice(-20).map(m => ({ role: m.role, content: m.content })) })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) {
        const message: Msg = { role: "assistant", content: j.detail ? `I couldn't complete that: ${j.detail}` : (j.error || fallback(text)) };
        setMessages(v => [...v, message]);
        void saveMessage(message);
        return;
      }
      let imageUrl: string | undefined;
      if (j.image?.data) {
        imageUrl = userId ? await persistGeneratedImage(userId, j.image) : `data:${j.image.mimeType || "image/png"};base64,${j.image.data}`;
      }
      const answer: Msg = { role: "assistant", content: j.reply || "Done ✦", imageUrl };
      setMessages(v => [...v, answer]);
      void saveMessage(answer);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Network error";
      const message: Msg = { role: "assistant", content: detail };
      setMessages(v => [...v, message]);
      void saveMessage(message);
    } finally { setSending(false); }
  }
  return <>
    <button className="veya-launch" onClick={() => setOpen(true)} aria-label={`Open ${nickname}`}><Sparkles size={19}/><span>{nickname}</span></button>
    {open && <section className={`veya-panel ${full ? "fullscreen" : ""}`} aria-label={nickname + " AI assistant"}>
      <header>
        <div className="veya-title"><span className="veya-orb"><Bot size={17}/></span><div><b>{nickname}</b><small>WAYSS AI companion · thoughtful by design</small></div></div>
        <div className="veya-head-actions">
          <button className="veya-close" onClick={() => { setNameDraft(nickname); setRenameOpen(true); }} aria-label="Rename assistant" title="Change nickname"><Pencil size={16}/></button>
          <button className="veya-close" onClick={() => setFull(v => !v)} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>{full ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button>
          <button className="veya-close" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18}/></button>
        </div>
      </header>
      {renameOpen && <form className="veya-rename" onSubmit={e => { e.preventDefault(); void rename(); }}><label>Give your AI a nickname</label><div><input autoFocus maxLength={32} value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="e.g. Nova, Echo, Orbit"/><button type="submit" disabled={!nameDraft.trim()}>Save</button><button type="button" onClick={() => setRenameOpen(false)}>Cancel</button></div><small>{userId ? "Saved to your account" : "Log in to sync your nickname and chat history"}</small></form>}
      <div className="veya-messages">
        {!historyLoaded && <div className="veya-msg assistant typing">Loading your memories…</div>}
        {messages.map((m, i) => <div key={m.id || i} className={`veya-msg ${m.role}`}>{m.content && <div>{m.content}</div>}{m.imageUrl && <a className="veya-image-link" href={m.imageUrl} target="_blank" rel="noreferrer"><img className="veya-generated-image" src={m.imageUrl} alt="AI-generated image"/></a>}</div>)}
        {sending && <div className="veya-msg assistant typing">thinking…</div>}<div ref={end}/>
      </div>
      <form className="veya-input" onSubmit={e => { e.preventDefault(); void send(); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={`Talk to ${nickname}… (try “generate an image of a neon city”)`} aria-label={`Message ${nickname}`} disabled={!historyLoaded}/>
        <button disabled={!input.trim() || sending || !historyLoaded} aria-label="Send"><Send size={17}/></button>
      </form>
    </section>}
  </>;
}
