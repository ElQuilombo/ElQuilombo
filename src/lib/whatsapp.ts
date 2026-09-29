export interface ExtractedPhone {
  raw: string;
  clean: string; // Dígitos normalizados con código de país para WhatsApp (ej: 584149411274)
  display: string; // Formato legible amigable (ej: 0414-9411274)
}

export interface WhatsappChatOption {
  phone: string;
  display: string;
  url: string;
}

/**
 * Busca números de celular venezolanos (0412, 0414, 0424, 0416, 0426)
 * incluso si están pegados uno tras otro sin espacios (ej: +58414941127404128306973).
 */
function findVenezuelanNumbers(text: string): ExtractedPhone[] {
  const veRegex = /(?:\+?58\s*)?0?(412|414|424|416|426)[\s.-]?(\d{3})[\s.-]?(\d{4})/gi;
  const matches: ExtractedPhone[] = [];

  let match: RegExpExecArray | null;
  while ((match = veRegex.exec(text)) !== null) {
    const rawMatch = match[0];
    const prefix = match[1];
    const mid = match[2];
    const end = match[3];
    const subscriber = `${mid}${end}`;
    const clean = `58${prefix}${subscriber}`;
    const display = `0${prefix}-${subscriber}`;
    matches.push({
      raw: rawMatch,
      clean,
      display,
    });
  }

  return matches;
}

/**
 * Extrae todos los números de teléfono válidos presentes en una cadena.
 * Soporta números separados por '/', ',', '-', 'y', o directamente concatenados.
 */
export function extractPhoneNumbers(rawPhone?: string): ExtractedPhone[] {
  if (!rawPhone) return [];
  const trimmed = rawPhone.trim();
  if (!trimmed) return [];

  const results: ExtractedPhone[] = [];
  const seenDigits = new Set<string>();

  const addPhone = (cleanDigits: string, rawChunk: string, customDisplay?: string) => {
    let clean = cleanDigits;
    if (clean.startsWith('00')) clean = clean.slice(2);
    if (clean.startsWith('0') && clean.length >= 10) {
      clean = '58' + clean.slice(1);
    } else if (!clean.startsWith('58') && clean.length === 10 && (clean.startsWith('4') || clean.startsWith('2'))) {
      clean = '58' + clean;
    }

    if (seenDigits.has(clean)) return;
    seenDigits.add(clean);

    let display = customDisplay;
    if (!display) {
      if (clean.startsWith('58') && clean.length === 12) {
        const prefix = clean.slice(2, 5);
        const rest = clean.slice(5);
        display = `0${prefix}-${rest}`;
      } else {
        display = rawChunk.trim() || clean;
      }
    }

    results.push({
      raw: rawChunk.trim(),
      clean,
      display,
    });
  };

  // 1. Intentar separar por delimitadores comunes
  const delimiterRegex = /[/,;\n|\r]+|\s+(?:y|e|o|and|or)\s+|\s+-\s+/i;
  const parts = trimmed.split(delimiterRegex).map((p) => p.trim()).filter(Boolean);

  if (parts.length > 1) {
    for (const part of parts) {
      const subMatches = findVenezuelanNumbers(part);
      if (subMatches.length > 0) {
        for (const sub of subMatches) {
          addPhone(sub.clean, sub.raw, sub.display);
        }
      } else {
        const onlyDigits = part.replace(/\D/g, '');
        if (onlyDigits.length >= 8) {
          addPhone(onlyDigits, part);
        }
      }
    }
  } else {
    // 2. Si no hay delimitadores explícitos, buscar patrones de números venezolanos (ej: +58414941127404128306973)
    const veMatches = findVenezuelanNumbers(trimmed);
    if (veMatches.length > 0) {
      for (const m of veMatches) {
        addPhone(m.clean, m.raw, m.display);
      }
    } else {
      const onlyDigits = trimmed.replace(/\D/g, '');
      if (onlyDigits.length >= 8) {
        addPhone(onlyDigits, trimmed);
      }
    }
  }

  return results;
}

/**
 * Normaliza y formatea el número principal para la API de WhatsApp.
 * Si el usuario ingresó varios números juntos, toma el primer número válido de forma segura.
 */
export function formatWhatsappPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  const phones = extractPhoneNumbers(rawPhone);
  if (phones.length > 0) {
    return phones[0].clean;
  }
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = '58' + digits.slice(1);
  } else if (!digits.startsWith('58') && digits.length === 10 && (digits.startsWith('4') || digits.startsWith('2'))) {
    digits = '58' + digits;
  }
  return digits;
}

/**
 * Formatea los teléfonos de forma legible y amigable para visualización en pantalla o tablas.
 * Ej: "0414-9411274 / 0412-8306973"
 */
export function formatPhoneDisplay(rawPhone?: string): string {
  if (!rawPhone) return '';
  const phones = extractPhoneNumbers(rawPhone);
  if (phones.length === 0) return rawPhone.trim();
  return phones.map((p) => p.display).join(' / ');
}

/**
 * Genera el enlace oficial universal para abrir el chat de WhatsApp del primer número disponible.
 */
export function getWhatsappChatUrl(rawPhone: string, message?: string): string {
  const phone = formatWhatsappPhone(rawPhone);
  const textParam = message ? `&text=${encodeURIComponent(message)}` : '';
  return `https://api.whatsapp.com/send?phone=${phone}${textParam}`;
}

/**
 * Genera enlaces individuales para cada número de teléfono detectado.
 * Permite contactar a cada persona por separado cuando registraron 2 números en la misma reserva.
 */
export function getAllWhatsappChatUrls(rawPhone?: string, message?: string): WhatsappChatOption[] {
  if (!rawPhone) return [];
  const phones = extractPhoneNumbers(rawPhone);
  const textParam = message ? `&text=${encodeURIComponent(message)}` : '';

  if (phones.length === 0) {
    const single = formatWhatsappPhone(rawPhone);
    if (!single) return [];
    return [
      {
        phone: single,
        display: rawPhone.trim(),
        url: `https://api.whatsapp.com/send?phone=${single}${textParam}`,
      },
    ];
  }

  return phones.map((p) => ({
    phone: p.clean,
    display: p.display,
    url: `https://api.whatsapp.com/send?phone=${p.clean}${textParam}`,
  }));
}

