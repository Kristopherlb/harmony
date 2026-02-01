import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Sparkles } from "lucide-react";
import type { ReportStyle } from "@shared/schema";

interface ReportResponse {
  id: string;
  style: ReportStyle;
  content: string;
  generatedAt: string;
  eventCount: number;
  timeRangeDays: number;
}

export function ReportPanel() {
  const [style, setStyle] = useState<ReportStyle>("executive");
  const [days, setDays] = useState<string>("7");
  const [report, setReport] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agent/generate-report", {
        style,
        days: parseInt(days),
      });
      return res.json() as Promise<ReportResponse>;
    },
    onSuccess: (data) => {
      setReport(data.content);
    },
  });

  const styleDescriptions: Record<ReportStyle, string> = {
    executive: "High-level summary for leadership with key metrics and decisions",
    standup: "Team-focused update with blockers, progress, and action items",
    stakeholder: "Business-oriented report with impact analysis and timelines",
  };

  return (
    <Card className="p-4 font-mono" data-testid="report-panel">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-status-degraded" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">AI Report Generator</h3>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="report-style" className="text-xs text-muted-foreground">
              Report Style
            </Label>
            <Select value={style} onValueChange={(v) => setStyle(v as ReportStyle)}>
              <SelectTrigger id="report-style" data-testid="select-report-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive" data-testid="option-executive">Executive</SelectItem>
                <SelectItem value="standup" data-testid="option-standup">Standup</SelectItem>
                <SelectItem value="stakeholder" data-testid="option-stakeholder">Stakeholder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-days" className="text-xs text-muted-foreground">
              Time Range
            </Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="report-days" data-testid="select-report-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{styleDescriptions[style]}</p>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full"
          data-testid="button-generate-report"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </>
          )}
        </Button>

        {generateMutation.isError && (
          <p className="text-xs text-destructive" data-testid="text-report-error">
            Failed to generate report. Please try again.
          </p>
        )}

        {report && (
          <div className="mt-4 border-t border-border pt-4" data-testid="report-output">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase">Generated Report</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(report)}
                data-testid="button-copy-report"
              >
                Copy
              </Button>
            </div>
            <ScrollArea className="h-[300px] rounded-md border border-border bg-muted/30 p-3">
              <pre className="text-xs whitespace-pre-wrap" data-testid="text-report-content">
                {report}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
}
