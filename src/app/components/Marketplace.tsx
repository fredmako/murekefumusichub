import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { CompositionCard } from '@/app/components/CompositionCard';
import { mockCompositions } from '@/app/data/mockData';
import { User, Composition } from '@/app/App';

interface MarketplaceProps {
  currentUser: User;
  onAddToCart: (composition: Composition) => void;
}

export function Marketplace({ currentUser, onAddToCart }: MarketplaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [accompanimentFilter, setAccompanimentFilter] = useState<string>('all');

  const filteredCompositions = mockCompositions.filter(comp => {
    const matchesSearch = comp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.composerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDifficulty = difficultyFilter === 'all' || comp.difficulty === difficultyFilter;
    const matchesLanguage = languageFilter === 'all' || comp.language === languageFilter;
    const matchesAccompaniment = accompanimentFilter === 'all' || comp.accompaniment === accompanimentFilter;

    return matchesSearch && matchesDifficulty && matchesLanguage && matchesAccompaniment;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Discover Choral Music</h1>
        <p className="text-gray-600">Browse and purchase high-quality choral compositions from talented composers worldwide</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search compositions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Difficulty Filter */}
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          {/* Language Filter */}
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Latin">Latin</SelectItem>
              <SelectItem value="German">German</SelectItem>
              <SelectItem value="French">French</SelectItem>
            </SelectContent>
          </Select>

          {/* Accompaniment Filter */}
          <Select value={accompanimentFilter} onValueChange={setAccompanimentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Accompaniment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="A cappella">A cappella</SelectItem>
              <SelectItem value="Piano">Piano</SelectItem>
              <SelectItem value="Organ">Organ</SelectItem>
              <SelectItem value="String Quartet">String Quartet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        {(searchTerm || difficultyFilter !== 'all' || languageFilter !== 'all' || accompanimentFilter !== 'all') && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setDifficultyFilter('all');
                setLanguageFilter('all');
                setAccompanimentFilter('all');
              }}
            >
              <Filter className="size-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mb-4">
        <p className="text-gray-600">
          {filteredCompositions.length} composition{filteredCompositions.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Compositions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompositions.map(composition => (
          <CompositionCard
            key={composition.id}
            composition={composition}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>

      {filteredCompositions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No compositions found matching your criteria.</p>
          <Button
            variant="link"
            onClick={() => {
              setSearchTerm('');
              setDifficultyFilter('all');
              setLanguageFilter('all');
              setAccompanimentFilter('all');
            }}
          >
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
