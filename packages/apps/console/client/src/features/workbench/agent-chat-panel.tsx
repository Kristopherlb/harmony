import React, { useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Send, Bot, User, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BlueprintDraft } from "@/features/workbench/types";
import { getDraftFromAssistantMessage, getMessageText } from "@/features/workbench/chat-utils";

interface AgentChatPanelProps {
  onDraftGenerated: (draft: BlueprintDraft) => void;
  externalSendText?: string | null;
  onExternalSendComplete?: () => void;
}

export function AgentChatPanel({
  onDraftGenerated,
  externalSendText,
  onExternalSendComplete,
}: AgentChatPanelProps) {
  const [inputValue, setInputValue] = React.useState("");
  const lastProcessedAssistantMessageId = React.useRef<string | null>(null);
  const lastProcessedExternalText = React.useRef<string | null>(null);

    // CORRECT API USAGE STATMENT:
    // Verified via node_modules/@ai-sdk/react/dist/index.d.ts (v3.0.66):
    // useChat returns UseChatHelpers which ONLY contains:
    // { id, setMessages, error, sendMessage, regenerate, stop, resumeStream, status, messages, clearError }
    // It DOES NOT contain: input, handleInputChange, handleSubmit, append, isLoading.
  const { messages, sendMessage, status } = useChat({
    api: "/api/chat",
    onFinish: ({ message }) => {
      const draft = getDraftFromAssistantMessage(message as any);
      if (draft) onDraftGenerated(draft);
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

    // Derive isLoading from status
  const isLoading = status === "streaming" || status === "submitted";

  const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!externalSendText) return;
    if (isLoading) return;
    if (lastProcessedExternalText.current === externalSendText) return;

    lastProcessedExternalText.current = externalSendText;
    sendMessage({ text: externalSendText })
      .catch(() => {
        // surface errors via existing onError handler
      })
      .finally(() => {
        onExternalSendComplete?.();
      });
  }, [externalSendText, isLoading, onExternalSendComplete, sendMessage]);

    // Reliable draft extraction: watch the latest assistant message and parse JSON.
  useEffect(() => {
    const latest = [...messages].reverse().find((m: any) => m?.role === "assistant");
    if (!latest?.id) return;
    if (lastProcessedAssistantMessageId.current === latest.id) return;

    const draft = getDraftFromAssistantMessage(latest);
    if (!draft) return;

    lastProcessedAssistantMessageId.current = latest.id;
    onDraftGenerated(draft);
  }, [messages, onDraftGenerated]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    await sendMessage({ text: inputValue });

    setInputValue("");
  };

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-slate-50/50 dark:bg-slate-950/50">
      <CardHeader className="px-4 py-3 border-b bg-background">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            AI Agent
          </CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            gpt-4o
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden relative flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>How can I help you build a workflow today?</p>
              </div>
            )}

            {messages.map((m: any) =>
              (() => {
                const isUser = m.role === "user";
                const draft = !isUser ? getDraftFromAssistantMessage(m) : null;
                const content = getMessageText(m).trim();

                // Avoid a dead/blank assistant bubble. If the assistant produced a draft via tools,
                // show a human-friendly summary even if there's no text.
                if (!isUser && content.length === 0 && draft) {
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 border">
                        <AvatarFallback className="bg-muted">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-lg p-3 text-sm max-w-[85%] bg-background border shadow-sm">
                        <div className="font-semibold">Generated draft</div>
                        <div className="mt-1 text-muted-foreground">
                          {draft.title} ({draft.nodes.length} steps)
                        </div>
                        {draft.summary && (
                          <div className="mt-2 text-muted-foreground">{draft.summary}</div>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="w-8 h-8 border">
                      <AvatarFallback
                        className={
                          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                        }
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-lg p-3 text-sm max-w-[85%] ${
                        isUser ? "bg-primary text-primary-foreground" : "bg-background border shadow-sm"
                      }`}
                    >
                      {content}
                    </div>
                  </div>
                );
              })()
            )}
            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="w-8 h-8 border">
                  <AvatarFallback className="bg-muted">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg p-3 text-sm max-w-[85%] bg-background border shadow-sm text-muted-foreground">
                  Generating draft…
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 bg-background border-t">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe a workflow..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
