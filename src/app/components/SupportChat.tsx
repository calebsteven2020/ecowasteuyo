import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const FUNCTION_URL = `https://${projectId}.supabase.co/functions/v1/server/make-server-fdf6bf9b/support-chat`;

const GREETING = "Hi! I'm the EcoWaste Uyo assistant. Ask me about plans, pricing, pickups, payments, or the app.";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Floating AI support widget. Talks to the support-chat route on the
 * existing "server" edge function (see supabase/functions/server/index.tsx),
 * which holds the Anthropic API key server-side and grounds every reply in
 * a system prompt describing the actual EcoWaste Uyo business — plans, how
 * it works, payment methods, the app, contact details.
 *
 * Mounted site-wide from Root.tsx (excluded on /admin). Positioned with a
 * bottom offset on mobile that clears MobileAppBanner.tsx when it's showing.
 */
export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(false);

    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
          apikey: publicAnonKey,
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) throw new Error(`support-chat responded ${res.status}`);
      const data = await res.json();
      if (!data.reply) throw new Error("no reply in response");

      setMessages(m => [...m, { role: "assistant", content: data.reply }]);
    } catch (err) {
      console.error("[support chat] failed:", err);
      setError(true);
      setMessages(m => [...m, {
        role: "assistant",
        content: "Sorry, I'm having trouble replying right now. You can reach the team directly at support@ecowaste.ng or +234 800 ECO WASTE.",
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl shadow-2xl right-5 left-5 sm:left-auto bottom-40 sm:bottom-24"
          style={{
            maxWidth: "22rem",
            marginLeft: "auto",
            height: "min(32rem, 60svh)",
            background: "#fff",
            border: "1px solid rgba(26,46,28,0.1)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0" style={{ background: "#1a2e1c" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(247,245,240,0.12)" }}>
                <MessageCircle className="w-4 h-4" style={{ color: "#85c48a" }} />
              </div>
              <div>
                <p style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.2 }}>EcoWaste Uyo Support</p>
                <p style={{ color: "rgba(247,245,240,0.55)", fontSize: "0.65rem", marginTop: "0.1rem" }}>Usually replies instantly</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="p-1" style={{ color: "rgba(247,245,240,0.6)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4 flex flex-col gap-2.5" style={{ background: "#f7f5f0" }}>
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${m.role === "user" ? "self-end" : "self-start"}`}
                style={{
                  background: m.role === "user" ? "#1a2e1c" : "#fff",
                  color: m.role === "user" ? "#f7f5f0" : "#1a2e1c",
                  border: m.role === "user" ? "none" : "1px solid rgba(26,46,28,0.08)",
                  fontSize: "0.8rem",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="self-start flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#5a6e5c" }} />
                <span style={{ color: "#5a6e5c", fontSize: "0.75rem" }}>Typing...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(26,46,28,0.08)", background: "#fff" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about plans, payments, pickups..."
              rows={1}
              className="flex-1 resize-none px-3 py-2.5 rounded-xl outline-none"
              style={{ background: "#f7f5f0", color: "#1a2e1c", fontSize: "0.8rem", maxHeight: "5rem" }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
              style={{ background: "#008751", color: "#fff", opacity: sending || !input.trim() ? 0.5 : 1 }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 right-5 bottom-24 sm:bottom-6"
        style={{ background: "#1a2e1c" }}
      >
        {open ? <X className="w-5 h-5" style={{ color: "#f7f5f0" }} /> : <MessageCircle className="w-5 h-5" style={{ color: "#f7f5f0" }} />}
        {!open && error && (
          <span className="absolute top-0 right-0 w-3 h-3 rounded-full" style={{ background: "#e57373", border: "2px solid #f7f5f0" }} />
        )}
      </button>
    </>
  );
}
