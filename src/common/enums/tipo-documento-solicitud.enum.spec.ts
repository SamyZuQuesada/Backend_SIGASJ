import {
  DOCUMENTOS_INFRA_OBLIGATORIOS,
  DOCUMENTOS_INFRA_REUNION_FINCAS,
  isTipoDocumentoSolicitud,
  normalizarTipoDocumentoSolicitud,
  TipoDocumentoSolicitud,
} from './tipo-documento-solicitud.enum';

describe('TipoDocumentoSolicitud (INFRA-QA-001)', () => {
  it('define tipos oficiales de adjunto', () => {
    expect(isTipoDocumentoSolicitud('identificacion')).toBe(true);
    expect(isTipoDocumentoSolicitud('plano-catastrado')).toBe(true);
    expect(isTipoDocumentoSolicitud('plano-agrimensura')).toBe(true);
    expect(isTipoDocumentoSolicitud('comprobante-pago')).toBe(true);
    expect(isTipoDocumentoSolicitud('otro')).toBe(true);
    expect(isTipoDocumentoSolicitud('invalido')).toBe(false);
  });

  it('normaliza variantes comunes enviadas por clientes', () => {
    expect(normalizarTipoDocumentoSolicitud('comprobante')).toBe(
      TipoDocumentoSolicitud.COMPROBANTE_PAGO,
    );
    expect(normalizarTipoDocumentoSolicitud('recibo')).toBe(
      TipoDocumentoSolicitud.COMPROBANTE_PAGO,
    );
    expect(normalizarTipoDocumentoSolicitud('cedula')).toBe(
      TipoDocumentoSolicitud.IDENTIFICACION,
    );
    expect(normalizarTipoDocumentoSolicitud('adjunto')).toBe(
      TipoDocumentoSolicitud.OTRO,
    );
    expect(normalizarTipoDocumentoSolicitud('escritura')).toBe(
      TipoDocumentoSolicitud.OTRO,
    );
    expect(normalizarTipoDocumentoSolicitud('posesion')).toBe(
      TipoDocumentoSolicitud.OTRO,
    );
    expect(normalizarTipoDocumentoSolicitud('tipo-inexistente')).toBeNull();
  });

  it('exige identificación + plano catastrado; agrimensura en Reunión de fincas', () => {
    expect(DOCUMENTOS_INFRA_OBLIGATORIOS).toEqual([
      TipoDocumentoSolicitud.IDENTIFICACION,
      TipoDocumentoSolicitud.PLANO_CATASTRADO,
    ]);
    expect(DOCUMENTOS_INFRA_REUNION_FINCAS).toEqual([
      TipoDocumentoSolicitud.PLANO_AGRIMENSURA,
    ]);
  });
});
