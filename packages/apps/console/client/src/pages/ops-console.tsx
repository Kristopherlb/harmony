import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { NOCHeader } from "@/components/noc-header";
import { SignalFeed } from "@/components/signal-feed";
import { ContextWorkspace } from "@/components/context-workspace";
import { ActionPanel } from "@/components/action-panel";
import { MobileActionDrawer } from "@/components/mobile-action-drawer";
import { AIChatBar, type ChatMessage } from "@/components/ai-chat-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import type { Event, Action, ActionCatalogResponse, UserRole, ChatResponse } from "@shared/schema";

export default function OpsConsole() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userRole] = useState<UserRole>("sre");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const eventsQuery = useQuery<{ events: Event[]; total: number }>({
    queryKey: ["/api/activity/stream"],
    refetchInterval: 10000,
  });

  const catalogQuery = useQuery<ActionCatalogResponse>({
    queryKey: ["/api/actions/catalog"],
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/agent/chat", {
        message,
        conversationId,
        context: { 
          currentPage: "ops-console",
          selectedEventId: selectedEvent?.id,
        },
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

  const events = eventsQuery.data?.events ?? [];
  const actions = catalogQuery.data?.actions ?? [];

  const relatedEvents = useMemo(() => {
    if (!selectedEvent || !selectedEvent.serviceTags) return [];
    
    return events.filter((e) => {
      if (e.id === selectedEvent.id) return false;
      if (!e.serviceTags || e.serviceTags.length === 0) return false;
      return e.serviceTags.some((tag) => selectedEvent.serviceTags.includes(tag));
    }).slice(0, 10);
  }, [selectedEvent, events]);

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    if (isMobile) {
      setLocation(`/console/signal/${event.id}`);
    }
  };

  const handleBackToFeed = () => {
    setSelectedEvent(null);
  };

  const criticalCount = events.filter(e => e.severity === "critical" && !e.resolved).length;

  if (eventsQuery.isLoading || catalogQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background font-mono" data-testid="ops-console-loading">
        <NOCHeader />
        <div className="flex h-[calc(100vh-64px)]">
          <div className="w-full md:w-1/4 border-r border-border p-3 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="hidden md:block w-1/2 p-4">
            <Skeleton className="h-32 w-full mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="hidden md:block w-1/4 border-l border-border p-3 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-mono" data-testid="ops-console-page">
      <NOCHeader />
      
      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-full md:w-[350px] md:min-w-[280px] md:max-w-[360px]">
          <SignalFeed
            events={events}
            selectedEvent={selectedEvent}
            onSelectEvent={handleSelectEvent}
            isMobile={isMobile}
            criticalCount={criticalCount}
          />
        </div>

        <div className="hidden md:flex flex-1 min-w-0">
          <ContextWorkspace
            event={selectedEvent}
            relatedEvents={relatedEvents}
          />
        </div>

        <div className="hidden md:flex w-[300px] min-w-[280px] max-w-[360px]">
          <ActionPanel
            event={selectedEvent}
            actions={actions}
            userRole={userRole}
          />
        </div>
      </div>

      {isMobile && (
        <MobileActionDrawer
          event={selectedEvent}
          actions={actions}
          userRole={userRole}
        />
      )}

      {!isMobile && (
        <AIChatBar
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          isLoading={chatMutation.isPending}
        />
      )}
    </div>
  );
}

export function SignalDetailPage() {
  const [, params] = useRoute("/console/signal/:id");
  const [, setLocation] = useLocation();
  const [userRole] = useState<UserRole>("sre");
  const isMobile = useIsMobile();

  const eventsQuery = useQuery<{ events: Event[]; total: number }>({
    queryKey: ["/api/activity/stream"],
    refetchInterval: 10000,
  });

  const catalogQuery = useQuery<ActionCatalogResponse>({
    queryKey: ["/api/actions/catalog"],
  });

  const events = eventsQuery.data?.events ?? [];
  const actions = catalogQuery.data?.actions ?? [];
  const selectedEvent = events.find(e => e.id === params?.id) || null;

  const relatedEvents = useMemo(() => {
    if (!selectedEvent || !selectedEvent.serviceTags) return [];
    
    return events.filter((e) => {
      if (e.id === selectedEvent.id) return false;
      if (!e.serviceTags || e.serviceTags.length === 0) return false;
      return e.serviceTags.some((tag) => selectedEvent.serviceTags.includes(tag));
    }).slice(0, 10);
  }, [selectedEvent, events]);

  const handleBack = () => {
    setLocation("/console");
  };

  if (eventsQuery.isLoading || catalogQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background font-mono" data-testid="signal-detail-loading">
        <NOCHeader />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-background font-mono" data-testid="signal-not-found">
        <NOCHeader />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] p-4 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Signal Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            The signal you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={handleBack} className="gap-1.5">
            <ChevronLeft className="h-4 w-4" />
            Back to Signal Stream
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-mono" data-testid="signal-detail-page">
      <NOCHeader />
      
      <ContextWorkspace
        event={selectedEvent}
        relatedEvents={relatedEvents}
        isMobile={isMobile}
        onBack={handleBack}
      />

      {isMobile && (
        <MobileActionDrawer
          event={selectedEvent}
          actions={actions}
          userRole={userRole}
        />
      )}
    </div>
  );
}
