import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { NOCHeader } from "@/components/noc-header";
import { DORAMetrics } from "@/components/dora-metrics";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { UnifiedStream } from "@/components/unified-stream";
import { SourceBreakdown } from "@/components/source-breakdown";
import { QuickStats } from "@/components/quick-stats";
import { SecuritySection } from "@/components/security-section";
import { AIChatBar, type ChatMessage } from "@/components/ai-chat-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { ActivityStreamResponse, DORAMetrics as DORAMetricsType, Event, ChatResponse } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const eventsQuery = useQuery<ActivityStreamResponse>({
    queryKey: ["/api/activity/stream"],
    refetchInterval: 30000,
  });

  const metricsQuery = useQuery<DORAMetricsType>({
    queryKey: ["/api/metrics/dora"],
    refetchInterval: 60000,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/agent/chat", {
        message,
        conversationId,
        context: { currentPage: "dashboard" },
      });
      return res.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setChatMessages(prev => [...prev, {
        id: data.message.id,
        role: data.message.role as "user" | "assistant",
        content: data.message.content,
        timestamp: new Date(data.message.timestamp),
        toolCalls: data.message.toolCalls?.map(tc => ({
          tool: tc.tool,
          status: tc.status as "pending" | "success" | "error",
          result: tc.result,
        })),
      }]);
    },
    onError: (error) => {
      toast({
        title: "Chat Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (message: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(message);
  };

  const slackCommandMutation = useMutation({
    mutationFn: async ({ command, text }: { command: string; text: string }) => {
      const res = await apiRequest("POST", "/api/integrations/slack/events", {
        command: `/ops`,
        text: `${command} ${text}`.trim(),
        user_id: "demo-user",
        user_name: "demo",
        channel_id: "C123456",
        channel_name: "ops-channel",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity/stream"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/dora"] });
      toast({
        title: "Command sent",
        description: "Your ops command has been processed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send command",
        variant: "destructive",
      });
    },
  });

  const events: Event[] = eventsQuery.data?.events ?? [];
  const metrics = metricsQuery.data ?? null;


  return (
    <div data-testid="dashboard-page">
      <section data-testid="section-dora-metrics" className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          DORA Metrics
        </h2>
        <DORAMetrics metrics={metrics} isLoading={metricsQuery.isLoading} />
      </section>

      <section data-testid="section-quick-stats" className="mb-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Quick Stats
        </h2>
        {eventsQuery.isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </Card>
            ))}
          </div>
        ) : (
          <QuickStats events={events} />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section data-testid="section-heatmap">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Activity Heatmap
          </h2>
          <Card className="p-4 border border-border bg-card overflow-x-auto">
            {eventsQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <ActivityHeatmap events={events} weeks={12} />
            )}
          </Card>
        </section>

        <section data-testid="section-security">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Security Posture
          </h2>
          <SecuritySection />
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-20">
        <div className="lg:col-span-2 space-y-6">
          <section data-testid="section-activity-stream">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Unified Activity Stream
            </h2>
            <Card className="border border-border bg-card p-4">
              {eventsQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-3 rounded-md border border-border">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <UnifiedStream events={events} maxHeight="400px" />
              )}
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section data-testid="section-source-breakdown">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Sources
            </h2>
            {eventsQuery.isLoading ? (
              <Card className="p-4">
                <Skeleton className="h-32 w-full" />
              </Card>
            ) : (
              <SourceBreakdown events={events} />
            )}
          </section>
        </div>
      </div>

      <AIChatBar
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        onCommand={(command, text) => {
          slackCommandMutation.mutate({ command, text });
        }}
        isLoading={chatMutation.isPending}
      />
    </div>
  );
}
