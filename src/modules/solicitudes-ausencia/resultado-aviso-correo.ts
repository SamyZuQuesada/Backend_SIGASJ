export type ResultadoAvisoCorreo = {
  enviado: boolean;
  destinos: string[];
  /** Solo en desarrollo con Ethereal: URL para ver el correo. */
  vistaPreviaUrl?: string | null;
  motivoOmitido?: string | null;
};
