import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import type { AppErrorAction, AppErrorDetail } from "@/lib/appErrorEvents";

const ACTION_LABELS: Record<AppErrorAction, string> = {
  ok: "OK",
  refresh: "Refresh",
  exit: "Exit",
};

export function AppErrorDialog({
  open,
  detail,
  onOpenChange,
  onAction,
}: {
  open: boolean;
  detail: AppErrorDetail | null;
  onOpenChange: (open: boolean) => void;
  onAction: (action: AppErrorAction, detail: AppErrorDetail | null) => void;
}) {
  if (!detail) return null;

  const actions = detail.actions || ["ok"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{detail.title || "Something went wrong"}</DialogTitle>
          <DialogDescription>
            {detail.message || "An unexpected error occurred."}
          </DialogDescription>
        </DialogHeader>
        {detail.status ? (
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Status: {detail.status}
          </div>
        ) : null}
        <DialogFooter>
          {actions.map((action) => (
            <Button
              key={action}
              variant={action === "refresh" ? "default" : "outline"}
              onClick={() => onAction(action, detail)}
            >
              {ACTION_LABELS[action]}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
