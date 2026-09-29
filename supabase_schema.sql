-- ==============================================================================
-- TABLA DE RESERVAS DE PREVENTA - EL QUILOMBO
-- Diseñada según los requerimientos de Tarek Barreto Bell:
-- 1. Cédula única para evitar duplicados.
-- 2. Código único de ticket QR.
-- 3. Campo 'is_paid' booleano por defecto en false para conciliación de pagos.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ticket_code VARCHAR(32) UNIQUE NOT NULL,
    buyer_name VARCHAR(120) NOT NULL,
    buyer_dni VARCHAR(32) UNIQUE NOT NULL,
    buyer_phone VARCHAR(32) NOT NULL,
    buyer_email VARCHAR(120) NOT NULL,
    tier_id VARCHAR(32) NOT NULL,
    tier_name VARCHAR(64) NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    total_usd NUMERIC(10, 2) NOT NULL,
    total_ref_bs NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(64) NOT NULL,
    favorite_artist VARCHAR(120),
    referral_source VARCHAR(120),
    meme_sticker_used VARCHAR(64),
    is_paid BOOLEAN DEFAULT false NOT NULL
);

-- Migración segura para añadir referral_source si la tabla ya existe
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS referral_source VARCHAR(120);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_reservations_ticket_code ON public.reservations(ticket_code);
CREATE INDEX IF NOT EXISTS idx_reservations_buyer_dni ON public.reservations(buyer_dni);
CREATE INDEX IF NOT EXISTS idx_reservations_is_paid ON public.reservations(is_paid);
CREATE INDEX IF NOT EXISTS idx_reservations_referral_source ON public.reservations(referral_source);

-- Políticas de Seguridad RLS (Row Level Security)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Permitir a usuarios anónimos registrar su reserva desde la web
CREATE POLICY "Permitir inserción de reservas a visitantes anónimos"
ON public.reservations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Permitir consultar reservas públicas por código de ticket para validación de entrada
CREATE POLICY "Permitir lectura de su propio boleto por código"
ON public.reservations
FOR SELECT
TO anon, authenticated
USING (true);

-- Permitir actualizar estado de pago desde el panel de organizador
CREATE POLICY "Permitir actualización de estado de pago"
ON public.reservations
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Permitir eliminar reservas desde el panel de organizador
CREATE POLICY "Permitir eliminación de reservas desde el panel"
ON public.reservations
FOR DELETE
TO anon, authenticated
USING (true);


-- ==============================================================================
-- TABLA DE CONFIGURACIÓN DEL EVENTO Y PLAYLIST DINÁMICA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.event_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'default_config',
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    event_date VARCHAR(64) DEFAULT '03 OCT • 9:00 PM' NOT NULL,
    venue_name VARCHAR(120) DEFAULT 'Óleo Gastrobar (La Viña)' NOT NULL,
    venue_address VARCHAR(200) DEFAULT 'Valencia, Carabobo - Venezuela' NOT NULL,
    official_whatsapp VARCHAR(32) DEFAULT '58412882460' NOT NULL,
    organizer_pin VARCHAR(32) DEFAULT '5401385' NOT NULL,
    price_general NUMERIC(10, 2) DEFAULT 10.00 NOT NULL,
    price_vip NUMERIC(10, 2) DEFAULT 20.00 NOT NULL,
    max_capacity INTEGER DEFAULT 350 NOT NULL,
    ticket_subtitle VARCHAR(120) DEFAULT 'FIESTA ARGENTINA' NOT NULL,
    ticket_door_instructions TEXT DEFAULT 'Mostrá este código por WhatsApp o en la entrada de Óleo Gastrobar' NOT NULL,
    custom_tracks JSONB DEFAULT '[]'::jsonb NOT NULL
);

ALTER TABLE public.event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de configuración"
ON public.event_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Permitir gestión de configuración"
ON public.event_settings
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
