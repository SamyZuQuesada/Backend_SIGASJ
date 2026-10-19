/**
 * El proceso del API siempre trabaja en UTC, sin importar la zona horaria del
 * servidor donde corra (Windows en Costa Rica, Docker en UTC, etc.).
 *
 * Motivo: el driver de SQL Server entrega las columnas `time` y `datetime`
 * como instantes UTC (useUTC: true) y TypeORM las convierte con los métodos
 * "locales" de Date. En un servidor de Costa Rica (UTC-6) eso corría las horas
 * del horario laboral 6 horas (00:00 pasaba a 18:00) y dejaba a todos los
 * fontaneros "fuera de horario".
 *
 * Lo que debe ser hora de Costa Rica (día calendario, año del código de
 * seguimiento, horario laboral) se calcula de forma explícita con
 * `America/Costa_Rica` en `reloj-asada.ts`.
 *
 * Debe importarse como PRIMER import del punto de entrada.
 */
process.env.TZ = 'UTC';

export {};
