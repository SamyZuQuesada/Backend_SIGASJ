const major = Number(process.versions.node.split('.')[0]);

if (major !== 22) {
  console.error(
    `\n[SIGASJ Backend] Se requiere Node.js 22.x (actual: ${process.version}).\n` +
      'Use: nvm use 22   o   instale Node 22 LTS.\n',
  );
  process.exit(1);
}
