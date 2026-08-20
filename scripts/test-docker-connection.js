const sql = require('mssql');

// Valores fijos de docker-compose.yml (desarrollo local).
const connectionString =
  'Server=localhost,1435;Database=SIGASJ;User Id=sa;Password=SigasjDev2026;Encrypt=false;TrustServerCertificate=true;';

async function main() {
  try {
    await sql.connect(connectionString);
    console.log('SQL_SERVER_OK');
    await sql.close();
  } catch (error) {
    console.error('SQL_SERVER_FAIL', error.message);
    process.exitCode = 1;
  }
}

void main();
