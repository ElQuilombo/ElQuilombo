import { supabase, isSupabaseConfigured } from './supabase';
import { TicketOrder } from '../types/ticket';
import { MemeSticker } from '../data/memes';

export interface ReservationRecord {
  id?: string;
  ticket_code: string;
  buyer_name: string;
  buyer_dni: string;
  buyer_phone: string;
  buyer_email: string;
  tier_id: string;
  tier_name: string;
  quantity: number;
  total_usd: number;
  total_ref_bs: number;
  payment_method: string;
  favorite_artist: string;
  referral_source?: string;
  meme_sticker_used?: string;
  is_paid: boolean;
  created_at?: string;
}

export interface ReservationResult {
  success: boolean;
  isExisting: boolean;
  order: TicketOrder;
  message?: string;
}

export const MAX_RESERVATIONS_PER_HOUR = 10;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface RateLimitStatus {
  allowed: boolean;
  count: number;
  remaining: number;
  waitMinutes: number;
}

/**
 * Checks client-side rate limit (device/browser level).
 * Ensures a single device cannot flood reservations even with varying details.
 */
export function checkClientRateLimit(): RateLimitStatus {
  if (typeof window === 'undefined') {
    return { allowed: true, count: 0, remaining: MAX_RESERVATIONS_PER_HOUR, waitMinutes: 0 };
  }

  try {
    const raw = localStorage.getItem('quilombo_hourly_reservations');
    const now = Date.now();
    const timestamps: number[] = raw ? JSON.parse(raw) : [];

    // Filter timestamps within the 1-hour rolling window
    const recent = timestamps.filter((t) => typeof t === 'number' && now - t < RATE_LIMIT_WINDOW_MS);

    if (recent.length >= MAX_RESERVATIONS_PER_HOUR) {
      const oldest = Math.min(...recent);
      const waitMinutes = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 60000));
      return { allowed: false, count: recent.length, remaining: 0, waitMinutes };
    }

    return {
      allowed: true,
      count: recent.length,
      remaining: MAX_RESERVATIONS_PER_HOUR - recent.length,
      waitMinutes: 0,
    };
  } catch (e) {
    return { allowed: true, count: 0, remaining: MAX_RESERVATIONS_PER_HOUR, waitMinutes: 0 };
  }
}

/**
 * Records a successful reservation timestamp in the client's local history.
 */
export function recordClientReservation(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('quilombo_hourly_reservations');
    const now = Date.now();
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    const recent = timestamps.filter((t) => typeof t === 'number' && now - t < RATE_LIMIT_WINDOW_MS);
    recent.push(now);
    localStorage.setItem('quilombo_hourly_reservations', JSON.stringify(recent));
  } catch (e) {}
}

