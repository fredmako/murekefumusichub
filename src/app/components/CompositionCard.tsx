import { Music2, Clock, Languages, Users, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Composition } from '@/app/App';

interface CompositionCardProps {
  composition: Composition;
  onAddToCart: (composition: Composition) => void;
  showActions?: boolean;
}

export function CompositionCard({ composition, onAddToCart, showActions = true }: CompositionCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-100 text-green-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <Music2 className="size-8 text-blue-600" />
          <Badge className={getDifficultyColor(composition.difficulty)}>
            {composition.difficulty}
          </Badge>
        </div>
        <CardTitle className="text-xl">{composition.title}</CardTitle>
        <p className="text-sm text-gray-600">by {composition.composerName}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-gray-700 line-clamp-2">{composition.description}</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="size-4" />
            <span>{composition.voiceParts.join(', ')}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="size-4" />
            <span>{composition.duration}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Languages className="size-4" />
            <span>{composition.language} • {composition.accompaniment}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-blue-600">${composition.price.toFixed(2)}</p>
        </div>
        {showActions && (
          <Button onClick={() => onAddToCart(composition)}>
            <ShoppingCart className="size-4 mr-2" />
            Add to Cart
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
