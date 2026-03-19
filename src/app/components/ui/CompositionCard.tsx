import { useEffect, useRef, useState } from "react";
import { Music2, Play, ShoppingCart } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardFooter,
} from "@/app/components/ui/card";
import { formatKesAmount } from "@/lib/currency";
import { MidiPreviewPlayer } from "@/app/components/MidiPreviewPlayer";
import { toast } from "sonner";

interface Composition {
  title: string;
  composerName: string;
  difficulty?: string;
  description?: string;
  voiceParts?: string[];
  duration?: string;
  language?: string;
  accompaniment?: string | string[];
  price: number;
  midiUrl?: string;
  thumbnailUrl?: string;
}

interface CompositionCardProps {
  composition: Composition;
  onAddToCart?: (composition: Composition) => void;
  showActions?: boolean;
}

export function CompositionCard({
  composition,
  onAddToCart,
  showActions = true,
}: CompositionCardProps) {
  const canAddToCart = typeof onAddToCart === "function";
  const [promptVisible, setPromptVisible] = useState(false);
  const promptTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (promptTimerRef.current) {
        window.clearTimeout(promptTimerRef.current);
      }
    };
  }, []);

  const handlePreviewEnd = () => {
    toast.info("Preview ended. Purchase to download the full composition.");
    setPromptVisible(true);
    if (promptTimerRef.current) {
      window.clearTimeout(promptTimerRef.current);
    }
    promptTimerRef.current = window.setTimeout(() => {
      setPromptVisible(false);
    }, 4000);
  };

  return (
    <Card className="group overflow-hidden border-border/70 bg-card/80 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.7)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {composition.thumbnailUrl ? (
          <img
            src={composition.thumbnailUrl}
            alt={`${composition.title} cover art`}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
            <Music2 className="size-12 text-white/70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center">
          {composition.midiUrl ? (
            <MidiPreviewPlayer
              midiUrl={composition.midiUrl}
              compact
              previewRatio={0.33}
              onPreviewEnd={handlePreviewEnd}
              className="flex flex-col items-center gap-2"
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full bg-white/15 text-white">
              <Play className="size-5" />
            </div>
          )}
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {composition.title}
              </p>
              <p className="truncate text-xs text-white/75">
                {composition.composerName}
              </p>
            </div>
            <Badge className="bg-white/15 text-white">
              {formatKesAmount(composition.price)}
            </Badge>
          </div>
          {promptVisible ? (
            <p className="mt-2 text-xs text-white/80">
              Preview ended. Purchase to download.
            </p>
          ) : null}
        </div>
      </div>

      <CardFooter className="flex items-center justify-between">
        {showActions ? (
          <Button
            onClick={() => onAddToCart?.(composition)}
            disabled={!canAddToCart}
            className="w-full"
          >
            <ShoppingCart className="mr-2 size-4" />
            Buy to Download
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export default CompositionCard;

