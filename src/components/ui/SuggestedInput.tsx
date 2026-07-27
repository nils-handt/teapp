import React, { useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../styles/zen';
import SuggestionDropdown from './SuggestionDropdown';

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
  enterKeyHint?: React.HTMLAttributes<HTMLInputElement>['enterKeyHint'];
  className?: string;
  inputClassName?: string;
  inlineSuggestions?: boolean;
  inlineSuggestionsFill?: boolean;
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
  enterKeyHint,
  className,
  inputClassName,
  inlineSuggestions = false,
  inlineSuggestionsFill = false,
}) => {
  const reactId = useId();
  const controlId = `tea-app-control-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const listId = `${controlId}-suggestions`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visibleSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.trim()),
    [suggestions],
  );
  const hasSuggestions = visibleSuggestions.length > 0;
  const suggestionPositionClass = !inlineSuggestions
    ? 'absolute top-full max-h-56'
    : inlineSuggestionsFill
      ? 'relative min-h-0 flex-1'
      : 'relative max-h-56';

  const matchingSuggestionIndex = () => visibleSuggestions.findIndex((suggestion) => suggestion === value);

  const openSuggestions = () => {
    if (!hasSuggestions) {
      return;
    }

    setIsOpen(true);
    const matchingIndex = matchingSuggestionIndex();
    setActiveIndex(matchingIndex >= 0 ? matchingIndex : null);
  };

  const closeSuggestions = () => {
    setIsOpen(false);
    setActiveIndex(null);
  };

  const closeSoon = () => {
    window.setTimeout(closeSuggestions, 120);
  };

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    onSelectSuggestion?.(suggestion);
    closeSuggestions();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasSuggestions || event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) => {
        if (!isOpen) {
          const matchingIndex = matchingSuggestionIndex();
          return matchingIndex >= 0 ? matchingIndex : 0;
        }
        return currentIndex === null ? 0 : Math.min(currentIndex + 1, visibleSuggestions.length - 1);
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) => {
        if (!isOpen) {
          const matchingIndex = matchingSuggestionIndex();
          return matchingIndex >= 0 ? matchingIndex : visibleSuggestions.length - 1;
        }
        return currentIndex === null ? visibleSuggestions.length - 1 : Math.max(currentIndex - 1, 0);
      });
      return;
    }

    if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      if (activeIndex !== null) {
        selectSuggestion(visibleSuggestions[activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeSuggestions();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={controlId}
          name={controlId}
          type={type}
          autoComplete="other"
          value={value}
          placeholder={placeholder}
          min={min}
          step={step}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          aria-label={ariaLabel}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={hasSuggestions ? isOpen : undefined}
          aria-controls={hasSuggestions ? listId : undefined}
          aria-haspopup={hasSuggestions ? 'listbox' : undefined}
          aria-activedescendant={isOpen && activeIndex !== null ? `${listId}-option-${activeIndex}` : undefined}
          onFocus={openSuggestions}
          onBlur={closeSoon}
          onChange={(event) => {
            onChange(event.target.value);
            setActiveIndex(null);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
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
            onClick={() => {
              const shouldOpen = !isOpen;
              if (shouldOpen) {
                const matchingIndex = matchingSuggestionIndex();
                setActiveIndex(matchingIndex >= 0 ? matchingIndex : null);
              } else {
                setActiveIndex(null);
              }
              setIsOpen(shouldOpen);
              inputRef.current?.focus();
            }}
            className="absolute top-0 right-0 flex h-full w-9 items-center justify-center text-zen-muted"
          >
            <span className="h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-current" />
          </button>
        ) : null}
      </div>
      {hasSuggestions && isOpen ? (
        <SuggestionDropdown
          id={listId}
          items={visibleSuggestions}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          onSelect={selectSuggestion}
          className={suggestionPositionClass}
        />
      ) : null}
    </div>
  );
};

export default SuggestedInput;
