'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EventSettings } from '../../types/settings';
import { MEMES, MemeSticker } from '../../data/memes';

interface AdminTicketPreviewProps {
  settings: EventSettings;
  reservations?: any[];
  onOpenTicketGenerator?: (reservation: any) => void;
}

export default function AdminTicketPreview({
  settings,
  reservations = [],
  onOpenTicketGenerator,
}: AdminTicketPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mode: 'demo' or 'attendee'
  const [previewMode, setPreviewMode] = useState<'demo' | 'attendee'>('demo');
  const [selectedResId, setSelectedResId] = useState<string>('');

  // Demo state
  const [demoTier, setDemoTier] = useState<'vip' | 'general'>('vip');
  const [demoStatus, setDemoStatus] = useState<'paid' | 'cash' | 'pending'>('paid');
  const [demoQuantity, setDemoQuantity] = useState<number>(1);
  const [demoName, setDemoName] = useState<string>('ALEJANDRO DEL SOLAR');
  const [demoDni, setDemoDni] = useState<string>('V-28.450.123');
  const [demoPhone, setDemoPhone] = useState<string>('0412-1234567');
  const [demoSong, setDemoSong] = useState<string>("Duki - She Don't Give a FO");
  const [demoReferral, setDemoReferral] = useState<string>('Instagram');

  // Meme selection
  const [selectedMemeIndex, setSelectedMemeIndex] = useState<number>(0);

  // Set initial selected reservation if available
  useEffect(() => {
    if (reservations.length > 0 && !selectedResId) {
      setSelectedResId(reservations[0].id || reservations[0].ticket_code);
    }
  }, [reservations, selectedResId]);

  // Selected reservation object
  const selectedReservation = useMemo(() => {
    if (previewMode !== 'attendee' || !selectedResId) return null;
    return reservations.find((r) => (r.id || r.ticket_code) === selectedResId) || null;
  }, [previewMode, selectedResId, reservations]);

  // Computed data for the ticket
  const ticketData = useMemo(() => {
    if (previewMode === 'attendee' && selectedReservation) {
      const r = selectedReservation;
      const status: 'paid' | 'cash' | 'pending' =
        r.payment_status === 'paid' || r.payment_status === 'cash' || r.payment_status === 'pending'
          ? r.payment_status
          : r.is_paid
          ? 'paid'
          : r.tier_id === 'cash' || r.tier_id === 'efectivo' || (typeof r.payment_method === 'string' && r.payment_method.toLowerCase().includes('efectivo'))
          ? 'cash'
          : 'pending';

      const tierName = r.tier_name || (r.tier_id === 'vip' ? 'Pase VIP Quilombo' : 'Pase Preventa');
      const qty = Number(r.quantity) || 1;
      const totalUSD = Number(r.total_usd) || 0;
      const totalRefBs = r.total_ref_bs || '0';

      return {
        buyerName: (r.buyer_name || 'Sin Nombre').toUpperCase(),
        buyerDni: r.buyer_dni || 'V-00.000.000',
        buyerPhone: r.buyer_phone || '',
        ticketCode: r.ticket_code || 'QLB-26-0000',
        tierName: `${qty}x ${tierName}`,
        quantity: qty,
        totalUSD,
        totalRefBs,
        favoriteArtist: r.favorite_artist || 'Sin especificar',
        referralSource: r.referral_source || 'Instagram',
        paymentMethod: r.payment_method || 'Pago Móvil',
        status,
        rawReservation: r,
      };
    }

    // Demo Mode
    const price = demoTier === 'vip' ? settings.priceVip : settings.priceGeneral;
    const totalUSD = price * demoQuantity;

    return {
      buyerName: demoName.toUpperCase(),
      buyerDni: demoDni,
      buyerPhone: demoPhone,
      ticketCode: 'QLB-26-DEMO',
      tierName: `${demoQuantity}x ${demoTier === 'vip' ? 'Pase VIP Quilombo' : 'Pase General Quilombo'}`,
      quantity: demoQuantity,
      totalUSD,
      totalRefBs: (totalUSD * 45).toFixed(2),
      favoriteArtist: demoSong,
      referralSource: demoReferral,
      paymentMethod: 'Pago Móvil',
      status: demoStatus,
      rawReservation: null,
    };
  }, [
    previewMode,
    selectedReservation,
    demoTier,
    demoStatus,
    demoQuantity,
    demoName,
    demoDni,
    demoPhone,
    demoSong,
    demoReferral,
    settings,
  ]);

  const currentMeme = useMemo(() => {
    return MEMES[selectedMemeIndex % MEMES.length];
  }, [selectedMemeIndex]);

  const handleNextMeme = () => {
    setSelectedMemeIndex((prev) => (prev + 1) % MEMES.length);
  };

  // Procedural QR Code Canvas Generator
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 260;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    let seed = 0;
    const code = ticketData.ticketCode;
    for (let i = 0; i < code.length; i++) {
      seed = (seed * 31 + code.charCodeAt(i)) & 0xffffffff;
    }
    const random = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    const modules = 21;
    const cellSize = Math.floor(size / modules);
    const offset = Math.floor((size - cellSize * modules) / 2);

    ctx.fillStyle = '#06050a';

    const drawFinder = (r: number, c: number) => {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 7; j++) {
          const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
          const isCore = i >= 2 && i <= 4 && j >= 2 && j <= 4;
          if (isBorder || isCore) {
            ctx.fillRect(offset + (c + j) * cellSize, offset + (r + i) * cellSize, cellSize, cellSize);
          }
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, modules - 7);
    drawFinder(modules - 7, 0);

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c >= modules - 8) || (r >= modules - 8 && c < 8)) {
          continue;
        }
        if (r === 6 || c === 6) {
          if ((r + c) % 2 === 0) {
            ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
          }
          continue;
        }
        if (random() > 0.46) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [ticketData.ticketCode]);

  return (
    <div
      style={{
        background: 'rgba(12, 9, 26, 0.9)',
        border: '1px solid var(--border-neon-purple)',
        borderRadius: '24px',
        padding: '1.25rem',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Simulation Header with View Mode Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '1rem' }}>👁️</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              SIMULADOR DE BOLETO EN VIVO
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.15rem' }}>
            Renderizado exacto con QR procedural y meme viral oficial.
          </p>
        </div>

        {/* Mode Toggle Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: 'var(--radius-pill)' }}>
          <button
            type="button"
            onClick={() => setPreviewMode('demo')}
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: previewMode === 'demo' ? 'var(--neon-purple)' : 'transparent',
              color: previewMode === 'demo' ? '#fff' : 'var(--text-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            🌟 Modo Demo
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('attendee')}
            disabled={reservations.length === 0}
            style={{
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: reservations.length === 0 ? 'not-allowed' : 'pointer',
              background: previewMode === 'attendee' ? 'var(--neon-purple)' : 'transparent',
              color: previewMode === 'attendee' ? '#fff' : 'var(--text-subtle)',
              transition: 'all 0.2s ease',
            }}
          >
            👥 Asistente Real ({reservations.length})
          </button>
        </div>
      </div>

      {/* Mode Controls Bar */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '0.75rem',
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6rem',
        }}
      >
        {previewMode === 'demo' ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status Selector */}
            <select
              value={demoStatus}
              onChange={(e) => setDemoStatus(e.target.value as any)}
              style={{
                background: demoStatus === 'paid' ? 'rgba(37, 211, 102, 0.15)' : demoStatus === 'cash' ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 214, 0, 0.15)',
                color: demoStatus === 'paid' ? '#25d366' : demoStatus === 'cash' ? 'var(--neon-cyan)' : '#ffd600',
                border: `1px solid ${demoStatus === 'paid' ? '#25d366' : demoStatus === 'cash' ? 'var(--neon-cyan)' : '#ffd600'}`,
                borderRadius: '8px',
                padding: '0.3rem 0.55rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="paid" style={{ background: '#0a061a', color: '#25d366' }}>✓ Pagado</option>
              <option value="cash" style={{ background: '#0a061a', color: 'var(--neon-cyan)' }}>💵 Efectivo</option>
              <option value="pending" style={{ background: '#0a061a', color: '#ffd600' }}>⏳ Pendiente</option>
            </select>

            {/* Tier Selector */}
            <select
              value={demoTier}
              onChange={(e) => setDemoTier(e.target.value as any)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.3rem 0.55rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="vip" style={{ background: '#0a061a' }}>⭐ VIP (${settings.priceVip})</option>
              <option value="general" style={{ background: '#0a061a' }}>🎟️ General (${settings.priceGeneral})</option>
            </select>

            {/* Quantity */}
            <select
              value={demoQuantity}
              onChange={(e) => setDemoQuantity(Number(e.target.value))}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.3rem 0.55rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {[1, 2, 3, 4, 5].map((q) => (
                <option key={q} value={q} style={{ background: '#0a061a' }}>{q}x entrada{q > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: '220px' }}>
            <select
              value={selectedResId}
              onChange={(e) => setSelectedResId(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#fff',
                border: '1px solid var(--border-neon-purple)',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {reservations.map((r) => (
                <option key={r.id || r.ticket_code} value={r.id || r.ticket_code} style={{ background: '#0a061a', color: '#fff' }}>
                  #{r.ticket_code} — {r.buyer_name} ({r.quantity || 1}x {r.tier_name || 'Preventa'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Change Meme Button */}
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleNextMeme}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#fff',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
            title="Cambiar el meme que aparece en el boleto"
          >
            <span>🎲</span>
            <span>Meme ({selectedMemeIndex + 1}/{MEMES.length})</span>
          </button>

          {/* If attendee mode, direct WhatsApp Ticket Generation action */}
          {previewMode === 'attendee' && selectedReservation && onOpenTicketGenerator && (
            <button
              type="button"
              onClick={() => onOpenTicketGenerator(selectedReservation)}
              style={{
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.25) 0%, rgba(0, 240, 255, 0.25) 100%)',
                border: '1px solid #25d366',
                color: '#25d366',
                borderRadius: '8px',
                padding: '0.35rem 0.65rem',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Abrir generador oficial de boleto QR para enviar por WhatsApp"
            >
              <span>🎟️</span>
              <span>Enviar QR</span>
            </button>
          )}
        </div>
      </div>

      {/* The Actual Digital Ticket Pass Card */}
      <div
        className="ticket-pass"
        style={{
          maxWidth: '100%',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          position: 'relative',
        }}
      >
        {/* Pass Header */}
        <div className="ticket-pass-header" style={{ padding: '1rem 1.25rem' }}>
          <div className="ticket-pass-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <img
              src="/assets/img/el-quilombo-logo.png"
              alt="El Quilombo"
              className="ticket-pass-logo"
              style={{ height: '32px', width: 'auto', display: 'block' }}
            />
          </div>
          <div
            className="ticket-pass-badge"
            style={{
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(139, 23, 245, 0.25) 100%)',
              border: '1px solid var(--border-neon-purple)',
              color: 'var(--neon-purple-light)',
              fontWeight: 800,
              fontSize: '0.72rem',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {settings.ticketSubtitle || 'ARGENTO PARTY'}
          </div>
        </div>

        {/* Pass Body */}
        <div className="ticket-pass-body" style={{ padding: '1.25rem', gap: '1rem' }}>
          {/* Attendee Personalized Header */}
          <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--neon-purple-light)', fontWeight: 800 }}>
              PREVENTA OFICIAL VALIDADA
            </span>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 900, color: '#fff', margin: '0.2rem 0' }}>
              {ticketData.buyerName}
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              Tu lugar está asegurado para la noche más picante de Valencia 🔥
            </span>
          </div>

          {/* Payment Status Pill */}
          <div
            style={{
              textAlign: 'center',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background:
                ticketData.status === 'paid'
                  ? 'rgba(37, 211, 102, 0.15)'
                  : ticketData.status === 'cash'
                  ? 'rgba(0, 229, 255, 0.15)'
                  : 'rgba(255, 214, 0, 0.15)',
              border: `1px solid ${
                ticketData.status === 'paid'
                  ? '#25d366'
                  : ticketData.status === 'cash'
                  ? 'var(--neon-cyan)'
                  : '#ffd600'
              }`,
              color:
                ticketData.status === 'paid'
                  ? '#25d366'
                  : ticketData.status === 'cash'
                  ? 'var(--neon-cyan)'
                  : '#ffd600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{ticketData.status === 'paid' ? '✓' : ticketData.status === 'cash' ? '💵' : '⏳'}</span>
            <span>
              {ticketData.status === 'paid'
                ? 'ENTRADA VALIDADA (PAGO CONFIRMADO)'
                : ticketData.status === 'cash'
                ? 'PAGO EN EFECTIVO COMPROMETIDO (PAGAR EN PUERTA)'
                : 'RESERVA PENDIENTE DE VALIDACIÓN'}
            </span>
          </div>

          {/* Full-Width Viral Meme Showcase */}
          <div
            className={`meme-fullwidth-showcase ${currentMeme.animationClass}`}
            style={{
              width: '100%',
              background: 'linear-gradient(180deg, #130d2a 0%, #090616 100%)',
              border: `2px solid ${currentMeme.borderColor || '#a855f7'}`,
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 20px ${currentMeme.accentGlow || 'rgba(168, 85, 247, 0.35)'}`,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Top Meme Header Bar with Logo in Top-Left */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.85rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <img
                  src="/assets/img/el-quilombo-logo.png"
                  alt="El Quilombo"
                  style={{
                    height: '28px',
                    width: 'auto',
                    display: 'block',
                    filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.8))',
                  }}
                />
                <span
                  style={{
                    fontSize: '0.64rem',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b17f5 100%)',
                    color: '#ffffff',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 900,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                  }}
                >
                  MEME OFICIAL
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {currentMeme.emoji} {currentMeme.name}
              </span>
            </div>

            {/* Meme Image Container */}
            <div
              style={{
                width: '100%',
                background: '#05040a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                minHeight: '180px',
                maxHeight: '300px',
              }}
            >
              <img
                src={currentMeme.imageUrl}
                alt={currentMeme.name}
                loading="eager"
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '300px',
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </div>

            {/* Punchline Banner */}
            <div
              style={{
                padding: '0.75rem 0.85rem',
                background: 'linear-gradient(180deg, rgba(20, 15, 38, 0.98) 0%, rgba(10, 8, 20, 0.98) 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  fontStyle: 'italic',
                  color: '#ffffff',
                  lineHeight: 1.35,
                }}
              >
                &ldquo;{currentMeme.tagline}&rdquo;
              </div>
            </div>
          </div>

          {/* Ticket Information Grid */}
          <div className="ticket-info-grid" style={{ gap: '0.85rem' }}>
            <div className="ticket-info-item">
              <span className="t-label">Titular de la Entrada</span>
              <span className="t-value" style={{ fontSize: '0.95rem' }}>{ticketData.buyerName}</span>
            </div>
            <div className="ticket-info-item">
              <span className="t-label">Cédula / DNI</span>
              <span className="t-value" style={{ fontSize: '0.95rem' }}>{ticketData.buyerDni}</span>
            </div>

            <div className="ticket-info-item">
              <span className="t-label">Fecha &amp; Hora</span>
              <span className="t-value" style={{ color: 'var(--neon-cyan)', fontWeight: 800, fontSize: '0.95rem' }}>
                {settings.eventDate}
              </span>
            </div>
            <div className="ticket-info-item">
              <span className="t-label">Tipo de Boleto</span>
              <span className="t-value neon-highlight" style={{ fontSize: '0.95rem' }}>
                {ticketData.tierName}
              </span>
            </div>

            <div className="ticket-info-item" style={{ gridColumn: 'span 2' }}>
              <span className="t-label">Lugar del Evento</span>
              <span className="t-value" style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>
                {settings.venueName}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.1rem' }}>
                {settings.venueAddress}
              </span>
            </div>

            <div className="ticket-info-item">
              <span className="t-label">Total de la Orden</span>
              <span className="t-value neon-highlight" style={{ fontSize: '0.95rem' }}>
                ${ticketData.totalUSD} USD
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                Ref: Bs. {ticketData.totalRefBs}
              </span>
            </div>

            <div className="ticket-info-item">
              <span className="t-label">Método de Pago</span>
              <span className="t-value" style={{ color: '#fff', fontSize: '0.88rem' }}>
                {ticketData.paymentMethod}
              </span>
            </div>

            {/* Song for DJ */}
            <div className="ticket-info-item" style={{ gridColumn: 'span 2', background: 'rgba(255, 255, 255, 0.02)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span className="t-label" style={{ color: '#c084fc' }}>🎧 Canción Pedida al DJ:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                &ldquo;{ticketData.favoriteArtist}&rdquo;
              </span>
            </div>

            {/* Acquisition Channel */}
            <div className="ticket-info-item" style={{ gridColumn: 'span 2' }}>
              <span className="t-label" style={{ color: '#f472b6' }}>📣 ¿Cómo nos conoció?:</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f472b6' }}>
                {ticketData.referralSource}
              </span>
            </div>
          </div>

          {/* Perforation Cutouts */}
          <div className="ticket-perforation">
            <div className="perforation-line" />
          </div>

          {/* QR Code Canvas & Booking Code */}
          <div className="ticket-qr-section" style={{ padding: '1rem' }}>
            <div className="qr-canvas-box" style={{ padding: '6px', background: '#fff', borderRadius: '10px' }}>
              <canvas ref={canvasRef} style={{ width: '92px', height: '92px', display: 'block' }} />
            </div>

            <div className="ticket-code-info">
              <span className="t-label">Código Único de Reserva</span>
              <span className="ticket-code-num" style={{ fontSize: '1.1rem', color: '#ffd600' }}>
                #{ticketData.ticketCode}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textAlign: 'right', marginTop: '4px', maxWidth: '190px', lineHeight: 1.3 }}>
                {settings.ticketDoorInstructions}
              </span>
            </div>
          </div>

          {/* Official WhatsApp Banner */}
          <div
            style={{
              padding: '0.55rem 0.85rem',
              background: 'rgba(37, 211, 102, 0.12)',
              border: '1px solid rgba(37, 211, 102, 0.3)',
              borderRadius: '10px',
              fontSize: '0.74rem',
              color: '#25d366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 700,
            }}
          >
            <span>WhatsApp Oficial para Pagos:</span>
            <strong>+{settings.officialWhatsapp}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
