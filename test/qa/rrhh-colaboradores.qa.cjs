/**
 * QA de Recursos Humanos (colaboradores) contra el backend en ejecución y SQL Server.
 *
 * Uso (con `npm run start:dev` corriendo):
 *   npx ts-node -T -O '{"module":"commonjs"}' -e "require('./test/qa/rrhh-colaboradores.qa.cjs')"
 *
 * Firma tokens de prueba con JWT_SECRET del .env local y elimina los registros que crea.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { DataSource } = require('typeorm');
const { buildMigrationDataSourceOptions } = require('../../src/database/data-source.options');

const BASE = `http://localhost:${process.env.PORT || 3000}/api/v1/rrhh/colaboradores`;
const SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_sigasj_2026';
const CAMPOS = ['id', 'nombre', 'apellidos', 'cedula', 'correoElectronico', 'cargo', 'activo', 'usuarioId'];

const resultados = [];
let seccionActual = '';
const seccion = (nombre) => {
  seccionActual = nombre;
  console.log(`\n## ${nombre}`);
};
const check = (nombre, ok, extra = '') => {
  resultados.push({ seccion: seccionActual, nombre, ok });
  console.log(`${ok ? '  OK   ' : '  FALLA'} ${nombre}${extra ? ` -> ${extra}` : ''}`);
};

/** Fecha a milisegundos de "hora de pared": así la guarda SQL Server y así la serializa el API. */
const horaPared = (valor) =>
  typeof valor === 'string' ? valor.replace(/Z$/, '').slice(0, 23) : null;

const normalizarFila = (fila) =>
  fila && {
    ...Object.fromEntries(CAMPOS.map((c) => [c, fila[c]])),
    id: Number(fila.id),
    activo: Boolean(fila.activo),
    usuarioId: fila.usuarioId == null ? null : Number(fila.usuarioId),
    createdAt: horaPared(fila.createdAtTexto ?? fila.createdAt),
    updatedAt: horaPared(fila.updatedAtTexto ?? fila.updatedAt),
  };