export async function processReservation(
  orderData: Omit<TicketOrder, 'ticketCode' | 'createdAt'>,
  selectedMeme: MemeSticker
): Promise<ReservationResult> {
  const normalizedDni = orderData.buyerDni.trim().toUpperCase();

  // Enforce client device rate limit (max 10 reservations / hour)
  const clientLimit = checkClientRateLimit();
  if (!clientLimit.allowed) {
    throw new Error(
      `Por motivos de seguridad, no se pueden realizar más de 10 reservas en la misma hora. Por favor espera ${clientLimit.waitMinutes} minuto(s) antes de intentar nuevamente.`
    );
  }

  // If Supabase is not configured, fallback to client-side order
  if (!isSupabaseConfigured || !supabase) {
    recordClientReservation();
    const fallbackCode = `QLB-26-${Math.floor(1000 + Math.random() * 9000)}`;
    const isCashOrder = orderData.paymentMethod?.toLowerCase().includes('efectivo') || orderData.tier?.id === 'cash';
    return {
      success: true,
      isExisting: false,
      order: {
        ...orderData,
        ticketCode: fallbackCode,
        createdAt: new Date().toISOString(),
        paymentStatus: isCashOrder ? 'cash' : 'pending',
      },
    };
  }

  try {
    // 1. Check if buyer_dni already exists to avoid duplicates
    const { data: existing, error: searchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('buyer_dni', normalizedDni)
      .maybeSingle();

    if (searchError) {
      console.warn('Error checking existing reservation:', searchError.message);
    }

    if (existing) {
      // Return existing reservation to user
      const isExistingCash = !existing.is_paid && (
        existing.tier_id === 'cash' ||
        existing.tier_id === 'efectivo' ||
        (typeof existing.payment_method === 'string' && existing.payment_method.toLowerCase().includes('efectivo'))
      );

      const existingOrder: TicketOrder = {
        tier: {
          id: existing.tier_id,
          name: existing.tier_name,
          priceUSD: Math.round(existing.total_usd / existing.quantity),
          features: [],
        },
        quantity: existing.quantity,
        buyerName: existing.buyer_name,
        buyerDni: existing.buyer_dni,
        buyerPhone: existing.buyer_phone,
        buyerEmail: existing.buyer_email,
        paymentMethod: existing.payment_method,
        favoriteArtist: existing.favorite_artist || '',
        referralSource: existing.referral_source || '',
        totalUSD: Number(existing.total_usd),
        totalRefBs: Number(existing.total_ref_bs).toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        ticketCode: existing.ticket_code,
        createdAt: existing.created_at,
        isPaid: Boolean(existing.is_paid),
        paymentStatus: existing.is_paid ? 'paid' : (isExistingCash ? 'cash' : 'pending'),
      };

      return {
        success: true,
        isExisting: true,
        order: existingOrder,
        message: `¡Ya tenías una preventa registrada con tu cédula (${normalizedDni})! Aquí está tu boleto digital.`,
      };
    }

    // Rate limiting in database: maximum 10 new reservations in the last hour per phone or email
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const cleanEmail = orderData.buyerEmail.trim().toLowerCase();
    const cleanPhone = orderData.buyerPhone.trim();

    const { count: recentDbCount, error: countError } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo)
      .or(`buyer_phone.eq.${cleanPhone},buyer_email.eq.${cleanEmail}`);

    if (!countError && typeof recentDbCount === 'number' && recentDbCount >= MAX_RESERVATIONS_PER_HOUR) {
      throw new Error(
        'Por motivos de seguridad, no se pueden realizar más de 10 reservas en la misma hora asociadas a este usuario.'
      );
    }

    // 2. Generate new unique ticket code
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const newTicketCode = `QLB-26-${randomCode}`;

    // Safely parse number whether it uses dot or comma separators (es-VE)
    const cleanedRefBs = typeof orderData.totalRefBs === 'string'
      ? parseFloat(orderData.totalRefBs.replace(/\./g, '').replace(',', '.'))
      : Number(orderData.totalRefBs);
    const parsedRefBs = isNaN(cleanedRefBs) ? 0 : cleanedRefBs;

    const newRecord: ReservationRecord = {
      ticket_code: newTicketCode,
      buyer_name: orderData.buyerName,
      buyer_dni: normalizedDni,
      buyer_phone: orderData.buyerPhone,
      buyer_email: orderData.buyerEmail,
      tier_id: orderData.tier.id,
      tier_name: orderData.tier.name,
      quantity: orderData.quantity,
      total_usd: orderData.totalUSD,
      total_ref_bs: parsedRefBs,
      payment_method: orderData.paymentMethod,
      favorite_artist: orderData.favoriteArtist,
      referral_source: orderData.referralSource || 'Otro',
      meme_sticker_used: selectedMeme.id,
      is_paid: false,
    };

    let insertResult = await supabase
      .from('reservations')
      .insert([newRecord])
      .select()
      .single();

    // Graceful fallback if database column 'referral_source' does not exist yet
    if (insertResult.error && insertResult.error.message?.includes('referral_source')) {
      console.warn('Column referral_source does not exist in DB yet, retrying insert without it...');
      const { referral_source, ...recordWithoutReferral } = newRecord;
      insertResult = await supabase
        .from('reservations')
        .insert([recordWithoutReferral])
        .select()
        .single();
    }

    if (insertResult.error) {
      throw insertResult.error;
    }

    const inserted = insertResult.data;

    recordClientReservation();

    const isCreatedCash = !inserted.is_paid && (
      inserted.tier_id === 'cash' ||
      inserted.tier_id === 'efectivo' ||
      (typeof inserted.payment_method === 'string' && inserted.payment_method.toLowerCase().includes('efectivo'))
    );

    const createdOrder: TicketOrder = {
      ...orderData,
      ticketCode: inserted.ticket_code,
      createdAt: inserted.created_at,
      isPaid: Boolean(inserted.is_paid),
      paymentStatus: inserted.is_paid ? 'paid' : (isCreatedCash ? 'cash' : 'pending'),
    };

    return {
      success: true,
      isExisting: false,
      order: createdOrder,
      message: '¡Tu preventa ha sido apartada con éxito en El Quilombo!',
    };
  } catch (err: any) {
    console.error('Supabase reservation error:', err);
    // Fallback gracefully so user can still get a ticket & WhatsApp link
    const fallbackCode = `QLB-26-${Math.floor(1000 + Math.random() * 9000)}`;
    const isFallbackCash = orderData.paymentMethod?.toLowerCase().includes('efectivo') || orderData.tier?.id === 'cash';
    return {
      success: true,
      isExisting: false,
      order: {
        ...orderData,
        ticketCode: fallbackCode,
        createdAt: new Date().toISOString(),
        isPaid: false,
        paymentStatus: isFallbackCash ? 'cash' : 'pending',
      },
      message: 'Reserva generada localmente.',
    };
  }
}

