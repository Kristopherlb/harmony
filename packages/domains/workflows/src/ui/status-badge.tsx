import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        Running: "default",
        Completed: "secondary",
        Failed: "destructive",
        Terminated: "destructive",
        TimedOut: "destructive",
    };

    const isCompleted = status === "Completed";

    return (
        <Badge
            variant={variants[status] || "secondary"}
            className={isCompleted ? "bg-green-600 hover:bg-green-700 text-white" : ""}
        >
            {status}
        </Badge>
    );
}
