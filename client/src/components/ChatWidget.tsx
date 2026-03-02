import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatAIText(text: string): string {
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 rounded text-xs">$1</code>');
  formatted = formatted.replace(/\n/g, "<br/>");
  return formatted;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-[#7c5cff] animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 rounded-full bg-[#7c5cff] animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 rounded-full bg-[#7c5cff] animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || isTyping) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "model", content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "model", content: "Sorry, something went wrong. Try again!" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-4 w-[360px] max-w-[calc(100vw-32px)] h-[500px] max-h-[70vh] rounded-2xl overflow-hidden z-50 flex flex-col"
            style={{
              background: "linear-gradient(135deg, rgba(15, 22, 36, 0.97), rgba(11, 15, 23, 0.98))",
              border: "1px solid rgba(124, 92, 255, 0.25)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(124, 92, 255, 0.1)",
              backdropFilter: "blur(20px)",
            }}
            data-testid="chat-widget"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10"
              style={{ background: "linear-gradient(135deg, rgba(124, 92, 255, 0.15), rgba(56, 189, 248, 0.1))" }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#38bdf8] flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white m-0">John's AI Assistant</h4>
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                data-testid="button-close-chat"
              >
                <X size={18} className="text-white/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: "thin" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7c5cff]/20 to-[#38bdf8]/20 flex items-center justify-center mb-3">
                    <Bot size={28} className="text-[#7c5cff]" />
                  </div>
                  <p className="text-white/60 text-sm">Ask me anything about John's workout journey!</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "model" && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#38bdf8] flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Bot size={12} className="text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-[#7c5cff] to-[#6a4de0] text-white rounded-br-md"
                        : "bg-white/[0.07] text-white/90 rounded-bl-md border border-white/[0.06]"
                    }`}
                    dangerouslySetInnerHTML={
                      msg.role === "model"
                        ? { __html: formatAIText(msg.content) }
                        : undefined
                    }
                    data-testid={`chat-message-${i}`}
                  >
                    {msg.role === "user" ? msg.content : null}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#38bdf8] flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Bot size={12} className="text-white" />
                  </div>
                  <div className="bg-white/[0.07] rounded-2xl rounded-bl-md border border-white/[0.06]">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 py-3 border-t border-white/10">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#7c5cff]/50 transition-colors"
                  disabled={isTyping}
                  data-testid="input-chat-message"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#6a4de0] text-white disabled:opacity-30 hover:shadow-[0_0_15px_rgba(124,92,255,0.3)] transition-all"
                  data-testid="button-send-chat"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-4 w-14 h-14 rounded-full z-50 flex items-center justify-center shadow-lg"
        style={{
          background: "linear-gradient(135deg, #7c5cff, #38bdf8)",
          boxShadow: "0 4px 20px rgba(124, 92, 255, 0.4)",
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-open-chat"
      >
        {isOpen ? (
          <X size={24} className="text-white" />
        ) : (
          <MessageCircle size={24} className="text-white" />
        )}
      </motion.button>
    </>
  );
}
