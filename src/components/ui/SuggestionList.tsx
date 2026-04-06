import React from 'react';
import {
  cn,
  zenSuggestionButtonClass,
  zenSuggestionGroupClass,
  zenSuggestionLabelClass,
} from '../../styles/zen';

type SuggestionListProps = {
  items: string[];
  onSelect: (value: string) => void;
  label?: string;
  className?: string;
  listClassName?: string;
  buttonClassName?: string;
};

const SuggestionList: React.FC<SuggestionListProps> = ({
  items,
  onSelect,
  label,
  className,
  listClassName,
  buttonClassName,
}) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn(zenSuggestionGroupClass, className)}>
      {label ? <div className={zenSuggestionLabelClass}>{label}</div> : null}
      <div className={cn(zenSuggestionGroupClass, listClassName)}>
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(zenSuggestionButtonClass, buttonClassName)}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestionList;
