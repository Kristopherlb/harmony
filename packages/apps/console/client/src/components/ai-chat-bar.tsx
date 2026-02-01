import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  FileText,
  AlertTriangle,
  BarChart3,
  Server,
  MessageSquare,
  Zap,
  ExternalLink,
  Terminal,
} from "lucide-react";
import { SiJira, SiNotion, SiSlack } from "react-icons/si";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: {
    tool: string;
    status: "pending" | "success" | "error";
    result?: string;
  }[];
}

interface SuggestionChip {
  label: string;
  prompt: string;
  icon: React.ReactNode;
  category: "query" | "action" | "report";
}

const defaultSuggestions: SuggestionChip[] = [
  {
    label: "Summarize today's activity",
    prompt: "Summarize today's engineering activity and highlight any issues",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    category: "query",
  },
  {
    label: "What's causing issues?",
    prompt: "What services are currently experiencing problems and what might be causing them?",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    category: "query",
  },
  {
    label: "Generate standup report",
    prompt: "Generate a standup report for the last 24 hours",
    icon: <FileText className="h-3.5 w-3.5" />,
    category: "report",
  },
  {
    label: "Show critical services",
    prompt: "Show me all services with critical or degraded health status",
    icon: <Server className="h-3.5 w-3.5" />,
    category: "query",
  },
];

const actionSuggestions: SuggestionChip[] = [
  {
    label: "Create Jira ticket",
    prompt: "Create a Jira ticket for ",
    icon: <SiJira className="h-3.5 w-3.5" />,
    category: "action",
  },
  {
    label: "Send to Notion",
    prompt: "Send a note to Notion about ",
    icon: <SiNotion className="h-3.5 w-3.5" />,
    category: "action",
  },
  {
    label: "Post to Slack",
    prompt: "Post a message to Slack channel ",
    icon: <SiSlack className="h-3.5 w-3.5" />,
    category: "action",
  },
];

interface AIChatBarProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onCommand?: (command: string, text: string) => void;
  isLoading?: boolean;
  className?: string;
}

const opsCommands = [
  { value: "log", label: "Log", icon: <MessageSquare className="h-3.5 w-3.5" />, description: "Standard log entry" },
  { value: "blocker", label: "Blocker", icon: <AlertTriangle className="h-3.5 w-3.5" />, description: "High severity issue" },
  { value: "decision", label: "Decision", icon: <FileText className="h-3.5 w-3.5" />, description: "Architectural decision" },
  { value: "status", label: "Status", icon: <BarChart3 className="h-3.5 w-3.5" />, description: "View your stats" },
] as const;

