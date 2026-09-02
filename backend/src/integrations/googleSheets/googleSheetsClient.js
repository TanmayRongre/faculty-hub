/**
 * googleSheetsClient.js
 *
 * Authenticates with the Google Sheets API using a service account.
 * Returns a singleton authenticated Sheets client.
 * All credential handling is isolated here — never exposed to controllers.
 */

const { google } = require('googleapis');
const { SheetsAuthError, translateGoogleError } = require('./errors');

let _sheetsClient = null;

/**
 * Returns an authenticated Google Sheets API client.
 * Uses GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY from environment.
 * Caches the client instance for the process lifetime.
 *
 * @returns {import('googleapis').sheets_v4.Sheets}
 * @throws {SheetsAuthError} if credentials are invalid or missing
 */
function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new SheetsAuthError(
      'Google Sheets credentials are not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.'
    );
  }

  email = email.trim().replace(/^["']|["']$/g, '');
  rawKey = rawKey.trim().replace(/^["']|["']$/g, '');

  // .env often escapes \n as \\n — normalise
  const privateKey = rawKey.replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    _sheetsClient = google.sheets({ version: 'v4', auth });
    return _sheetsClient;
  } catch (err) {
    throw translateGoogleError(err);
  }
}

/**
 * Validates that the required Google Sheets environment variables are present.
 * Does NOT make any network calls.
 *
 * @returns {{ configured: boolean, missing: string[] }}
 */
function checkConfiguration() {
  const required = [
    'GOOGLE_SPREADSHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  return { configured: missing.length === 0, missing };
}

/**
 * Resets the cached client (for testing or credential rotation).
 */
function resetClient() {
  _sheetsClient = null;
}

module.exports = { getSheetsClient, checkConfiguration, resetClient };
