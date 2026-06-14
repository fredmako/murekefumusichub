import { Play, X } from "lucide-react";
import { Button } from "@/app/components/ui/button";

export function StickyPlayer({ composition, onClose }: any) {
  if (!composition) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur p-3 flex items-center justify-between">
      <div>
        <p className="font-semibold">{composition.title}</p>
        <p className="text-xs text-muted-foreground">
          {composition.composerName}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button size="icon">
          <Play className="size-4" />
        </Button>

        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
