'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { EventSettings, DEFAULT_EVENT_SETTINGS, OrganizerMetrics } from '../../types/settings';
import { Track } from '../../types/track';
import { PLAYLIST as INITIAL_PLAYLIST } from '../../data/playlist';
import AdminTicketPreview from '../../components/admin/AdminTicketPreview';
import { saveEventSettings, getEventSettings } from '../../lib/settings';
import TicketQrModal from '../../components/modals/TicketQrModal';
import { TicketOrder } from '../../types/ticket';
import { MEME_STICKERS } from '../../data/memes';
import { getWhatsappChatUrl } from '../../lib/whatsapp';

export default function OrganizadorPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'metrics' | 'attendees' | 'sources' | 'songs' | 'ticket' | 'playlist'>('metrics');

  // Selected reservation to generate and send QR ticket
  const [selectedTicketOrder, setSelectedTicketOrder] = useState<TicketOrder | null>(null);

  // Event settings state
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_EVENT_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsSaveNotice, setSettingsSaveNotice] = useState<string | null>(null);

  // Reservations state
  const [reservations, setReservations] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<OrganizerMetrics | null>(null);
  const [isLoadingReservations, setIsLoadingReservations] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'cash' | 'pending'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const getReservationStatus = (r: any): 'paid' | 'cash' | 'pending' => {
    if (r.payment_status === 'paid' || r.payment_status === 'cash' || r.payment_status === 'pending') {
      return r.payment_status;
    }
    if (r.is_paid) return 'paid';
    if (r.tier_id === 'cash' || r.tier_id === 'efectivo' || (typeof r.payment_method === 'string' && r.payment_method.toLowerCase().includes('efectivo'))) return 'cash';
    return 'pending';
  };
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const PAYMENT_OPTIONS = [
    'Pago Móvil',
    'Zelle',
    'Binance Pay (USDT)',
    'Efectivo en Rock & Riff',
  ];

  const formatReservationDateTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Playlist state
  const [customTracks, setCustomTracks] = useState<Track[]>([]);
  const [newTrack, setNewTrack] = useState({
    title: '',
    artist: '',
    src: '',
    cover: '',
    badge: '',
  });
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Temas Pedidos state
  const [songSearchQuery, setSongSearchQuery] = useState<string>('');
  const [songStatusFilter, setSongStatusFilter] = useState<'all' | 'paid' | 'cash' | 'pending'>('all');
  const [copiedSongId, setCopiedSongId] = useState<string | null>(null);
  const [copiedAllSongs, setCopiedAllSongs] = useState<boolean>(false);

  const songRequests = useMemo(() => {
    return reservations
      .filter((r) => r.favorite_artist && typeof r.favorite_artist === 'string' && r.favorite_artist.trim().length > 0)
      .map((r) => ({
        id: r.id || r.ticket_code,
        song: r.favorite_artist.trim(),
        buyerName: r.buyer_name || 'Sin nombre',
        buyerDni: r.buyer_dni || '',
        buyerPhone: r.buyer_phone || '',
        ticketCode: r.ticket_code || '',
        status: getReservationStatus(r),
        paymentMethod: r.payment_method || '',
        quantity: r.quantity || 1,
        createdAt: r.created_at || '',
      }));
  }, [reservations]);

  const filteredSongRequests = useMemo(() => {
    return songRequests.filter((s) => {
      if (songStatusFilter !== 'all' && s.status !== songStatusFilter) {
        return false;
      }
      if (songSearchQuery.trim()) {
        const q = songSearchQuery.toLowerCase().trim();
        const matchesSong = s.song.toLowerCase().includes(q);
        const matchesName = s.buyerName.toLowerCase().includes(q);
        const matchesDni = s.buyerDni.toLowerCase().includes(q);
        return matchesSong || matchesName || matchesDni;
      }
      return true;
    });
  }, [songRequests, songStatusFilter, songSearchQuery]);

  const handleCopySingleSong = async (id: string, songText: string) => {
    try {
      await navigator.clipboard.writeText(songText);
      setCopiedSongId(id);
      setTimeout(() => setCopiedSongId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Acquisition / Referral Sources (Canales de Difusión) state
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sourceStatusFilter, setSourceStatusFilter] = useState<'all' | 'paid' | 'cash' | 'pending'>('all');
  const [sourceSearchQuery, setSourceSearchQuery] = useState<string>('');
  const [copiedSourceReport, setCopiedSourceReport] = useState<boolean>(false);

  const CHANNEL_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
    'Instagram': {
      icon: '📸',
      label: 'Instagram',
      color: '#f43f5e',
      bg: 'rgba(244, 63, 94, 0.12)',
      border: 'rgba(244, 63, 94, 0.35)',
    },
    'TikTok': {
      icon: '🎵',
      label: 'TikTok',
      color: '#00f2fe',
      bg: 'rgba(0, 242, 254, 0.12)',
      border: 'rgba(0, 242, 254, 0.35)',
    },
    'Amigos / Recomendación': {
      icon: '🗣️',
      label: 'Amigos / Recomendación',
      color: '#ffd600',
      bg: 'rgba(255, 214, 0, 0.12)',
      border: 'rgba(255, 214, 0, 0.35)',
    },
    'WhatsApp': {
      icon: '💬',
      label: 'WhatsApp',
      color: '#25d366',
      bg: 'rgba(37, 211, 102, 0.12)',
      border: 'rgba(37, 211, 102, 0.35)',
    },
    'Rock & Riff': {
      icon: '🎸',
      label: 'Rock & Riff',
      color: '#c084fc',
      bg: 'rgba(192, 132, 252, 0.12)',
      border: 'rgba(192, 132, 252, 0.35)',
    },
    'Carteles / Flyers': {
      icon: '📄',
      label: 'Carteles / Flyers',
      color: '#fb923c',
      bg: 'rgba(251, 146, 60, 0.12)',
      border: 'rgba(251, 146, 60, 0.35)',
    },
    'Otro': {
      icon: '✨',
      label: 'Otro medio',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.12)',
      border: 'rgba(56, 189, 248, 0.35)',
    },
    'No especificado': {
      icon: '❓',
      label: 'No especificado (preventas previas)',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
      border: 'rgba(148, 163, 184, 0.25)',
    },
  };

  const sourceAnalysis = useMemo(() => {
    const totalReservations = reservations.length;
    let totalWithSource = 0;
    let totalUsdTracked = 0;
    let totalTicketsTracked = 0;

    const channelMap = new Map<string, {
      channel: string;
      count: number;
      tickets: number;
      totalUsd: number;
      paidCount: number;
      cashCount: number;
      pendingCount: number;
    }>();

    reservations.forEach((r) => {
      const raw = (r.referral_source || '').trim();
      const channel = raw || 'No especificado';
      if (raw) totalWithSource += 1;

      const qty = Number(r.quantity) || 1;
      const usd = Number(r.total_usd) || 0;
      totalUsdTracked += usd;
      totalTicketsTracked += qty;

      const status = getReservationStatus(r);

      if (!channelMap.has(channel)) {
        channelMap.set(channel, {
          channel,
          count: 0,
          tickets: 0,
          totalUsd: 0,
          paidCount: 0,
          cashCount: 0,
          pendingCount: 0,
        });
      }

      const item = channelMap.get(channel)!;
      item.count += 1;
      item.tickets += qty;
      item.totalUsd += usd;
      if (status === 'paid') item.paidCount += 1;
      else if (status === 'cash') item.cashCount += 1;
      else item.pendingCount += 1;
    });

    const channelsList = Array.from(channelMap.values()).map((c) => {
      const pct = totalReservations > 0 ? (c.count / totalReservations) * 100 : 0;
      const conversionPct = c.count > 0 ? ((c.paidCount + c.cashCount) / c.count) * 100 : 0;
      return {
        ...c,
        pct,
        conversionPct,
      };
    });

    // Sort by count descending
    channelsList.sort((a, b) => b.count - a.count);

    const topChannel = channelsList.length > 0 ? channelsList[0] : null;

    return {
      totalReservations,
      totalWithSource,
      totalUsdTracked,
      totalTicketsTracked,
      channelsList,
      topChannel,
    };
  }, [reservations]);

  const filteredSourceAttendees = useMemo(() => {
    return reservations.filter((r) => {
      const raw = (r.referral_source || '').trim();
      const channel = raw || 'No especificado';

      // Channel filter
      if (sourceFilter !== 'all' && channel !== sourceFilter) {
        return false;
      }

      // Status filter
      const status = getReservationStatus(r);
      if (sourceStatusFilter !== 'all' && status !== sourceStatusFilter) {
        return false;
      }

      // Search query
      if (sourceSearchQuery.trim()) {
        const q = sourceSearchQuery.toLowerCase().trim();
        const matchesName = (r.buyer_name || '').toLowerCase().includes(q);
        const matchesDni = (r.buyer_dni || '').toLowerCase().includes(q);
        const matchesPhone = (r.buyer_phone || '').toLowerCase().includes(q);
        const matchesCode = (r.ticket_code || '').toLowerCase().includes(q);
        const matchesChannel = channel.toLowerCase().includes(q);
        return matchesName || matchesDni || matchesPhone || matchesCode || matchesChannel;
      }

      return true;
    });
  }, [reservations, sourceFilter, sourceStatusFilter, sourceSearchQuery]);

  const handleCopyDJList = async () => {
    if (songRequests.length === 0) return;

    let text = `🎧 *LISTA DE TEMAS PEDIDOS - EL QUILOMBO (ROCK & RIFF)* 🇦🇷🔥\n`;
    text += `📊 Total solicitudes: ${songRequests.length} temas recibidos\n\n`;

    if (metrics?.topRequestedArtists && metrics.topRequestedArtists.length > 0) {
      text += `🏆 *TOP MÁS PEDIDOS EN PREVENTA:*\n`;
      metrics.topRequestedArtists.slice(0, 10).forEach((item, idx) => {
        text += `${idx + 1}. ${item.name} (${item.count} votos)\n`;
      });
      text += `\n`;
    }

    text += `📋 *TODAS LAS SOLICITUDES DE ASISTENTES:*\n`;
    filteredSongRequests.forEach((s, idx) => {
      const tag = s.status === 'paid' ? '✓ PAGADO' : s.status === 'cash' ? '💵 EFECTIVO' : '⏳ PEND.';
      text += `${idx + 1}. "${s.song}" - ${s.buyerName} [${tag}]\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopiedAllSongs(true);
      setTimeout(() => setCopiedAllSongs(false), 2500);
    } catch {
      alert('Error al copiar al portapapeles.');
    }
  };

  const handleExportSongRequestsCSV = () => {
    if (songRequests.length === 0) {
      alert('No hay solicitudes de temas registradas para exportar.');
      return;
    }

    const headers = [
      '#',
      'Tema / Artista Solicitado',
      'Titular',
      'Cedula DNI',
      'WhatsApp',
      'Estado Entrada',
      'Codigo Ticket',
      'Fecha Solicitud',
    ];

    const rows = filteredSongRequests.map((s, index) => {
      const statusLabel = s.status === 'paid' ? 'PAGADO' : s.status === 'cash' ? 'EFECTIVO' : 'PENDIENTE';
      return [
        index + 1,
        `"${s.song.replace(/"/g, '""')}"`,
        `"${(s.buyerName || '').replace(/"/g, '""')}"`,
        `"${s.buyerDni || ''}"`,
        `"${s.buyerPhone || ''}"`,
        statusLabel,
        `"${s.ticketCode || ''}"`,
        `"${s.createdAt || ''}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `El_Quilombo_Temas_Pedidos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySourceReport = async () => {
    if (reservations.length === 0) return;

    let text = `📣 *REPORTE DE CANALES DE DIFUSIÓN - EL QUILOMBO (ROCK & RIFF)* 🇦🇷🔥\n`;
    text += `📊 Total de reservas registradas: ${reservations.length}\n`;
    text += `🎯 Reservas con canal respondido: ${sourceAnalysis.totalWithSource}\n\n`;

    if (sourceAnalysis.topChannel) {
      text += `🏆 *CANAL #1 CON MÁS TRACCIÓN:*\n`;
      text += `👉 ${sourceAnalysis.topChannel.channel}: ${sourceAnalysis.topChannel.count} reservas (${sourceAnalysis.topChannel.pct.toFixed(1)}%) • ${sourceAnalysis.topChannel.tickets} entradas • $${sourceAnalysis.topChannel.totalUsd} USD\n\n`;
    }

    text += `📈 *DESGLOSE DE ADQUISICIÓN POR CANAL:*\n`;
    sourceAnalysis.channelsList.forEach((c, idx) => {
      const cfg = CHANNEL_CONFIG[c.channel] || { icon: '📌' };
      text += `${idx + 1}. ${cfg.icon} *${c.channel}*: ${c.count} reservas (${c.pct.toFixed(1)}%) • ${c.tickets} entradas • $${c.totalUsd} USD • Conv: ${c.conversionPct.toFixed(0)}% pagado\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSourceReport(true);
      setTimeout(() => setCopiedSourceReport(false), 2500);
    } catch {
      alert('Error al copiar el reporte al portapapeles.');
    }
  };

  const handleExportSourcesCSV = () => {
    if (reservations.length === 0) {
      alert('No hay reservas registradas para exportar.');
      return;
    }

    const headers = [
      '#',
      'Codigo Ticket',
      'Titular',
      'Cedula DNI',
      'WhatsApp',
      'Canal de Difusion',
      'Cantidad Entradas',
      'Total USD',
      'Metodo de Pago',
      'Estado Pago',
      'Fecha Reserva',
    ];

    const rows = filteredSourceAttendees.map((r, index) => {
      const status = getReservationStatus(r);
      const statusLabel = status === 'paid' ? 'PAGADO' : status === 'cash' ? 'EFECTIVO' : 'PENDIENTE';
      const channel = (r.referral_source || '').trim() || 'No especificado';
      return [
        index + 1,
        `"${r.ticket_code || ''}"`,
        `"${(r.buyer_name || '').replace(/"/g, '""')}"`,
        `"${r.buyer_dni || ''}"`,
        `"${r.buyer_phone || ''}"`,
        `"${channel.replace(/"/g, '""')}"`,
        r.quantity || 1,
        r.total_usd || 0,
        `"${(r.payment_method || '').replace(/"/g, '""')}"`,
        statusLabel,
        `"${r.created_at || ''}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `El_Quilombo_Canales_Difusion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddSongToWebPlaylist = (songTitle: string) => {
    setNewTrack((prev) => ({
      ...prev,
      title: songTitle,
      artist: 'Trap Argentino / Sugerencia',
      badge: 'PEDIDO EN PREVENTA',
    }));
    setActiveTab('playlist');
  };

  // Check saved session on mount
  useEffect(() => {
    const savedAuth = sessionStorage.getItem('quilombo_admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Load settings and reservations when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchSettings();
    fetchReservations();
  }, [isAuthenticated]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (Array.isArray(data.settings.customTracks)) {
          setCustomTracks(data.settings.customTracks);
        }
      }
    } catch (err) {
      console.warn('Error fetching settings:', err);
    }
  };

  const fetchReservations = async () => {
    setIsLoadingReservations(true);
    try {
      const res = await fetch('/api/admin/reservations');
      const data = await res.json();
      if (data.success) {
        setReservations(data.reservations || []);
        setMetrics(data.metrics || null);
      }
    } catch (err) {
      console.warn('Error fetching reservations:', err);
    } finally {
      setIsLoadingReservations(false);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e && 'preventDefault' in e) {
      e.preventDefault();
    }
    const cleanPin = pinInput.trim();
    // Default master password is 5401385 or customized in settings
    if (cleanPin === '5401385' || cleanPin === settings.organizerPin) {
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('quilombo_admin_auth', 'true');
      }
      setPinError(null);
    } else {
      setPinError('Contraseña incorrecta. Por favor verificá e intentá nuevamente.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('quilombo_admin_auth');
    setPinInput('');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSaveNotice(null);

    try {
      const payload = {
        ...settings,
        customTracks,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setSettingsSaveNotice('¡Configuración guardada exitosamente en Supabase!');
        setTimeout(() => setSettingsSaveNotice(null), 4000);
      } else {
        setSettingsSaveNotice('Error al guardar: ' + (data.error || 'Desconocido'));
      }
    } catch (err: any) {
      setSettingsSaveNotice('Error de conexión al guardar.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleChangePaymentStatus = async (
    reservation: any,
    newStatus: 'paid' | 'cash' | 'pending'
  ): Promise<boolean> => {
    const currentStatus = getReservationStatus(reservation);
    if (newStatus === currentStatus) return true;

    setUpdatingId(reservation.id);
    const newIsPaid = newStatus === 'paid';
    const newTierId = newStatus === 'cash' ? 'cash' : 'general';

    try {
      const res = await fetch('/api/admin/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reservation.id,
          ticket_code: reservation.ticket_code,
          payment_status: newStatus,
          is_paid: newIsPaid,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state immediately
        setReservations((prev) =>
          prev.map((r) =>
            r.id === reservation.id
              ? {
                  ...r,
                  is_paid: newIsPaid,
                  tier_id: newTierId,
                  payment_status: newStatus,
                }
              : r
          )
        );
        // Refresh live metrics from database
        fetchReservations();
        return true;
      } else {
        alert('⚠️ Error al actualizar estado en Supabase:\n\n' + (data.error || 'Verifica los permisos RLS en Supabase'));
        return false;
      }
    } catch (err: any) {
      console.error('Error updating payment status:', err);
      alert('⚠️ Error de conexión al actualizar en Supabase: ' + (err?.message || 'Error desconocido'));
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleTogglePaid = async (reservation: any): Promise<boolean> => {
    const current = getReservationStatus(reservation);
    const nextStatus: 'paid' | 'pending' = current === 'paid' ? 'pending' : 'paid';
    return handleChangePaymentStatus(reservation, nextStatus);
  };

  const handleDeleteReservation = async (reservation: any) => {
    const confirmMessage = `¿Estás seguro de que deseas eliminar permanentemente la reserva de ${reservation.buyer_name} (#${reservation.ticket_code})?\n\nEsta acción no se puede deshacer.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingId(reservation.id);
    try {
      const res = await fetch('/api/admin/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reservation.id,
          ticket_code: reservation.ticket_code,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Remove from local list immediately
        setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
        // Refresh live metrics from database
        fetchReservations();
      } else {
        alert('⚠️ Error al eliminar en Supabase:\n\n' + (data.error || 'Verifica los permisos en Supabase'));
      }
    } catch (err: any) {
      console.error('Error deleting reservation:', err);
      alert('⚠️ Error de conexión al eliminar: ' + (err?.message || 'Error desconocido'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleChangePaymentMethod = async (reservation: any, newMethod: string) => {
    if (!newMethod || newMethod === reservation.payment_method) return;
    setUpdatingPaymentId(reservation.id);

    try {
      const res = await fetch('/api/admin/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reservation.id,
          payment_method: newMethod,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state immediately
        setReservations((prev) =>
          prev.map((r) => (r.id === reservation.id ? { ...r, payment_method: newMethod } : r))
        );
      } else {
        alert('⚠️ Error al actualizar método de pago en Supabase:\n\n' + (data.error || 'Verifica permisos'));
      }
    } catch (err: any) {
      console.error('Error updating payment method:', err);
      alert('⚠️ Error de conexión al actualizar método de pago: ' + (err?.message || 'Error desconocido'));
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const handleChangeQuantity = async (reservation: any, newQty: number) => {
    if (!newQty || newQty < 1 || newQty === Number(reservation.quantity)) return;
    setUpdatingQuantityId(reservation.id);

    const oldQty = Number(reservation.quantity) || 1;
    const oldUSD = Number(reservation.total_usd) || 10;
    const oldBs = Number(reservation.total_ref_bs) || 0;

    // Unit price in USD (usually $10)
    const unitPriceUSD = oldUSD > 0 ? oldUSD / oldQty : 10;
    const newTotalUSD = Math.round(newQty * unitPriceUSD);

    // Exchange rate per USD
    const rateBs = oldUSD > 0 && oldBs > 0 ? oldBs / oldUSD : 974.42;
    const newTotalRefBs = Number((newTotalUSD * rateBs).toFixed(2));

    try {
      const res = await fetch('/api/admin/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reservation.id,
          quantity: newQty,
          total_usd: newTotalUSD,
          total_ref_bs: newTotalRefBs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state immediately
        setReservations((prev) =>
          prev.map((r) =>
            r.id === reservation.id
              ? {
                  ...r,
                  quantity: newQty,
                  total_usd: newTotalUSD,
                  total_ref_bs: newTotalRefBs,
                }
              : r
          )
        );
        // Refresh live metrics from database
        fetchReservations();
      } else {
        alert('⚠️ Error al actualizar cantidad en Supabase:\n\n' + (data.error || 'Verifica los permisos en Supabase'));
      }
    } catch (err: any) {
      console.error('Error updating quantity:', err);
      alert('⚠️ Error de conexión al actualizar cantidad: ' + (err?.message || 'Error desconocido'));
    } finally {
      setUpdatingQuantityId(null);
    }
  };

  const handleOpenTicketGenerator = async (reservation: any) => {
    const currentStatus = getReservationStatus(reservation);
    // Si está pendiente, la marcamos como pagada en el sistema.
    // Si ya está en efectivo comprometido, preservamos su condición de efectivo!
    if (currentStatus === 'pending') {
      await handleChangePaymentStatus(reservation, 'paid');
    }

    const effectiveStatus = currentStatus === 'cash' ? 'cash' : 'paid';

    const selectedMeme =
      MEME_STICKERS.find((m) => m.id === reservation.meme_sticker_used) ||
      MEME_STICKERS[0];

    const order: TicketOrder = {
      tier: {
        id: reservation.tier_id || 'general',
        name: reservation.tier_name || 'Pase Preventa Oficial',
        priceUSD: reservation.quantity ? Math.round(reservation.total_usd / reservation.quantity) : 10,
        features: [],
      },
      quantity: reservation.quantity || 1,
      buyerName: reservation.buyer_name || 'Asistente',
      buyerDni: reservation.buyer_dni || '',
      buyerPhone: reservation.buyer_phone || '',
      buyerEmail: reservation.buyer_email || '',
      paymentMethod: reservation.payment_method || 'Pago Móvil',
      favoriteArtist: reservation.favorite_artist || '',
      totalUSD: Number(reservation.total_usd || 0),
      totalRefBs: Number(reservation.total_ref_bs || 0).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      ticketCode: reservation.ticket_code,
      createdAt: reservation.created_at,
      isPaid: effectiveStatus === 'paid',
      paymentStatus: effectiveStatus,
      meme: selectedMeme,
    };

    setSelectedTicketOrder(order);
  };

  const handleExportCSV = () => {
    if (reservations.length === 0) {
      alert('No hay reservas registradas para exportar.');
      return;
    }

    const headers = [
      'Codigo Ticket',
      'Titular',
      'Cedula DNI',
      'WhatsApp',
      'Email',
      'Pase',
      'Cantidad',
      'Total USD',
      'Total Bs',
      'Metodo Pago',
      'Tema Pedido',
      'Sticker Usado',
      'Estado Pago',
      'Fecha Creacion',
    ];

    const rows = reservations.map((r) => {
      const status = getReservationStatus(r);
      const statusLabel = status === 'paid' ? 'PAGADO' : status === 'cash' ? 'EFECTIVO' : 'PENDIENTE';

      return [
        `"${r.ticket_code}"`,
        `"${r.buyer_name || ''}"`,
        `"${r.buyer_dni || ''}"`,
        `"${r.buyer_phone || ''}"`,
        `"${r.buyer_email || ''}"`,
        `"${r.tier_name || ''}"`,
        r.quantity || 1,
        r.total_usd || 0,
        r.total_ref_bs || 0,
        `"${r.payment_method || ''}"`,
        `"${(r.favorite_artist || '').replace(/"/g, '""')}"`,
        `"${r.meme_sticker_used || ''}"`,
        statusLabel,
        `"${r.created_at || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lista_puerta_el_quilombo_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrack.title || !newTrack.artist || !newTrack.src) {
      alert('Por favor completá al menos el Título, Artista y enlace de audio.');
      return;
    }

    const id = 'custom-' + Date.now();
    const trackItem: Track = {
      id,
      title: newTrack.title.trim(),
      artist: newTrack.artist.trim(),
      src: newTrack.src.trim(),
      cover: newTrack.cover.trim() || '/assets/img/tracks/gil.jpg',
      badge: newTrack.badge.trim() || `🔥 ${newTrack.artist.trim()}`,
      category: 'custom',
    };

    const updated = [...customTracks, trackItem];
    setCustomTracks(updated);
    setNewTrack({ title: '', artist: '', src: '', cover: '', badge: '' });

    // Auto save to settings
    saveEventSettings({ customTracks: updated });
  };

  const handleRemoveTrack = (id: string) => {
    const updated = customTracks.filter((t) => t.id !== id);
    setCustomTracks(updated);
    saveEventSettings({ customTracks: updated });
  };

  const handlePreviewTrack = (src: string, id: string) => {
    if (previewingTrackId === id) {
      if (previewAudio) {
        previewAudio.pause();
      }
      setPreviewingTrackId(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    const audio = new Audio(src);
    audio.play().catch(() => alert('No se pudo reproducir este archivo de audio. Verificá la URL.'));
    setPreviewAudio(audio);
    setPreviewingTrackId(id);
    audio.onended = () => setPreviewingTrackId(null);
  };

  // Filtered reservations
  const filteredReservations = reservations.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      !q ||
      (r.buyer_name && r.buyer_name.toLowerCase().includes(q)) ||
      (r.buyer_dni && r.buyer_dni.toLowerCase().includes(q)) ||
      (r.ticket_code && r.ticket_code.toLowerCase().includes(q)) ||
      (r.buyer_phone && r.buyer_phone.includes(q));

    if (!matchesQuery) return false;

    const status = getReservationStatus(r);
    if (statusFilter === 'paid') return status === 'paid';
    if (statusFilter === 'cash') return status === 'cash';
    if (statusFilter === 'pending') return status === 'pending';
    return true;
  });

  const paidCount = reservations.filter((r) => getReservationStatus(r) === 'paid').length;
  const cashCount = reservations.filter((r) => getReservationStatus(r) === 'cash').length;
  const pendingCount = reservations.filter((r) => getReservationStatus(r) === 'pending').length;

  // -------------------------------------------------------------
  // PIN LOGIN SCREEN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(circle at 50% 30%, #1e1135 0%, #06050a 80%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: 'rgba(15, 12, 28, 0.95)',
            border: '1px solid var(--border-neon-purple)',
            borderRadius: '24px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.2)',
          }}
        >
          <img
            src="/assets/img/el-quilombo-logo.png"
            alt="El Quilombo"
            style={{ width: '130px', margin: '0 auto 1.25rem', display: 'block' }}
          />

          <div
            style={{
              display: 'inline-block',
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid var(--border-neon-cyan)',
              color: 'var(--neon-cyan)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.74rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '1rem',
            }}
          >
            🔐 Panel de Organizador
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-title)',
              fontSize: '1.4rem',
              fontWeight: 900,
              color: '#fff',
              marginBottom: '0.5rem',
            }}
          >
            ACCESO EXCLUSIVO
          </h1>
          <p style={{ color: 'var(--text-subtle)', fontSize: '0.82rem', marginBottom: '1.75rem' }}>
            Ingresá el PIN de seguridad del equipo de El Quilombo para acceder a métricas, conciliación y personalización.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePinSubmit(e);
            }}
          >
            <div style={{ marginBottom: '1.25rem' }}>
              <input
                type="password"
                id="organizer-pin-input"
                maxLength={16}
                placeholder="Ingresá la contraseña"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePinSubmit(e);
                  }
                }}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '14px',
                  color: '#fff',
                  padding: '0.9rem',
                  fontSize: '1.2rem',
                  textAlign: 'center',
                  letterSpacing: '4px',
                  outline: 'none',
                }}
              />
            </div>

            {pinError && (
              <div style={{ color: '#ff007f', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 600 }}>
                {pinError}
              </div>
            )}

            <button
              type="button"
              id="btn-login-organizer"
              onClick={handlePinSubmit}
              style={{
                width: '100%',
                background: 'var(--gradient-party)',
                border: 'none',
                color: '#fff',
                fontFamily: 'var(--font-title)',
                fontWeight: 900,
                fontSize: '0.95rem',
                padding: '0.85rem',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-neon-pink)',
              }}
            >
              Desbloquear Panel →
            </button>
          </form>

          <div style={{ marginTop: '1.5rem' }}>
            <Link
              href="/"
              style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', textDecoration: 'underline' }}
            >
              ← Volver al sitio web principal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED ORGANIZER DASHBOARD
  // -------------------------------------------------------------
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#06050a',
        color: 'var(--text-main)',
        fontFamily: 'var(--font-body)',
        paddingBottom: '5rem',
      }}
    >
      {/* Top Admin Header */}
      <header className="organizer-header-responsive">
        <div className="organizer-header-top">
          <div className="organizer-brand-group">
            <Link href="/" title="Volver a la portada">
              <img
                src="/assets/img/el-quilombo-logo.png"
                alt="El Quilombo"
                className="organizer-brand-logo"
              />
            </Link>
            <span className="organizer-badge-tag">
              Panel Organizador
            </span>
          </div>

          <div className="organizer-header-actions">
            <Link
              href="/"
              target="_blank"
              className="organizer-action-link-web"
              title="Abrir web pública en nueva pestaña"
            >
              <span>🌐</span> <span>Ver Web ↗</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="organizer-action-btn-logout"
              title="Cerrar sesión de organizador"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="organizer-tabs-bar">
          <button
            type="button"
            id="tab-btn-metrics"
            onClick={() => setActiveTab('metrics')}
            className={`organizer-tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
          >
            <span>📊</span> Métricas
          </button>

          <button
            type="button"
            id="tab-btn-attendees"
            onClick={() => setActiveTab('attendees')}
            className={`organizer-tab-btn ${activeTab === 'attendees' ? 'active' : ''}`}
          >
            <span>👥</span> Asistentes ({reservations.length})
          </button>

          <button
            type="button"
            id="tab-btn-sources"
            onClick={() => setActiveTab('sources')}
            className={`organizer-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
          >
            <span>📣</span> Canales / Difusión {sourceAnalysis.totalWithSource > 0 ? `(${sourceAnalysis.totalWithSource})` : ''}
          </button>

          <button
            type="button"
            id="tab-btn-songs"
            onClick={() => setActiveTab('songs')}
            className={`organizer-tab-btn ${activeTab === 'songs' ? 'active' : ''}`}
          >
            <span>🎧</span> Temas Pedidos ({songRequests.length})
          </button>

          <button
            type="button"
            id="tab-btn-ticket"
            onClick={() => setActiveTab('ticket')}
            className={`organizer-tab-btn ${activeTab === 'ticket' ? 'active' : ''}`}
          >
            <span>🎟️</span> Boleto Digital
          </button>

          <button
            type="button"
            id="tab-btn-playlist"
            onClick={() => setActiveTab('playlist')}
            className={`organizer-tab-btn ${activeTab === 'playlist' ? 'active' : ''}`}
          >
            <span>🎵</span> Playlist ({customTracks.length + INITIAL_PLAYLIST.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="organizer-main-container">
        {/* ========================================================= */}
        {/* TAB 1: METRICS DASHBOARD                                  */}
        {/* ========================================================= */}
        {activeTab === 'metrics' && (
          <div>
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>
                  RESUMEN DE RECAUDACIÓN &amp; AFORO
                </h2>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                  Datos en tiempo real sincronizados desde la base de datos Supabase.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchReservations}
                disabled={isLoadingReservations}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-pill)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  minHeight: '40px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {isLoadingReservations ? '🔄 Actualizando...' : '🔄 Refrescar'}
              </button>
            </div>

            {/* Metric KPI Cards Grid (Responsive 2x2 on Mobile, 4x1 on Desktop) */}
            <div className="organizer-metrics-grid">
              {/* Total Revenue USD */}
              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid var(--border-neon-cyan)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: 'var(--neon-cyan)' }}>
                  💰 Total Preventa (USD)
                </span>
                <div className="organizer-kpi-value">
                  ${metrics?.totalRevenueUSD || 0} USD
                </div>
                <span className="organizer-kpi-subtext">
                  Ref. Bs: {metrics ? metrics.totalRevenueBs.toLocaleString('es-VE', { minimumFractionDigits: 2 }) : '0,00'}
                </span>
              </div>

              {/* Tickets Count */}
              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid var(--border-neon-purple)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: 'var(--neon-purple-light)' }}>
                  🎟️ Entradas Apartadas
                </span>
                <div className="organizer-kpi-value">
                  {metrics?.totalTicketsCount || 0}
                </div>
                <span className="organizer-kpi-subtext">
                  {metrics?.totalReservations || 0} órdenes registradas
                </span>
              </div>

              {/* Paid Status */}
              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12), rgba(0, 229, 255, 0.08) 50%, rgba(15, 12, 28, 0.85) 100%)',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: '#86efac' }}>
                  ✓ Pagadas / 💵 Efectivo / ⏳ Pendientes
                </span>
                <div className="organizer-kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#25d366' }} title="Pagadas">{metrics?.paidReservationsCount || 0}</span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: '0.9rem' }}>/</span>
                  <span style={{ color: 'var(--neon-cyan)' }} title="Efectivo comprometido">{metrics?.cashReservationsCount || 0}</span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: '0.9rem' }}>/</span>
                  <span style={{ color: '#ffd600' }} title="Pendientes">{metrics?.pendingReservationsCount || 0}</span>
                </div>
                <span className="organizer-kpi-subtext">
                  Cobrado: ${metrics?.paidRevenueUSD || 0} USD • Efectivo: ${metrics?.cashRevenueUSD || 0} USD
                </span>
              </div>

              {/* Aforo / Occupancy */}
              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 0, 127, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid var(--border-neon-pink)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: 'var(--neon-pink)' }}>
                  🔥 Aforo Rock &amp; Riff
                </span>
                <div className="organizer-kpi-value">
                  {metrics?.occupancyPercentage || 0}%
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', marginTop: '0.45rem' }}>
                  <div
                    style={{
                      width: `${Math.min(100, metrics?.occupancyPercentage || 0)}%`,
                      height: '100%',
                      background: 'var(--gradient-party)',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* RECAUDACIÓN POR MÉTODO DE PAGO */}
            <div
              style={{
                background: 'rgba(15, 12, 28, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.15rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>💳</span> RECAUDACIÓN PAGADA POR MÉTODO DE PAGO
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                    Total cobrado y conciliado en tiempo real según el método seleccionado por los asistentes.
                  </p>
                </div>

                {/* Badge Global Cobrado */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.15) 0%, rgba(0, 229, 255, 0.15) 100%)',
                    border: '1px solid #25d366',
                    borderRadius: '12px',
                    padding: '0.5rem 1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Cobrado (Pagado)
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#25d366', fontFamily: 'monospace' }}>
                    ${metrics?.paidRevenueUSD || 0} USD
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    {metrics?.paidReservationsCount || 0} órdenes conciliadas
                  </span>
                </div>
              </div>

              {/* Grid de Métodos de Pago */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                {metrics?.paymentMethods && metrics.paymentMethods.length > 0 ? (
                  metrics.paymentMethods.map((pm) => {
                    const isPagoMovil = pm.method.toLowerCase().includes('móvil') || pm.method.toLowerCase().includes('movil');
                    const isZelle = pm.method.toLowerCase().includes('zelle');
                    const isBinance = pm.method.toLowerCase().includes('binance');
                    const isCash = pm.method.toLowerCase().includes('efectivo');

                    const icon = isPagoMovil ? '📱' : isZelle ? '💵' : isBinance ? '🟡' : isCash ? '🎟️' : '💳';
                    const accentColor = isPagoMovil
                      ? 'var(--neon-cyan)'
                      : isZelle
                      ? '#a855f7'
                      : isBinance
                      ? '#ffd600'
                      : isCash
                      ? '#ec4899'
                      : 'var(--neon-purple-light)';

                    const bgGradient = isPagoMovil
                      ? 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(15, 12, 28, 0.9) 100%)'
                      : isZelle
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 12, 28, 0.9) 100%)'
                      : isBinance
                      ? 'linear-gradient(135deg, rgba(255, 214, 0, 0.08) 0%, rgba(15, 12, 28, 0.9) 100%)'
                      : isCash
                      ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(15, 12, 28, 0.9) 100%)'
                      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(15, 12, 28, 0.9) 100%)';

                    const borderStyle = pm.paidUSD > 0
                      ? `1px solid ${accentColor}`
                      : '1px solid rgba(255, 255, 255, 0.1)';

                    const percentOfTotalPaid = (metrics.paidRevenueUSD || 0) > 0
                      ? Math.round((pm.paidUSD / (metrics.paidRevenueUSD || 1)) * 100)
                      : 0;

                    return (
                      <div
                        key={pm.method}
                        style={{
                          background: bgGradient,
                          border: borderStyle,
                          borderRadius: '14px',
                          padding: '1.15rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: pm.paidUSD > 0 ? `0 4px 20px ${accentColor}15` : 'none',
                        }}
                      >
                        {/* Method Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{icon}</span> {pm.method}
                          </span>
                          {pm.paidUSD > 0 ? (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                color: '#25d366',
                                background: 'rgba(37, 211, 102, 0.15)',
                                border: '1px solid rgba(37, 211, 102, 0.3)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '0.15rem 0.5rem',
                              }}
                            >
                              ✓ {pm.paidOrders} pagada{pm.paidOrders !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--text-subtle)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '0.15rem 0.45rem',
                              }}
                            >
                              $0 cobrado
                            </span>
                          )}
                        </div>

                        {/* Paid Amount */}
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Total Pagado
                          </div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: pm.paidUSD > 0 ? accentColor : '#64748b', fontFamily: 'monospace', lineHeight: 1.2 }}>
                            ${pm.paidUSD} USD
                          </div>
                          {pm.paidBs > 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
                              Ref: Bs. {pm.paidBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          ) : pm.paidUSD > 0 ? (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
                              {pm.paidTickets} entrada{pm.paidTickets !== 1 ? 's' : ''}
                            </div>
                          ) : null}
                        </div>

                        {/* Progress Bar of Collected share */}
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentOfTotalPaid}%`,
                              height: '100%',
                              background: accentColor,
                              borderRadius: '2px',
                            }}
                          />
                        </div>

                        {/* Pending and Cash Subtext */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-subtle)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {pm.cashOrders && pm.cashOrders > 0 ? (
                              <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>
                                💵 ${pm.cashUSD || 0} efec. ({pm.cashOrders})
                              </span>
                            ) : null}
                            {pm.pendingOrders > 0 ? (
                              <span style={{ color: '#ffd600' }}>
                                ⏳ ${pm.pendingUSD} pend. ({pm.pendingOrders})
                              </span>
                            ) : (!pm.cashOrders || pm.cashOrders === 0) ? (
                              <span style={{ color: '#94a3b8' }}>Sin pendientes</span>
                            ) : null}
                          </div>
                          <span style={{ fontWeight: 700, color: '#cbd5e1' }}>
                            {pm.totalTickets} entr.
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                    Cargando desglose de métodos...
                  </div>
                )}
              </div>
            </div>

            {/* Top Song Requests */}
            <div
              style={{
                background: 'rgba(15, 12, 28, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.5rem',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                  🎧 TOP TEMAS & ARTISTAS MÁS PEDIDOS (PARA EL DJ)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  Canciones que los asistentes escribieron en el formulario de preventa:
                </p>
              </div>

              {metrics && metrics.topRequestedArtists.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {metrics.topRequestedArtists.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-neon-purple)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span style={{ color: 'var(--neon-cyan)', fontWeight: 800 }}>#{idx + 1}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{item.name}</span>
                      <span
                        style={{
                          background: 'rgba(168, 85, 247, 0.3)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                        }}
                      >
                        {item.count} votos
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
                  Aún no hay suficientes votos registrados.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ATTENDEES & PAYMENT RECONCILIATION                 */}
        {/* ========================================================= */}
        {activeTab === 'attendees' && (
          <div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
                  LISTA DE ASISTENTES & CONCILIACIÓN
                </h2>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                  Buscá por cédula o código, cambiá el estado de pago y contactá al cliente.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="btn-export-csv"
                  onClick={handleExportCSV}
                  style={{
                    background: 'rgba(0, 240, 255, 0.15)',
                    border: '1px solid var(--border-neon-cyan)',
                    color: 'var(--neon-cyan)',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>📥</span> Descargar Lista de Puerta (CSV)
                </button>
              </div>
            </div>

            {/* Filter Bar with iOS-friendly 16px search and count pills */}
            <div className="organizer-filters-bar">
              <div className="organizer-search-box">
                <input
                  type="text"
                  id="search-attendees-input"
                  placeholder="🔍 Buscar por nombre, cédula o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="organizer-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="organizer-search-clear-btn"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="organizer-filter-pills-row">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="organizer-filter-pill-btn"
                  style={{
                    background: statusFilter === 'all' ? 'var(--neon-purple)' : 'rgba(255, 255, 255, 0.06)',
                    color: '#fff',
                    boxShadow: statusFilter === 'all' ? '0 0 12px rgba(168, 85, 247, 0.4)' : 'none',
                  }}
                >
                  Todos ({reservations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className="organizer-filter-pill-btn"
                  style={{
                    background: statusFilter === 'paid' ? '#25d366' : 'rgba(255, 255, 255, 0.06)',
                    color: '#fff',
                    boxShadow: statusFilter === 'paid' ? '0 0 12px rgba(37, 211, 102, 0.35)' : 'none',
                  }}
                >
                  ✓ Pagados ({paidCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('cash')}
                  className="organizer-filter-pill-btn"
                  style={{
                    background: statusFilter === 'cash' ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.06)',
                    color: statusFilter === 'cash' ? '#000' : '#fff',
                    boxShadow: statusFilter === 'cash' ? '0 0 12px rgba(0, 229, 255, 0.45)' : 'none',
                  }}
                >
                  💵 Efectivo ({cashCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className="organizer-filter-pill-btn"
                  style={{
                    background: statusFilter === 'pending' ? '#ffd600' : 'rgba(255, 255, 255, 0.06)',
                    color: statusFilter === 'pending' ? '#000' : '#fff',
                    boxShadow: statusFilter === 'pending' ? '0 0 12px rgba(255, 214, 0, 0.35)' : 'none',
                  }}
                >
                  ⏳ Pendientes ({pendingCount})
                </button>
              </div>
            </div>

            {/* Desktop View: Full Data Table (Screens >= 768px) */}
            <div className="organizer-desktop-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '0.85rem 1rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>Código</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#fff', fontWeight: 800 }}>Titular &amp; Cédula</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#fff', fontWeight: 800 }}>Entradas</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#fff', fontWeight: 800 }}>Monto</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#fff', fontWeight: 800 }}>Método</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#fff', fontWeight: 800 }}>Estado Pago</th>
                    <th style={{ padding: '0.85rem 1rem', color: '#fff', fontWeight: 800 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.length > 0 ? (
                    filteredReservations.map((r) => {
                      const status = getReservationStatus(r);
                      let waMsg = '';
                      if (status === 'paid') {
                        waMsg = `🎉 *¡TU ENTRADA HA SIDO APROBADA! - EL QUILOMBO* 🇦🇷🔥\n¡Hola ${r.buyer_name}! Tu preventa ha sido validada y aprobada por el equipo de El Quilombo 💜\n\n🎟️ *Entrada:* ${r.quantity}x ${r.tier_name}\n🪪 *Titular:* ${r.buyer_name} (${r.buyer_dni})\n🔢 *Código Único de Acceso:* #${r.ticket_code}\n📍 *Lugar:* Rock & Riff (La Viña) - antiguo Oleo Gastrobar (asi aparece en google)\n🗺️ *Ubicación / Cómo llegar:* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8\n🗓️ *Fecha:* Viernes 09 de Octubre • 8:00 PM\n\n*(Te adjunto aquí tu boleto oficial con código QR generado en el sistema).*\n¡Presentalo al llegar y preparate para la fiesta más picante de Valencia! 🇦🇷🔥`;
                      } else if (status === 'cash') {
                        waMsg = `🎟️ *¡TU ENTRADA ESTÁ RESERVADA (PAGO EN EFECTIVO)! - EL QUILOMBO* 🇦🇷🔥\n¡Hola ${r.buyer_name}! Tu preventa ha sido asegurada por el equipo de El Quilombo 💜\n\n🎟️ *Entrada:* ${r.quantity}x ${r.tier_name}\n🪪 *Titular:* ${r.buyer_name} (${r.buyer_dni})\n🔢 *Código Único de Acceso:* #${r.ticket_code}\n💵 *Monto en Efectivo Comprometido:* $${r.total_usd} USD (Ref: Bs. ${r.total_ref_bs})\n📍 *Lugar:* Rock & Riff (La Viña) - antiguo Oleo Gastrobar (asi aparece en google)\n🗺️ *Ubicación / Cómo llegar:* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8\n🗓️ *Fecha:* Viernes 09 de Octubre • 8:00 PM\n\n*(Te adjunto aquí tu boleto oficial con código QR generado en el sistema).* Recuerda llevar el monto exacto en efectivo en puerta. ¡Nos vemos en la fiesta más picante de Valencia! 🇦🇷🔥`;
                      } else {
                        waMsg = `¡Hola ${r.buyer_name}! Te escribimos del equipo de El Quilombo 🇦🇷🔥 con respecto a tu preventa #${r.ticket_code} ($${r.total_usd} USD). ¿Deseas concretar tu pago para validar tu entrada?`;
                      }
                      const waLink = getWhatsappChatUrl(r.buyer_phone, waMsg);

                      const isPaid = status === 'paid';
                      const isCash = status === 'cash';

                      return (
                        <tr
                          key={`desktop-${r.id}`}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: isPaid ? 'rgba(37, 211, 102, 0.03)' : isCash ? 'rgba(0, 229, 255, 0.03)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--neon-cyan)', fontSize: '0.86rem' }}>
                              #{r.ticket_code}
                            </div>
                            {r.created_at && (
                              <div
                                style={{
                                  color: 'var(--text-subtle)',
                                  fontSize: '0.72rem',
                                  marginTop: '0.25rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Fecha y hora de reserva: ${new Date(r.created_at).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}`}
                              >
                                <span>🕒</span>
                                <span>{formatReservationDateTime(r.created_at)}</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: '#fff' }}>{r.buyer_name}</div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '0.74rem' }}>{r.buyer_dni}</div>
                            {r.referral_source && (
                              <div style={{ marginTop: '0.25rem' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.68rem',
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '999px',
                                    background: 'rgba(236, 72, 153, 0.12)',
                                    color: '#f472b6',
                                    border: '1px solid rgba(236, 72, 153, 0.28)',
                                    fontWeight: 700,
                                  }}
                                  title={`¿Cómo se enteró?: ${r.referral_source}`}
                                >
                                  <span>📣</span>
                                  <span>{r.referral_source}</span>
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                              <select
                                value={r.quantity || 1}
                                onChange={(e) => handleChangeQuantity(r, parseInt(e.target.value, 10))}
                                disabled={updatingQuantityId === r.id}
                                title="Cambiar cantidad de entradas de esta persona"
                                style={{
                                  background: updatingQuantityId === r.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                  color: '#ffffff',
                                  border: updatingQuantityId === r.id ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.18)',
                                  borderRadius: '6px',
                                  padding: '0.28rem 0.45rem',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  cursor: updatingQuantityId === r.id ? 'wait' : 'pointer',
                                  outline: 'none',
                                }}
                              >
                                {Array.from(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, r.quantity || 1]))
                                  .sort((a, b) => a - b)
                                  .map((num) => (
                                    <option key={num} value={num} style={{ background: '#0a061a', color: '#fff' }}>
                                      {num}x
                                    </option>
                                  ))}
                              </select>
                              <span style={{ fontSize: '0.78rem', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                                {r.tier_name || 'Pase Preventa'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ fontWeight: 800, color: 'var(--neon-cyan)' }}>${r.total_usd} USD</div>
                            <div style={{ color: 'var(--text-subtle)', fontSize: '0.72rem' }}>Ref: Bs. {r.total_ref_bs}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <select
                              value={r.payment_method || 'Pago Móvil'}
                              onChange={(e) => handleChangePaymentMethod(r, e.target.value)}
                              disabled={updatingPaymentId === r.id}
                              title="Cambiar método de pago"
                              style={{
                                background: updatingPaymentId === r.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                border: updatingPaymentId === r.id ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.18)',
                                borderRadius: '8px',
                                padding: '0.35rem 0.55rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: updatingPaymentId === r.id ? 'wait' : 'pointer',
                                outline: 'none',
                                width: '100%',
                                maxWidth: '170px',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {r.payment_method && !PAYMENT_OPTIONS.includes(r.payment_method) && (
                                <option value={r.payment_method} style={{ background: '#0a061a', color: '#fff' }}>
                                  {r.payment_method}
                                </option>
                              )}
                              <option value="Pago Móvil" style={{ background: '#0a061a', color: '#fff' }}>📱 Pago Móvil</option>
                              <option value="Zelle" style={{ background: '#0a061a', color: '#fff' }}>💵 Zelle</option>
                              <option value="Binance Pay (USDT)" style={{ background: '#0a061a', color: '#fff' }}>🟡 Binance Pay</option>
                              <option value="Efectivo en Rock & Riff" style={{ background: '#0a061a', color: '#fff' }}>🎟️ Efectivo</option>
                            </select>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            {(() => {
                              const bg = isPaid
                                ? '#25d366'
                                : isCash
                                ? 'rgba(0, 229, 255, 0.16)'
                                : 'rgba(255, 214, 0, 0.15)';
                              const border = isPaid
                                ? 'none'
                                : isCash
                                ? '1px solid var(--neon-cyan)'
                                : '1px solid #ffd600';
                              const color = isPaid
                                ? '#fff'
                                : isCash
                                ? 'var(--neon-cyan)'
                                : '#ffd600';
                              const boxShadow = isPaid
                                ? '0 0 10px rgba(37, 211, 102, 0.35)'
                                : isCash
                                ? '0 0 10px rgba(0, 229, 255, 0.3)'
                                : 'none';

                              return (
                                <select
                                  value={status}
                                  onChange={(e) => handleChangePaymentStatus(r, e.target.value as 'paid' | 'cash' | 'pending')}
                                  disabled={updatingId === r.id}
                                  title="Cambiar estado de pago (Pagado / Efectivo comprometido / Pendiente)"
                                  style={{
                                    background: bg,
                                    border: border,
                                    color: color,
                                    borderRadius: 'var(--radius-pill)',
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    cursor: updatingId === r.id ? 'wait' : 'pointer',
                                    outline: 'none',
                                    boxShadow: boxShadow,
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <option value="paid" style={{ background: '#0a061a', color: '#25d366', fontWeight: 800 }}>
                                    ✓ PAGADO
                                  </option>
                                  <option value="cash" style={{ background: '#0a061a', color: 'var(--neon-cyan)', fontWeight: 800 }}>
                                    💵 EFECTIVO
                                  </option>
                                  <option value="pending" style={{ background: '#0a061a', color: '#ffd600', fontWeight: 800 }}>
                                    ⏳ PENDIENTE
                                  </option>
                                </select>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenTicketGenerator(r)}
                                title="Generar imagen oficial con código QR y enviar al cliente por WhatsApp"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(139, 23, 245, 0.3) 0%, rgba(0, 240, 255, 0.25) 100%)',
                                  border: '1px solid var(--border-neon-cyan)',
                                  color: '#fff',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>🎟️</span> Generar Boleto QR &amp; Enviar
                              </button>
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: 'rgba(37, 211, 102, 0.15)',
                                  border: '1px solid #25d366',
                                  color: '#25d366',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.74rem',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                💬 WhatsApp
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteReservation(r)}
                                disabled={deletingId === r.id}
                                title={`Eliminar reserva #${r.ticket_code} (${r.buyer_name})`}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  cursor: deletingId === r.id ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  whiteSpace: 'nowrap',
                                  opacity: deletingId === r.id ? 0.6 : 1,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span>🗑️</span>
                                <span>{deletingId === r.id ? '...' : 'Eliminar'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-subtle)' }}>
                        No se encontraron reservas con ese criterio de búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Ergonomic Concierge Cards (Screens < 768px) */}
            <div className="organizer-mobile-cards-container">
              {filteredReservations.length > 0 ? (
                filteredReservations.map((r) => {
                  const status = getReservationStatus(r);
                  let waMsg = '';
                  if (status === 'paid') {
                    waMsg = `🎉 *¡TU ENTRADA HA SIDO APROBADA! - EL QUILOMBO* 🇦🇷🔥\n¡Hola ${r.buyer_name}! Tu preventa ha sido validada y aprobada por el equipo de El Quilombo 💜\n\n🎟️ *Entrada:* ${r.quantity}x ${r.tier_name}\n🪪 *Titular:* ${r.buyer_name} (${r.buyer_dni})\n🔢 *Código Único de Acceso:* #${r.ticket_code}\n📍 *Lugar:* Rock & Riff (La Viña) - antiguo Oleo Gastrobar (asi aparece en google)\n🗺️ *Ubicación / Cómo llegar:* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8\n🗓️ *Fecha:* Viernes 09 de Octubre • 8:00 PM\n\n*(Te adjunto aquí tu boleto oficial con código QR generado en el sistema).*\n¡Presentalo al llegar y preparate para la fiesta más picante de Valencia! 🇦🇷🔥`;
                  } else if (status === 'cash') {
                    waMsg = `🎟️ *¡TU ENTRADA ESTÁ RESERVADA (PAGO EN EFECTIVO)! - EL QUILOMBO* 🇦🇷🔥\n¡Hola ${r.buyer_name}! Tu preventa ha sido asegurada por el equipo de El Quilombo 💜\n\n🎟️ *Entrada:* ${r.quantity}x ${r.tier_name}\n🪪 *Titular:* ${r.buyer_name} (${r.buyer_dni})\n🔢 *Código Único de Acceso:* #${r.ticket_code}\n💵 *Monto en Efectivo Comprometido:* $${r.total_usd} USD (Ref: Bs. ${r.total_ref_bs})\n📍 *Lugar:* Rock & Riff (La Viña) - antiguo Oleo Gastrobar (asi aparece en google)\n🗺️ *Ubicación / Cómo llegar:* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8\n🗓️ *Fecha:* Viernes 09 de Octubre • 8:00 PM\n\n*(Te adjunto aquí tu boleto oficial con código QR generado en el sistema).* Recuerda llevar el monto exacto en efectivo en puerta. ¡Nos vemos en la fiesta más picante de Valencia! 🇦🇷🔥`;
                  } else {
                    waMsg = `¡Hola ${r.buyer_name}! Te escribimos del equipo de El Quilombo 🇦🇷🔥 con respecto a tu preventa #${r.ticket_code} ($${r.total_usd} USD). ¿Deseas concretar tu pago para validar tu entrada?`;
                  }
                  const waLink = getWhatsappChatUrl(r.buyer_phone, waMsg);

                  return (
                    <div
                      key={`mobile-card-${r.id}`}
                      className={`attendee-mobile-card ${status}`}
                    >
                      {/* Card Header: Ticket Code + Timestamp + Status Select */}
                      <div className="attendee-mobile-card-header">
                        <div>
                          <span className="attendee-mobile-ticket-code">
                            #{r.ticket_code}
                          </span>
                          {r.created_at && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: '0.7rem',
                                color: 'var(--text-subtle)',
                                marginTop: '0.2rem',
                              }}
                            >
                              🕒 {formatReservationDateTime(r.created_at)}
                            </span>
                          )}
                        </div>

                        <select
                          value={status}
                          onChange={(e) => handleChangePaymentStatus(r, e.target.value as 'paid' | 'cash' | 'pending')}
                          disabled={updatingId === r.id}
                          className={`attendee-mobile-status-toggle ${status}`}
                          title="Tocar para cambiar estado de pago"
                          style={{ outline: 'none' }}
                        >
                          <option value="paid" style={{ background: '#0a061a', color: '#25d366', fontWeight: 800 }}>
                            ✓ PAGADO
                          </option>
                          <option value="cash" style={{ background: '#0a061a', color: 'var(--neon-cyan)', fontWeight: 800 }}>
                            💵 EFECTIVO
                          </option>
                          <option value="pending" style={{ background: '#0a061a', color: '#ffd600', fontWeight: 800 }}>
                            ⏳ PENDIENTE
                          </option>
                        </select>
                      </div>

                      {/* Attendee Name */}
                      <div className="attendee-mobile-buyer-name">{r.buyer_name}</div>

                      {/* Meta: Cédula & Phone */}
                      <div className="attendee-mobile-meta-row">
                        {r.buyer_dni && (
                          <span className="attendee-mobile-meta-item">
                            🪪 {r.buyer_dni}
                          </span>
                        )}
                        {r.buyer_phone && (
                          <span className="attendee-mobile-meta-item">
                            📱 {r.buyer_phone}
                          </span>
                        )}
                        {r.referral_source && (
                          <span
                            className="attendee-mobile-meta-item"
                            style={{
                              color: '#f472b6',
                              borderColor: 'rgba(236, 72, 153, 0.3)',
                              background: 'rgba(236, 72, 153, 0.1)',
                              fontWeight: 700,
                            }}
                          >
                            📣 {r.referral_source}
                          </span>
                        )}
                      </div>

                      {/* Details Grid: Quantity, Tier, Amount & Payment Method */}
                      <div className="attendee-mobile-details-grid">
                        <div>
                          <div className="attendee-mobile-detail-label">Entradas</div>
                          <select
                            value={r.quantity || 1}
                            onChange={(e) => handleChangeQuantity(r, parseInt(e.target.value, 10))}
                            disabled={updatingQuantityId === r.id}
                            title="Cambiar cantidad de entradas"
                            style={{
                              marginTop: '0.25rem',
                              width: '100%',
                              background: updatingQuantityId === r.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              color: '#ffffff',
                              border: updatingQuantityId === r.id ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              padding: '0.3rem 0.45rem',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              cursor: updatingQuantityId === r.id ? 'wait' : 'pointer',
                              outline: 'none',
                            }}
                          >
                            {Array.from(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, r.quantity || 1]))
                              .sort((a, b) => a - b)
                              .map((num) => (
                                <option key={num} value={num} style={{ background: '#0a061a', color: '#fff' }}>
                                  {num}x {r.tier_name || 'Preventa'}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <div className="attendee-mobile-detail-label">Total USD</div>
                          <div className="attendee-mobile-detail-value" style={{ color: 'var(--neon-cyan)' }}>
                            ${r.total_usd} USD
                          </div>
                        </div>

                        <div>
                          <div className="attendee-mobile-detail-label">Método Pago</div>
                          <select
                            value={r.payment_method || 'Pago Móvil'}
                            onChange={(e) => handleChangePaymentMethod(r, e.target.value)}
                            disabled={updatingPaymentId === r.id}
                            title="Cambiar método de pago"
                            style={{
                              marginTop: '0.25rem',
                              width: '100%',
                              background: updatingPaymentId === r.id ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              color: '#ffffff',
                              border: updatingPaymentId === r.id ? '1px solid var(--neon-cyan)' : '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              padding: '0.3rem 0.45rem',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: updatingPaymentId === r.id ? 'wait' : 'pointer',
                              outline: 'none',
                            }}
                          >
                            {r.payment_method && !PAYMENT_OPTIONS.includes(r.payment_method) && (
                              <option value={r.payment_method} style={{ background: '#0a061a', color: '#fff' }}>
                                {r.payment_method}
                              </option>
                            )}
                            <option value="Pago Móvil" style={{ background: '#0a061a', color: '#fff' }}>📱 Pago Móvil</option>
                            <option value="Zelle" style={{ background: '#0a061a', color: '#fff' }}>💵 Zelle</option>
                            <option value="Binance Pay (USDT)" style={{ background: '#0a061a', color: '#fff' }}>🟡 Binance Pay</option>
                            <option value="Efectivo en Rock & Riff" style={{ background: '#0a061a', color: '#fff' }}>🎟️ Efectivo</option>
                          </select>
                        </div>

                        <div>
                          <div className="attendee-mobile-detail-label">Ref. Bs</div>
                          <div className="attendee-mobile-detail-value" style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                            Bs. {r.total_ref_bs || '0,00'}
                          </div>
                        </div>
                      </div>

                      {/* Song Request if provided */}
                      {r.favorite_artist && (
                        <div className="attendee-mobile-song-box" title={`Tema pedido: ${r.favorite_artist}`}>
                          <span>🎧</span>
                          <span><strong>Tema pedido:</strong> {r.favorite_artist}</span>
                        </div>
                      )}

                      {/* Action Buttons: Generate & Send QR + Direct WhatsApp */}
                      <div className="attendee-mobile-actions-row">
                        <button
                          type="button"
                          onClick={() => handleOpenTicketGenerator(r)}
                          className="attendee-mobile-btn-qr"
                          title="Aprobar y generar imagen oficial con código QR para enviar al asistente"
                        >
                          <span>🎟️</span>
                          <span>Generar Boleto QR</span>
                        </button>

                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="attendee-mobile-btn-wa"
                          title="Abrir chat directo de WhatsApp con el cliente"
                        >
                          <span>💬</span>
                          <span>WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteReservation(r)}
                          disabled={deletingId === r.id}
                          className="attendee-mobile-btn-delete"
                          title="Eliminar reserva permanentemente"
                        >
                          <span>🗑️</span>
                          <span>{deletingId === r.id ? '...' : 'Eliminar'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1rem',
                    background: 'rgba(15, 12, 28, 0.8)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-subtle)',
                  }}
                >
                  <p style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>🔍</p>
                  <p style={{ fontSize: '0.92rem', color: '#fff', fontWeight: 700 }}>
                    No se encontraron reservas
                  </p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Probá cambiando el filtro o término de búsqueda.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: CANALES DE DIFUSIÓN & ORIGEN DE ASISTENTES           */}
        {/* ========================================================= */}
        {activeTab === 'sources' && (
          <div>
            {/* Top Bar with Title & Action Buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>
                  📣 CANALES DE DIFUSIÓN &amp; ORIGEN DE ASISTENTES
                </h2>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                  Descubrí por qué canal se enteraron de El Quilombo (Instagram, TikTok, WhatsApp, Amigos, etc.) para enfocar la pauta y medir efectividad.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCopySourceReport}
                  style={{
                    background: copiedSourceReport ? 'rgba(37, 211, 102, 0.25)' : 'rgba(236, 72, 153, 0.15)',
                    border: `1px solid ${copiedSourceReport ? 'var(--neon-green)' : 'rgba(236, 72, 153, 0.4)'}`,
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.5rem 1rem',
                    color: copiedSourceReport ? 'var(--neon-green)' : '#f472b6',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease',
                  }}
                  title="Copiar reporte analítico para compartir por WhatsApp"
                >
                  <span>{copiedSourceReport ? '✓' : '📋'}</span>
                  <span>{copiedSourceReport ? '¡Reporte Copiado!' : 'Copiar Reporte WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSourcesCSV}
                  style={{
                    background: 'rgba(0, 229, 255, 0.12)',
                    border: '1px solid var(--border-neon-cyan)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.5rem 1rem',
                    color: 'var(--neon-cyan)',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease',
                  }}
                  title="Descargar listado de asistentes con su canal en formato Excel / CSV"
                >
                  <span>📥</span>
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Metrics Highlights Cards Grid */}
            <div className="organizer-metrics-grid" style={{ marginBottom: '1.5rem' }}>
              {/* Card 1: Top Channel */}
              <div className="organizer-metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="organizer-metric-label">Canal #1 Líder</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{sourceAnalysis.topChannel ? (CHANNEL_CONFIG[sourceAnalysis.topChannel.channel]?.icon || '🏆') : '—'}</span>
                      <span>{sourceAnalysis.topChannel ? sourceAnalysis.topChannel.channel : 'Sin datos'}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '1.4rem' }}>🏆</span>
                </div>
                <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--neon-cyan)', fontWeight: 800 }}>
                  {sourceAnalysis.topChannel ? `${sourceAnalysis.topChannel.count} reservas (${sourceAnalysis.topChannel.pct.toFixed(1)}% del total)` : 'Esperando respuestas'}
                </div>
              </div>

              {/* Card 2: Total Surveyed */}
              <div className="organizer-metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="organizer-metric-label">Respuestas Registradas</span>
                    <div className="organizer-metric-value" style={{ color: '#25d366' }}>
                      {sourceAnalysis.totalWithSource}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontWeight: 500, marginLeft: '0.35rem' }}>
                        / {reservations.length}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '1.4rem' }}>🎯</span>
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  {reservations.length > 0
                    ? `${((sourceAnalysis.totalWithSource / reservations.length) * 100).toFixed(0)}% de compradores encuestados`
                    : 'Sin reservas'}
                </div>
              </div>

              {/* Card 3: Revenue Tracked */}
              <div className="organizer-metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="organizer-metric-label">Ingresos por Canal Líder</span>
                    <div className="organizer-metric-value" style={{ color: 'var(--neon-cyan)' }}>
                      ${sourceAnalysis.topChannel ? sourceAnalysis.topChannel.totalUsd : 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>USD</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '1.4rem' }}>💵</span>
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  {sourceAnalysis.topChannel ? `${sourceAnalysis.topChannel.tickets} entradas de ${sourceAnalysis.topChannel.channel}` : 'Sin datos'}
                </div>
              </div>

              {/* Card 4: Conversion Rate */}
              <div className="organizer-metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="organizer-metric-label">Conversión Canal Líder</span>
                    <div className="organizer-metric-value" style={{ color: '#ffd600' }}>
                      {sourceAnalysis.topChannel ? `${sourceAnalysis.topChannel.conversionPct.toFixed(0)}%` : '—'}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.4rem' }}>⚡</span>
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  {sourceAnalysis.topChannel ? `${sourceAnalysis.topChannel.paidCount + sourceAnalysis.topChannel.cashCount} confirmados de ${sourceAnalysis.topChannel.count}` : 'Sin datos'}
                </div>
              </div>
            </div>

            {/* Visual Breakdown of Channels (Bar Chart Style) */}
            <div
              style={{
                background: 'rgba(18, 10, 36, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span>📊</span> Distribución de Audiencia por Canal
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                    Hacé clic en cualquier canal para filtrar la tabla de asistentes inferior:
                  </p>
                </div>
                {sourceFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSourceFilter('all')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '0.3rem 0.75rem',
                      color: '#fff',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Quitar filtro ({sourceFilter})
                  </button>
                )}
              </div>

              {sourceAnalysis.channelsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-subtle)' }}>
                  <p>Aún no hay reservas con canales de difusión registrados.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {sourceAnalysis.channelsList.map((c) => {
                    const cfg = CHANNEL_CONFIG[c.channel] || {
                      icon: '📌',
                      label: c.channel,
                      color: 'var(--neon-cyan)',
                      bg: 'rgba(0, 229, 255, 0.12)',
                      border: 'rgba(0, 229, 255, 0.3)',
                    };
                    const isSelected = sourceFilter === c.channel;

                    return (
                      <div
                        key={c.channel}
                        onClick={() => setSourceFilter(isSelected ? 'all' : c.channel)}
                        style={{
                          background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '1px solid var(--neon-purple-light)' : '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '0.85rem 1rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {/* Channel Header Line */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.15rem' }}>{cfg.icon}</span>
                            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.92rem' }}>
                              {cfg.label}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                background: cfg.bg,
                                color: cfg.color,
                                border: `1px solid ${cfg.border}`,
                              }}
                            >
                              {c.pct.toFixed(1)}%
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                            <span style={{ color: '#fff', fontWeight: 800 }}>{c.count} reservas</span>
                            <span style={{ margin: '0 0.35rem', color: 'var(--text-subtle)' }}>•</span>
                            <span>{c.tickets} entradas</span>
                            <span style={{ margin: '0 0.35rem', color: 'var(--text-subtle)' }}>•</span>
                            <span style={{ color: 'var(--neon-cyan)', fontWeight: 800 }}>${c.totalUsd} USD</span>
                          </div>
                        </div>

                        {/* Progress Bar Track */}
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                            marginBottom: '0.45rem',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(c.pct, 2)}%`,
                              height: '100%',
                              background: cfg.color,
                              borderRadius: '999px',
                              transition: 'width 0.5s ease',
                              boxShadow: `0 0 8px ${cfg.color}`,
                            }}
                          />
                        </div>

                        {/* Status Pills Breakdown */}
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.72rem' }}>
                          <span style={{ color: '#25d366', fontWeight: 700 }}>
                            ✓ {c.paidCount} pagadas
                          </span>
                          <span style={{ color: 'var(--text-subtle)' }}>•</span>
                          <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>
                            💵 {c.cashCount} efectivo
                          </span>
                          <span style={{ color: 'var(--text-subtle)' }}>•</span>
                          <span style={{ color: '#ffd600', fontWeight: 700 }}>
                            ⏳ {c.pendingCount} pendientes
                          </span>
                          <span style={{ marginLeft: 'auto', color: isSelected ? 'var(--neon-purple-light)' : 'var(--text-subtle)', fontWeight: 700 }}>
                            {isSelected ? '✓ Filtrando asistentes' : 'Tocar para ver compradores ➔'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filterable Attendees Table by Channel */}
            <div
              style={{
                background: 'rgba(18, 10, 36, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.25rem',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span>👥</span> Listado de Asistentes por Canal ({filteredSourceAttendees.length})
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-subtle)', marginTop: '0.2rem' }}>
                    Filtrá por canal de adquisición o estado de pago para contactar a tus compradores.
                  </p>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', minWidth: '240px' }}>
                  <input
                    type="text"
                    value={sourceSearchQuery}
                    onChange={(e) => setSourceSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, cédula o canal..."
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '0.45rem 1rem 0.45rem 2.2rem',
                      color: '#fff',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                  <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: 'var(--text-subtle)' }}>
                    🔍
                  </span>
                  {sourceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSourceSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-subtle)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Channel Selector Pills */}
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setSourceFilter('all')}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: sourceFilter === 'all' ? 'var(--neon-purple)' : 'rgba(255, 255, 255, 0.05)',
                    color: sourceFilter === 'all' ? '#fff' : 'var(--text-subtle)',
                    border: sourceFilter === 'all' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  🌐 Todos los Canales ({reservations.length})
                </button>

                {sourceAnalysis.channelsList.map((c) => {
                  const cfg = CHANNEL_CONFIG[c.channel] || { icon: '📌' };
                  const isSelected = sourceFilter === c.channel;
                  return (
                    <button
                      key={c.channel}
                      type="button"
                      onClick={() => setSourceFilter(c.channel)}
                      style={{
                        padding: '0.35rem 0.85rem',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        background: isSelected ? 'var(--neon-purple)' : 'rgba(255, 255, 255, 0.05)',
                        color: isSelected ? '#fff' : 'var(--text-subtle)',
                        border: isSelected ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>{cfg.icon}</span>
                      <span>{c.channel}</span>
                      <span style={{ opacity: 0.75 }}>({c.count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Status Selector Pills */}
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setSourceStatusFilter('all')}
                  style={{
                    padding: '0.28rem 0.7rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sourceStatusFilter === 'all' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    color: sourceStatusFilter === 'all' ? '#fff' : 'var(--text-subtle)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  Todos los Estados
                </button>
                <button
                  type="button"
                  onClick={() => setSourceStatusFilter('paid')}
                  style={{
                    padding: '0.28rem 0.7rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sourceStatusFilter === 'paid' ? 'rgba(37, 211, 102, 0.2)' : 'transparent',
                    color: '#25d366',
                    border: '1px solid rgba(37, 211, 102, 0.3)',
                  }}
                >
                  ✓ Solo Pagados
                </button>
                <button
                  type="button"
                  onClick={() => setSourceStatusFilter('cash')}
                  style={{
                    padding: '0.28rem 0.7rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sourceStatusFilter === 'cash' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
                    color: 'var(--neon-cyan)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                  }}
                >
                  💵 Solo Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setSourceStatusFilter('pending')}
                  style={{
                    padding: '0.28rem 0.7rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sourceStatusFilter === 'pending' ? 'rgba(255, 214, 0, 0.2)' : 'transparent',
                    color: '#ffd600',
                    border: '1px solid rgba(255, 214, 0, 0.3)',
                  }}
                >
                  ⏳ Solo Pendientes
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="organizer-desktop-table-container organizer-table-wrapper" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-subtle)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Ticket</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Titular / DNI</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Canal de Origen</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Entradas</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Total USD</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Estado Pago</th>
                      <th style={{ padding: '0.75rem 1rem' }}>WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSourceAttendees.length > 0 ? (
                      filteredSourceAttendees.map((r) => {
                        const status = getReservationStatus(r);
                        const isPaid = status === 'paid';
                        const isCash = status === 'cash';
                        const channel = (r.referral_source || '').trim() || 'No especificado';
                        const cfg = CHANNEL_CONFIG[channel] || {
                          icon: '📌',
                          label: channel,
                          color: '#fff',
                          bg: 'rgba(255, 255, 255, 0.08)',
                          border: 'rgba(255, 255, 255, 0.15)',
                        };

                        const waMsg = `¡Hola ${r.buyer_name}! Te escribimos del equipo de El Quilombo 🇦🇷🔥 con respecto a tu preventa #${r.ticket_code} ($${r.total_usd} USD). ¡Gracias por enterarte por ${channel}!`;
                        const waLink = getWhatsappChatUrl(r.buyer_phone, waMsg);

                        return (
                          <tr
                            key={`source-row-${r.id}`}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                              background: isPaid ? 'rgba(37, 211, 102, 0.03)' : isCash ? 'rgba(0, 229, 255, 0.03)' : 'transparent',
                            }}
                          >
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--neon-cyan)', fontSize: '0.86rem' }}>
                                #{r.ticket_code}
                              </div>
                              {r.created_at && (
                                <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                                  🕒 {formatReservationDateTime(r.created_at)}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 700, color: '#fff' }}>{r.buyer_name}</div>
                              <div style={{ color: 'var(--text-subtle)', fontSize: '0.74rem' }}>{r.buyer_dni}</div>
                            </td>

                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  padding: '0.25rem 0.65rem',
                                  borderRadius: '999px',
                                  background: cfg.bg,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.border}`,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>{cfg.icon}</span>
                                <span>{cfg.label}</span>
                              </span>
                            </td>

                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#fff' }}>
                              {r.quantity || 1}x <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>({r.tier_name || 'Preventa'})</span>
                            </td>

                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 800, color: 'var(--neon-cyan)' }}>${r.total_usd} USD</div>
                              <div style={{ color: 'var(--text-subtle)', fontSize: '0.7rem' }}>Ref: Bs. {r.total_ref_bs}</div>
                            </td>

                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '999px',
                                  background: isPaid ? '#25d366' : isCash ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 214, 0, 0.15)',
                                  color: isPaid ? '#fff' : isCash ? 'var(--neon-cyan)' : '#ffd600',
                                  border: isPaid ? 'none' : isCash ? '1px solid var(--neon-cyan)' : '1px solid #ffd600',
                                }}
                              >
                                {isPaid ? '✓ PAGADO' : isCash ? '💵 EFECTIVO' : '⏳ PENDIENTE'}
                              </span>
                            </td>

                            <td style={{ padding: '0.85rem 1rem' }}>
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: 'rgba(37, 211, 102, 0.15)',
                                  border: '1px solid #25d366',
                                  color: '#25d366',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  whiteSpace: 'nowrap',
                                }}
                                title="Enviar mensaje de WhatsApp al comprador"
                              >
                                <span>📲</span> WhatsApp
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
                          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No se encontraron asistentes para el filtro seleccionado.</p>
                          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Probá cambiando el canal o el término de búsqueda.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Ergonomic Cards for Acquisition Sources */}
              <div className="organizer-mobile-cards-container">
                {filteredSourceAttendees.length > 0 ? (
                  filteredSourceAttendees.map((r) => {
                    const status = getReservationStatus(r);
                    const isPaid = status === 'paid';
                    const isCash = status === 'cash';
                    const channel = (r.referral_source || '').trim() || 'No especificado';
                    const cfg = CHANNEL_CONFIG[channel] || {
                      icon: '📌',
                      label: channel,
                      color: '#fff',
                      bg: 'rgba(255, 255, 255, 0.08)',
                      border: 'rgba(255, 255, 255, 0.15)',
                    };

                    const waMsg = `¡Hola ${r.buyer_name}! Te escribimos del equipo de El Quilombo 🇦🇷🔥 con respecto a tu preventa #${r.ticket_code} ($${r.total_usd} USD). ¡Gracias por enterarte por ${channel}!`;
                    const waLink = getWhatsappChatUrl(r.buyer_phone, waMsg);

                    return (
                      <div
                        key={`source-mobile-${r.id}`}
                        className={`attendee-mobile-card ${status}`}
                        style={{
                          background: 'linear-gradient(145deg, rgba(22, 17, 43, 0.95) 0%, rgba(13, 10, 26, 0.98) 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '16px',
                          padding: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--neon-cyan)', fontSize: '0.85rem' }}>
                            #{r.ticket_code}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '999px',
                              background: isPaid ? '#25d366' : isCash ? 'rgba(0, 229, 255, 0.16)' : 'rgba(255, 214, 0, 0.15)',
                              color: isPaid ? '#fff' : isCash ? 'var(--neon-cyan)' : '#ffd600',
                            }}
                          >
                            {isPaid ? '✓ PAGADO' : isCash ? '💵 EFECTIVO' : '⏳ PENDIENTE'}
                          </span>
                        </div>

                        <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem', marginBottom: '0.25rem' }}>
                          {r.buyer_name}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          {r.buyer_dni && <span>🪪 {r.buyer_dni}</span>}
                          {r.buyer_phone && <span>📱 {r.buyer_phone}</span>}
                          {r.created_at && <span>🕒 {formatReservationDateTime(r.created_at)}</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Canal de Origen</div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                color: cfg.color,
                                marginTop: '0.15rem',
                              }}
                            >
                              <span>{cfg.icon}</span>
                              <span>{cfg.label}</span>
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>{r.quantity || 1}x {r.tier_name || 'Preventa'}</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>${r.total_usd} USD</div>
                          </div>
                        </div>

                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            width: '100%',
                            background: 'rgba(37, 211, 102, 0.15)',
                            border: '1px solid #25d366',
                            color: '#25d366',
                            borderRadius: '8px',
                            padding: '0.5rem',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            textDecoration: 'none',
                          }}
                        >
                          <span>📲</span> Escribir por WhatsApp
                        </a>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-subtle)', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px' }}>
                    <p style={{ fontWeight: 600 }}>No hay asistentes para este filtro.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: TEMAS PEDIDOS (SOLICITUDES DE ASISTENTES)          */}
        {/* ========================================================= */}
        {activeTab === 'songs' && (
          <div>
            {/* Top Bar with Title & Action Buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>
                  🎧 TEMAS &amp; ARTISTAS PEDIDOS (PARA EL DJ)
                </h2>
                <p style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>
                  Canciones solicitadas en tiempo real por los asistentes en el formulario de preventa.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCopyDJList}
                  style={{
                    background: copiedAllSongs ? 'rgba(37, 211, 102, 0.25)' : 'rgba(168, 85, 247, 0.15)',
                    border: `1px solid ${copiedAllSongs ? 'var(--neon-green)' : 'var(--border-neon-purple)'}`,
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.5rem 1rem',
                    color: copiedAllSongs ? 'var(--neon-green)' : 'var(--neon-purple-light)',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease',
                  }}
                  title="Copiar lista de temas para enviar por WhatsApp al DJ"
                >
                  <span>{copiedAllSongs ? '✓' : '📋'}</span>
                  <span>{copiedAllSongs ? '¡Copiado para WhatsApp!' : 'Copiar Lista para DJ'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSongRequestsCSV}
                  style={{
                    background: 'rgba(0, 240, 255, 0.12)',
                    border: '1px solid var(--border-neon-cyan)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.5rem 1rem',
                    color: 'var(--neon-cyan)',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  title="Descargar archivo CSV con todos los temas pedidos"
                >
                  <span>📥</span> Descargar Temas (CSV)
                </button>
              </div>
            </div>

            {/* KPI Cards for Songs */}
            <div className="organizer-metrics-grid" style={{ marginBottom: '1.5rem' }}>
              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid var(--border-neon-purple)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: 'var(--neon-purple-light)' }}>
                  🎵 Total Canciones Pedidas
                </span>
                <div className="organizer-kpi-value">{songRequests.length}</div>
                <span className="organizer-kpi-subtext">Solicitadas en preventa</span>
              </div>

              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid rgba(37, 211, 102, 0.35)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: '#86efac' }}>
                  ✓ De Asistentes Pagados
                </span>
                <div className="organizer-kpi-value" style={{ color: '#25d366' }}>
                  {songRequests.filter((s) => s.status === 'paid').length}
                </div>
                <span className="organizer-kpi-subtext">Entradas confirmadas (Prioridad DJ)</span>
              </div>

              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid var(--border-neon-cyan)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: 'var(--neon-cyan)' }}>
                  💵 De Pagos en Efectivo
                </span>
                <div className="organizer-kpi-value" style={{ color: 'var(--neon-cyan)' }}>
                  {songRequests.filter((s) => s.status === 'cash').length}
                </div>
                <span className="organizer-kpi-subtext">Comprometidos en puerta</span>
              </div>

              <div
                className="organizer-kpi-card"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 214, 0, 0.12), rgba(15, 12, 28, 0.85))',
                  border: '1px solid rgba(255, 214, 0, 0.35)',
                }}
              >
                <span className="organizer-kpi-title" style={{ color: '#ffd600' }}>
                  ⏳ De Preventas Pendientes
                </span>
                <div className="organizer-kpi-value" style={{ color: '#ffd600' }}>
                  {songRequests.filter((s) => s.status === 'pending').length}
                </div>
                <span className="organizer-kpi-subtext">Por conciliar comprobante</span>
              </div>
            </div>

            {/* Top Trending Podium / Chips */}
            {metrics && metrics.topRequestedArtists && metrics.topRequestedArtists.length > 0 && (
              <div
                style={{
                  background: 'rgba(15, 12, 28, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🏆</span> TOP ARTISTAS &amp; TEMAS MÁS VOTADOS
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                    Haz clic en cualquiera para filtrar
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {metrics.topRequestedArtists.map((item, idx) => {
                    const isSelected = songSearchQuery.toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSongSearchQuery(isSelected ? '' : item.name)}
                        style={{
                          background: isSelected ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${isSelected ? 'var(--neon-cyan)' : 'var(--border-neon-purple)'}`,
                          borderRadius: 'var(--radius-pill)',
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          color: '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        title={`Filtrar pedidos de ${item.name}`}
                      >
                        <span style={{ color: 'var(--neon-cyan)', fontWeight: 900 }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 600 }}>{item.name}</span>
                        <span
                          style={{
                            background: 'rgba(168, 85, 247, 0.35)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: '#fff',
                          }}
                        >
                          {item.count} votos
                        </span>
                      </button>
                    );
                  })}
                  {songSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSongSearchQuery('')}
                      style={{
                        background: 'transparent',
                        border: '1px dashed rgba(255, 255, 255, 0.25)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--text-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      ✕ Limpiar filtro
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Search & Filter Bar */}
            <div className="organizer-filters-bar">
              <div className="organizer-search-box">
                <input
                  type="text"
                  placeholder="🔍 Buscar por canción, artista o titular..."
                  value={songSearchQuery}
                  onChange={(e) => setSongSearchQuery(e.target.value)}
                  className="organizer-search-input"
                />
                {songSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSongSearchQuery('')}
                    className="organizer-search-clear-btn"
                    title="Limpiar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="organizer-filter-pills-row">
                <button
                  type="button"
                  onClick={() => setSongStatusFilter('all')}
                  className={`organizer-filter-pill-btn ${songStatusFilter === 'all' ? 'active' : ''}`}
                >
                  Todos ({songRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSongStatusFilter('paid')}
                  className={`organizer-filter-pill-btn ${songStatusFilter === 'paid' ? 'active' : ''}`}
                  style={{ color: songStatusFilter === 'paid' ? '#fff' : '#86efac' }}
                >
                  ✓ Pagados ({songRequests.filter((s) => s.status === 'paid').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSongStatusFilter('cash')}
                  className={`organizer-filter-pill-btn ${songStatusFilter === 'cash' ? 'active' : ''}`}
                  style={{ color: songStatusFilter === 'cash' ? '#fff' : 'var(--neon-cyan)' }}
                >
                  💵 Efectivo ({songRequests.filter((s) => s.status === 'cash').length})
                </button>
                <button
                  type="button"
                  onClick={() => setSongStatusFilter('pending')}
                  className={`organizer-filter-pill-btn ${songStatusFilter === 'pending' ? 'active' : ''}`}
                  style={{ color: songStatusFilter === 'pending' ? '#fff' : '#ffd600' }}
                >
                  ⏳ Pendientes ({songRequests.filter((s) => s.status === 'pending').length})
                </button>
              </div>
            </div>

            {/* List / Cards of Requested Songs */}
            {filteredSongRequests.length === 0 ? (
              <div
                style={{
                  background: 'rgba(15, 12, 28, 0.65)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  color: 'var(--text-subtle)',
                }}
              >
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🎧</span>
                <p style={{ fontSize: '1rem', color: '#fff', fontWeight: 700, marginBottom: '0.35rem' }}>
                  No se encontraron canciones pedidas
                </p>
                <p style={{ fontSize: '0.8rem' }}>
                  Probá ajustando la búsqueda o el filtro de estado de pago.
                </p>
              </div>
            ) : (
              <div className="song-requests-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredSongRequests.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="song-request-card"
                    style={{
                      background: 'rgba(15, 12, 28, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.85rem',
                      transition: 'border-color 0.2s ease, transform 0.2s ease',
                    }}
                  >
                    {/* Left: Number + Song + Requester Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', flex: 1, minWidth: '260px' }}>
                      <span
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--neon-cyan)',
                          fontWeight: 900,
                          fontSize: '0.85rem',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {idx + 1}
                      </span>

                      <div>
                        {/* Song Title / Request */}
                        <div
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 800,
                            color: '#fff',
                            marginBottom: '0.35rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>🎶 &ldquo;{req.song}&rdquo;</span>
                          <button
                            type="button"
                            onClick={() => handleCopySingleSong(req.id, req.song)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedSongId === req.id ? 'var(--neon-green)' : 'var(--text-subtle)',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                            title="Copiar nombre del tema"
                          >
                            {copiedSongId === req.id ? '✓ ¡Copiado!' : '📋'}
                          </button>
                        </div>

                        {/* Requester details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                          <span>
                            👤 <strong>{req.buyerName}</strong> {req.buyerDni && `(${req.buyerDni})`}
                          </span>
                          <span>•</span>
                          <span>🎟️ {req.quantity}x entrada(s)</span>
                          {req.createdAt && (
                            <>
                              <span>•</span>
                              <span>🕒 {formatReservationDateTime(req.createdAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Payment Status Badge & DJ Player Shortcuts */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {/* Status Badge */}
                      <span
                        style={{
                          padding: '0.3rem 0.65rem',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background:
                            req.status === 'paid'
                              ? 'rgba(37, 211, 102, 0.15)'
                              : req.status === 'cash'
                              ? 'rgba(0, 240, 255, 0.15)'
                              : 'rgba(255, 214, 0, 0.15)',
                          color:
                            req.status === 'paid'
                              ? '#25d366'
                              : req.status === 'cash'
                              ? 'var(--neon-cyan)'
                              : '#ffd600',
                          border: `1px solid ${
                            req.status === 'paid'
                              ? 'rgba(37, 211, 102, 0.35)'
                              : req.status === 'cash'
                              ? 'var(--border-neon-cyan)'
                              : 'rgba(255, 214, 0, 0.35)'
                          }`,
                        }}
                      >
                        {req.status === 'paid' ? '✓ PAGADO' : req.status === 'cash' ? '💵 EFECTIVO' : '⏳ PENDIENTE'}
                      </span>

                      {/* YouTube Search Link */}
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(req.song + ' trap argentino')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'rgba(255, 0, 0, 0.12)',
                          border: '1px solid rgba(255, 0, 0, 0.35)',
                          borderRadius: 'var(--radius-pill)',
                          color: '#ff4d4d',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        title="Buscar y reproducir en YouTube"
                      >
                        <span>▶</span> YouTube ↗
                      </a>

                      {/* Spotify Search Link */}
                      <a
                        href={`https://open.spotify.com/search/${encodeURIComponent(req.song)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: 'rgba(30, 215, 96, 0.12)',
                          border: '1px solid rgba(30, 215, 96, 0.35)',
                          borderRadius: 'var(--radius-pill)',
                          color: '#1ed760',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        title="Buscar en Spotify"
                      >
                        <span>🟢</span> Spotify ↗
                      </a>

                      {/* Add to Web Playlist shortcut */}
                      <button
                        type="button"
                        onClick={() => handleAddSongToWebPlaylist(req.song)}
                        style={{
                          background: 'rgba(168, 85, 247, 0.12)',
                          border: '1px solid var(--border-neon-purple)',
                          borderRadius: 'var(--radius-pill)',
                          color: 'var(--neon-purple-light)',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        title="Cargar este tema en el formulario de la Playlist Web"
                      >
                        <span>+</span> Playlist Web
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: CUSTOMIZE DIGITAL TICKET                           */}
        {/* ========================================================= */}
        {activeTab === 'ticket' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
                PERSONALIZADOR DEL BOLETO DIGITAL
              </h2>
              <p style={{ color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                Modificá las fechas, lugar, precios y textos del comprobante. Los cambios se sincronizan en la web de todos los usuarios.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '2rem',
                alignItems: 'start',
              }}
            >
              {/* Settings Form */}
              <form
                onSubmit={handleSaveSettings}
                style={{
                  background: 'rgba(15, 12, 28, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '20px',
                  padding: '1.75rem',
                }}
              >
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                      Fecha y Hora del Evento
                    </label>
                    <input
                      type="text"
                      id="input-event-date"
                      value={settings.eventDate}
                      onChange={(e) => setSettings({ ...settings, eventDate: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.7rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                      Lugar del Evento (Venue)
                    </label>
                    <input
                      type="text"
                      id="input-venue-name"
                      value={settings.venueName}
                      onChange={(e) => setSettings({ ...settings, venueName: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.7rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                      Dirección Completa
                    </label>
                    <input
                      type="text"
                      id="input-venue-address"
                      value={settings.venueAddress}
                      onChange={(e) => setSettings({ ...settings, venueAddress: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.7rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                        Precio General ($ USD)
                      </label>
                      <input
                        type="number"
                        id="input-price-general"
                        min="1"
                        value={settings.priceGeneral}
                        onChange={(e) => setSettings({ ...settings, priceGeneral: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '0.7rem',
                          color: '#fff',
                          fontSize: '0.9rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                        Precio VIP ($ USD)
                      </label>
                      <input
                        type="number"
                        id="input-price-vip"
                        min="1"
                        value={settings.priceVip}
                        onChange={(e) => setSettings({ ...settings, priceVip: Number(e.target.value) })}
                        style={{
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '0.7rem',
                          color: '#fff',
                          fontSize: '0.9rem',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                      WhatsApp Oficial de Pagos
                    </label>
                    <input
                      type="text"
                      id="input-official-whatsapp"
                      value={settings.officialWhatsapp}
                      onChange={(e) => setSettings({ ...settings, officialWhatsapp: e.target.value })}
                      placeholder="Ej: 58412882460"
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.7rem',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                      Instrucciones de Puerta en el Boleto
                    </label>
                    <textarea
                      id="input-door-instructions"
                      rows={2}
                      value={settings.ticketDoorInstructions}
                      onChange={(e) => setSettings({ ...settings, ticketDoorInstructions: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        padding: '0.7rem',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        resize: 'none',
                      }}
                    />
                  </div>

                  {settingsSaveNotice && (
                    <div
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: settingsSaveNotice.includes('Error')
                          ? 'rgba(255, 0, 127, 0.15)'
                          : 'rgba(0, 240, 255, 0.15)',
                        color: settingsSaveNotice.includes('Error') ? '#ff007f' : 'var(--neon-cyan)',
                      }}
                    >
                      {settingsSaveNotice}
                    </div>
                  )}

                  <button
                    type="submit"
                    id="btn-save-ticket-settings"
                    disabled={isSavingSettings}
                    style={{
                      background: 'var(--gradient-party)',
                      border: 'none',
                      color: '#fff',
                      fontFamily: 'var(--font-title)',
                      fontWeight: 900,
                      fontSize: '0.95rem',
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-pill)',
                      cursor: 'pointer',
                    }}
                  >
                    {isSavingSettings ? 'Guardando en Supabase...' : '💾 Guardar Cambios en Vivo'}
                  </button>
                </div>
              </form>

              {/* Live Preview */}
              <div>
                <AdminTicketPreview settings={settings} />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PLAYLIST MANAGEMENT                                */}
        {/* ========================================================= */}
        {activeTab === 'playlist' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 900, color: '#fff' }}>
                GESTOR DE PLAYLIST «QUILOMBO SOUND»
              </h2>
              <p style={{ color: 'var(--text-subtle)', fontSize: '0.82rem' }}>
                Añadí nuevas canciones para que suenen en el reproductor web y en la lista de los visitantes.
              </p>
            </div>

            {/* Add Song Form */}
            <div
              style={{
                background: 'rgba(15, 12, 28, 0.85)',
                border: '1px solid var(--border-neon-purple)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--neon-cyan)', marginBottom: '1rem' }}>
                ➕ Añadir Nueva Canción al Reproductor
              </h3>

              <form onSubmit={handleAddTrack} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: '#fff', marginBottom: '0.35rem' }}>
                    Título de la Canción *
                  </label>
                  <input
                    type="text"
                    id="input-song-title"
                    placeholder="Ej: Si Me Sobrara El Tiempo"
                    value={newTrack.title}
                    onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: '#fff', marginBottom: '0.35rem' }}>
                    Artista(s) *
                  </label>
                  <input
                    type="text"
                    id="input-song-artist"
                    placeholder="Ej: Duki"
                    value={newTrack.artist}
                    onChange={(e) => setNewTrack({ ...newTrack, artist: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: '#fff', marginBottom: '0.35rem' }}>
                    URL del Audio (mp3 o m4a) *
                  </label>
                  <input
                    type="text"
                    id="input-song-src"
                    placeholder="Ej: /assets/audio/goteo.m4a o URL web"
                    value={newTrack.src}
                    onChange={(e) => setNewTrack({ ...newTrack, src: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', color: '#fff', marginBottom: '0.35rem' }}>
                    Carátula (Opcional)
                  </label>
                  <input
                    type="text"
                    id="input-song-cover"
                    placeholder="/assets/img/tracks/goteo.jpg"
                    value={newTrack.cover}
                    onChange={(e) => setNewTrack({ ...newTrack, cover: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="submit"
                    id="btn-add-song"
                    style={{
                      width: '100%',
                      background: 'var(--gradient-party)',
                      border: 'none',
                      color: '#fff',
                      fontFamily: 'var(--font-title)',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      padding: '0.65rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    + Agregar Canción
                  </button>
                </div>
              </form>
            </div>

            {/* Combined Playlist View */}
            <div
              style={{
                background: 'rgba(15, 12, 28, 0.85)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                  Canciones en la Playlist ({INITIAL_PLAYLIST.length + customTracks.length} tracks activos)
                </h3>
              </div>

              {/* Custom Added Tracks */}
              {customTracks.length > 0 && (
                <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(0, 240, 255, 0.05)', borderBottom: '1px solid rgba(0, 240, 255, 0.1)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--neon-cyan)', textTransform: 'uppercase' }}>
                    ⚡ Agregadas por el Organizador ({customTracks.length}):
                  </span>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {customTracks.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.04)',
                          borderRadius: '8px',
                          padding: '0.6rem 0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>🎵</span>
                          <div>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{t.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{t.artist}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handlePreviewTrack(t.src, t.id)}
                            style={{
                              background: previewingTrackId === t.id ? '#25d366' : 'rgba(255, 255, 255, 0.08)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {previewingTrackId === t.id ? '⏸ Detener' : '▶ Probar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveTrack(t.id)}
                            style={{
                              background: 'rgba(255, 0, 127, 0.15)',
                              border: '1px solid var(--border-neon-pink)',
                              color: 'var(--neon-pink)',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            ✕ Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Initial Tracks */}
              <div style={{ padding: '0.75rem 1.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                  Lineup Base Oficial ({INITIAL_PLAYLIST.length} temas):
                </span>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {INITIAL_PLAYLIST.map((t, idx) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ color: 'var(--neon-cyan)', fontWeight: 800, fontSize: '0.75rem' }}>#{idx + 1}</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{t.title}</span>
                        <span style={{ color: 'var(--text-subtle)' }}>— {t.artist}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Base oficial</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Generador de Boleto QR para el Organizador */}
      {selectedTicketOrder && (
        <TicketQrModal
          order={selectedTicketOrder}
          onClose={() => {
            setSelectedTicketOrder(null);
            fetchReservations();
          }}
          isOrganizerView={true}
        />
      )}
    </div>
  );
}
