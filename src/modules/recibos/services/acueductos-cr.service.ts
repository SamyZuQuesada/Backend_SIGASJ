import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AcueductosCrService {
  private readonly logger = new Logger(AcueductosCrService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Ejecuta la consulta de recibo en la plataforma AcueductosCR mediante simulación de flujo ASP.NET Web Forms.
   */
  async consultarReciboRaw(numeroPaja: number): Promise<string> {
    const baseUrl = this.configService.get<string>('acueductosCr.baseUrl') || 'https://acueductoscr.com';
    const provincia = this.configService.get<number>('acueductosCr.provincia') || 5;
    const acueducto = this.configService.get<number>('acueductosCr.acueducto') || 207;
    const timeoutMs = this.configService.get<number>('acueductosCr.timeout') || 15000;

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/Recibos`;

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'es-CR,es;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    try {
      // Step 1: GET inicial
      const controller1 = new AbortController();
      const timer1 = setTimeout(() => controller1.abort(), timeoutMs);

      const getRes = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: controller1.signal,
      });
      clearTimeout(timer1);

      if (!getRes.ok) {
        throw new Error(`Respuesta HTTP no exitosa en GET inicial: ${getRes.status}`);
      }

      let cookieHeader = getRes.headers.get('set-cookie');
      const html1 = await getRes.text();

      // Detectar dinámicamente el id del ScriptManager (ej: ctl00$ctl10 o ctl00$ctl06)
      const scriptManagerId = this.extractScriptManagerId(html1);

      let viewState = this.extractHiddenInput(html1, '__VIEWSTATE');
      let viewStateGen = this.extractHiddenInput(html1, '__VIEWSTATEGENERATOR');
      let eventValidation = this.extractHiddenInput(html1, '__EVENTVALIDATION');

      const postHeaders: Record<string, string> = {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-MicrosoftAjax': 'Delta=true',
        Origin: baseUrl,
        Referer: targetUrl,
      };

      if (cookieHeader) {
        postHeaders['Cookie'] = cookieHeader.split(';')[0];
      }

      // Step 2: Postback seleccionar Provincia
      const body2 = new URLSearchParams();
      body2.append(scriptManagerId, 'ctl00$MainContent$UpdatePanel1|ctl00$MainContent$ddlProvincia');
      body2.append('__EVENTTARGET', 'ctl00$MainContent$ddlProvincia');
      body2.append('__EVENTARGUMENT', '');
      body2.append('__LASTFOCUS', '');
      body2.append('__VIEWSTATE', viewState || '');
      if (viewStateGen) body2.append('__VIEWSTATEGENERATOR', viewStateGen);
      body2.append('__EVENTVALIDATION', eventValidation || '');
      body2.append('ctl00$MainContent$ddlProvincia', String(provincia));
      body2.append('ctl00$MainContent$ddlAcueducto', '0');
      body2.append('ctl00$MainContent$txtMedidor', String(numeroPaja));
      body2.append('__ASYNCPOST', 'true');

      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), timeoutMs);

      const res2 = await fetch(targetUrl, {
        method: 'POST',
        headers: postHeaders,
        body: body2.toString(),
        signal: controller2.signal,
      });
      clearTimeout(timer2);

      if (res2.headers.get('set-cookie')) {
        cookieHeader = res2.headers.get('set-cookie');
        postHeaders['Cookie'] = cookieHeader!.split(';')[0];
      }

      const respText2 = await res2.text();
      viewState = this.getDeltaValue(respText2, '__VIEWSTATE') || viewState;
      viewStateGen = this.getDeltaValue(respText2, '__VIEWSTATEGENERATOR') || viewStateGen;
      eventValidation = this.getDeltaValue(respText2, '__EVENTVALIDATION') || eventValidation;

      // Step 3: Postback seleccionar Acueducto
      const body3 = new URLSearchParams();
      body3.append(scriptManagerId, 'ctl00$MainContent$UpdatePanel1|ctl00$MainContent$ddlAcueducto');
      body3.append('__EVENTTARGET', 'ctl00$MainContent$ddlAcueducto');
      body3.append('__EVENTARGUMENT', '');
      body3.append('__LASTFOCUS', '');
      body3.append('__VIEWSTATE', viewState || '');
      if (viewStateGen) body3.append('__VIEWSTATEGENERATOR', viewStateGen);
      body3.append('__EVENTVALIDATION', eventValidation || '');
      body3.append('ctl00$MainContent$ddlProvincia', String(provincia));
      body3.append('ctl00$MainContent$ddlAcueducto', String(acueducto));
      body3.append('ctl00$MainContent$txtMedidor', String(numeroPaja));
      body3.append('__ASYNCPOST', 'true');

      const controller3 = new AbortController();
      const timer3 = setTimeout(() => controller3.abort(), timeoutMs);

      const res3 = await fetch(targetUrl, {
        method: 'POST',
        headers: postHeaders,
        body: body3.toString(),
        signal: controller3.signal,
      });
      clearTimeout(timer3);

      if (res3.headers.get('set-cookie')) {
        cookieHeader = res3.headers.get('set-cookie');
        postHeaders['Cookie'] = cookieHeader!.split(';')[0];
      }

      const respText3 = await res3.text();
      viewState = this.getDeltaValue(respText3, '__VIEWSTATE') || viewState;
      viewStateGen = this.getDeltaValue(respText3, '__VIEWSTATEGENERATOR') || viewStateGen;
      eventValidation = this.getDeltaValue(respText3, '__EVENTVALIDATION') || eventValidation;

      // Step 4: Postback Consultar Recibo
      const body4 = new URLSearchParams();
      body4.append(scriptManagerId, 'ctl00$MainContent$UpdatePanel1|ctl00$MainContent$btnConsultar');
      body4.append('__EVENTTARGET', '');
      body4.append('__EVENTARGUMENT', '');
      body4.append('__LASTFOCUS', '');
      body4.append('__VIEWSTATE', viewState || '');
      if (viewStateGen) body4.append('__VIEWSTATEGENERATOR', viewStateGen);
      body4.append('__EVENTVALIDATION', eventValidation || '');
      body4.append('ctl00$MainContent$ddlProvincia', String(provincia));
      body4.append('ctl00$MainContent$ddlAcueducto', String(acueducto));
      body4.append('ctl00$MainContent$txtMedidor', String(numeroPaja));
      body4.append('ctl00$MainContent$btnConsultar', 'Consultar');
      body4.append('__ASYNCPOST', 'true');

      const controller4 = new AbortController();
      const timer4 = setTimeout(() => controller4.abort(), timeoutMs);

      const res4 = await fetch(targetUrl, {
        method: 'POST',
        headers: postHeaders,
        body: body4.toString(),
        signal: controller4.signal,
      });
      clearTimeout(timer4);

      if (!res4.ok) {
        throw new Error(`Respuesta HTTP no exitosa en consulta final: ${res4.status}`);
      }

      const finalHtmlOrDelta = await res4.text();
      return finalHtmlOrDelta;

    } catch (error: any) {
      // Diagnóstico técnico sin registrar PII ni números de paja ni datos de abonados
      this.logger.error(`Error de comunicación con el servicio externo de AcueductosCR: ${error?.message}`);
      throw new ServiceUnavailableException(
        'El servicio externo de AcueductosCR no está disponible temporalmente. Por favor intente más tarde.',
      );
    }
  }

  /**
   * Extrae el identificador dinámico de ScriptManager a partir del HTML inicial.
   */
  private extractScriptManagerId(htmlStr: string): string {
    const matchInit = htmlStr.match(
      /Sys\.WebForms\.PageRequestManager\._initialize\(\s*['"]([^'"]+)['"]/i,
    );
    if (matchInit && matchInit[1]) {
      return matchInit[1];
    }

    const matchInput = htmlStr.match(/<input[^>]*name="(ctl00\$ctl\d+)"[^>]*>/i);
    if (matchInput && matchInput[1]) {
      return matchInput[1];
    }

    return 'ctl00$ctl10';
  }

  private extractHiddenInput(htmlStr: string, name: string): string | null {
    const escaped = name.replace(/\$/g, '\\$');
    const regex = new RegExp(`name="${escaped}"[^>]*value="([^"]*)"`, 'i');
    const match = htmlStr.match(regex);
    if (match) return match[1];
    const regex2 = new RegExp(`value="([^"]*)"[^>]*name="${escaped}"`, 'i');
    const match2 = htmlStr.match(regex2);
    return match2 ? match2[1] : null;
  }

  private getDeltaValue(text: string, id: string): string | null {
    const match = text.match(new RegExp(`\\|hiddenField\\|${id.replace(/\$/g, '\\$')}\\|([^\\|]*)`));
    return match ? match[1] : null;
  }
}
