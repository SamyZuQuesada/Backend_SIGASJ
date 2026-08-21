import { ContactoPublico } from '../entities/contacto-publico.entity';

export type ContactoPublicoResponse = {
  telefono: string;
  telefonosAdicionales: string[];
  email: string;
  horarioAtencion: string;
  horarioVentanilla: string | null;
  direccion: string;
  referenciaUbicacion: string | null;
  regionResumen: string;
  mapaUrl: string | null;
  mapaLatitud: number | null;
  mapaLongitud: number | null;
  mapaZoom: number;
  textoUbicacionMapa: string | null;
  urlFacebook: string | null;
  descripcionContacto: string | null;
  actualizadoEn: string;
};

function parseTelefonosAdicionales(raw: string | null): string[] {
  if (!raw?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function mapContactoPublicoToResponse(
  entity: ContactoPublico,
): ContactoPublicoResponse {
  return {
    telefono: entity.telefono,
    telefonosAdicionales: parseTelefonosAdicionales(
      entity.telefonosAdicionalesJson,
    ),
    email: entity.email,
    horarioAtencion: entity.horarioAtencion,
    horarioVentanilla: entity.horarioVentanilla,
    direccion: entity.direccion,
    referenciaUbicacion: entity.referenciaUbicacion,
    regionResumen: entity.regionResumen,
    mapaUrl: entity.mapaUrl,
    mapaLatitud: toNumber(entity.mapaLatitud),
    mapaLongitud: toNumber(entity.mapaLongitud),
    mapaZoom: entity.mapaZoom,
    textoUbicacionMapa: entity.textoUbicacionMapa,
    urlFacebook: entity.urlFacebook,
    descripcionContacto: entity.descripcionContacto,
    actualizadoEn: entity.actualizadoEn.toISOString(),
  };
}

export function serializeTelefonosAdicionales(values: string[] | undefined): string | null {
  const normalized = (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}
