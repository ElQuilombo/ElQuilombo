'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { TICKET_TIERS, REF_EXCHANGE_RATE } from '../../data/ticketing';
import { TicketTier, TicketOrder } from '../../types/ticket';
import { getRandomMemeSticker } from '../../data/memes';
import { processReservation, checkClientRateLimit, RateLimitStatus } from '../../lib/reservations';
import { getPaymentDetail, getPagoMovilBankingClipboard } from '../../data/payments';

interface TicketingSectionProps {
  onGenerateTicket: (order: TicketOrder) => void;
}

export default function TicketingSection({ onGenerateTicket }: TicketingSectionProps) {
  const [selectedTierId, setSelectedTierId] = useState<'general' | 'vip'>('general');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [rateLimit, setRateLimit] = useState<RateLimitStatus>({ allowed: true, count: 0, remaining: 10, waitMinutes: 0 });
  const [formData, setFormData] = useState({
    name: '',
    dni: '',
    phone: '',
    email: '',
    paymentMethod: 'Pago Móvil',
    favoriteArtist: '',
    referralSource: '',
  });

  // Track and refresh hourly rate limit
  useEffect(() => {
    setRateLimit(checkClientRateLimit());
    const interval = setInterval(() => {
      setRateLimit(checkClientRateLimit());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Restore active cooldown from sessionStorage on mount
  useEffect(() => {
    try {
      const savedTime = sessionStorage.getItem('quilombo_last_reservation');
      if (savedTime) {
        const elapsed = Math.floor((Date.now() - Number(savedTime)) / 1000);
        if (elapsed < 10) {
          setCooldownSeconds(10 - elapsed);
        }
      }
    } catch (e) {}
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const startCooldown = () => {
    setCooldownSeconds(10);
    try {
      sessionStorage.setItem('quilombo_last_reservation', Date.now().toString());
    } catch (e) {}
  };

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const FAH_AUDIO_SRC = '/assets/audio/fah.mp3?v=2';
  const fahAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const audio = new Audio(FAH_AUDIO_SRC);
      audio.preload = 'auto';
      fahAudioRef.current = audio;
    } catch (e) {}
  }, []);

  const playFahSound = () => {
    try {
      if (fahAudioRef.current) {
        fahAudioRef.current.currentTime = 0;
        fahAudioRef.current.volume = 1.0;
        const playPromise = fahAudioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[Ticketing] Audio play failed:', err);
          });
        }
      } else {
        const audio = new Audio(FAH_AUDIO_SRC);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch (e) {
      console.warn('[Ticketing] Audio error:', e);
    }
  };

  const [bcvRate, setBcvRate] = useState<number>(REF_EXCHANGE_RATE);
  const [isRateLive, setIsRateLive] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/bcv')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.rate && typeof data.rate === 'number' && data.rate > 0) {
          setBcvRate(data.rate);
          setIsRateLive(Boolean(data.isLive));
        }
      })
      .catch((err) => {
        console.warn('[Ticketing] Error fetching live BCV rate:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedTier: TicketTier = TICKET_TIERS[selectedTierId];
  const totalUSD = selectedTier.priceUSD * quantity;
  const rawTotalBs = totalUSD * bcvRate;
  const totalRefBs = rawTotalBs.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedBcvRate = bcvRate.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleQtyChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      return Math.min(Math.max(next, 1), 10);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownSeconds > 0) {
      alert(`Por favor esperá ${cooldownSeconds} segundos antes de realizar otra reserva.`);
      return;
    }

    const currentLimit = checkClientRateLimit();
    if (!currentLimit.allowed) {
      alert(
        `⚠️ Por motivos de seguridad, no se pueden enviar más de 10 reservas en la misma hora. Por favor intentá nuevamente en ${currentLimit.waitMinutes} minuto(s).`
      );
      return;
    }

    if (!formData.name.trim() || !formData.dni.trim() || !formData.phone.trim()) {
      alert('Por favor completá los campos obligatorios (Nombre, Cédula y WhatsApp).');
      return;
    }

    if (!formData.referralSource) {
      alert('Por favor indicanos cómo te enteraste de nosotros para continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const meme = getRandomMemeSticker();

      // Trigger viral sound effect and confetti
      playFahSound();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b17f5', '#a855f7', '#00f0ff', '#ffd600', '#ffffff'],
      });

      const result = await processReservation(
        {
          tier: selectedTier,
          quantity,
          buyerName: formData.name.trim(),
          buyerDni: formData.dni.trim(),
          buyerPhone: formData.phone.trim(),
          buyerEmail: formData.email.trim(),
          paymentMethod: formData.paymentMethod,
          favoriteArtist: formData.favoriteArtist.trim() || 'Milo J / Trueno',
          referralSource: formData.referralSource || 'Otro',
          totalUSD,
          totalRefBs,
        },
        meme
      );

      const finalOrder: TicketOrder = {
        ...result.order,
        meme,
        isExisting: result.isExisting,
        noticeMessage: result.message,
      };

      onGenerateTicket(finalOrder);
      startCooldown();
      setRateLimit(checkClientRateLimit());
    } catch (err: any) {
      console.error('[Ticketing] Error creating reservation:', err);
      alert(err?.message || 'Ocurrió un inconveniente al procesar tu reserva. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="section ticketing-section" id="entradas">
      <div className="container">
        <div className="section-header">
          <span className="section-pill">Fase de Preventa Oficial</span>
          <h2 className="section-title">
            ELEGÍ TU <span className="text-gradient">TIPO DE ENTRADA</span>
          </h2>
          <p className="section-subtitle">
            Entradas limitadas para el <strong>Viernes 09 de Octubre en Rock &amp; Riff</strong>. Asegurá tu preventa a $10 USD antes de que suba a $15 USD en puerta.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="pricing-grid">
          {/* General Pass */}
          <div
            className="ticket-card popular selected"
            data-tier="general"
          >
            <div className="badge-popular" style={{ background: '#8b17f5' }}>🔥 PREVENTA OFICIAL (AHORRO $5)</div>
            <div className="ticket-header">
              <h3 className="ticket-name">{TICKET_TIERS.general.name}</h3>
              <div className="ticket-sub">⚡ Preventa Limitada ($15 en puerta)</div>
            </div>
            <div className="ticket-price-box">
              <span className="ticket-currency">$</span>
              <span className="ticket-amount">{TICKET_TIERS.general.priceUSD}</span>
              <span className="ticket-period">USD</span>
            </div>
            <ul className="ticket-features">
              {TICKET_TIERS.general.features.map((feat, idx) => (
                <li key={idx} className="ticket-feature-item">
                  <span className="check">✓</span> <span>{feat}</span>
                </li>
              ))}
            </ul>
            <a
              href="#reserva"
              className="btn-select-tier"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✓ Pase Seleccionado
            </a>
          </div>
        </div>

        {/* Reservation Box */}
        <div className="reservation-box" id="reserva">
          <div className="res-header">
            <h3 className="res-title">APARTÁ TU ENTRADA EN PREVENTA</h3>
            <p className="res-subtitle">
              Completá tus datos para generar tu <strong>Ticket Digital con Código QR</strong> y confirmar tu reserva directamente por WhatsApp.
            </p>
          </div>

          {/* Live Calculator Bar */}
          <div className="calculator-bar">
            <div className="calc-tier-info">
              <span className="calc-tier-name" id="calc-tier-name">
                {selectedTier.name}
              </span>
              <span className="calc-tier-unit" id="calc-tier-unit">
                ${selectedTier.priceUSD} USD c/u
              </span>
            </div>

            <div className="calc-qty-control">
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                CANTIDAD:
              </span>
              <button
                type="button"
                className="btn-qty"
                id="btn-qty-minus"
                onClick={() => handleQtyChange(-1)}
                disabled={quantity <= 1}
                aria-label="Disminuir cantidad"
              >
                −
              </button>
              <span className="qty-display" id="calc-qty">
                {quantity}
              </span>
              <button
                type="button"
                className="btn-qty"
                id="btn-qty-plus"
                onClick={() => handleQtyChange(1)}
                disabled={quantity >= 10}
                aria-label="Aumentar cantidad"
              >
                +
              </button>
            </div>

            <div className="calc-total-box">
              <div className="calc-total-usd" id="calc-total-usd">
                ${totalUSD} USD
              </div>
              <div className="calc-total-ref" id="calc-total-ref">
                Bs. {totalRefBs}
              </div>
              <div
                id="bcv-rate-indicator"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.74rem',
                  color: isRateLive ? 'var(--neon-cyan)' : 'var(--text-subtle)',
                  marginTop: '0.35rem',
                  fontWeight: 600,
                  letterSpacing: '0.2px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: isRateLive ? '#00f0ff' : '#888',
                    boxShadow: isRateLive ? '0 0 8px #00f0ff' : 'none',
                    flexShrink: 0,
                  }}
                />
                <span>Tasa oficial BCV: Bs. {formattedBcvRate}</span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <form className="res-form" id="reservation-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="buyer-name" className="form-label">
                Nombre y Apellido *
              </label>
              <input
                type="text"
                id="buyer-name"
                className="form-input"
                placeholder="Ej: Santiago Pérez"
                required
                autoComplete="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <span className="form-hint">El nombre que aparecerá en tu boleto digital</span>
            </div>

            <div className="form-group">
              <label htmlFor="buyer-dni" className="form-label">
                Cédula o DNI *
              </label>
              <input
                type="text"
                id="buyer-dni"
                className="form-input"
                placeholder="Ej: V-28123456"
                required
                inputMode="numeric"
                autoComplete="off"
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
              />
              <span className="form-hint">Para verificación de aforo en la puerta</span>
            </div>

            <div className="form-group">
              <label htmlFor="buyer-phone" className="form-label">
                WhatsApp de Contacto *
              </label>
              <input
                type="tel"
                id="buyer-phone"
                className="form-input"
                placeholder="Ej: 0412 1234567"
                required
                autoComplete="tel"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <span className="form-hint">Para enviarte la confirmación y datos de pago</span>
            </div>

            <div className="form-group">
              <label htmlFor="buyer-email" className="form-label">
                Correo Electrónico *
              </label>
              <input
                type="email"
                id="buyer-email"
                className="form-input"
                placeholder="tucorreo@ejemplo.com"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <span className="form-hint">Para respaldo de tu boleto y código QR</span>
            </div>

            <div className="form-group">
              <label htmlFor="buyer-payment" className="form-label">
                Método de Pago *
              </label>
              <select
                id="buyer-payment"
                className="form-select"
                required
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              >
                <option value="Pago Móvil">Pago Móvil (BNC)</option>
                <option value="Zelle">Zelle (USD)</option>
                <option value="Binance Pay (USDT)">Binance Pay (USDT)</option>
                <option value="Efectivo en Rock & Riff">Efectivo en Rock & Riff (USD / Bs)</option>
              </select>
              <span className="form-hint">Al reservar se mostrarán los datos de tu método seleccionado</span>

              {/* Dynamic live payment details preview */}
              {(() => {
                const payDetail = getPaymentDetail(formData.paymentMethod);
                const isPagoMovil = formData.paymentMethod.includes('Pago Móvil');
                const isCash = formData.paymentMethod.toLowerCase().includes('efectivo');

                return (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      background: 'linear-gradient(145deg, rgba(18, 12, 42, 0.95) 0%, rgba(8, 5, 24, 0.98) 100%)',
                      border: `1px solid ${payDetail.accentColor}55`,
                      borderRadius: '14px',
                      padding: '0.85rem 1rem',
                      fontSize: '0.8rem',
                      boxShadow: `0 6px 20px rgba(0, 0, 0, 0.4), 0 0 15px ${payDetail.accentColor}18`,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: '#fff' }}>
                        <span style={{ fontSize: '1.1rem' }}>{payDetail.icon}</span>
                        <span style={{ fontSize: '0.9rem' }}>{payDetail.name}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: payDetail.accentColor,
                          background: `${payDetail.accentColor}18`,
                          border: `1px solid ${payDetail.accentColor}55`,
                          borderRadius: 'var(--radius-pill)',
                          padding: '0.2rem 0.6rem',
                        }}
                      >
                        {payDetail.badge}
                      </span>
                    </div>

                    {/* Calculated Amount Banner */}
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '0.55rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.65rem',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                        {isCash ? 'Monto a pagar en taquilla:' : 'Monto a transferir:'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <strong style={{ fontSize: '1.05rem', color: 'var(--neon-cyan)', fontFamily: 'monospace' }}>
                          {isPagoMovil
                            ? `Bs. ${totalRefBs}`
                            : formData.paymentMethod.includes('Binance')
                            ? `${totalUSD} USDT`
                            : isCash
                            ? `$${totalUSD} USD (o Bs. ${totalRefBs})`
                            : `$${totalUSD} USD`}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            const val = isPagoMovil
                              ? totalRefBs.replace(/\./g, '').replace(',', '.').trim()
                              : String(totalUSD);
                            handleCopy(val, 'preview_monto');
                          }}
                          style={{
                            background: copiedField === 'preview_monto' ? '#25d366' : 'rgba(0, 229, 255, 0.12)',
                            border: copiedField === 'preview_monto' ? '1px solid #25d366' : '1px solid rgba(0, 229, 255, 0.3)',
                            color: copiedField === 'preview_monto' ? '#000' : 'var(--neon-cyan)',
                            borderRadius: '5px',
                            padding: '0.2rem 0.45rem',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedField === 'preview_monto' ? '✓' : '📋 Copiar'}
                        </button>
                      </div>
                    </div>

                    {/* ⚡ Quick 1-Click Banking Copy Button for Pago Móvil */}
                    {isPagoMovil && (
                      <div style={{ marginBottom: '0.65rem' }}>
                        <button
                          type="button"
                          id="btn-copy-pagomovil-preview"
                          onClick={() => handleCopy(getPagoMovilBankingClipboard(totalRefBs), 'preview_pago_movil_banco')}
                          style={{
                            width: '100%',
                            background: copiedField === 'preview_pago_movil_banco'
                              ? 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)'
                              : 'linear-gradient(135deg, rgba(0, 229, 255, 0.22) 0%, rgba(135, 52, 216, 0.3) 100%)',
                            border: copiedField === 'preview_pago_movil_banco' ? '1px solid #25d366' : '1px solid var(--neon-cyan)',
                            color: '#ffffff',
                            fontFamily: 'var(--font-title)',
                            fontWeight: 900,
                            fontSize: '0.82rem',
                            padding: '0.6rem 0.8rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.45rem',
                            boxShadow: '0 3px 12px rgba(0, 240, 255, 0.2)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <span>{copiedField === 'preview_pago_movil_banco' ? '✓' : '⚡'}</span>
                          <span>
                            {copiedField === 'preview_pago_movil_banco'
                              ? '¡Datos copiados para tu banco!'
                              : 'Copiar todos los datos con monto (para el Banco)'}
                          </span>
                        </button>
                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.3rem' }}>
                          💡 Copia Banco (0191), Cédula, Teléfono y Monto exacto para pegar directo en tu app de banco.
                        </span>
                      </div>
                    )}

                    {/* 📍 Quick Google Maps Location Button for Cash */}
                    {isCash && (
                      <div style={{ marginBottom: '0.65rem' }}>
                        <a
                          href="https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8"
                          target="_blank"
                          rel="noopener noreferrer"
                          id="btn-location-rocknriff-preview"
                          style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.18) 0%, rgba(139, 23, 245, 0.25) 100%)',
                            border: '1px solid var(--neon-cyan)',
                            color: '#ffffff',
                            fontFamily: 'var(--font-title)',
                            fontWeight: 900,
                            fontSize: '0.82rem',
                            padding: '0.6rem 0.8rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.45rem',
                            boxShadow: '0 3px 12px rgba(0, 240, 255, 0.15)',
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <span>📍</span>
                          <span>Ver Ubicación de Rock &amp; Riff en Google Maps</span>
                        </a>
                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.3rem' }}>
                          💡 Rock &amp; Riff (antiguo Oleo Gastrobar, El Viñedo). Pagás en efectivo al llegar el 09 de octubre.
                        </span>
                      </div>
                    )}

                    {/* Fields List with Individual Copy */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#cbd5e1', fontSize: '0.76rem' }}>
                      {payDetail.fields.map((f, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            padding: '0.35rem 0.55rem',
                            borderRadius: '6px',
                          }}
                        >
                          <span style={{ color: 'var(--text-subtle)' }}>{f.label}:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <strong style={{ color: '#fff', fontFamily: f.copyable ? 'monospace' : 'inherit' }}>{f.value}</strong>
                            {f.copyable && (
                              <button
                                type="button"
                                onClick={() => handleCopy(f.copyValue || f.value, `field_${idx}`)}
                                style={{
                                  background: copiedField === `field_${idx}` ? '#25d366' : 'rgba(255, 255, 255, 0.08)',
                                  border: copiedField === `field_${idx}` ? '1px solid #25d366' : '1px solid rgba(255, 255, 255, 0.15)',
                                  color: copiedField === `field_${idx}` ? '#000' : '#fff',
                                  borderRadius: '4px',
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {copiedField === `field_${idx}` ? '✓' : '📋'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {payDetail.note && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#fbbf24', lineHeight: 1.35 }}>
                          {payDetail.note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="form-group form-full">
              <label htmlFor="buyer-artist" className="form-label">
                ¿Qué tema o artista argentino no puede faltar en la fiesta? 🗣️
              </label>
              <input
                type="text"
                id="buyer-artist"
                className="form-input"
                placeholder="Ej: Milo J - Rara Vez / Trueno - Dance Crip / Duki"
                value={formData.favoriteArtist}
                onChange={(e) => setFormData({ ...formData, favoriteArtist: e.target.value })}
              />
              <span className="form-hint">¡Los temas más pedidos sonarán en vivo!</span>
            </div>

            <div className="form-group form-full">
              <label htmlFor="buyer-referral" className="form-label">
                ¿Cómo te enteraste de nosotros? *
              </label>
              <select
                id="buyer-referral"
                className="form-select"
                required
                value={formData.referralSource}
                onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
              >
                <option value="" disabled>Seleccioná una opción...</option>
                <option value="Instagram">📸 Instagram (Reels, Stories o Anuncios)</option>
                <option value="TikTok">🎵 TikTok (@belleamar_ o Para Ti)</option>
                <option value="Amigos / Recomendación">🗣️ Amigos / Recomendación (Boca a boca)</option>
                <option value="WhatsApp">💬 WhatsApp (Estados o Grupos)</option>
                <option value="Rock & Riff">🎸 Rock & Riff (En el local)</option>
                <option value="Carteles / Flyers">📄 Carteles / Flyers en la calle</option>
                <option value="Otro">✨ Otro medio</option>
              </select>
              <span className="form-hint">¡Queremos saber cómo llegaste a la fiesta!</span>
            </div>

            <div className="form-full">
              {(() => {
                const isRateLimited = !rateLimit.allowed;
                const isDisabled = isSubmitting || cooldownSeconds > 0 || isRateLimited;

                return (
                  <>
                    <button
                      type="submit"
                      id="btn-submit-reservation"
                      className="btn-checkout"
                      disabled={isDisabled}
                      style={
                        isDisabled && !isSubmitting
                          ? {
                              opacity: 0.65,
                              cursor: 'not-allowed',
                              filter: 'grayscale(0.4)',
                              transform: 'none',
                              boxShadow: 'none',
                            }
                          : undefined
                      }
                    >
                      {isSubmitting ? (
                        <span>⚡ Registrando Reserva...</span>
                      ) : isRateLimited ? (
                        <span>🔒 Límite de 10 reservas por hora alcanzado</span>
                      ) : cooldownSeconds > 0 ? (
                        <span>⏳ Esperá {cooldownSeconds}s para otra reserva</span>
                      ) : (
                        <>
                          <span>⚡ Reservar y Ver Datos de Pago</span>
                          <span>→</span>
                        </>
                      )}
                    </button>

                    {isRateLimited ? (
                      <span
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          marginTop: '0.45rem',
                          fontSize: '0.74rem',
                          color: '#f87171',
                          fontWeight: 600,
                        }}
                      >
                        🔒 Por seguridad, se ha alcanzado el límite de 10 reservas en la misma hora. Podrás reservar nuevamente en {rateLimit.waitMinutes} minuto(s).
                      </span>
                    ) : cooldownSeconds > 0 ? (
                      <span
                        style={{
                          display: 'block',
                          textAlign: 'center',
                          marginTop: '0.45rem',
                          fontSize: '0.74rem',
                          color: '#ffd600',
                          fontWeight: 600,
                        }}
                      >
                        ⏳ Por seguridad, por favor esperá {cooldownSeconds} segundos antes de apartar una nueva entrada.
                      </span>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
