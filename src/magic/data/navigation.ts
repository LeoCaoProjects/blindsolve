import { BookAIcon, BrainIcon, GalleryVerticalEndIcon, LucideIcon, Settings2Icon, TimerIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  short: string;
  path: string;
  icon: LucideIcon;
}

export const primaryNav: NavItem[] = [
{ id: 'timer', label: 'Timer', short: 'Timer', path: '/', icon: TimerIcon },
{ id: 'pairs', label: 'Letter Pairs', short: 'Pairs', path: '/pairs', icon: BookAIcon },
{ id: 'flashcards', label: 'Flashcards', short: 'Cards', path: '/flashcards', icon: GalleryVerticalEndIcon },
{ id: 'training', label: 'Training', short: 'Training', path: '/training', icon: BrainIcon }];


export const settingsNav: NavItem = { id: 'settings', label: 'Settings', short: 'Settings', path: '/settings', icon: Settings2Icon };

export const settingsSections = [
{ id: 'cube', label: 'Cube & lettering' },
{ id: 'methods', label: 'Methods' },
{ id: 'pairs', label: 'Letter pairs' },
{ id: 'timer', label: 'Timer' },
{ id: 'account', label: 'Account & sync' },
{ id: 'backup', label: 'Data' },
{ id: 'support', label: 'Support' }];