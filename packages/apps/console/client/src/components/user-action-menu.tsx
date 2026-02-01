import { UserCircle, UserCog, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserActionMenuProps {
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewProfile: () => void;
  onChangeAssignee?: () => void;
  showChangeAssignee?: boolean;
  trigger: React.ReactNode;
}

export function UserActionMenu({
  username,
  open,
  onOpenChange,
  onViewProfile,
  onChangeAssignee,
  showChangeAssignee = false,
  trigger,
}: UserActionMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-56 z-[9999]" 
        align="start"
        data-testid="user-action-popover"
      >
        <DropdownMenuLabel className="font-normal p-0">
          <div className="flex items-center gap-3 p-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-bold bg-primary/10">
                {username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">@{username}</p>
              <p className="text-xs text-muted-foreground">Team Member</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-3 py-2.5"
          onSelect={() => {
            onViewProfile();
          }}
          data-testid="menu-view-profile"
        >
          <UserCircle className="h-4 w-4 text-primary" />
          <span className="flex-1">View Profile</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuItem>
        {showChangeAssignee && onChangeAssignee && (
          <DropdownMenuItem
            className="cursor-pointer gap-3 py-2.5"
            onSelect={() => {
              onChangeAssignee();
            }}
            data-testid="menu-change-assignee"
          >
            <UserCog className="h-4 w-4 text-status-degraded" />
            <span className="flex-1">Change Assignee</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
