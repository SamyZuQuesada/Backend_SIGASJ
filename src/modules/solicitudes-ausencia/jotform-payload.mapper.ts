import { BadRequestException } from '@nestjs/common';
import {
  TIPOS_SOLICITUD_AUSENCIA,
  TipoSolicitudAusencia,
} from '../../common/enums/tipo-solicitud-ausencia.enum';

export type JotformFieldMap = {
  correlacion: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
};

export type SolicitudAusenciaWebhookParsed = {
  jotformSubmissionId: string;
  formId: string | null;
  correlacionToken: string;
  tipo: TipoSolicitudAusencia;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const pickString = (
  source: Record<string, unknown>,
  key: string,
): string | undefined => {
  const direct = source[key];
  const asText = asNonEmptyString(direct);
  if (asText) return asText;

  // Jotform a veces anida answers: { q1_tipo: { answer: "..." } }
  const nested = asRecord(direct);
  if (nested) {
    const answer = nested.answer ?? nested.text ?? nested.value;
    const nestedText = asNonEmptyString(answer);
    if (nestedText) return nestedText;
    if (Array.isArray(answer)) {
      const joined = answer
        .filter((item): item is string => typeof item === 'string')
        .join(' ')
        .trim();
      if (joined) return joined;
    }
  }

  const matchKey = Object.keys(source).find(
    (k) =>
      k === key ||
      k.endsWith(`_${key}`) ||
      k.toLowerCase() === key.toLowerCase(),
  );
  if (matchKey && matchKey !== key) {
    return pickString(source, matchKey);
  }
  return undefined;
};

const normalizarFecha = (valor: string): string => {
  const trimmed = valor.trim();
  if (!trimmed) {
    throw new BadRequestException('Faltan fechaInicio o fechaFin');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Jotform date: MM/DD/YYYY o DD/MM/YYYY — en CR se asume DD/MM/YYYY
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    const day = a.padStart(2, '0');
    const month = b.padStart(2, '0');
    return `${y}-${month}-${day}`;
  }
  const dash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const [, d, m, y] = dash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  throw new BadRequestException(`Fecha inválida: ${valor}`);
};

export const normalizarTipoSolicitudAusencia = (
  valor: string,
): TipoSolicitudAusencia => {
  const trimmed = valor.trim();
  const upper = trimmed.toUpperCase();
  if (
    upper === 'VACACIONES' ||
    upper === 'VACACION' ||
    upper.includes('VACAC')
  ) {
    return TipoSolicitudAusencia.VACACIONES;
  }
  if (upper === 'PERMISO' || upper.includes('PERM')) {
    return TipoSolicitudAusencia.PERMISO;
  }
  if (TIPOS_SOLICITUD_AUSENCIA.includes(upper as TipoSolicitudAusencia)) {
    return upper as TipoSolicitudAusencia;
  }
  throw new BadRequestException(
    `Tipo de solicitud inválido: ${valor}. Use PERMISO o VACACIONES.`,
  );
};

const extractSubmissionId = (root: Record<string, unknown>): string => {
  const candidates = [
    root.submissionID,
    root.submissionId,
    root.jotformSubmissionId,
    root.id,
  ];
  for (const candidate of candidates) {
    const text = asNonEmptyString(candidate);
    if (text) return text;
  }
  throw new BadRequestException('Falta submissionID de Jotform');
};

const extractFormId = (root: Record<string, unknown>): string | null => {
  return (
    asNonEmptyString(root.formID) ??
    asNonEmptyString(root.formId) ??
    asNonEmptyString(root.form_id) ??
    null
  );
};

/**
 * Acepta payload limpio de pruebas o el formato típico de webhook Jotform
 * (submissionID + rawRequest JSON string / answers).
 *
 * Importante: cualquier `colaboradorId` del payload se ignora; la identidad
 * se resuelve solo con el token de correlación emitido por SIGASJ.
 */
export function parseJotformWebhookPayload(
  body: unknown,
  fields: JotformFieldMap,
): SolicitudAusenciaWebhookParsed {
  const root = asRecord(body);
  if (!root) {
    throw new BadRequestException('Payload de webhook inválido');
  }

  // Formato normalizado (tests / integraciones internas)
  if (
    typeof root.jotformSubmissionId === 'string' &&
    typeof root.correlacionToken === 'string' &&
    typeof root.tipo === 'string'
  ) {
    const fechaInicioRaw = asNonEmptyString(root.fechaInicio);
    const fechaFinRaw = asNonEmptyString(root.fechaFin);
    if (!fechaInicioRaw || !fechaFinRaw) {
      throw new BadRequestException('Faltan fechaInicio o fechaFin');
    }
    return {
      jotformSubmissionId: root.jotformSubmissionId.trim(),
      formId: extractFormId(root),
      correlacionToken: root.correlacionToken.trim(),
      tipo: normalizarTipoSolicitudAusencia(root.tipo),
      fechaInicio: normalizarFecha(fechaInicioRaw),
      fechaFin: normalizarFecha(fechaFinRaw),
      motivo: asNonEmptyString(root.motivo) ?? null,
    };
  }

  const submissionId = extractSubmissionId(root);

  let answers: Record<string, unknown> = root;
  if (typeof root.rawRequest === 'string' && root.rawRequest.trim()) {
    try {
      const parsed = JSON.parse(root.rawRequest) as unknown;
      const parsedRecord = asRecord(parsed);
      if (parsedRecord) answers = { ...root, ...parsedRecord };
    } catch {
      throw new BadRequestException('rawRequest de Jotform no es JSON válido');
    }
  } else if (asRecord(root.rawRequest)) {
    answers = { ...root, ...asRecord(root.rawRequest)! };
  } else if (asRecord(root.answers)) {
    answers = { ...root, ...asRecord(root.answers)! };
  }

  const correlacionToken = pickString(answers, fields.correlacion);
  const tipoRaw = pickString(answers, fields.tipo);
  const fechaInicioRaw = pickString(answers, fields.fechaInicio);
  const fechaFinRaw = pickString(answers, fields.fechaFin);
  const motivoRaw = pickString(answers, fields.motivo);

  if (!correlacionToken) {
    throw new BadRequestException(
      'Falta el token de correlación del Fontanero',
    );
  }
  if (!tipoRaw) {
    throw new BadRequestException('Falta el tipo de solicitud');
  }
  if (!fechaInicioRaw || !fechaFinRaw) {
    throw new BadRequestException('Faltan fechaInicio o fechaFin');
  }

  return {
    jotformSubmissionId: submissionId,
    formId: extractFormId(root),
    correlacionToken,
    tipo: normalizarTipoSolicitudAusencia(tipoRaw),
    fechaInicio: normalizarFecha(fechaInicioRaw),
    fechaFin: normalizarFecha(fechaFinRaw),
    motivo: motivoRaw ?? null,
  };
}
