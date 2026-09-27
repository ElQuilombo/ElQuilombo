'use client';

import React, { useState, useEffect, useRef } from 'react';
import CountdownTimer from './CountdownTimer';
import { useAudioPlayer } from '../../context/AudioPlayerContext';

// Real verified comments extracted directly from the viral TikTok video by @belleamar_ (ID: 7677661590254046482)
const REAL_TIKTOK_COMMENTS = [
  {
    user: '@sugarbite15',
    nickname: 'Jesús Ruiz',
    text: 'NECESITO IRRRR',
    likes: 6,
  },
  {
    user: '@yuxerneim',
    nickname: 'yuxerneim',
    text: 'porfa metan música de bhavi, duki, lit, khea, ysy y neo PORFAVOR',
    likes: 57,
  },
  {
    user: '@daviangely.s',
    nickname: '𝑫𝒂𝒗𝒊🌷',
    text: 'Amiga como que en Valencia y no en Caracas? ya me había ilusionado 😔✋🏻',
    likes: 183,
  },
  {
    user: '@cruelwriter',
    nickname: 'estefany 📚',
    text: 'POR QUÉ TENGO QUE ESTAR EN CARACAS SI ESTE ES LITERALMENTE MI SUEÑO ?????',
    likes: 21,
  },
  {
    user: '@dalessiooo',
    nickname: 'D’Alessio ⟭⟬⁷',
    text: 'La milonista más milonista de Valencia no podrá ir 😔✋🏻',
    likes: 5,
  },
  {
    user: '@andres666.00',
    nickname: '~𝕺𝖇𝖊𝖗𝐲𝖓.🫓🕯️',
    text: 'Milo vas a venir a Venezuela?',
    likes: 62,
  },
  {
    user: '@kaadlv1',
    nickname: 'kaadlv1',
    text: 'Me ilusionaste',
    likes: 71,
  },
  {
    user: '@zizugd',
    nickname: 'zizu',
    text: 'Y pa los larenses??? 🥺',
    likes: 34,
  },
  {
    user: '@soffi_111_',
    nickname: 'sofi',
    text: 'cómo que en Valencia?? 😭😭😭😭',
    likes: 31,
  },
  {
    user: '@lanoviadesaturogojo6',
    nickname: '✪-𝓢𝓪𝓽𝓾𝓻𝓸 𝓖𝓸𝓳𝓸-✪',
    text: 'POR QUÉ TENGO QUE SER MWNOR DE EDAD POR QUÉ',
    likes: 5,
  },
  {
    user: '@mai280827',
    nickname: '🪷Mai🪷',
    text: 'pero si viene Milo o q?',
    likes: 19,
  },
];

interface HeroSectionProps {
  onOpenReel: () => void;
}

