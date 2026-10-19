/*
  Corrige las horas de AUDITORIA guardadas ANTES de aplicar la migracion
  UseUtcDefaultsForTimestamps (1724686030000).

  Antes, las columnas createdAt / updatedAt / fechaCreacion las rellenaba SQL Server
  con GETDATE() (hora LOCAL del servidor). El API las lee como UTC, asi que en un SQL
  Server instalado en Costa Rica (UTC-6) esos registros se ven 6 horas atrasados.

  CUANDO USARLO
  - Solo si el servidor SQL esta en hora de Costa Rica (UTC-6). Si esta en UTC no hace falta.
  - UNA SOLA VEZ, justo despues de aplicar la migracion y antes de crear datos nuevos.
    Los registros nuevos ya se guardan en UTC real y NO deben tocarse.
  - Haga respaldo antes. Revise primero el SELECT de verificacion.

  QUE NO TOCA: columnas que escribe la aplicacion (fechaReporte, fechaAsignacion,
  fechaHora del historial, fechaMovimiento, etc.), que ya eran UTC reales.

  Ajuste @CorteUtc al instante en que se aplico la migracion (en UTC).
*/
DECLARE @CorteUtc DATETIME2 = '2026-10-19T00:00:00';   -- <== AJUSTAR: momento de la migracion (UTC)
DECLARE @DesfaseHoras INT = DATEDIFF(HOUR, GETUTCDATE(), GETDATE());  -- -6 en Costa Rica

SELECT @DesfaseHoras AS desfase_horas_servidor;  -- debe ser -6; si es 0 NO ejecute el resto

/* Verificacion: filas que se corregirian
SELECT 'ActividadFontanero' AS tabla, COUNT(*) AS filas FROM ActividadFontanero WHERE createdAt < @CorteUtc
UNION ALL SELECT 'ObservacionAveria', COUNT(*) FROM ObservacionAveria WHERE fechaCreacion < @CorteUtc;
*/

IF @DesfaseHoras = -6
BEGIN
  BEGIN TRAN;
  -- Actividades del fontanero
  UPDATE ActividadFontanero SET createdAt = DATEADD(HOUR, 6, createdAt), updatedAt = DATEADD(HOUR, 6, updatedAt) WHERE createdAt < @CorteUtc;
  -- Observaciones de atencion de averias
  UPDATE ObservacionAveria SET fechaCreacion = DATEADD(HOUR, 6, fechaCreacion) WHERE fechaCreacion < @CorteUtc;
  -- Auditoria de averias, colaboradores, incapacidades, permisos y vacaciones
  UPDATE Averia SET createdAt = DATEADD(HOUR, 6, createdAt), updatedAt = DATEADD(HOUR, 6, updatedAt) WHERE createdAt < @CorteUtc;
  UPDATE Colaborador SET createdAt = DATEADD(HOUR, 6, createdAt), updatedAt = DATEADD(HOUR, 6, updatedAt) WHERE createdAt < @CorteUtc;
  UPDATE Incapacidad SET createdAt = DATEADD(HOUR, 6, createdAt), updatedAt = DATEADD(HOUR, 6, updatedAt) WHERE createdAt < @CorteUtc;
  UPDATE PermisoColaborador SET createdAt = DATEADD(HOUR, 6, createdAt), updatedAt = DATEADD(HOUR, 6, updatedAt) WHERE createdAt < @CorteUtc;
  UPDATE MovimientoVacaciones SET createdAt = DATEADD(HOUR, 6, createdAt) WHERE createdAt < @CorteUtc;
  COMMIT;
END
