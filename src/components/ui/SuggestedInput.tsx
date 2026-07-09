import React, { useId, useMemo, useState } from 'react';
import { cn } from '../../styles/zen';

type SuggestedInputProps = {
  ariaLabel: string;
  value: string;
  suggestions: string[];
  onChange: (value: string) => void;
  onSelectSuggestion?: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  min?: string;
  step?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  className?: string;
  inputClassName?: string;
  inlineSuggestions?: boolean;
};

const SuggestedInput: React.FC<SuggestedInputProps> = ({
  ariaLabel,
  value,
  suggestions,
  onChange,
  onSelectSuggestion,
  type = 'text',
  placeholder,
  min,
  step,
  inputMode,
  className,
  inputClassName,
  inlineSuggestions = false,
}) => {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const visibleSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.trim()),
    [suggestions],
  );
  const hasSuggestions = visibleSuggestions.length > 0;

  const closeSoon = () => {
    window.setTimeout(() => setIsOpen(false), 120);
  };

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    onSelectSuggestion?.(suggestion);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          min={min}
          step={step}
          inputMode={inputMode}
          aria-label={ariaLabel}
          aria-expanded={hasSuggestions ? isOpen : undefined}
          aria-controls={hasSuggestions ? listId : undefined}
          aria-haspopup={hasSuggestions ? 'listbox' : undefined}
          onFocus={() => setIsOpen(hasSuggestions)}
          onBlur={closeSoon}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(hasSuggestions);
          }}
          className={cn(
            'w-full rounded border border-[#d9dbd2] bg-white px-3 py-2 text-zen-text outline-none transition focus:border-[#c59a2e]',
            hasSuggestions && 'pr-9',
            inputClassName,
          )}
        />
        {hasSuggestions ? (
          <button
            type="button"
            aria-label={`Show ${ariaLabel} suggestions`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsOpen((current) => !current)}
            className="absolute top-0 right-0 flex h-full w-9 items-center justify-center text-zen-muted"
          >
            <span className="h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-current" />
          </button>
        ) : null}
      </div>
      {hasSuggestions && isOpen ? (
        <div
          id={listId}
          role="listbox"
          className={cn(
            'left-0 z-[1100] mt-1 max-h-56 w-full overflow-y-auto border-t-[6px] border-t-[#bfd2f5] bg-white py-1 shadow-[0_2px_12px_rgba(0,0,0,0.24)]',
            inlineSuggestions ? 'relative' : 'absolute top-full',
          )}
        >
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected={suggestion === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              className="block w-full px-4 py-3 text-left text-sm text-zen-text hover:bg-[#d7e5ff]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SuggestedInput;
