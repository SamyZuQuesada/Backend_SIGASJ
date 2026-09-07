const version = process.versions.node;
const [majorRaw, minorRaw, patchRaw] = version.split('.');
const major = Number(majorRaw);
const minor = Number(minorRaw);
const patch = Number(patchRaw);

const isAllowed =
  major === 22 &&
  Number.isFinite(minor) &&
  Number.isFinite(patch) &&
  (minor > 12 || (minor === 12 && patch >= 0));

if (!isAllowed) {
  console.error(
    `\n[SIGASJ Backend] Se requiere Node.js >=22.12.0 y <23 (actual: ${version}).\n` +
      'Use: nvm use 22   o   instale Node 22 LTS (22.12+).\n',
  );
  process.exit(1);
}
