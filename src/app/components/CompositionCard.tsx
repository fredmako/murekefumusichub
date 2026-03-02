import { Clock, Languages, Music2, ShoppingCart, Users } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

interface Composition {
  title: string;
  composerName: string;
  difficulty: string;
  description?: string;
  voiceParts?: string[];
  duration?: string;
  language?: string;
  accompaniment?: string;
  price: number;
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-100 text-green-800";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "Advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="lift-card overflow-hidden border-border/70">
      <div className="h-1 w-full bg-gradient-to-r from-primary to-[#0d3e47]" />
      <CardHeader>
        <div className="mb-2 flex items-start justify-between">
          <Music2 className="size-8 text-primary" />
          <Badge className={getDifficultyColor(composition.difficulty)}>
            {composition.difficulty}
          </Badge>
        </div>
        <CardTitle className="text-2xl">{composition.title}</CardTitle>
        <p className="text-sm text-muted-foreground">by {composition.composerName}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {composition.description || "No description available"}
        </p>

        <div className="space-y-2">
          {composition.voiceParts && composition.voiceParts.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>{composition.voiceParts.join(", ")}</span>
            </div>
          )}

          {composition.duration && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>{composition.duration}</span>
            </div>
          )}

          {(composition.language || composition.accompaniment) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Languages className="size-4" />
              <span>
                {composition.language || "Unknown"} •{" "}
                {composition.accompaniment || "Unknown"}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-primary">
            ${composition.price.toFixed(2)}
          </p>
        </div>
        {showActions && (
          <Button
            onClick={() => onAddToCart?.(composition)}
            disabled={!canAddToCart}
          >
            <ShoppingCart className="mr-2 size-4" />
            Add to Cart
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default CompositionCard;
