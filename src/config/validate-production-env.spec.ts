import {
  JWT_SECRET_INSEGURO_EJEMPLO,
  assertProductionEnv,
  collectProductionEnvProblems,
} from './validate-production-env';

const valido: NodeJS.ProcessEnv = {
  JWT_SECRET: 'un-secreto-largo-distinto',
  DB_TYPE: 'mssql',
  DB_HOST: 'sql.example.com',
  DB_DATABASE: 'SIGASJ',
  DB_USERNAME: 'sigasj',
  DB_PASSWORD: 'no-es-real',
  FRONTEND_BASE_URL: 'https://sigasj.vercel.app',
};

describe('validate-production-env', () => {
  it('no exige variables fuera de production', () => {
    expect(() => assertProductionEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('rechaza el JWT de ejemplo y la ausencia de CORS', () => {
    expect(
      collectProductionEnvProblems({
        JWT_SECRET: JWT_SECRET_INSEGURO_EJEMPLO,
        DB_TYPE: 'mssql',
        DB_HOST: 'localhost',
        DB_DATABASE: 'SIGASJ',
        DB_USERNAME: 'sa',
        DB_PASSWORD: 'x',
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('JWT_SECRET'),
        expect.stringContaining('CORS_ORIGINS'),
      ]),
    );
  });

  it('acepta una matriz mínima de producción', () => {
    expect(collectProductionEnvProblems(valido)).toEqual([]);
    expect(() =>
      assertProductionEnv({ ...valido, NODE_ENV: 'production' }),
    ).not.toThrow();
  });
});
