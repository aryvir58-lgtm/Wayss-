import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  FilePenLine,
  KeyRound,
  Lock,
  Shield,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "./supabase";

type Post = {
  id: string;
  body: string | null;
  kind: string | null;
  created_at: string;
  media_url: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function WayssSettings({ open, onClose }: Props) {
  const [section, setSection] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open || section !== "posts") return;

    let alive = true;

    const loadPosts = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || !alive) return;

      const { data, error } = await supabase
        .from("posts")
        .select("id,body,kind,created_at,media_url")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      if (!alive) return;
      if (error) {
        setMsg(error.message);
        return;
      }

      setPosts((data as Post[]) || []);
    };

    void loadPosts();
    return () => {
      alive = false;
    };
  }, [open, section]);

  async function resetPassword() {
    setMsg("");

    if (!newPass || newPass.length < 6) {
      setMsg("New password must be at least 6 characters.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPass });
    setMsg(error?.message || "Password updated successfully.");

    if (!error) setNewPass("");
  }

  async function sendResetEmail() {
    setMsg("");

    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;

    if (!email) {
      setMsg("No email address is available for this account.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    setMsg(error?.message || "Password reset email sent.");
  }

  async function removePost(id: string) {
    if (!window.confirm("Delete this post permanently?")) return;

    const { error } = await supabase.from("posts").delete().eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setPosts((current) => current.filter((post) => post.id !== id));
    setEditing(null);
    setMsg("Post deleted.");
  }

  async function savePost(id: string) {
    const body = draft.trim();
    const { error } = await supabase
      .from("posts")
      .update({ body: body || null })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setPosts((current) =>
      current.map((post) =>
        post.id === id ? { ...post, body: body || null } : post,
      ),
    );
    setEditing(null);
    setMsg("Post updated.");
  }

  if (!open) return null;

  return (
    <div
      className="ws-settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="ws-settings" role="dialog" aria-modal="true" aria-label="WAYSS Settings">
        <header>
          <div>
            <span className="eyebrow">ACCOUNT CENTER</span>
            <h2>Settings</h2>
          </div>
          <button className="icon" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>

        {section === null ? (
          <div className="ws-settings-list">
            <button onClick={() => setSection("account")}>
              <span>
                <UserRound />
                Account Center
                <small>Profile and account controls</small>
              </span>
              <ChevronRight />
            </button>

            <button onClick={() => setSection("posts")}>
              <span>
                <FilePenLine />
                Your Posts
                <small>Edit or delete anything you posted</small>
              </span>
              <ChevronRight />
            </button>

            <button onClick={() => setSection("security")}>
              <span>
                <KeyRound />
                Password &amp; Security
                <small>Change password and sign-in security</small>
              </span>
              <ChevronRight />
            </button>

            <button onClick={() => setSection("privacy")}>
              <span>
                <Lock />
                Privacy
                <small>Profile visibility and connections</small>
              </span>
              <ChevronRight />
            </button>

            <button onClick={() => setSection("safety")}>
              <span>
                <Shield />
                Safety &amp; Controls
                <small>Blocking, reports and account safety</small>
              </span>
              <ChevronRight />
            </button>
          </div>
        ) : (
          <div className="ws-settings-page">
            <button className="back" onClick={() => setSection(null)}>
              <ArrowLeft size={15} />
              Settings
            </button>

            {section === "account" && (
              <>
                <h3>Account Center</h3>
                <p>Manage your WAYSS account and profile information.</p>
                <div className="ws-setting-card">
                  Profile editing is available from the You page.
                </div>
              </>
            )}

            {section === "posts" && (
              <>
                <h3>Your Posts</h3>
                <p>Edit or permanently delete your own posts.</p>

                {posts.length === 0 ? (
                  <div className="ws-setting-card">
                    You haven&apos;t posted anything yet.
                  </div>
                ) : (
                  posts.map((post) => (
                    <article className="ws-post-card" key={post.id}>
                      {editing === post.id ? (
                        <>
                          <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            rows={4}
                            placeholder="Edit your post..."
                          />
                          <div className="ws-post-actions">
                            <button
                              className="primary"
                              onClick={() => void savePost(post.id)}
                            >
                              Save
                            </button>
                            <button
                              className="outline"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <b>{post.kind === "signal" ? "Signal" : "Echo"}</b>
                            <p>{post.body || "Image post"}</p>
                          </div>
                          <div className="ws-post-actions">
                            <button
                              className="outline"
                              onClick={() => {
                                setEditing(post.id);
                                setDraft(post.body || "");
                                setMsg("");
                              }}
                            >
                              <FilePenLine size={15} />
                              Edit
                            </button>
                            <button
                              className="danger"
                              onClick={() => void removePost(post.id)}
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))
                )}

                {msg && <div className="ws-setting-msg">{msg}</div>}
              </>
            )}

            {section === "security" && (
              <>
                <h3>Password &amp; Security</h3>
                <p>Change your password while signed in.</p>
                <input
                  type="password"
                  value={newPass}
                  onChange={(event) => setNewPass(event.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button className="primary ws-save" onClick={() => void resetPassword()}>
                  <KeyRound size={16} />
                  Update password
                </button>
                {msg && <div className="ws-setting-msg">{msg}</div>}
                <button className="outline ws-save" onClick={() => void sendResetEmail()}>
                  Send password reset email
                </button>
              </>
            )}

            {section === "privacy" && (
              <>
                <h3>Privacy</h3>
                <p>
                  Private/public profile and connection controls are available from your profile editor.
                </p>
              </>
            )}

            {section === "safety" && (
              <>
                <h3>Safety &amp; Controls</h3>
                <p>Use blocking and reporting controls where available.</p>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
