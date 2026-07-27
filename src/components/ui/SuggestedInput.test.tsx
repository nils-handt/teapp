import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuggestedInput from './SuggestedInput';

const suggestions = ['Assam', 'Darjeeling', 'Sencha'];

type ControlledInputProps = {
  initialValue?: string;
  onSelectSuggestion?: (value: string) => void;
};

const ControlledInput: React.FC<ControlledInputProps> = ({ initialValue = '', onSelectSuggestion }) => {
  const [value, setValue] = useState(initialValue);

  return (
    <SuggestedInput
      ariaLabel="Tea name"
      value={value}
      suggestions={suggestions}
      onChange={setValue}
      onSelectSuggestion={onSelectSuggestion}
    />
  );
};

describe('SuggestedInput', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  it('uses a neutral field identity that does not resemble personal autofill data', () => {
    render(<ControlledInput />);

    const input = screen.getByRole('combobox', { name: 'Tea name' });
    expect(input.id).toMatch(/^tea-app-control-[a-zA-Z0-9_-]+$/);
    expect(input.getAttribute('name')).toBe(input.id);
    expect(input.getAttribute('autocomplete')).toBe('off');
  });

  it('uses the spacious Zen menu treatment', () => {
    render(<ControlledInput />);

    fireEvent.focus(screen.getByRole('combobox', { name: 'Tea name' }));

    const listbox = screen.getByRole('listbox');
    expect(listbox.className).toContain('rounded-2xl');
    expect(listbox.className).toContain('border-zen-border');
    expect(listbox.className).toContain('zen-autocomplete-menu');
    expect(listbox.className).not.toContain('border-t-[6px]');
    expect(screen.getByRole('option', { name: 'Assam' }).className).toContain('zen-autocomplete-option');
  });

  it('moves the active option with arrow keys and stops at list boundaries', () => {
    render(<ControlledInput />);
    const input = screen.getByRole('combobox', { name: 'Tea name' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Assam' }).id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Darjeeling' }).id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Sencha' }).id);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Darjeeling' }).id);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('selects the active option with Enter and closes the menu', () => {
    const onSelectSuggestion = vi.fn();
    render(<ControlledInput onSelectSuggestion={onSelectSuggestion} />);
    const input = screen.getByRole('combobox', { name: 'Tea name' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect((input as HTMLInputElement).value).toBe('Assam');
    expect(onSelectSuggestion).toHaveBeenCalledWith('Assam');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape without changing the value', () => {
    render(<ControlledInput initialValue="Custom tea" />);
    const input = screen.getByRole('combobox', { name: 'Tea name' });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect((input as HTMLInputElement).value).toBe('Custom tea');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears the active option while typing and supports mouse selection', () => {
    render(<ControlledInput initialValue="Assam" />);
    const input = screen.getByRole('combobox', { name: 'Tea name' });

    fireEvent.focus(input);
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option', { name: 'Assam' }).id);

    fireEvent.change(input, { target: { value: 'A' } });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();

    const option = screen.getByRole('option', { name: 'Darjeeling' });
    fireEvent.mouseEnter(option);
    expect(option.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(option);
    expect((input as HTMLInputElement).value).toBe('Darjeeling');
  });

  it('returns focus to the input when the toggle opens the menu', () => {
    render(<ControlledInput />);

    fireEvent.click(screen.getByRole('button', { name: 'Show Tea name suggestions' }));

    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Tea name' }));
    expect(screen.getByRole('listbox')).toBeDefined();
  });
});
