import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Sparkles, ChevronDown } from "lucide-react";
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
  formatted = formatted.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
  formatted = formatted.replace(/\n/g, "<br/>");
  return formatted;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center px-4 py-3">
      <div className="w-2 h-2 rounded-full bg-[#7c5cff] animate-bounce" style={{ animationDelay: "0ms" }} />
      <div className="w-2 h-2 rounded-full bg-[#9b7fff] animate-bounce" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 rounded-full bg-[#38bdf8] animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function ChatPromptPopup({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 300000);
    const handleClick = () => onDismiss();
    document.addEventListener("click", handleClick, { once: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.8 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="pointer-events-none select-none"
      style={{ position: "fixed", bottom: "96px", right: "16px", left: "auto", zIndex: 10000 }}
      data-testid="chat-prompt-popup"
    >
      <div className="relative">
        <div
          className="px-6 py-4 rounded-2xl max-w-[260px]"
          style={{
            background: "linear-gradient(135deg, rgba(124, 92, 255, 0.25), rgba(56, 189, 248, 0.15))",
            border: "1px solid rgba(124, 92, 255, 0.35)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(124, 92, 255, 0.3), 0 0 60px rgba(124, 92, 255, 0.1)",
          }}
        >
          <p
            className="text-white m-0 leading-relaxed"
            style={{
              fontFamily: "'Caveat', 'Dancing Script', 'Segoe Script', 'Comic Sans MS', cursive",
              fontSize: "clamp(22px, 3vw, 28px)",
              fontWeight: 700,
              textShadow: "0 2px 8px rgba(124, 92, 255, 0.4)",
              letterSpacing: "0.5px",
            }}
          >
            Try my web chat AI!
          </p>
        </div>
        <div className="absolute -bottom-3 right-8 flex flex-col items-center">
          <ChevronDown size={28} className="text-[#7c5cff] animate-bounce" style={{ filter: "drop-shadow(0 2px 4px rgba(124, 92, 255, 0.5))" }} />
        </div>
      </div>
    </motion.div>
  );
}

const quickPrompts = [
  "What's John's best squat?",
  "Show me the workout stats",
  "How many days logged?",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    handleScroll();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setShowPrompt(false);
    }
  }, [isOpen]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom && messages.length > 3);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
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

  const messageCount = messages.filter(m => m.role === "user").length;

  return (
    <>
      <style>{`
        .chat-container {
          background: linear-gradient(160deg, rgba(13, 18, 30, 0.98), rgba(8, 11, 20, 0.99));
          border: 1px solid rgba(124, 92, 255, 0.2);
          box-shadow:
            0 25px 80px rgba(0, 0, 0, 0.6),
            0 0 50px rgba(124, 92, 255, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px);
        }

        .chat-header {
          background: linear-gradient(135deg, rgba(124, 92, 255, 0.18), rgba(56, 189, 248, 0.08));
          border-bottom: 1px solid rgba(124, 92, 255, 0.15);
        }

        .chat-header::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124, 92, 255, 0.4), rgba(56, 189, 248, 0.3), transparent);
        }

        .msg-user {
          background: linear-gradient(135deg, #7c5cff 0%, #6344e0 50%, #5535d4 100%);
          border-radius: 20px 20px 6px 20px;
          box-shadow: 0 4px 16px rgba(124, 92, 255, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
          position: relative;
          overflow: hidden;
        }

        .msg-user::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        }

        .msg-ai {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px 20px 20px 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          position: relative;
        }

        .msg-ai::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
        }

        .inline-code {
          background: rgba(124, 92, 255, 0.15);
          border: 1px solid rgba(124, 92, 255, 0.2);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: #c4b5fd;
        }

        .chat-input-wrapper {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .chat-input-wrapper:focus-within {
          border-color: rgba(124, 92, 255, 0.4);
          box-shadow: 0 0 20px rgba(124, 92, 255, 0.1), inset 0 0 20px rgba(124, 92, 255, 0.03);
        }

        .chat-input-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
        }

        .send-btn {
          background: linear-gradient(135deg, #7c5cff, #6344e0);
          border-radius: 12px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .send-btn:not(:disabled):hover {
          box-shadow: 0 0 20px rgba(124, 92, 255, 0.4);
          transform: scale(1.05);
        }

        .send-btn:disabled {
          opacity: 0.25;
          background: rgba(124, 92, 255, 0.3);
        }

        .quick-prompt {
          background: rgba(124, 92, 255, 0.08);
          border: 1px solid rgba(124, 92, 255, 0.15);
          border-radius: 12px;
          transition: all 0.25s ease;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          padding: 6px 12px;
        }

        .quick-prompt:hover {
          background: rgba(124, 92, 255, 0.15);
          border-color: rgba(124, 92, 255, 0.3);
          color: rgba(255, 255, 255, 0.9);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(124, 92, 255, 0.15);
        }

        .ai-avatar {
          background: linear-gradient(135deg, #7c5cff, #38bdf8);
          box-shadow: 0 2px 8px rgba(124, 92, 255, 0.3);
        }

        .chat-messages-area::-webkit-scrollbar {
          width: 4px;
        }

        .chat-messages-area::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages-area::-webkit-scrollbar-thumb {
          background: rgba(124, 92, 255, 0.2);
          border-radius: 4px;
        }

        .chat-messages-area::-webkit-scrollbar-thumb:hover {
          background: rgba(124, 92, 255, 0.4);
        }

        .chat-fab {
          background: linear-gradient(135deg, #7c5cff, #38bdf8);
          box-shadow: 0 6px 24px rgba(124, 92, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
          position: relative;
          overflow: hidden;
        }

        .chat-fab::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
          animation: fabShine 3s ease-in-out infinite;
        }

        @keyframes fabShine {
          0%, 100% { transform: translate(-30%, -30%); }
          50% { transform: translate(30%, 30%); }
        }

        .chat-fab:hover {
          box-shadow: 0 8px 32px rgba(124, 92, 255, 0.5), 0 0 40px rgba(124, 92, 255, 0.2);
        }

        .scroll-indicator {
          background: linear-gradient(135deg, rgba(124, 92, 255, 0.9), rgba(56, 189, 248, 0.8));
          box-shadow: 0 2px 12px rgba(124, 92, 255, 0.4);
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .scroll-indicator:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 16px rgba(124, 92, 255, 0.5);
        }

        .msg-timestamp {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.25);
          margin-top: 4px;
        }

        .empty-state-glow {
          position: relative;
        }

        .empty-state-glow::after {
          content: '';
          position: absolute;
          inset: -20px;
          background: radial-gradient(circle, rgba(124, 92, 255, 0.08) 0%, transparent 70%);
          border-radius: 50%;
          z-index: -1;
        }

        .chat-footer-gradient {
          background: linear-gradient(to top, rgba(13, 18, 30, 1) 0%, transparent 100%);
          pointer-events: none;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 20px;
        }

        .message-counter {
          position: absolute;
          top: -6px;
          right: -6px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
          border: 2px solid rgba(11, 15, 23, 0.9);
        }
      `}</style>

      <AnimatePresence>
        {showPrompt && !isOpen && (
          <ChatPromptPopup onDismiss={() => setShowPrompt(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.85 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="chat-container w-[380px] max-w-[calc(100vw-32px)] h-[520px] max-h-[72vh] rounded-3xl overflow-hidden flex flex-col"
            style={{ position: "fixed", bottom: "96px", right: "16px", left: "auto", zIndex: 9998 }}
            data-testid="chat-widget"
          >
            <div className="chat-header relative flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="ai-avatar w-9 h-9 rounded-full flex items-center justify-center relative">
                  <Bot size={17} className="text-white" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0d121e]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white m-0 flex items-center gap-1.5">
                    John's AI
                    <Sparkles size={12} className="text-[#38bdf8]" />
                  </h4>
                  <span className="text-[10px] text-green-400/80 font-medium tracking-wide">
                    Always online
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messageCount > 0 && (
                  <span className="text-[10px] text-white/30 font-medium">
                    {messageCount} msg{messageCount !== 1 ? "s" : ""}
                  </span>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-all duration-200 group"
                  data-testid="button-close-chat"
                >
                  <X size={18} className="text-white/50 group-hover:text-white/90 transition-colors" />
                </button>
              </div>
            </div>

            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="chat-messages-area flex-1 overflow-y-auto p-4 space-y-4 relative"
              style={{ scrollbarWidth: "thin" }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="empty-state-glow w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c5cff]/15 to-[#38bdf8]/10 flex items-center justify-center mb-4 border border-white/[0.06]">
                    <Bot size={30} className="text-[#7c5cff]" />
                  </div>
                  <p className="text-white/80 text-sm font-semibold mb-1">Ask me anything!</p>
                  <p className="text-white/40 text-xs mb-5 max-w-[220px] leading-relaxed">
                    I know everything about John's workout journey, stats, and progress
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(prompt)}
                        className="quick-prompt"
                        data-testid={`quick-prompt-${i}`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "model" && (
                    <div className="ai-avatar w-7 h-7 rounded-full flex items-center justify-center mr-2.5 flex-shrink-0 mt-1">
                      <Bot size={13} className="text-white" />
                    </div>
                  )}
                  <div className="flex flex-col" style={{ maxWidth: "78%" }}>
                    <div
                      className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === "user" ? "msg-user text-white" : "msg-ai text-white/90"
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
                </motion.div>
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="ai-avatar w-7 h-7 rounded-full flex items-center justify-center mr-2.5 flex-shrink-0 mt-1">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="msg-ai">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {showScrollDown && (
              <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-10">
                <button onClick={scrollToBottom} className="scroll-indicator">
                  <ChevronDown size={16} className="text-white" />
                </button>
              </div>
            )}

            <div className="px-4 py-3 relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex gap-2.5 items-center"
              >
                <div className="chat-input-wrapper flex-1 flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about John's workouts..."
                    className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none"
                    disabled={isTyping}
                    data-testid="input-chat-message"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="send-btn p-2.5 text-white flex items-center justify-center"
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
        onClick={() => { setIsOpen(!isOpen); setShowPrompt(false); }}
        className="chat-fab w-14 h-14 rounded-full flex items-center justify-center"
        style={{ position: "fixed", bottom: "24px", right: "16px", left: "auto", zIndex: 9999 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        data-testid="button-open-chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X size={24} className="text-white" />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <MessageCircle size={24} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && messages.length > 0 && (
          <span className="message-counter">{messages.length}</span>
        )}
      </motion.button>
    </>
  );
}
