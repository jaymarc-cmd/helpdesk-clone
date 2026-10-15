import {
  AppWindow,
  BookOpen,
  Brain,
  Briefcase,
  CircleCheck,
  Compass,
  Flame,
  Gem,
  Globe,
  KeyRound,
  Laptop,
  Layers,
  Mail,
  Medal,
  MessageSquare,
  Mic,
  Network,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Star,
  Ticket,
  Timer,
  Trophy,
  Wrench,
  Zap,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { Category, Channel } from '../types';

/**
 * Shared icon vocabulary. Pages may import any other icon straight from 'lucide-react';
 * mappings that encode domain meaning (category, channel, badge) live here so they stay consistent.
 */

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  Accounts: KeyRound,
  Network: Network,
  Hardware: Laptop,
  Software: AppWindow,
  Email: Mail,
  Security: ShieldAlert,
};

export const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  email: Mail,
  portal: Globe,
  phone: Phone,
  chat: MessageSquare,
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: 'Email',
  portal: 'Self-service portal',
  phone: 'Phone',
  chat: 'Chat',
};

/** Badge icon names stored in engine/progress.ts, mapped to glyphs. */
export const BADGE_ICON: Record<string, LucideIcon> = {
  ticket: Ticket,
  layers: Layers,
  medal: Medal,
  gem: Gem,
  brain: Brain,
  'shield-check': ShieldCheck,
  zap: Zap,
  flame: Flame,
  star: Star,
  compass: Compass,
  trophy: Trophy,
  phone: Phone,
  mic: Mic,
  briefcase: Briefcase,
  timer: Timer,
  'circle-check': CircleCheck,
  'book-open': BookOpen,
  wrench: Wrench,
};

export function CategoryIcon({ category, ...props }: { category: Category } & LucideProps) {
  const I = CATEGORY_ICON[category] ?? AppWindow;
  return <I aria-hidden size={16} strokeWidth={2} {...props} />;
}

export function ChannelIcon({ channel, ...props }: { channel: Channel } & LucideProps) {
  const I = CHANNEL_ICON[channel] ?? Globe;
  return <I aria-hidden size={14} strokeWidth={2} {...props} />;
}

export function BadgeGlyph({ icon, ...props }: { icon: string } & LucideProps) {
  const I = BADGE_ICON[icon] ?? Medal;
  return <I aria-hidden size={22} strokeWidth={1.75} {...props} />;
}
