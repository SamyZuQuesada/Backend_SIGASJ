// Las pruebas corren siempre en UTC, igual que el API (ver src/common/time/forzar-zona-utc.ts),
// para que den el mismo resultado en cualquier computadora (por ejemplo Windows en hora de
// Costa Rica). Lo que depende de Costa Rica se prueba con instantes explícitos.
module.exports = async () => {
  process.env.TZ = 'UTC';
};
