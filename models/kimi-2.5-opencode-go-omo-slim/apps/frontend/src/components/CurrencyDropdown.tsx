import { useState, useRef, useEffect, useMemo } from 'react';
import type { Currency } from '../types';

interface CurrencyDropdownProps {
  currencies: Currency[];
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

export function CurrencyDropdown({ 
  currencies, 
  value, 
  onChange, 
  placeholder = 'Select currency' 
}: CurrencyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = currencies.find(c => c.code === value);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return currencies.filter(c => 
      c.code.toLowerCase().includes(term) || 
      c.name.toLowerCase().includes(term)
    );
  }, [currencies, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 
                   bg-gray-800 border border-gray-700 rounded-lg
                   hover:border-gray-600 focus:border-green-500 focus:outline-none
                   transition-colors text-left"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selected ? (
            <>
              <span className="font-semibold text-white">{selected.code}</span>
              <span className="text-gray-400 truncate text-sm">- {selected.name}</span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 
                        rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded
                         text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 text-sm">No currencies found</div>
            ) : (
              filtered.map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => handleSelect(currency.code)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left
                             hover:bg-gray-700 transition-colors
                             ${value === currency.code ? 'bg-gray-700' : ''}`}
                >
                  <span className="font-semibold text-white w-12">{currency.code}</span>
                  <span className="text-gray-400 text-sm truncate">{currency.name}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded 
                    ${currency.type === 'crypto' ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'}`}>
                    {currency.type}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