export function AIChatBar({ messages, onSendMessage, onCommand, isLoading, className }: AIChatBarProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect /ops commands
  const commandMatch = input.match(/^\/ops\s+(\w+)?/);
  const isTypingCommand = commandMatch !== null;
  const commandPrefix = commandMatch?.[1] || "";
  const filteredCommands = isTypingCommand
    ? opsCommands.filter(cmd => cmd.value.startsWith(commandPrefix.toLowerCase()))
    : [];

  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isExpanded]);

  useEffect(() => {
    if (isTypingCommand && filteredCommands.length > 0) {
      setShowCommandSuggestions(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
    }
  }, [input, isTypingCommand, filteredCommands.length]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    
    // Check if it's a command
    const commandMatch = input.trim().match(/^\/ops\s+(\w+)(?:\s+(.+))?$/);
    if (commandMatch && onCommand) {
      const [, command, text = ""] = commandMatch;
      onCommand(command, text.trim());
      setInput("");
      setIsExpanded(true);
      setShowCommandSuggestions(false);
      return;
    }
    
    // Regular message
    onSendMessage(input.trim());
    setInput("");
    setIsExpanded(true);
    setShowCommandSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommandSuggestions && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedCommandIndex];
        if (selectedCommand) {
          const restOfInput = input.replace(/^\/ops\s+\w*/, "").trim();
          setInput(`/ops ${selectedCommand.value}${restOfInput ? ` ${restOfInput}` : ""}`);
          setShowCommandSuggestions(false);
          textareaRef.current?.focus();
        }
      } else if (e.key === "Escape") {
        setShowCommandSuggestions(false);
      }
      return;
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: SuggestionChip) => {
    if (suggestion.category === "action") {
      setInput(suggestion.prompt);
      textareaRef.current?.focus();
    } else {
      onSendMessage(suggestion.prompt);
      setIsExpanded(true);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setTimeout(() => setIsFocused(false), 200);
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out",
        isExpanded ? "h-[60vh]" : isFocused ? "h-auto" : "h-auto",
        className
      )}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="container mx-auto px-4">
        <Card
          className={cn(
            "border-t shadow-lg transition-all duration-300",
            isExpanded ? "h-full flex flex-col" : ""
          )}
        >
          {isExpanded && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Ops Agent</span>
                <Badge variant="outline" className="text-xs">Beta</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(false)}
                  data-testid="button-minimize-chat"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsExpanded(false);
                    setIsFocused(false);
                  }}
                  data-testid="button-close-chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {isExpanded && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Sparkles className="h-12 w-12 mb-4 text-primary/50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Ops Agent</h3>
                  <p className="text-sm max-w-md mb-4">
                    Ask questions about your services, generate reports, or take actions
                    across your connected tools.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Try commands like <code className="px-1.5 py-0.5 bg-muted rounded">/ops log</code> or <code className="px-1.5 py-0.5 bg-muted rounded">/ops blocker</code></span>
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.content.startsWith("/ops") && (
                      <div className="flex items-center gap-1.5 mb-1 text-xs opacity-80">
                        <Terminal className="h-3 w-3" />
                        <span className="font-mono">Command</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.toolCalls.map((tool, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex items-center gap-2 text-xs px-2 py-1 rounded",
                              tool.status === "success"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : tool.status === "error"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-amber-500/10 text-amber-500"
                            )}
                          >
                            <Zap className="h-3 w-3" />
                            <span>{tool.tool}</span>
                            {tool.status === "success" && tool.result && (
                              <ExternalLink className="h-3 w-3 ml-auto cursor-pointer" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="text-xs opacity-60 mt-1 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.1s]" />
                      <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {(isFocused || isExpanded) && !isExpanded && (
            <div className="px-4 pt-3 pb-2 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Quick Actions</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {defaultSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion.label}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => handleSuggestionClick(suggestion)}
                    data-testid={`suggestion-${suggestion.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {suggestion.icon}
                    {suggestion.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Connected Tools</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {actionSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion.label}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => handleSuggestionClick(suggestion)}
                    data-testid={`action-${suggestion.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {suggestion.icon}
                    {suggestion.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your ops, generate reports, or use /ops commands..."
                className="min-h-[44px] max-h-[120px] resize-none pr-10"
                rows={1}
                data-testid="input-chat"
              />
              {showCommandSuggestions && filteredCommands.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredCommands.map((cmd, idx) => (
                    <button
                      key={cmd.value}
                      type="button"
                      onClick={() => {
                        const restOfInput = input.replace(/^\/ops\s+\w*/, "").trim();
                        setInput(`/ops ${cmd.value}${restOfInput ? ` ${restOfInput}` : ""}`);
                        setShowCommandSuggestions(false);
                        textareaRef.current?.focus();
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-muted transition-colors",
                        idx === selectedCommandIndex && "bg-muted"
                      )}
                      data-testid={`command-suggestion-${cmd.value}`}
                    >
                      <Terminal className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{cmd.label}</div>
                        <div className="text-xs text-muted-foreground">{cmd.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!isExpanded && messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-8 w-8"
                  onClick={() => setIsExpanded(true)}
                  data-testid="button-expand-chat"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="h-[44px] px-4"
              data-testid="button-send-chat"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
