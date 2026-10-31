import {
  createCorsOriginDelegate,
  resolveCorsAllowedOrigins,
} from './cors-origin';

describe('cors-origin', () => {
  it('en producción solo usa orígenes de env (sin localhost por defecto)', () => {
    const origins = resolveCorsAllowedOrigins({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://frontend-autorizado.example',
    });

    expect(origins).toEqual(['https://frontend-autorizado.example']);
    expect(origins.some((o) => o.includes('localhost'))).toBe(false);
  });

  it('en desarrollo agrega localhost Vite', () => {
    const origins = resolveCorsAllowedOrigins({
      NODE_ENV: 'development',
      FRONTEND_URL: 'https://frontend-autorizado.example',
    });

    expect(origins).toContain('https://frontend-autorizado.example');
    expect(origins).toContain('http://localhost:5173');
  });

  it('createCorsOriginDelegate permite autorizados y rechaza otros', (done) => {
    const delegate = createCorsOriginDelegate({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://frontend-autorizado.example',
    });

    delegate('https://frontend-autorizado.example', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);

      delegate('https://example.com', (err2, allow2) => {
        expect(err2).toBeNull();
        expect(allow2).toBe(false);

        delegate(undefined, (err3, allow3) => {
          expect(err3).toBeNull();
          expect(allow3).toBe(true);
          done();
        });
      });
    });
  });
});
