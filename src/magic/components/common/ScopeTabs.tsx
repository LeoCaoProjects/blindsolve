import React from 'react';
import { OptionGroup } from './OptionGroup';

export type Scope = 'both' | 'edges' | 'corners';

/** Always Both · Edges · Corners, in that order, everywhere pieces can be filtered. */
export function ScopeTabs({
  value,
  onChange,
  disabled,
  className





}: {value: Scope;onChange: (s: Scope) => void;disabled?: boolean;className?: string;}) {
  return (
    <OptionGroup
      label="Pieces"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      options={[
      { value: 'both', label: 'Both' },
      { value: 'edges', label: 'Edges' },
      { value: 'corners', label: 'Corners' }]
      } />);


}