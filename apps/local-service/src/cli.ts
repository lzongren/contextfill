import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const environmentTemplate = `# Optional. ContextFill works without an OpenAI key.
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
CONTEXTFILL_SERVICE_PORT=4318

# Set to 1 for one service start to clear a lost pairing and print a new code.
CONTEXTFILL_PAIRING_RESET=0

# Register the provider callback URLs documented in MAILBOX_INTEGRATION.md.
CONTEXTFILL_OAUTH_REDIRECT_ORIGIN=http://localhost:4318

# Gmail API OAuth web client. ContextFill requests gmail.readonly.
CONTEXTFILL_GOOGLE_CLIENT_ID=
CONTEXTFILL_GOOGLE_CLIENT_SECRET=

# Microsoft Entra public client. common supports personal plus work/school accounts.
CONTEXTFILL_MICROSOFT_CLIENT_ID=
CONTEXTFILL_MICROSOFT_TENANT=common
`;

export const helpText = `ContextFill companion service

Usage:
  contextfill-service --init   create a private .env template in the current directory
  contextfill-service          start the loopback service on 127.0.0.1:4318
  contextfill-service --help   show this help

Configure a Gmail or Microsoft OAuth application in .env before connecting a real mailbox.
The service prints a one-time code used to pair the ContextFill extension.`;

export async function initializeConfig(directory = process.cwd()): Promise<string> {
  const output = resolve(directory, '.env');
  await writeFile(output, environmentTemplate, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return output;
}
