import {
  DOCUMENTOS_INFRA_OBLIGATORIOS,
  DOCUMENTOS_INFRA_REUNION_FINCAS,
  isTipoDocumentoSolicitud,
  TipoDocumentoSolicitud,
} from './tipo-documento-solicitud.enum';

describe('TipoDocumentoSolicitud (INFRA-QA-001)', () => {
  it('define tipos oficiales de adjunto', () => {
    expect(isTipoDocumentoSolicitud('identificacion')).toBe(true);
    expect(isTipoDocumentoSolicitud('plano-catastrado')).toBe(true);
    expect(isTipoDocumentoSolicitud('plano-agrimensura')).toBe(true);
    expect(isTipoDocumentoSolicitud('otro')).toBe(false);
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
