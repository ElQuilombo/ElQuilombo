'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { TicketOrder } from '../../types/ticket';
import { OFFICIAL_WHATSAPP_NUMBER, ORGANIZERS_NAME, ORGANIZERS_PHONE, ORGANIZERS_PHONE_FORMATTED } from '../../data/ticketing';
import { MemeSticker, getRandomMemeSticker } from '../../data/memes';
import { exportStoryVideo, exportStoryGif } from '../../lib/storyVideoExporter';
import { formatWhatsappPhone, getWhatsappChatUrl, getAllWhatsappChatUrls, formatPhoneDisplay } from '../../lib/whatsapp';
import { getPaymentDetail, getPagoMovilBankingClipboard } from '../../data/payments';

interface TicketQrModalProps {
  order: TicketOrder | null;
  onClose: () => void;
  onOrderUpdated?: (order: TicketOrder) => void;
  isOrganizerView?: boolean;
}

export default function TicketQrModal({ order, onClose, onOrderUpdated, isOrganizerView = false }: TicketQrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ticketRef = useRef<HTMLDivElement | null>(null);
  const memeCardRef = useRef<HTMLDivElement | null>(null);

  // Local state for active meme and order
  const [currentMeme, setCurrentMeme] = useState<MemeSticker | null>(null);
  const [currentOrder, setCurrentOrder] = useState<TicketOrder | null>(null);

  // Export states
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [isExportingGif, setIsExportingGif] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isSharingInstagram, setIsSharingInstagram] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  const handleClose = () => {
    setCurrentOrder(null);
    setCurrentMeme(null);
    onClose();
  };

  // Synchronize with parent order
  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      setCurrentMeme(order.meme || getRandomMemeSticker());
    } else {
      setCurrentOrder(null);
      setCurrentMeme(null);
    }
  }, [order]);

  // Support ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // QR Code Rendering
  useEffect(() => {
    if (!currentOrder || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 260;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    let seed = 0;
    const code = currentOrder.ticketCode;
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
  }, [currentOrder]);

  if (!order || !currentOrder || !currentMeme) return null;

  const isApproved = Boolean(currentOrder.isPaid);
  const isCashCommitted =
    currentOrder.paymentStatus === 'cash' ||
    currentOrder.tier?.id === 'cash' ||
    currentOrder.tier?.id === 'efectivo' ||
    Boolean(currentOrder.paymentMethod?.toLowerCase().includes('efectivo'));
  const showQrSection = isApproved || isCashCommitted || Boolean(isOrganizerView);

  const whatsappNumber = OFFICIAL_WHATSAPP_NUMBER;
  const memeText = `Meme: ${currentMeme.name} ("${currentMeme.tagline}")`;

  // Pre-filled WhatsApp message for Organizers (Payment Coordination & Approval)
  const organizersMessage = isCashCommitted
    ? `⚡ *RESERVA EN EFECTIVO - EL QUILOMBO* 💵🇦🇷🔥
¡Hola organizadores de El Quilombo! Acabo de apartar mi preventa para pagar en efectivo en taquilla:

🎫 *Código de Reserva:* #${currentOrder.ticketCode}
👤 *Titular:* ${currentOrder.buyerName}
🪪 *Cédula/DNI:* ${currentOrder.buyerDni}
📱 *WhatsApp:* ${currentOrder.buyerPhone}
📧 *Email:* ${currentOrder.buyerEmail}
🎟️ *Entradas:* ${currentOrder.quantity}x ${currentOrder.tier.name}
💵 *Monto en Efectivo a Pagar en Puerta:* $${currentOrder.totalUSD} USD (o Ref: Bs. ${currentOrder.totalRefBs})
💳 *Método de pago:* Efectivo en Rock & Riff
🎶 *Tema pedido:* ${currentOrder.favoriteArtist}
🎯 *${memeText}*

Ya cuento con mi código de reserva generado. Llevo el monto en efectivo el día del evento en taquilla para ingresar. ¡Muchas gracias! 🔥`
    : `⚡ *RESERVA Y PAGO - EL QUILOMBO* 💜
¡Hola organizadores de El Quilombo! Acabo de apartar mi preventa 🇦🇷🔥:

🎫 *Código de Reserva:* #${currentOrder.ticketCode}
👤 *Titular:* ${currentOrder.buyerName}
🪪 *Cédula/DNI:* ${currentOrder.buyerDni}
📱 *WhatsApp:* ${currentOrder.buyerPhone}
📧 *Email:* ${currentOrder.buyerEmail}
🎟️ *Entradas:* ${currentOrder.quantity}x ${currentOrder.tier.name}
💰 *Total a transferir:* $${currentOrder.totalUSD} USD (Ref: Bs. ${currentOrder.totalRefBs})
💳 *Método de pago:* ${currentOrder.paymentMethod}
🎶 *Tema pedido:* ${currentOrder.favoriteArtist}
🎯 *${memeText}*

Ya cuento con los datos de pago (${currentOrder.paymentMethod}). Les adjunto aquí el comprobante para validar mi entrada y activar mi boleto QR. ¡Muchas gracias!`;

  const waOrganizersUrl = getWhatsappChatUrl(ORGANIZERS_PHONE, organizersMessage);

  const handleWhatsappOrganizersClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Permite navegación nativa universal hacia WhatsApp
  };

  const buyerFormattedPhone = formatWhatsappPhone(currentOrder.buyerPhone);
  const targetPhone = isOrganizerView ? buyerFormattedPhone : formatWhatsappPhone(whatsappNumber);

  const waApprovedOrganizerMessage = isCashCommitted
    ? `🎟️ *¡TU ENTRADA ESTÁ RESERVADA (PAGO EN EFECTIVO)! - EL QUILOMBO* 🇦🇷🔥
¡Hola ${currentOrder.buyerName}! Tu preventa ha sido asegurada por el equipo de El Quilombo 💜

🎟️ *Entrada:* ${currentOrder.quantity}x ${currentOrder.tier.name}
🪪 *Titular:* ${currentOrder.buyerName} (${currentOrder.buyerDni})
🔢 *Código Único de Acceso:* #${currentOrder.ticketCode}
💵 *Monto en Efectivo Comprometido:* $${currentOrder.totalUSD} USD (Ref: Bs. ${currentOrder.totalRefBs})
📍 *Lugar:* Rock & Riff (La Viña) - antiguo Oleo Gastrobar (asi aparece en google)
🗺️ *Ubicación / Cómo llegar:* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8
🗓️ *Fecha:* Viernes 09 de Octubre • 8:00 PM

*(Te adjunto aquí tu boleto oficial con código QR generado en el sistema).*
⚠️ *Recuerda tener preparado tu monto exacto en efectivo al llegar a la puerta.*
¡Presentalo al llegar y preparate para la fiesta más picante de Valencia! 🇦🇷🔥`
    : `🎉 *¡TU ENTRADA HA SIDO APROBADA! - EL QUILOMBO* 🇦🇷🔥
¡Hola ${currentOrder.buyerName}! Tu preventa ha sido validada y aprobada por el equipo de El Quilombo 💜

🎟️ *Entrada:* ${currentOrder.quantity}x ${currentOrder.tier.name}
🪪 *Titular:* ${currentOrder.buyerName} (${currentOrder.buyerDni})
🔢 *Código Único de Acceso:* #${currentOrder.ticketCode}
📍 *Lugar:* Rock & Riff (La Viña) - antiguo Oleo Gastrobar (asi aparece en google)
🗺️ *Ubicación / Cómo llegar:* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8
🗓️ *Fecha:* Viernes 09 de Octubre • 8:00 PM

*(Te adjunto aquí tu boleto oficial con código QR generado en el sistema).*
¡Presentalo al llegar y preparate para la fiesta más picante de Valencia! 🇦🇷🔥`;

  const waClientMessage = isCashCommitted
    ? `⚡ *RESERVA EN EFECTIVO - EL QUILOMBO* 💵🇦🇷🔥
¡Hola equipo de @elquilombo.vzla! Aparté mi preventa para pagar en efectivo en taquilla:

🎫 *Código:* #${currentOrder.ticketCode}
👤 *Titular:* ${currentOrder.buyerName}
🪪 *Cédula/DNI:* ${currentOrder.buyerDni}
📱 *WhatsApp:* ${currentOrder.buyerPhone}
📧 *Email:* ${currentOrder.buyerEmail}
🎟️ *Entradas:* ${currentOrder.quantity}x ${currentOrder.tier.name}
💵 *Total a pagar en efectivo:* $${currentOrder.totalUSD} USD (o Ref: Bs. ${currentOrder.totalRefBs})
💳 *Método de pago:* Efectivo en Rock & Riff
🎶 *Tema/Artista que no puede faltar:* ${currentOrder.favoriteArtist}
🎯 *${memeText}*

¡Nos vemos en Rock & Riff el viernes 09 de octubre! 🇦🇷🔥
📍 *Ubicación (antiguo Oleo Gastrobar):* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8`
    : `⚡ *RESERVA PREVENTA - EL QUILOMBO* 💜
¡Hola equipo de @elquilombo.vzla! Quiero confirmar mi entrada:

🎫 *Código:* #${currentOrder.ticketCode}
👤 *Titular:* ${currentOrder.buyerName}
🪪 *Cédula/DNI:* ${currentOrder.buyerDni}
📱 *WhatsApp:* ${currentOrder.buyerPhone}
📧 *Email:* ${currentOrder.buyerEmail}
🎟️ *Entradas:* ${currentOrder.quantity}x ${currentOrder.tier.name}
💰 *Total a pagar:* $${currentOrder.totalUSD} USD (Ref: Bs. ${currentOrder.totalRefBs})
💳 *Método de pago:* ${currentOrder.paymentMethod}
🎶 *Tema/Artista que no puede faltar:* ${currentOrder.favoriteArtist}
🎯 *${memeText}*

¿Me podrían facilitar los datos para concretar el pago? ¡Nos vemos en Rock & Riff! 🇦🇷🔥
📍 *Ubicación (antiguo Oleo Gastrobar):* https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8`;

  const waMessage = isOrganizerView ? waApprovedOrganizerMessage : waClientMessage;
  const organizerWaLinks = isOrganizerView ? getAllWhatsappChatUrls(currentOrder.buyerPhone, waMessage) : [];
  const waWebUrl = organizerWaLinks[0]?.url || getWhatsappChatUrl(targetPhone, waMessage);

  const handleWhatsappClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!targetPhone) {
      e.preventDefault();
      alert('⚠️ No se encontró un número de teléfono válido para este asistente.');
      return;
    }
  };

  // 1. Export 9:16 Video Story
  const handleExportVideo = async () => {
    setIsExportingVideo(true);
    setExportProgressText('Iniciando grabación...');

    try {
      const res = await exportStoryVideo(
        currentOrder,
        currentMeme,
        '/assets/audio/fah.mp3',
        (pct, txt) => setExportProgressText(`${txt} (${pct}%)`)
      );

      if (!res.success) {
        console.error('Error exporting video:', res.error);
      }
    } catch (err: any) {
      console.error('Error generating video story:', err);
    } finally {
      setIsExportingVideo(false);
      setExportProgressText(null);
    }
  };

  // 2. Export Animated GIF
  const handleExportGif = async () => {
    setIsExportingGif(true);
    setExportProgressText('Generando GIF animado...');

    try {
      const res = await exportStoryGif(currentOrder, currentMeme, (pct, txt) =>
        setExportProgressText(`${txt} (${pct}%)`)
      );
      if (!res.success) {
        console.error('Error generating GIF');
      }
    } catch (err: any) {
      console.error('Error generating GIF:', err);
    } finally {
      setIsExportingGif(false);
      setExportProgressText(null);
    }
  };

  // 3. Export Static PNG
  const handleExportPng = async () => {
    if (!ticketRef.current) return;
    setIsExportingPng(true);

    try {
      const dataUrl = await toPng(ticketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0a0814',
      });

      const link = document.createElement('a');
      link.download = `Boleto_ElQuilombo_${currentOrder.ticketCode}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting story image:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  // 4. Compartir en Instagram (Stories / Feed) - Exporta la imagen del meme con el logo de El Quilombo y la frase
  const handleShareInstagram = async () => {
    const targetElement = memeCardRef.current || ticketRef.current;
    if (!targetElement || !currentMeme) return;
    setIsSharingInstagram(true);

    const shareCaption = `"${currentMeme.tagline}" 🇦🇷🔥 ¡Nos vemos este Viernes 09 de Octubre en El Quilombo (Rock & Riff, Valencia)! @elquilombo.vzla`;

    try {
      const dataUrl = await toPng(targetElement, {
        cacheBust: true,
        pixelRatio: 3, // Ultra alta resolución para Instagram Stories
        backgroundColor: '#0c081e',
      });

      // Convertir dataUrl a Blob y File para Web Share API
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `ElQuilombo_Meme_${currentMeme.id}.png`, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Meme de El Quilombo',
          text: shareCaption,
        });
      } else {
        // Fallback: descargar imagen del meme, copiar texto al portapapeles y abrir Instagram
        const link = document.createElement('a');
        link.download = `ElQuilombo_Meme_${currentMeme.id}.png`;
        link.href = dataUrl;
        link.click();

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(shareCaption);
          } catch (_) {}
        }

        window.open('https://www.instagram.com/', '_blank');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Usuario cerró el diálogo nativo de compartir
      } else {
        console.error('Error sharing on Instagram:', err);
      }
    } finally {
      setIsSharingInstagram(false);
    }
  };

  // -------------------------------------------------------------
  // ORGANIZER QUICK QR PASS VIEW
  // Muestra únicamente la sección del código QR mejorada con
  // botones de Enviar por WhatsApp y Descargar Imagen (PNG)
  // -------------------------------------------------------------
  if (isOrganizerView) {
    return (
      <div
        className="ticket-dialog-wrapper"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflowY: 'auto',
        }}
      >
        {/* Dark Blur Backdrop */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 5, 10, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 1,
          }}
          onClick={handleClose}
        />

        {/* Organizer Ticket Modal Dialog */}
        <dialog
          className="ticket-dialog"
          open
          style={{
            position: 'relative',
            zIndex: 2,
            margin: 'auto',
            border: 'none',
            background: 'transparent',
            padding: 0,
            maxWidth: '460px',
            width: '100%',
          }}
        >
          {/* Official Pass Card To Export (Attached to ticketRef) */}
          <div
            ref={ticketRef}
            style={{
              background: 'linear-gradient(145deg, #140d2e 0%, #080518 100%)',
              border: '1px solid rgba(135, 52, 216, 0.45)',
              borderRadius: '24px',
              padding: '1.5rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 35px rgba(81, 30, 132, 0.35)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top Pass Brand & Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.85rem',
                borderBottom: '1px dashed rgba(255, 255, 255, 0.15)',
                marginBottom: '1.25rem',
              }}
            >
              <img
                src="/assets/img/el-quilombo-logo.png"
                alt="El Quilombo"
                style={{ width: '85px', height: 'auto', display: 'block' }}
              />
              <span
                style={{
                  background: 'rgba(37, 211, 102, 0.15)',
                  border: '1px solid #25d366',
                  color: '#25d366',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                ✓ Pase Oficial Aprobado
              </span>
            </div>

            {/* QR Section (Mejorada & Compacta) */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '1.15rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.1rem',
                marginBottom: '1.15rem',
              }}
            >
              {/* QR Canvas Box */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '8px',
                  borderRadius: '14px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <canvas
                  ref={canvasRef}
                  id="ticket-qr-canvas"
                  style={{ width: '110px', height: '110px', display: 'block' }}
                />
              </div>

              {/* Code and Event Details */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-subtle)',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                  }}
                >
                  CÓDIGO ÚNICO DE RESERVA
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    color: '#ffd600',
                    letterSpacing: '1px',
                    lineHeight: 1.15,
                  }}
                >
                  #{currentOrder.ticketCode}
                </span>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.35, marginTop: '0.2rem' }}>
                  Mostrá este código por WhatsApp o en la entrada de <strong>Rock &amp; Riff</strong>
                </div>
              </div>
            </div>

            {/* Attendee Info Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.65rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '0.85rem 1rem',
                marginBottom: '0.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Titular
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  {currentOrder.buyerName}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Cédula / DNI
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
                  {currentOrder.buyerDni || 'No especificada'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Entradas
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--neon-cyan)' }}>
                  {currentOrder.quantity}x {currentOrder.tier.name}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Fecha &amp; Lugar
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>
                  09 OCT • Rock &amp; Riff
                </div>
              </div>
            </div>

            {/* Event Branding Watermark */}
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.7rem',
                color: 'var(--text-subtle)',
                marginTop: '0.65rem',
              }}
            >
              Verificado por el Equipo Oficial de El Quilombo 🇦🇷🔥
            </div>
          </div>

          {/* Action Buttons (Outside ticketRef so they are NOT in the exported PNG) */}
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {/* 1. Send via WhatsApp to Attendee */}
            <a
              href={waWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsappClick}
              id="btn-organizer-send-whatsapp"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                border: 'none',
                color: '#ffffff',
                fontFamily: 'var(--font-title)',
                fontWeight: 900,
                fontSize: '0.95rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                boxShadow: '0 4px 18px rgba(37, 211, 102, 0.35)',
                minHeight: '48px',
                transition: 'transform 0.15s ease',
              }}
            >
              <span>💬 Enviar Boleto por WhatsApp a {currentOrder.buyerName}</span>
              <span>→</span>
            </a>

            {/* 2. Download Image (PNG) */}
            <button
              type="button"
              id="btn-download-organizer-ticket-png"
              onClick={handleExportPng}
              disabled={isExportingPng}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.85) 0%, rgba(0, 240, 255, 0.85) 100%)',
                border: '1px solid var(--border-neon-cyan)',
                color: '#ffffff',
                fontFamily: 'var(--font-title)',
                fontWeight: 800,
                fontSize: '0.92rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                minHeight: '48px',
                boxShadow: '0 4px 16px rgba(0, 240, 255, 0.25)',
              }}
            >
              <span>📸</span>
              <span>{isExportingPng ? 'Generando Imagen PNG...' : 'Descargar Imagen'}</span>
            </button>

            {/* 3. Close Modal */}
            <button
              type="button"
              id="btn-close-organizer-qr-modal"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-subtle)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.5rem',
                textAlign: 'center',
                textDecoration: 'underline',
              }}
            >
              Cerrar Comprobante
            </button>
          </div>
        </dialog>
      </div>
    );
  }

  return (
    <div
      className="ticket-dialog-wrapper"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      {/* Dark Blur Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 5, 10, 0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          zIndex: 1,
        }}
        onClick={handleClose}
      />

      {/* Main Ticket Modal Dialog */}
      <dialog
        className="ticket-dialog"
        open
        style={{
          position: 'relative',
          zIndex: 2,
          margin: 'auto',
          border: 'none',
          background: 'transparent',
          padding: 0,
          maxWidth: '560px',
          width: '100%',
        }}
      >
        <div className="ticket-pass" ref={ticketRef}>
          {/* Notification Alert for existing reservations or organizer view */}
          {(currentOrder.noticeMessage || isOrganizerView) && (
            <div
              className="ticket-notice-alert"
              id="ticket-notice-alert"
              style={{
                background: 'rgba(0, 240, 255, 0.15)',
                borderBottom: '1px solid var(--border-neon-cyan)',
                padding: '0.65rem 1.25rem',
                fontSize: '0.8rem',
                color: 'var(--neon-cyan)',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              ℹ️ {isOrganizerView ? (isCashCommitted ? `💵 Boleto con Pago en Efectivo Comprometido para ${currentOrder.buyerName}` : `Boleto Oficial con QR listo para enviar a ${currentOrder.buyerName}`) : currentOrder.noticeMessage}
            </div>
          )}

          {/* Pass Header */}
          <div className="ticket-pass-header">
            <div className="ticket-pass-brand">
              <img
                src="/assets/img/el-quilombo-logo.png"
                alt="El Quilombo"
                className="ticket-pass-logo"
              />
            </div>
            <button
              type="button"
              id="btn-close-ticket-top"
              aria-label="Cerrar boleto"
              onClick={handleClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                transition: 'all 0.2s',
              }}
            >
              ✕
            </button>
          </div>

          {/* Pass Body */}
          <div className="ticket-pass-body">
            {/* Buyer Personalized Gratitude Header */}
            <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--neon-purple)', fontWeight: 800 }}>
                ¡GRACIAS POR RESERVAR!
              </span>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '0.2rem 0' }}>
                {currentOrder.buyerName.toUpperCase()}
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                Tu lugar está reservado para la noche más picante de Valencia 🔥
              </span>
            </div>

            {/* Cash Committed Badge */}
            {isCashCommitted && (
              <div
                style={{
                  background: 'rgba(0, 229, 255, 0.12)',
                  border: '1px solid var(--neon-cyan)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  color: 'var(--neon-cyan)',
                  textAlign: 'center',
                  marginBottom: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 0 12px rgba(0, 229, 255, 0.2)',
                }}
              >
                <span>💵</span>
                <span>PAGO EN EFECTIVO COMPROMETIDO (PAGAR EN PUERTA)</span>
              </div>
            )}

            {/* Full Width Non-Minimalist Meme Quilombero Showcase */}
            <div
              ref={memeCardRef}
              className={`meme-fullwidth-showcase ${currentMeme.animationClass}`}
              style={{
                width: '100%',
                background: 'linear-gradient(180deg, #130d2a 0%, #090616 100%)',
                border: `2px solid ${currentMeme.borderColor || '#a855f7'}`,
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: `0 12px 36px rgba(0, 0, 0, 0.7), 0 0 25px ${currentMeme.accentGlow || 'rgba(168, 85, 247, 0.45)'}`,
                display: 'flex',
                flexDirection: 'column',
                margin: '0.4rem 0 0.85rem',
                position: 'relative',
              }}
            >
              {/* Top Meme Header Bar with El Quilombo Logo in Top-Left */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.95rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  gap: '0.6rem',
                }}
              >
                {/* Logo El Quilombo in Top-Left Corner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <img
                    src="/assets/img/el-quilombo-logo.png"
                    alt="El Quilombo"
                    style={{
                      height: '34px',
                      width: 'auto',
                      display: 'block',
                      filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8))',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'linear-gradient(135deg, #ec4899 0%, #8b17f5 100%)',
                      color: '#ffffff',
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-pill)',
                      fontWeight: 900,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      boxShadow: '0 2px 8px rgba(236, 72, 153, 0.35)',
                    }}
                  >
                    MEME OFICIAL
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {currentMeme.emoji} {currentMeme.name}
                </span>
              </div>

              {/* Full Width Meme Image */}
              <div
                style={{
                  width: '100%',
                  background: '#05040a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  minHeight: '220px',
                  maxHeight: '380px',
                }}
              >
                <img
                  src={currentMeme.imageUrl}
                  alt={currentMeme.name}
                  loading="eager"
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '380px',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                  }}
                />
              </div>

              {/* Meme Tagline / Punchline Banner */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  background: 'linear-gradient(180deg, rgba(20, 15, 38, 0.98) 0%, rgba(10, 8, 20, 0.98) 100%)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    fontStyle: 'italic',
                    color: '#ffffff',
                    lineHeight: 1.4,
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
                  }}
                >
                  &ldquo;{currentMeme.tagline}&rdquo;
                </div>
              </div>

              {/* Event Watermark Footer for Instagram */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 1rem 0.55rem',
                  background: 'rgba(0, 0, 0, 0.45)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  fontWeight: 700,
                }}
              >
                <span>📍 Viernes 09 OCT • Rock &amp; Riff</span>
                <span style={{ color: 'var(--neon-cyan)', fontWeight: 800 }}>@elquilombo.vzla 🔥</span>
              </div>
            </div>

            {/* Direct Instagram Share Button on Ticket Header */}
            <button
              type="button"
              id="btn-share-instagram-direct"
              onClick={handleShareInstagram}
              disabled={isSharingInstagram}
              style={{
                width: '100%',
                background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                border: 'none',
                color: '#ffffff',
                fontFamily: 'var(--font-title)',
                fontWeight: 900,
                fontSize: '0.95rem',
                padding: '0.85rem 1.25rem',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                boxShadow: '0 6px 22px rgba(220, 39, 67, 0.45)',
                transition: 'all 0.2s ease',
                marginTop: '0.2rem',
                marginBottom: '0.5rem',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>{isSharingInstagram ? 'Generando imagen...' : 'Compartir en Instagram'}</span>
            </button>

            {/* Ticket Info Grid */}
            <div className="ticket-info-grid" style={{ marginTop: '1rem' }}>
              <div className="ticket-info-item">
                <span className="t-label">Titular de la Entrada</span>
                <span className="t-value" id="t-buyer-name">{currentOrder.buyerName}</span>
              </div>
              <div className="ticket-info-item">
                <span className="t-label">Cédula / DNI</span>
                <span className="t-value">{currentOrder.buyerDni}</span>
              </div>
              <div className="ticket-info-item">
                <span className="t-label">Fecha &amp; Hora</span>
                <span className="t-value">09 OCT • 8:00 PM</span>
              </div>
              <div className="ticket-info-item">
                <span className="t-label">Entradas Amparadas</span>
                <span className="t-value neon-highlight" id="t-tier-name">
                  {currentOrder.quantity}x {currentOrder.tier.name}
                </span>
              </div>
              <div className="ticket-info-item">
                <span className="t-label">Lugar del Evento</span>
                <span className="t-value">
                  Rock &amp; Riff (La Viña)
                  <a
                    href="https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      color: 'var(--neon-cyan)',
                      textDecoration: 'underline',
                      marginTop: '0.2rem',
                      fontWeight: 700,
                    }}
                    title="Abrir ubicación en Google Maps"
                  >
                    📍 antiguo Oleo Gastrobar (Google Maps) ↗
                  </a>
                </span>
              </div>
              <div className="ticket-info-item">
                <span className="t-label">Total a Pagar</span>
                <span className="t-value neon-highlight" id="t-total-usd">${currentOrder.totalUSD} USD</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }} id="t-total-ref">
                  (Bs. {currentOrder.totalRefBs})
                </span>
              </div>
            </div>

            {/* Conditional QR Section for Approved/Organizer Pass */}
            {showQrSection && (
              <>
                {/* Perforation Divider Cut */}
                <div className="ticket-perforation">
                  <div className="perforation-line" />
                </div>

                {/* QR & Booking Serial Section */}
                <div className="ticket-qr-section">
                  <div className="qr-canvas-box">
                    <canvas ref={canvasRef} id="ticket-qr-canvas" style={{ width: '100px', height: '100px', display: 'block' }} />
                  </div>
                  <div className="ticket-code-info">
                    <span className="t-label">Código Único de Reserva</span>
                    <span className="ticket-code-num" id="t-code-display">#{currentOrder.ticketCode}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px', maxWidth: '200px' }}>
                      Mostrá este código por WhatsApp o en la entrada de Rock &amp; Riff
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Selected Payment Method Details for Non-Approved / Customer Reservation View */}
            {!showQrSection && (() => {
              const paymentDetail = getPaymentDetail(currentOrder.paymentMethod || 'Pago Móvil');

              return (
                <div
                  style={{
                    marginTop: '1.25rem',
                    background: 'linear-gradient(135deg, rgba(18, 12, 42, 0.96) 0%, rgba(8, 5, 24, 0.98) 100%)',
                    border: `1px solid ${paymentDetail.accentColor}55`,
                    borderRadius: '18px',
                    padding: '1.25rem 1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    textAlign: 'left',
                    boxShadow: `0 8px 30px rgba(0, 0, 0, 0.6), 0 0 20px ${paymentDetail.accentColor}20`,
                  }}
                >
                  {/* Header: Title + Selected Method Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.65rem' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.2px', color: paymentDetail.accentColor, fontWeight: 800 }}>
                        DATOS PARA CONCRETAR TU PAGO
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>{paymentDetail.icon}</span>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                          {paymentDetail.name}
                        </h4>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: paymentDetail.accentColor,
                        background: `${paymentDetail.accentColor}18`,
                        border: `1px solid ${paymentDetail.accentColor}66`,
                        borderRadius: 'var(--radius-pill)',
                        padding: '0.2rem 0.65rem',
                      }}
                    >
                      {paymentDetail.badge}
                    </span>
                  </div>

                  {/* Amount to transfer banner */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '0.75rem 0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                      {isCashCommitted ? 'Monto a pagar en taquilla:' : 'Monto a transferir:'}
                    </span>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--neon-cyan)', fontFamily: 'monospace' }}>
                          {currentOrder.paymentMethod.includes('Pago Móvil')
                            ? `Bs. ${currentOrder.totalRefBs}`
                            : currentOrder.paymentMethod.includes('Binance')
                            ? `${currentOrder.totalUSD} USDT`
                            : isCashCommitted
                            ? `$${currentOrder.totalUSD} USD (o Bs. ${currentOrder.totalRefBs})`
                            : `$${currentOrder.totalUSD} USD`}
                        </span>
                        <button
                          type="button"
                          title="Copiar monto exacto"
                          onClick={() => {
                            const valToCopy = currentOrder.paymentMethod.includes('Pago Móvil')
                              ? currentOrder.totalRefBs.replace(/\./g, '').replace(',', '.').trim()
                              : String(currentOrder.totalUSD);
                            handleCopy(valToCopy, 'Monto');
                          }}
                          style={{
                            background: copiedField === 'Monto' ? '#25d366' : 'rgba(0, 229, 255, 0.12)',
                            border: copiedField === 'Monto' ? '1px solid #25d366' : '1px solid rgba(0, 229, 255, 0.3)',
                            color: copiedField === 'Monto' ? '#000' : 'var(--neon-cyan)',
                            borderRadius: '6px',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <span>{copiedField === 'Monto' ? '✓' : '📋'}</span>
                          <span>{copiedField === 'Monto' ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ⚡ Quick 1-Click Banking Copy Button for Pago Móvil (Format: Banco, CI, Tel, Monto) */}
                  {currentOrder.paymentMethod.includes('Pago Móvil') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <button
                        type="button"
                        id="btn-copy-pagomovil-all"
                        onClick={() => handleCopy(getPagoMovilBankingClipboard(currentOrder.totalRefBs), 'pago_movil_banco')}
                        style={{
                          width: '100%',
                          background: copiedField === 'pago_movil_banco'
                            ? 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)'
                            : 'linear-gradient(135deg, rgba(0, 229, 255, 0.22) 0%, rgba(135, 52, 216, 0.3) 100%)',
                          border: copiedField === 'pago_movil_banco' ? '1px solid #25d366' : '1px solid var(--neon-cyan)',
                          color: '#ffffff',
                          fontFamily: 'var(--font-title)',
                          fontWeight: 900,
                          fontSize: '0.88rem',
                          padding: '0.75rem 0.9rem',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 4px 16px rgba(0, 240, 255, 0.25)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{copiedField === 'pago_movil_banco' ? '✓' : '⚡'}</span>
                        <span>
                          {copiedField === 'pago_movil_banco'
                            ? '¡Datos copiados para pegar en el Banco!'
                            : 'Copiar todos los datos con monto (para el Banco)'}
                        </span>
                      </button>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.35 }}>
                        💡 Incluye Banco (0191), Cédula, Teléfono y Monto listo para la opción <em>&ldquo;Pegar datos&rdquo;</em> de tu app bancaria (BNC, Banesco, BDV, etc.)
                      </span>
                    </div>
                  )}

                  {/* 📍 Quick Google Maps Location Button for Cash */}
                  {isCashCommitted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <a
                        href="https://maps.app.goo.gl/u3Q8guMx3PVEw4Vc8"
                        target="_blank"
                        rel="noopener noreferrer"
                        id="btn-modal-location-rocknriff"
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.18) 0%, rgba(139, 23, 245, 0.25) 100%)',
                          border: '1px solid var(--neon-cyan)',
                          color: '#ffffff',
                          fontFamily: 'var(--font-title)',
                          fontWeight: 900,
                          fontSize: '0.88rem',
                          padding: '0.75rem 0.9rem',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 4px 16px rgba(0, 240, 255, 0.2)',
                          textDecoration: 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>📍</span>
                        <span>Ver Ubicación de Rock &amp; Riff en Google Maps</span>
                      </a>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.35 }}>
                        💡 Rock &amp; Riff (antiguo Oleo Gastrobar, El Viñedo). Pagás en taquilla al llegar el 09 de octubre.
                      </span>
                    </div>
                  )}

                  {/* Payment Credential Fields with 1-Click Copy */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {paymentDetail.fields.map((field, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '0.55rem 0.85rem',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {field.label}
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', wordBreak: 'break-word', fontFamily: field.copyable ? 'monospace' : 'inherit' }}>
                            {field.value}
                          </span>
                        </div>
                        {field.copyable && (
                          <button
                            type="button"
                            onClick={() => handleCopy(field.copyValue || field.value, field.label)}
                            style={{
                              background: copiedField === field.label ? '#25d366' : 'rgba(255, 255, 255, 0.08)',
                              border: copiedField === field.label ? '1px solid #25d366' : '1px solid rgba(255, 255, 255, 0.15)',
                              color: copiedField === field.label ? '#000' : '#fff',
                              borderRadius: '6px',
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span>{copiedField === field.label ? '✓' : '📋'}</span>
                            <span>{copiedField === field.label ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Important Notes & Warnings (e.g. Zelle Concept) */}
                  {paymentDetail.note && (
                    <div
                      style={{
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid rgba(251, 191, 36, 0.35)',
                        borderRadius: '10px',
                        padding: '0.6rem 0.85rem',
                        fontSize: '0.76rem',
                        color: '#fde047',
                        lineHeight: 1.4,
                        fontWeight: 700,
                      }}
                    >
                      {paymentDetail.note}
                    </div>
                  )}

                  {/* WhatsApp Submission Action */}
                  <div style={{ marginTop: '0.35rem', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                      {isCashCommitted
                        ? 'Tu reserva en taquilla está apartada. Podés notificar a los organizadores por WhatsApp o guardar tu boleto:'
                        : 'Al hacer el pago, enviá el capture o referencia a los organizadores para activar tu entrada:'}
                    </p>

                    <a
                      href={waOrganizersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      id="btn-whatsapp-organizers"
                      onClick={handleWhatsappOrganizersClick}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontFamily: 'var(--font-title)',
                        fontWeight: 900,
                        fontSize: '0.92rem',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-pill)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        textDecoration: 'none',
                        boxShadow: '0 4px 18px rgba(37, 211, 102, 0.35)',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span>{isCashCommitted ? '💬 Notificar Reserva en Efectivo por WhatsApp' : '💬 Enviar Comprobante por WhatsApp'}</span>
                      <span>→</span>
                    </a>

                    <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-subtle)', lineHeight: 1.35 }}>
                      {isCashCommitted
                        ? 'Presentá tu código de reserva o boleto con código QR en la entrada de Rock & Riff para pagar e ingresar.'
                        : 'Los organizadores verificarán tu pago y tu boleto oficial con código QR quedará habilitado para el acceso.'}
                    </span>
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Pass Actions Footer (Only for Approved Pass with QR) */}
          {showQrSection && (
            <div className="ticket-pass-footer">
              {exportProgressText && (
                <div style={{ fontSize: '0.82rem', color: 'var(--neon-cyan)', textAlign: 'center', marginBottom: '0.25rem', fontWeight: 700 }}>
                  ⏳ {exportProgressText}
                </div>
              )}

              {/* 1. Share Direct on Instagram */}
              <button
                type="button"
                id="btn-share-instagram-approved"
                onClick={handleShareInstagram}
                disabled={isSharingInstagram || isExportingVideo || isExportingGif || isExportingPng}
                style={{
                  width: '100%',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  border: 'none',
                  color: '#fff',
                  fontFamily: 'var(--font-title)',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 20px rgba(220, 39, 67, 0.45)',
                  transition: 'transform 0.2s',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>{isSharingInstagram ? 'Preparando...' : 'Compartir en Instagram'}</span>
              </button>

              {/* 2. Share / Export Video 9:16 for Instagram Stories */}
              <button
                type="button"
                id="btn-export-story-video"
                onClick={handleExportVideo}
                disabled={isExportingVideo || isExportingGif || isExportingPng || isSharingInstagram}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #8b17f5 0%, #ec4899 100%)',
                  border: 'none',
                  color: '#fff',
                  fontFamily: 'var(--font-title)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(139, 23, 245, 0.35)',
                  transition: 'transform 0.2s',
                }}
              >
                <span>🎬 {isExportingVideo ? 'Generando Video Stories...' : 'Exportar Video Stories (9:16)'}</span>
              </button>

              {/* 3. Secondary Export Options: GIF & PNG */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
                <button
                  type="button"
                  id="btn-export-gif"
                  onClick={handleExportGif}
                  disabled={isExportingVideo || isExportingGif || isExportingPng || isSharingInstagram}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-neon-cyan)',
                    color: 'var(--neon-cyan)',
                    fontFamily: 'var(--font-title)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>🎞️ {isExportingGif ? 'Creando GIF...' : 'Descargar GIF'}</span>
                </button>

                <button
                  type="button"
                  id="btn-export-png"
                  onClick={handleExportPng}
                  disabled={isExportingVideo || isExportingGif || isExportingPng || isSharingInstagram}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-neon-purple)',
                    color: '#fff',
                    fontFamily: 'var(--font-title)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>📸 {isExportingPng ? 'Guardando...' : 'Boleto PNG'}</span>
                </button>
              </div>

              {/* 4. WhatsApp Direct Link(s) */}
              {isOrganizerView && organizerWaLinks.length > 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  {organizerWaLinks.map((link, idx) => (
                    <a
                      key={`qr-wa-${idx}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-whatsapp-confirm"
                      style={{
                        padding: '0.75rem 1rem',
                        fontSize: '0.86rem',
                      }}
                    >
                      <span>
                        💬 Enviar Boleto a WA #{idx + 1} ({link.display})
                      </span>
                      <span>→</span>
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  href={waWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp-confirm"
                  onClick={handleWhatsappClick}
                >
                  <span>
                    {isOrganizerView
                      ? `💬 Enviar Boleto por WhatsApp a ${currentOrder.buyerName}`
                      : isCashCommitted
                      ? '💬 Notificar Reserva en Efectivo por WhatsApp'
                      : '💬 Enviar Comprobante por WhatsApp'}
                  </span>
                  <span>→</span>
                </a>
              )}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