(async () => {
  const ds = new DataSource({ ...buildMigrationDataSourceOptions(), migrations: [], logging: false });
  await ds.initialize();
  const creados = new Set();

  const filaBD = async (id) => {
    const [fila] = await ds.query(
      'SELECT *, CONVERT(varchar(23), createdAt, 126) AS createdAtTexto, CONVERT(varchar(23), updatedAt, 126) AS updatedAtTexto FROM Colaborador WHERE id = @0',
      [id],
    );
    return normalizarFila(fila);
  };
  const totalBD = async () => (await ds.query('SELECT COUNT(*) AS total FROM Colaborador'))[0].total;
  const coincide = (api, bd) => {
    const a = normalizarFila(api);
    const diferencias = [...CAMPOS, 'createdAt', 'updatedAt'].filter((c) => a?.[c] !== bd?.[c]);
    return { ok: Boolean(a && bd) && diferencias.length === 0, diferencias };
  };

  try {
    const usuarioPorRol = async (rol) =>
      (
        await ds.query(
          'SELECT TOP 1 u.idUsuario, u.correo FROM Usuario u JOIN Rol r ON r.idRol = u.idRol WHERE r.nombre = @0 ORDER BY u.idUsuario',
          [rol],
        )
      )[0];
    const firmar = (u, role, opciones = { expiresIn: '15m' }, secreto = SECRET) =>
      jwt.sign({ sub: String(u.idUsuario), email: u.correo, role, name: 'QA' }, secreto, opciones);

    const admin = await usuarioPorRol('ADMINISTRADORA');
    const tokens = { admin: firmar(admin, 'ADMINISTRADORA') };
    for (const rol of ['SECRETARIA', 'FONTANERO', 'AYUDANTE', 'ABONADO']) {
      const u = await usuarioPorRol(rol);
      if (u) tokens[rol] = firmar(u, rol);
    }

    const api = async (method, path = '', body, token = tokens.admin) => {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json };
    };

    const sufijo = String(Date.now()).slice(-4);
    const marca = `QA${sufijo}`;
    const datos = {
      nombre: 'Juan',
      apellidos: `Pérez ${marca}`,
      cedula: `1${sufijo}1111`,
      correoElectronico: `juan.${sufijo}@qa.cr`,
      cargo: 'Fontanero',
    };

    // ---------------------------------------------------------------- Registro
    seccion('Registrar colaborador');
    const totalAntes = await totalBD();
    const alta = await api('POST', '', datos);
    const id = alta.json?.id;
    if (id) creados.add(id);
    check('POST responde 201 con id', alta.status === 201 && Number.isInteger(id), `status ${alta.status}`);
    check('Cédula se normaliza a 1-XXXX-XXXX', alta.json?.cedula === `1-${sufijo}-1111`, alta.json?.cedula);
    check('Queda activo por defecto', alta.json?.activo === true);
    const bdAlta = await filaBD(id);
    const cmpAlta = coincide(alta.json, bdAlta);
    check('Respuesta del API = fila en SQL Server', cmpAlta.ok, cmpAlta.diferencias.join(', '));
    check('Se insertó exactamente 1 fila', (await totalBD()) === totalAntes + 1);

    const segundo = await api('POST', '', {
      nombre: 'Ana',
      apellidos: `Mora ${marca}`,
      cedula: `2${sufijo}2222`,
      correoElectronico: `ana.${sufijo}@qa.cr`,
      cargo: 'Secretaria',
    });
    if (segundo.json?.id) creados.add(segundo.json.id);
    check('Registra un segundo colaborador para búsquedas', segundo.status === 201);

    // ---------------------------------------------------------------- Consulta
    seccion('Consultar colaborador');
    const detalle = await api('GET', `/${id}`);
    const cmpDetalle = coincide(detalle.json, await filaBD(id));
    check('GET /:id responde 200', detalle.status === 200);
    check('Detalle = fila en SQL Server', cmpDetalle.ok, cmpDetalle.diferencias.join(', '));
    check('Detalle no expone contraseñas', !JSON.stringify(detalle.json).toLowerCase().includes('password'));

    // ---------------------------------------------------------------- Búsqueda
    seccion('Buscar colaborador');
    const buscar = async (texto) => (await api('GET', `?search=${encodeURIComponent(texto)}`)).json?.data ?? [];
    check('Por nombre', (await buscar(`Juan Pérez ${marca}`)).some((c) => c.id === id) || (await buscar('Juan')).some((c) => c.id === id));
    check('Por apellidos', (await buscar(`Pérez ${marca}`)).map((c) => c.id).join() === String(id));
    check('Por cédula con guiones', (await buscar(`1-${sufijo}-1111`)).some((c) => c.id === id));
    check('Por cédula sin guiones', (await buscar(`1${sufijo}1111`)).some((c) => c.id === id));
    check('Sin distinguir mayúsculas', (await buscar(`pérez ${marca.toLowerCase()}`)).some((c) => c.id === id));
    check('Búsqueda sin coincidencias devuelve vacío', (await buscar(`NoExiste${marca}`)).length === 0);
    const comodin = await api('GET', `?search=${encodeURIComponent('%')}`);
    check('Comodín % no rompe la consulta', comodin.status === 200);

    // ---------------------------------------------------------------- Filtros y paginación
    seccion('Filtrar colaborador');
    const filtrar = async (q) => (await api('GET', `?search=${marca}&${q}`)).json;
    const porCargo = await filtrar('cargo=fontanero');
    check('Por cargo (sin distinguir mayúsculas)', porCargo.data.length === 1 && porCargo.data[0].id === id);
    const activos = await filtrar('activo=true');
    check('Por estado activo', activos.total === 2);
    const pag1 = await filtrar('page=1&limit=1');
    const pag2 = await filtrar('page=2&limit=1');
    check('Paginación: 1 por página, 2 páginas', pag1.totalPages === 2 && pag1.data.length === 1 && pag2.data.length === 1);
    check('Paginación: páginas distintas', pag1.data[0].id !== pag2.data[0].id);
    const combinado = await filtrar('cargo=Secretaria&activo=true');
    check('Filtros combinados', combinado.data.length === 1 && combinado.data[0].id === segundo.json.id);

    // ---------------------------------------------------------------- Edición
    seccion('Editar colaborador');
    const antesEdit = await filaBD(id);
    const edit = await api('PATCH', `/${id}`, { cargo: 'Ayudante de fontanero' });
    const despuesEdit = await filaBD(id);
    check('PATCH parcial responde 200', edit.status === 200);
    check('Cargo actualizado en SQL Server', despuesEdit.cargo === 'Ayudante de fontanero');
    const intactos = ['nombre', 'apellidos', 'cedula', 'correoElectronico', 'activo', 'usuarioId', 'createdAt'].filter(
      (c) => antesEdit[c] !== despuesEdit[c],
    );
    check('Campos no enviados se conservan (sin pérdida)', intactos.length === 0, intactos.join(', '));
    check('updatedAt avanza', despuesEdit.updatedAt >= antesEdit.updatedAt);
    const ahoraLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    check('updatedAt guarda la hora local de Costa Rica', despuesEdit.updatedAt.slice(0, 16) === ahoraLocal, despuesEdit.updatedAt);
    const cmpEdit = coincide(edit.json, despuesEdit);
    check('Respuesta = SQL Server tras editar', cmpEdit.ok, cmpEdit.diferencias.join(', '));

    const editCompleto = await api('PATCH', `/${id}`, {
      ...datos,
      correoElectronico: `JUAN.NUEVO.${sufijo}@QA.CR`,
      cargo: 'Fontanero',
    });
    check('PATCH con su propia cédula no da conflicto', editCompleto.status === 200, `status ${editCompleto.status}`);
    check('Correo se guarda en minúsculas', (await filaBD(id)).correoElectronico === `juan.nuevo.${sufijo}@qa.cr`);

    const [cuentaCruda] = await ds.query(
      'SELECT TOP 1 u.idUsuario FROM Usuario u WHERE u.activo = 1 AND NOT EXISTS (SELECT 1 FROM Colaborador c WHERE c.usuarioId = u.idUsuario) ORDER BY u.idUsuario DESC',
    );
    const cuentaLibre = cuentaCruda && { idUsuario: Number(cuentaCruda.idUsuario) };
    if (cuentaLibre) {
      const vincular = await api('PATCH', `/${id}`, { usuarioId: cuentaLibre.idUsuario });
      check('Vincula una cuenta de usuario', vincular.status === 200 && (await filaBD(id)).usuarioId === cuentaLibre.idUsuario);
      const conUsuario = await api('GET', `/${id}`);
      check('El detalle trae la cuenta vinculada', conUsuario.json?.usuario?.idUsuario === cuentaLibre.idUsuario);
      const robar = await api('PATCH', `/${segundo.json.id}`, { usuarioId: cuentaLibre.idUsuario });
      check('Misma cuenta en otro colaborador responde 409', robar.status === 409);
      const desvincular = await api('PATCH', `/${id}`, { usuarioId: null });
      check('Desvincula la cuenta (usuarioId null)', desvincular.status === 200 && (await filaBD(id)).usuarioId === null);
    }

    const cedulaAjena = await api('PATCH', `/${id}`, { cedula: `2-${sufijo}-2222` });
    check('Editar a una cédula ajena responde 409', cedulaAjena.status === 409);

    // ---------------------------------------------------------------- Inactivar / reactivar
    seccion('Inactivar y reactivar');
    const antesEstado = await filaBD(id);
    const inactivar = await api('PATCH', `/${id}/estado`, { activo: false });
    const inactivo = await filaBD(id);
    check('Inactivar responde 200', inactivar.status === 200);
    check('activo = 0 en SQL Server', inactivo.activo === false);
    check('Inactivar no borra ni altera otros datos',
      ['nombre', 'apellidos', 'cedula', 'correoElectronico', 'cargo', 'usuarioId', 'createdAt'].every((c) => antesEstado[c] === inactivo[c]));
    check('Aparece con filtro inactivos', (await filtrar('activo=false')).data.some((c) => c.id === id));
    check('No aparece con filtro activos', !(await filtrar('activo=true')).data.some((c) => c.id === id));
    check('Sigue consultable en el detalle', (await api('GET', `/${id}`)).status === 200);
    const reactivar = await api('PATCH', `/${id}/estado`, { activo: true });
    const reactivado = await filaBD(id);
    check('Reactivar responde 200', reactivar.status === 200);
    check('activo = 1 en SQL Server', reactivado.activo === true);
    check('Reactivar conserva los datos',
      ['nombre', 'apellidos', 'cedula', 'correoElectronico', 'cargo', 'usuarioId', 'createdAt'].every((c) => antesEstado[c] === reactivado[c]));
    const repetir = await api('PATCH', `/${id}/estado`, { activo: true });
    check('Reactivar dos veces es idempotente', repetir.status === 200 && (await filaBD(id)).activo === true);

    // ---------------------------------------------------------------- Permisos
    seccion('Usuario sin permisos');
    const snapshot = JSON.stringify(await filaBD(id));
    const totalSeguridad = await totalBD();
    const operaciones = [
      ['GET', ''],
      ['GET', `/${id}`],
      ['POST', '', { ...datos, cedula: `3${sufijo}3333` }],
      ['PATCH', `/${id}`, { cargo: 'Hackeado' }],
      ['PATCH', `/${id}/estado`, { activo: false }],
    ];
    const sesiones = {
      'sin token': [null, 401],
      'token inválido': ['abc.def.ghi', 401],
      'token con otra firma': [firmar(admin, 'ADMINISTRADORA', { expiresIn: '5m' }, 'otra-clave'), 401],
      'token vencido': [firmar(admin, 'ADMINISTRADORA', { expiresIn: -10 }), 401],
      ...Object.fromEntries(
        Object.entries(tokens)
          .filter(([rol]) => rol !== 'admin')
          .map(([rol, token]) => [`rol ${rol}`, [token, 403]]),
      ),
    };
    for (const [nombre, [token, esperado]] of Object.entries(sesiones)) {
      const estados = [];
      for (const [method, path, body] of operaciones) estados.push((await api(method, path, body, token)).status);
      check(`${nombre}: las 5 operaciones responden ${esperado}`, estados.every((s) => s === esperado), estados.join('/'));
    }
    check('Ningún intento sin permiso modificó SQL Server',
      JSON.stringify(await filaBD(id)) === snapshot && (await totalBD()) === totalSeguridad);

    // ---------------------------------------------------------------- Datos inválidos
    seccion('Datos inválidos');
    const totalInvalidos = await totalBD();
    const invalidos = {
      'sin campos': {},
      'nombre vacío': { ...datos, cedula: `4${sufijo}4444`, nombre: '   ' },
      'nombre de 101 caracteres': { ...datos, cedula: `4${sufijo}4444`, nombre: 'x'.repeat(101) },
      'correo inválido': { ...datos, cedula: `4${sufijo}4444`, correoElectronico: 'juan' },
      'cédula con letras': { ...datos, cedula: 'abc' },
      'cédula iniciando en 0': { ...datos, cedula: '0-1111-1111' },
      'DIMEX de 10 dígitos': { ...datos, cedula: '1234567890' },
      'usuarioId negativo': { ...datos, cedula: `4${sufijo}4444`, usuarioId: -1 },
      'usuarioId inexistente': { ...datos, cedula: `4${sufijo}4444`, usuarioId: 99999999 },
      'cédula duplicada': { ...datos, correoElectronico: `otro.${sufijo}@qa.cr` },
    };
    for (const [nombre, body] of Object.entries(invalidos)) {
      const r = await api('POST', '', body);
      if (r.json?.id) creados.add(r.json.id);
      check(`POST ${nombre} se rechaza`, [400, 404, 409].includes(r.status), `status ${r.status}`);
    }
    const patchVacio = await api('PATCH', `/${id}`, {});
    check('PATCH sin campos responde 400', patchVacio.status === 400);
    const estadoTexto = await api('PATCH', `/${id}/estado`, { activo: 'no' });
    check('Estado no booleano responde 400', estadoTexto.status === 400);
    const idTexto = await api('GET', '/abc');
    check('Id no numérico responde 400', idTexto.status === 400);
    check('Id inexistente responde 404', (await api('GET', '/99999999')).status === 404);
    check('Editar inexistente responde 404', (await api('PATCH', '/99999999', { cargo: 'X' })).status === 404);
    check('Estado de inexistente responde 404', (await api('PATCH', '/99999999/estado', { activo: false })).status === 404);
    check('Ningún dato inválido llegó a SQL Server', (await totalBD()) === totalInvalidos);

    // ---------------------------------------------------------------- Concurrencia
    seccion('Operaciones duplicadas');
    const cedulaDoble = `5${sufijo}5555`;
    const dobles = await Promise.all(
      [1, 2, 3].map((n) => api('POST', '', { ...datos, correoElectronico: `d${n}.${sufijo}@qa.cr`, cedula: cedulaDoble })),
    );
    dobles.forEach((r) => r.json?.id && creados.add(r.json.id));
    const [{ total: filasDobles }] = await ds.query(
      "SELECT COUNT(*) AS total FROM Colaborador WHERE REPLACE(cedula, '-', '') = @0",
      [cedulaDoble],
    );
    check('3 POST simultáneos dejan 1 sola fila', filasDobles === 1, dobles.map((r) => r.status).join('/'));

    // ---------------------------------------------------------------- Persistencia final
    seccion('Persistencia: API vs SQL Server');
    const listado = await api('GET', `?search=${marca}&limit=100`);
    const diferencias = [];
    for (const c of listado.json.data) {
      const cmp = coincide(c, await filaBD(c.id));
      if (!cmp.ok) diferencias.push(`${c.id}: ${cmp.diferencias.join(',')}`);
    }
    check(`Los ${listado.json.data.length} registros del listado coinciden con SQL Server`, diferencias.length === 0, diferencias.join(' | '));
  } finally {
    if (creados.size) {
      await ds.query(`DELETE FROM Colaborador WHERE id IN (${[...creados].map(Number).join(',')})`);
      console.log(`\nRegistros de QA eliminados: ${creados.size}`);
    }
    await ds.destroy();
  }

  const fallas = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallas.length}/${resultados.length} verificaciones correctas`);
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
