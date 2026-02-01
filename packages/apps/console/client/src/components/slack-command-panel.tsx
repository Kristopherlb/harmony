import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Terminal, MessageSquare, AlertTriangle, FileText, BarChart } from "lucide-react";
import { SiSlack } from "react-icons/si";

interface SlackCommandPanelProps {
  onSubmit: (command: string, text: string) => void;
  isSubmitting?: boolean;
  className?: string;
}

const commands = [
  { value: "log", label: "Log", icon: <MessageSquare className="h-3.5 w-3.5" />, description: "Standard log entry" },
  { value: "blocker", label: "Blocker", icon: <AlertTriangle className="h-3.5 w-3.5" />, description: "High severity issue" },
  { value: "decision", label: "Decision", icon: <FileText className="h-3.5 w-3.5" />, description: "Architectural decision" },
  { value: "status", label: "Status", icon: <BarChart className="h-3.5 w-3.5" />, description: "View your stats" },
] as const;

export function SlackCommandPanel({ onSubmit, isSubmitting, className }: SlackCommandPanelProps) {
  const [command, setCommand] = useState<string>("log");
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && command !== "status") return;
    onSubmit(command, text);
    setText("");
  };

  const selectedCommand = commands.find((c) => c.value === command);

  return (
    <Card
      className={cn("p-4 font-mono border border-border bg-card", className)}
      data-testid="slack-command-panel"
    >
      <div className="flex items-center gap-2 mb-4">
        <SiSlack className="h-5 w-5 text-primary" />
        <span className="font-semibold">Slack Command Simulator</span>
        <Badge variant="secondary" className="ml-auto font-mono text-xs">
          /ops
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Terminal className="h-4 w-4" />
          <span className="text-sm">/ops</span>
          <Select value={command} onValueChange={setCommand}>
            <SelectTrigger
              className="w-32 h-8 font-mono text-sm"
              data-testid="select-command"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {commands.map((cmd) => (
                <SelectItem
                  key={cmd.value}
                  value={cmd.value}
                  className="font-mono"
                  data-testid={`select-command-${cmd.value}`}
                >
                  <div className="flex items-center gap-2">
                    {cmd.icon}
                    <span>{cmd.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {command !== "status" && (
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Enter ${selectedCommand?.label.toLowerCase()} message...`}
            className="font-mono text-sm"
            disabled={isSubmitting}
            data-testid="input-command-text"
          />
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selectedCommand?.description}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || (!text.trim() && command !== "status")}
            className="gap-1.5 font-mono"
            data-testid="button-send-command"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
