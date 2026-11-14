import { registerAs } from '@nestjs/config';

/**
 * Asistente público SIGASJ.
 * Compatible con OpenAI y Azure OpenAI (API estilo chat/completions).
 */
export default registerAs('assistant', () => {
  const provider = (process.env.ASSISTANT_PROVIDER || 'openai').trim().toLowerCase();
  const azureEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
  const azureDeployment = (process.env.AZURE_OPENAI_DEPLOYMENT || '').trim();
  const azureApiVersion =
    process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-08-01-preview';

  const openaiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const azureKey = process.env.AZURE_OPENAI_API_KEY?.trim() || '';

  const useAzure =
    provider === 'azure' ||
    (!!azureEndpoint && !!azureDeployment && !!azureKey);

  return {
    enabled: useAzure ? !!azureKey : !!openaiKey,
    provider: useAzure ? 'azure' : 'openai',
    apiKey: useAzure ? azureKey : openaiKey,
    model: process.env.ASSISTANT_MODEL?.trim() || 'gpt-4o-mini',
    openaiBaseUrl: (
      process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
    ).replace(/\/$/, ''),
    azureEndpoint,
    azureDeployment,
    azureApiVersion,
    timeoutMs: Number(process.env.ASSISTANT_TIMEOUT_MS || 25000),
    maxTokens: Number(process.env.ASSISTANT_MAX_TOKENS || 450),
  };
});