/**
 * Permite a un titular con cédula ya registrada sumar entradas adicionales a su reserva
 */
export async function addTicketsToReservation(
  buyerDni: string,
  additionalQty: number,
  bcvRate?: number
): Promise<{ success: boolean; order?: TicketOrder; message?: string }> {
  const normalizedDni = buyerDni.trim().toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      message: 'Supabase no está configurado para actualizar reservas.',
    };
  }

  try {
    const { data: existing, error: findError } = await supabase
      .from('reservations')
      .select('*')
      .eq('buyer_dni', normalizedDni)
      .single();

    if (findError || !existing) {
      return {
        success: false,
        message: `No se encontró una reserva previa con la cédula ${normalizedDni}.`,
      };
    }

    const currentQty = existing.quantity || 1;
    const unitPrice = Math.round(existing.total_usd / currentQty) || 10;
    const newQty = currentQty + additionalQty;
    const newTotalUSD = newQty * unitPrice;

    const rate = bcvRate && bcvRate > 0
      ? bcvRate
      : (existing.total_usd > 0 ? existing.total_ref_bs / existing.total_usd : 848);
    const newTotalRefBs = newTotalUSD * rate;

    const { data: updated, error: updateError } = await supabase
      .from('reservations')
      .update({
        quantity: newQty,
        total_usd: newTotalUSD,
        total_ref_bs: newTotalRefBs,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError || !updated) {
      throw updateError || new Error('No se pudo actualizar la reserva');
    }

    const updatedOrder: TicketOrder = {
      tier: {
        id: updated.tier_id,
        name: updated.tier_name,
        priceUSD: unitPrice,
        features: [],
      },
      quantity: updated.quantity,
      buyerName: updated.buyer_name,
      buyerDni: updated.buyer_dni,
      buyerPhone: updated.buyer_phone,
      buyerEmail: updated.buyer_email,
      paymentMethod: updated.payment_method,
      favoriteArtist: updated.favorite_artist || '',
      totalUSD: Number(updated.total_usd),
      totalRefBs: Number(updated.total_ref_bs).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      ticketCode: updated.ticket_code,
      createdAt: updated.created_at,
      isPaid: Boolean(updated.is_paid),
      isExisting: true,
      noticeMessage: `¡Se han sumado +${additionalQty} entrada(s)! Ahora tenés un total de ${updated.quantity} entradas.`,
    };

    return {
      success: true,
      order: updatedOrder,
      message: `¡Se sumaron +${additionalQty} entrada(s) a tu reserva! Total: ${updated.quantity} entradas.`,
    };
  } catch (err: any) {
    console.error('Error adding tickets to reservation:', err);
    return {
      success: false,
      message: err?.message || 'Error al agregar entradas adicionales.',
    };
  }
}

