import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ReciboConsultaResponseDto, ReciboItemDto } from '../dto/recibo-consulta-response.dto';

export class AcueductosCrParser {
  /**
   * Procesa la respuesta HTML o Delta de ASP.NET Web Forms y la convierte a DTO.
   */
  public parseResponse(htmlOrDelta: string, numeroPaja: number): ReciboConsultaResponseDto {
    if (!htmlOrDelta || typeof htmlOrDelta !== 'string') {
      throw new ServiceUnavailableException('Respuesta vacía o inválida del servicio externo AcueductosCR');
    }

    // Detectar redirección a Error.aspx o mensaje de error general
    if (htmlOrDelta.includes('pageRedirect||%2fError.aspx') || htmlOrDelta.includes('MainContent_lblErrorMessage')) {
      throw new ServiceUnavailableException(
        'El servidor de AcueductosCR reportó un error al procesar la solicitud',
      );
    }

    // Extraer mensaje principal de MainContent_lblMensaje
    const mensajeMatch =
      htmlOrDelta.match(/id="MainContent_lblMensaje"[^>]*>([\s\S]*?)<\/span>/i) ||
      htmlOrDelta.match(/MainContent_lblMensaje\|([^\|]*)/i);

    const rawMensaje = mensajeMatch ? this.cleanHtmlText(mensajeMatch[1]) : '';

    // Caso 1: Paja sin recibos pendientes
    if (rawMensaje.toLowerCase().includes('no existen recibos pendientes')) {
      const abonado = this.extractAbonadoNombre(rawMensaje);

      return {
        success: true,
        data: {
          numeroPaja,
          abonado,
          tieneRecibosPendientes: false,
          mensaje: 'No posee recibos pendientes',
          recibos: [],
        },
      };
    }

    // Caso 2: Cuenta no existe
    if (
      rawMensaje.toLowerCase().includes('cuenta consultada no existe') ||
      rawMensaje.toLowerCase().includes('la cuenta') ||
      rawMensaje.toLowerCase().includes('verificar si ingreso')
    ) {
      throw new NotFoundException(
        'La paja consultada no existe. Por favor verifique que el número ingresado sea el correcto.',
      );
    }

    // Caso 3: Recibos pendientes en tabla MainContent_grvRecibos
    const gridMatch = htmlOrDelta.match(/id="MainContent_grvRecibos"[\s\S]*?<\/table>/i);
    const clienteMatch =
      htmlOrDelta.match(/id="MainContent_lblCliente"[^>]*>([\s\S]*?)<\/span>/i) ||
      htmlOrDelta.match(/MainContent_lblCliente\|([^\|]*)/i);

    const abonadoCliente = clienteMatch ? this.cleanHtmlText(clienteMatch[1]) : 'ABONADO';

    if (gridMatch) {
      const recibos = this.parseGridRecibos(gridMatch[0]);

      return {
        success: true,
        data: {
          numeroPaja,
          abonado: abonadoCliente,
          tieneRecibosPendientes: recibos.length > 0,
          mensaje: recibos.length > 0 ? 'Recibos pendientes encontrados' : 'No posee recibos pendientes',
          recibos,
        },
      };
    }

    // Si hay un mensaje pero no encaja en las anteriores
    if (rawMensaje) {
      const abonadoFallback = this.extractAbonadoNombre(rawMensaje) || abonadoCliente;
      return {
        success: true,
        data: {
          numeroPaja,
          abonado: abonadoFallback,
          tieneRecibosPendientes: false,
          mensaje: rawMensaje,
          recibos: [],
        },
      };
    }

    throw new ServiceUnavailableException(
      'No se pudo interpretar la respuesta del sistema AcueductosCR',
    );
  }

  /**
   * Extrae el nombre del abonado a partir del texto del mensaje.
   * Ejemplo: "No existen recibos pendientes para el abonado: JUAN PEREZ"
   */
  private extractAbonadoNombre(textoMensaje: string): string {
    const regex = /abonado:\s*([^\n\r]+)/i;
    const match = textoMensaje.match(regex);

    if (match && match[1].trim()) {
      return match[1].trim();
    }

    return 'ABONADO';
  }

  /**
   * Parsea de manera flexible y desacoplada la tabla HTML de recibos (MainContent_grvRecibos).
   * Mantiene el funcionamiento incluso con columnas adicionales o desconocidas.
   */
  private parseGridRecibos(tableHtml: string): ReciboItemDto[] {
    const recibos: ReciboItemDto[] = [];

    try {
      const rowMatches = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      if (rowMatches.length < 2) return recibos;

      // Extraer encabezados th si existen
      const headerRow = rowMatches[0][1];
      const headers = [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
        this.cleanHtmlText(m[1]).toLowerCase(),
      );

      for (let i = 1; i < rowMatches.length; i++) {
        const cells = [...rowMatches[i][1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
          this.cleanHtmlText(m[1]),
        );

        if (cells.length === 0) continue;

        const item: ReciboItemDto = {};

        cells.forEach((val, idx) => {
          const headerName = headers[idx] || `col_${idx}`;

          if (headerName.includes('emision') || headerName.includes('fecha')) {
            item.fechaEmision = val;
          } else if (headerName.includes('vencimiento')) {
            item.fechaVencimiento = val;
          } else if (headerName.includes('total') || headerName.includes('monto') || headerName.includes('pagar')) {
            const sanitizedVal = val.replace(/,/g, '').replace(/[^0-9.]/g, '');
            const parsedMonto = parseFloat(sanitizedVal);
            item.total = isNaN(parsedMonto) ? undefined : parsedMonto;
          } else if (headerName.includes('periodo') || headerName.includes('mes')) {
            item.periodo = val;
          } else {
            // Preservar cualquier columna adicional sin fallar ni romper el tipo
            const keyName = headerName.replace(/[^a-zA-Z0-9_]/g, '_');
            item[keyName] = val;
          }
        });

        recibos.push(item);
      }
    } catch {
      // Retornar de forma segura lo parseado hasta el momento sin lanzar error
    }

    return recibos;
  }

  /**
   * Limpia etiquetas HTML, secuencias de escape y espacios duplicados.
   */
  private cleanHtmlText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&#225;/g, 'á')
      .replace(/&#233;/g, 'é')
      .replace(/&#237;/g, 'í')
      .replace(/&#243;/g, 'ó')
      .replace(/&#250;/g, 'ú')
      .replace(/&#241;/g, 'ñ')
      .replace(/&#193;/g, 'Á')
      .replace(/&#201;/g, 'É')
      .replace(/&#205;/g, 'Í')
      .replace(/&#211;/g, 'Ó')
      .replace(/&#218;/g, 'Ú')
      .replace(/&#209;/g, 'Ñ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