export default function HeroSection({ onOpenReel }: HeroSectionProps) {
  const { pauseAudio } = useAudioPlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [commentIndex, setCommentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [tiktokStats, setTiktokStats] = useState({
    views: '140.0K',
    likes: '28.8K',
    comments: '842',
    shares: '4.1K',
  });

  useEffect(() => {
    fetch('/api/tiktok-stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.views) {
          setTiktokStats({
            views: data.views,
            likes: data.likes,
            comments: data.comments,
            shares: data.shares,
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load live TikTok stats:', err);
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCommentIndex((prev) => (prev + 1) % REAL_TIKTOK_COMMENTS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      pauseAudio();
      video.play().then(() => {
        setIsVideoPlaying(true);
      }).catch((err) => {
        console.warn('Video play error:', err);
      });
    } else {
      video.pause();
      setIsVideoPlaying(false);
    }
  };

  const handleVideoCardClick = () => {
    handleTogglePlay();
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const target = Number(e.target.value);
    video.currentTime = target;
    setCurrentTime(target);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFullscreenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (video) {
      if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
        return;
      } else if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => onOpenReel());
        return;
      }
    }
    onOpenReel();
  };

  const currentComment = REAL_TIKTOK_COMMENTS[commentIndex];

  return (
    <section className="hero-section" id="hero">
      <div className="container">
        {/* Top Presenters & Allies: Club Sonrisas, Rock & Riff, ANDY */}
        <div className="hero-sponsor-wrap" aria-label="Aliados y Presentadores">
          <a
            href="https://www.instagram.com/clubsonrisasproject?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw=="
            target="_blank"
            rel="noopener noreferrer"
            className="hero-sponsor-item"
            title="Club Sonrisas • Causa Solidaria (@clubsonrisasproject)"
          >
            <img
              src="/assets/img/club-sonrisas.png"
              alt="Club Sonrisas"
              className="hero-sponsor-logo club-sonrisas"
            />
          </a>

          <span className="hero-sponsor-divider" aria-hidden="true" />

          <a
            href="https://www.instagram.com/rocknriffbar/"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-sponsor-item"
            title="Rock & Riff • Venue Oficial"
          >
            <img
              src="/assets/img/rocknriff.png"
              alt="Rock & Riff Bar"
              className="hero-sponsor-logo rocknriff"
            />
          </a>

          <span className="hero-sponsor-divider" aria-hidden="true" />

          <a
            href="https://www.instagram.com/andrea_calanche/"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-sponsor-item"
            title="ANDY • Diseño Gráfico Oficial"
          >
            <img
              src="/assets/img/andy.png"
              alt="ANDY Diseñadora"
              className="hero-sponsor-logo andy"
            />
          </a>
        </div>

        <div className="hero-grid">
          {/* Left: Hero Copy & Countdown */}
          <div className="hero-content">
            <div className="hero-brand-logo-wrap">
              <img
                src="/assets/img/el-quilombo-logo.png"
                alt="El Quilombo - Fiesta Temática Argentina"
                className="hero-official-logo"
              />
            </div>

            <h1 className="hero-title" style={{ marginTop: '0.75rem' }}>
              <span className="title-sub">⚡ LA FIESTA TEMÁTICA ARGENTINA EN VALENCIA 💜</span>
            </h1>

            <p className="hero-desc">
              La noche donde Valencia se transforma en Buenos Aires. Homenaje oficial a{' '}
              <strong>Milo J, Trueno, Duki, WOS, Dillom, Ca7riel &amp; Paco</strong> y los mayores referentes del trap argentino. Artistas en vivo sorpresa, After Party oficial extendido y dinámicas en tarima.
            </p>

            {/* Poster Price Blocks */}
            <div className="poster-prices-container" style={{ justifyContent: 'flex-start', margin: '1rem 0' }}>
              <div className="poster-price-box highlight">
                <span className="price-label">PREVENTA</span>
                <div className="price-amount">$10 USD</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', fontWeight: 700 }}>Entradas Limitadas</span>
              </div>
              <div className="poster-price-box">
                <span className="price-label" style={{ background: '#4a0e80' }}>EN PUERTA</span>
                <div className="price-amount" style={{ color: '#94a3b8' }}>$15 USD</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Noche del evento</span>
              </div>
            </div>

            {/* Age Restriction Notice */}
            <div className="age-restriction-pill" style={{ marginBottom: '1.25rem' }}>
              <span>PARA MAYORES DE <strong>+15</strong> (SI ES MENOR DEBE IR CON UN REPRESENTANTE)</span>
            </div>

            {/* Live Event Countdown */}
            <CountdownTimer />

            {/* Hero Action Buttons */}
            <div className="hero-actions">
              <a href="#entradas" className="btn-primary">
                <span>🔥 Apartar Preventa $10</span>
                <span>→</span>
              </a>
              <a href="#lineup" className="btn-secondary">
                <span>🎧 Ver Playlist</span>
              </a>
            </div>

            {/* Social Proof */}
            <div className="social-proof">
              <span className="flame">🔥</span>
              <span><strong>+420 personas</strong> ya están activas para el 9 de Octubre en Rock &amp; Riff</span>
            </div>
          </div>

          {/* Right: Interactive Visual Card (Direct TikTok Video & Real FOMO Reactions) */}
          <div className="hero-visual">
            <div className="visual-card">
              {/* Direct Native TikTok Video Player Showcase */}
              <div
                className={`visual-media is-video-active ${isVideoPlaying ? 'video-playing' : ''}`}
                id="hero-visual-media"
                onClick={handleVideoCardClick}
                onMouseEnter={() => setShowControls(true)}
                onMouseLeave={() => isVideoPlaying && setShowControls(false)}
              >
                <video
                  ref={videoRef}
                  src="/assets/video/tiktok-viral-quilombo.mp4"
                  poster="/assets/img/tiktok-cover.jpg"
                  playsInline
                  preload="none"
                  className="hero-inline-video"
                  onPlay={() => {
                    setIsVideoPlaying(true);
                    pauseAudio();
                  }}
                  onPause={() => setIsVideoPlaying(false)}
                  onEnded={() => setIsVideoPlaying(false)}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                />

                {/* Top Badge Overlay */}
                <div className="video-top-badges">
                  <div className="tiktok-viral-tag">
                    <span className="tiktok-logo-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
                      </svg>
                    </span>
                    <span>@belleamar_</span>
                    <span className="live-dot" />
                    <span className="views-highlight">{tiktokStats.views} VISTAS</span>
                  </div>

                  <button
                    type="button"
                    className="video-mute-quick-btn"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
                    title={isMuted ? 'Activar sonido' : 'Silenciar'}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                </div>

                {/* Big Center Play Button Overlay (when paused) */}
                {!isVideoPlaying && (
                  <div className="video-play-center-overlay">
                    <button
                      type="button"
                      className="btn-tiktok-inline-play"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePlay();
                      }}
                      aria-label="Reproducir video de TikTok"
                    >
                      <span className="inline-play-icon">▶</span>
                      <div className="inline-play-info">
                        <span className="inline-play-title">REPRODUCIR TIKTOK</span>
                        <span className="inline-play-sub">Dale click para escuchar</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Bottom Video Controls Bar (visible on hover, tap, or pause) */}
                <div
                  className={`video-bottom-controls-bar ${(!isVideoPlaying || showControls) ? 'visible' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="video-ctrl-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePlay();
                    }}
                    aria-label={isVideoPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    {isVideoPlaying ? '⏸' : '▶'}
                  </button>

                  <span className="video-time-display">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>

                  <div className="video-progress-wrap">
                    <input
                      type="range"
                      min="0"
                      max={duration || 79}
                      step="0.1"
                      value={currentTime}
                      onChange={handleSeek}
                      className="video-seek-slider"
                      aria-label="Barra de progreso de video"
                    />
                    <div
                      className="video-seek-fill"
                      style={{ width: `${(currentTime / (duration || 79)) * 100}%` }}
                    />
                  </div>

                  <button
                    type="button"
                    className="video-ctrl-btn"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
                    title={isMuted ? 'Activar sonido' : 'Silenciar'}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>

                  <button
                    type="button"
                    className="video-ctrl-btn"
                    onClick={handleFullscreenClick}
                    aria-label="Pantalla completa"
                    title="Pantalla completa"
                  >
                    ⛶
                  </button>
                </div>
              </div>

              {/* Real TikTok FOMO Metrics & Verified Comments Panel */}
              <div className="hero-inline-fomo-panel">
                {/* 4 Real Metrics */}
                <div className="tiktok-metrics-strip inline-fomo-metrics">
                  <div className="tiktok-stat">
                    <span className="stat-val">{tiktokStats.views}</span>
                    <span className="stat-lbl">Vistas 👁️</span>
                  </div>
                  <div className="tiktok-stat-sep" />
                  <div className="tiktok-stat">
                    <span className="stat-val">{tiktokStats.likes}</span>
                    <span className="stat-lbl">Likes ❤️</span>
                  </div>
                  <div className="tiktok-stat-sep" />
                  <div className="tiktok-stat">
                    <span className="stat-val">{tiktokStats.comments}</span>
                    <span className="stat-lbl">Comments 💬</span>
                  </div>
                  <div className="tiktok-stat-sep" />
                  <div className="tiktok-stat">
                    <span className="stat-val">{tiktokStats.shares}</span>
                    <span className="stat-lbl">Shares ↗</span>
                  </div>
                </div>

                {/* Real Verified Comments Ticker (Full Text) */}
                <div className="tiktok-live-reaction-card" key={commentIndex}>
                  <div className="reaction-card-header">
                    <div className="reaction-card-user-info">
                      <span className="reaction-user">{currentComment.user}</span>
                      <span className="reaction-nickname">({currentComment.nickname}):</span>
                    </div>
                    {currentComment.likes > 0 && (
                      <span className="reaction-likes">❤️ {currentComment.likes}</span>
                    )}
                  </div>
                  <p className="reaction-text">&ldquo;{currentComment.text}&rdquo;</p>
                </div>

                {/* Action Bar */}
                <div className="hero-video-actions-bar">
                  <button
                    type="button"
                    className="btn-video-fullscreen-action"
                    onClick={handleFullscreenClick}
                    title="Ver en pantalla completa"
                  >
                    <span>⛶ Pantalla Completa</span>
                  </button>
                  <a
                    href="https://www.tiktok.com/@belleamar_/video/7677661590254046482"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-video-tiktok-link"
                    title="Abrir en TikTok"
                  >
                    <span>TikTok ↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
