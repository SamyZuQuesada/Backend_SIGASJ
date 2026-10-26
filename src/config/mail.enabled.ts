/**
 * MAIL_ENABLED=true/false manda.
 * Si no hay bandera, se habilita cuando hay usuario y contraseña SMTP.
 */
export const resolverMailEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const flag = env.MAIL_ENABLED?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') {
    return false;
  }
  if (flag === 'true' || flag === '1' || flag === 'yes') {
    return true;
  }
  return Boolean(env.MAIL_USER?.trim() && env.MAIL_PASSWORD);
};
