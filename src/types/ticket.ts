import { MemeSticker } from '../data/memes';

export interface TicketTier {
  id: 'general' | 'vip' | string;
  name: string;
  priceUSD: number;
  badge?: string;
  description?: string;
  features: string[];
}

export interface TicketOrder {
  tier: TicketTier;
  quantity: number;
  buyerName: string;
  buyerDni: string;
  buyerPhone: string;
  buyerEmail: string;
  paymentMethod: string;
  favoriteArtist: string;
  referralSource?: string;
  totalUSD: number;
  totalRefBs: string;
  ticketCode: string;
  createdAt?: string;
  meme?: MemeSticker;
  isExisting?: boolean;
  isPaid?: boolean;
  paymentStatus?: 'pending' | 'cash' | 'paid';
  noticeMessage?: string;
}
