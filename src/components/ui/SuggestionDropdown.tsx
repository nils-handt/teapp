import React, { useEffect, useRef } from 'react';
import { cn } from '../../styles/zen';

type SuggestionDropdownProps = {
  id: string;
  items: string[];
  activeIndex: number | null;
  onActiveIndexChange: (index: number) => void;
  onSelect: (value: string) => void;
  className?: string;
};

const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({
  id,
  items,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  className,
}) => {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (activeIndex === null || activeIndex >= items.length) {
      return;
    }

    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, items.length]);

  return (
    <div
      id={id}
      role="listbox"
      className={cn(
        'zen-autocomplete-menu left-0 z-[1100] mt-2 w-full overflow-y-auto rounded-2xl border border-zen-border p-1.5 shadow-[0_12px_28px_rgba(69,83,66,0.16)]',
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item}
          id={`${id}-option-${index}`}
          ref={(element) => { optionRefs.current[index] = element; }}
          type="button"
          role="option"
          aria-selected={activeIndex === index}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelect(item)}
          className={cn(
            'zen-autocomplete-option text-base',
            activeIndex === index && 'zen-autocomplete-option--active',
          )}
        >
          {item}
        </button>
      ))}
    </div>
  );
};

export default SuggestionDropdown;
