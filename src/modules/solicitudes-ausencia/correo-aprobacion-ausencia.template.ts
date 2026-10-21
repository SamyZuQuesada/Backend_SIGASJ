export type CorreoAprobacionAusenciaDatos = {
  nombre: string;
  tipoLabel: string;
  solicitudId: number;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
  urlMisSolicitudes?: string | null;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** YYYY-MM-DD → DD/MM/YYYY (presentación local CR). */
export const formatearFechaCorreo = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const construirTextoAprobacionAusencia = (
  datos: CorreoAprobacionAusenciaDatos,
): string => {
  const saludo = datos.nombre ? `Hola ${datos.nombre},` : 'Hola,';
  const periodo = `${formatearFechaCorreo(datos.fechaInicio)} — ${formatearFechaCorreo(datos.fechaFin)}`;
  const lineas = [
    saludo,
    '',
    `Su solicitud de ${datos.tipoLabel} (#${datos.solicitudId}) fue aprobada.`,
    `Periodo: ${periodo}.`,
    datos.motivo?.trim() ? `Motivo: ${datos.motivo.trim()}.` : null,
    '',
    datos.urlMisSolicitudes
      ? `Consúltela aquí: ${datos.urlMisSolicitudes}`
      : 'Puede consultarla en SIGASJ → Mis solicitudes.',
    '',
    'ASADA San Juan — SIGASJ',
  ];
  return lineas.filter((l): l is string => l !== null).join('\n');
};

/**
 * Plantilla HTML compatible con clientes de correo (estilos inline + tablas).
 * Paleta alineada al panel SIGASJ (#062e63 / azul agua).
 */
export const construirHtmlAprobacionAusencia = (
  datos: CorreoAprobacionAusenciaDatos,
): string => {
  const nombre = escapeHtml(datos.nombre || 'colaborador/a');
  const tipo = escapeHtml(datos.tipoLabel);
  const periodo = escapeHtml(
    `${formatearFechaCorreo(datos.fechaInicio)} — ${formatearFechaCorreo(datos.fechaFin)}`,
  );
  const motivo = datos.motivo?.trim() ? escapeHtml(datos.motivo.trim()) : null;
  const url = datos.urlMisSolicitudes?.trim() || '';
  const cta = url
    ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#1d6fd8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Ver mis solicitudes</a>`
    : `<span style="display:inline-block;background:#1d6fd8;color:#ffffff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">SIGASJ → Mis solicitudes</span>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Solicitud aprobada — SIGASJ</title>
</head>
<body style="margin:0;padding:0;background:#eef4fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #d7e6f7;box-shadow:0 12px 30px rgba(30,90,156,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#062e63 0%,#1d6fd8 55%,#38bdf8 100%);padding:28px 28px 24px;">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:#dbeafe;">ASADA San Juan</p>
              <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:800;color:#ffffff;">SIGASJ</h1>
              <p style="margin:10px 0 0;font-size:15px;color:#e0f2fe;">Aviso de solicitud de ausencia</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <span style="display:inline-block;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">Aprobada</span>
              <h2 style="margin:16px 0 8px;font-size:22px;line-height:1.3;color:#062e63;font-weight:800;">Su solicitud de ${tipo} fue aprobada</h2>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#334155;">Hola ${nombre}, le confirmamos que su solicitud <strong style="color:#062e63;">#${datos.solicitudId}</strong> ya fue revisada y aprobada por la Administración.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fbff;border:1px solid #e2eef9;border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2eef9;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Tipo</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;text-transform:capitalize;">${tipo}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;border-bottom:1px solid #e2eef9;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Periodo</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${periodo}</p>
                  </td>
                </tr>
                ${
                  motivo
                    ? `<tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Motivo</p>
                    <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;">${motivo}</p>
                  </td>
                </tr>`
                    : ''
                }
              </table>
              <p style="margin:24px 0 18px;font-size:15px;line-height:1.5;color:#475569;">Puede revisar el detalle en su historial de solicitudes.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                <tr>
                  <td>${cta}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;">
              <p style="margin:0;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#94a3b8;">Este mensaje fue enviado automáticamente por SIGASJ. No responda a este correo.</p>
              <p style="margin:8px 0 0;font-size:13px;font-weight:700;color:#64748b;">ASADA San Juan — SIGASJ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
