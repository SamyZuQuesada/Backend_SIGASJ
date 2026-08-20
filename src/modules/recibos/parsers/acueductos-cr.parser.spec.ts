import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AcueductosCrParser } from './acueductos-cr.parser';

describe('AcueductosCrParser', () => {
  let parser: AcueductosCrParser;

  beforeEach(() => {
    parser = new AcueductosCrParser();
  });

  it('debe parsear correctamente la respuesta de un abonado sin recibos pendientes', () => {
    const mockHtml = `
      <div id="MainContent_UpdatePanel1">
        <span id="MainContent_lblMensaje">No existen recibos pendientes para el abonado: MARCO ANTONIO CABALCETA JIMENEZ</span>
      </div>
    `;

    const result = parser.parseResponse(mockHtml, 130);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.numeroPaja).toBe(130);
    expect(result.data?.abonado).toBe('MARCO ANTONIO CABALCETA JIMENEZ');
    expect(result.data?.tieneRecibosPendientes).toBe(false);
    expect(result.data?.recibos).toEqual([]);
  });

  it('debe lanzar NotFoundException si la paja no existe', () => {
    const mockHtml = `
      <span id="MainContent_lblMensaje">La cuenta consultada no existe, por favor verificar si ingreso la cuenta la correcta.</span>
    `;

    expect(() => parser.parseResponse(mockHtml, 99999)).toThrow(NotFoundException);
  });

  it('debe parsear correctamente una tabla con recibos pendientes (MainContent_grvRecibos)', () => {
    const mockHtml = `
      <span id="MainContent_lblCliente">JUAN PEREZ GONZALEZ</span>
      <table id="MainContent_grvRecibos">
        <tr>
          <th>Fecha Emisión</th>
          <th>Vencimiento</th>
          <th>Total</th>
        </tr>
        <tr>
          <td>2026-08-01</td>
          <td>2026-08-20</td>
          <td>12500</td>
        </tr>
      </table>
    `;

    const result = parser.parseResponse(mockHtml, 250);

    expect(result.success).toBe(true);
    expect(result.data?.numeroPaja).toBe(250);
    expect(result.data?.abonado).toBe('JUAN PEREZ GONZALEZ');
    expect(result.data?.tieneRecibosPendientes).toBe(true);
    expect(result.data?.recibos).toHaveLength(1);
    expect(result.data?.recibos[0].fechaEmision).toBe('2026-08-01');
    expect(result.data?.recibos[0].fechaVencimiento).toBe('2026-08-20');
    expect(result.data?.recibos[0].total).toBe(12500);
  });

  it('debe lanzar ServiceUnavailableException ante respuestas de error de Web Forms', () => {
    const mockHtml = `pageRedirect||%2fError.aspx|`;

    expect(() => parser.parseResponse(mockHtml, 130)).toThrow(ServiceUnavailableException);
  });

  it('debe lanzar ServiceUnavailableException ante respuestas vacías', () => {
    expect(() => parser.parseResponse('', 130)).toThrow(ServiceUnavailableException);
  });
});
