/**
 * SearchBar Component
 * 
 * Animated search input with category filters and recent searches.
 */

import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

interface SearchBarProps {
    onSearch: (query: string, category?: string) => void;
    onClear?: () => void;
    placeholder?: string;
    categories?: string[];
    recentSearches?: string[];
    trending?: string[];
}

export function SearchBar({
    onSearch,
    onClear,
    placeholder = 'Search listings...',
    categories = [],
    recentSearches = [],
    trending = [],
}: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
    const [isFocused, setIsFocused] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (query.trim()) {
            onSearch(query.trim(), selectedCategory);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        onSearch(suggestion, selectedCategory);
        setShowSuggestions(false);
    };

    const handleClear = () => {
        setQuery('');
        setSelectedCategory(undefined);
        onClear?.();
        inputRef.current?.focus();
    };

    const handleCategoryClick = (category: string) => {
        const newCategory = selectedCategory === category ? undefined : category;
        setSelectedCategory(newCategory);
        if (query.trim()) {
            onSearch(query.trim(), newCategory);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Search input */}
            <form onSubmit={handleSubmit}>
                <div className={`
          relative flex items-center
          bg-clay-card border rounded-2xl
          transition-all duration-200
          ${isFocused ? 'border-clay-action shadow-lg shadow-clay-action/10' : 'border-white/10'}
        `}>
                    <Search size={20} className="absolute left-4 text-text-muted" />

                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => { setIsFocused(true); setShowSuggestions(true); }}
                        onBlur={() => setIsFocused(false)}
                        placeholder={placeholder}
                        className="
              w-full h-12 pl-12 pr-12
              bg-transparent
              text-white placeholder-text-muted
              focus:outline-none
            "
                    />

                    {query && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X size={18} className="text-text-muted" />
                        </button>
                    )}
                </div>
            </form>

            {/* Category filters */}
            {categories.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2 -mx-1 px-1">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => handleCategoryClick(category)}
                            className={`
                px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all
                ${selectedCategory === category
                                    ? 'bg-clay-action text-white'
                                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                                }
              `}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && (recentSearches.length > 0 || trending.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-clay-card border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {/* Recent searches */}
                    {recentSearches.length > 0 && (
                        <div className="p-3 border-b border-white/10">
                            <p className="text-xs text-text-muted mb-2 flex items-center gap-1">
                                <Clock size={12} /> Recent
                            </p>
                            <div className="space-y-1">
                                {recentSearches.slice(0, 3).map((search, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSuggestionClick(search)}
                                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                                    >
                                        {search}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Trending */}
                    {trending.length > 0 && (
                        <div className="p-3">
                            <p className="text-xs text-text-muted mb-2 flex items-center gap-1">
                                <TrendingUp size={12} /> Trending
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {trending.slice(0, 5).map((term, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSuggestionClick(term)}
                                        className="px-3 py-1 bg-white/5 rounded-full text-sm hover:bg-white/10 transition-colors"
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default SearchBar;
