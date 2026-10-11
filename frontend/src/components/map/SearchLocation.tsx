'use client';

import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface SearchLocationProps {
  onSelectLocation: (lat: number, lng: number) => void;
}

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

export function SearchLocation({ onSelectLocation }: SearchLocationProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      // Nominatim search API
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (result: GeocodeResult) => {
    onSelectLocation(parseFloat(result.lat), parseFloat(result.lon));
    setShowResults(false);
    setQuery(result.display_name.split(',')[0]); // simplified name
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-[400] max-w-sm mx-auto">
      <div className="relative flex items-center bg-surface rounded-lg shadow-lg border border-border">
        <Input 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search location..."
          className="border-none focus-visible:ring-0 shadow-none h-12 pr-12 rounded-lg"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-1 text-muted-foreground"
          onClick={handleSearch}
        >
          {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>

      {showResults && results.length > 0 && (
        <div className="mt-2 bg-surface rounded-lg shadow-xl border border-border max-h-60 overflow-y-auto">
          {results.map((r, idx) => (
            <button
              key={idx}
              onClick={() => selectResult(r)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover border-b border-border last:border-0"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
