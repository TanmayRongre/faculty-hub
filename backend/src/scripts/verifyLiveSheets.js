/**
 * verifyLiveSheets.js
 *
 * Comprehensive Live Verification of Google Sheets integration for Phase 3.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { getSheetsClient, resetClient } = require('../integrations/googleSheets/googleSheetsClient');
const sheetsService = require('../integrations/googleSheets/googleSheetsService');
const { SHEET_NAMES } = require('../integrations/googleSheets/spreadsheetConfig');

async function verifyLive() {
  console.log('=== Live Google Sheets Verification ===');
  resetClient();

  const id = (process.env.GOOGLE_SPREADSHEET_ID || '').trim().replace(/^["']|["']$/g, '');
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim().replace(/^["']|["']$/g, '');

  console.log(`• Target Spreadsheet ID: ${id}`);
  console.log(`• Service Account Email: ${email}`);

  try {
    const client = getSheetsClient();
    const res = await client.spreadsheets.get({ spreadsheetId: id });
    console.log(`✅ Authentication & Spreadsheet Access: SUCCESS`);
    console.log(`• Title: "${res.data.properties?.title}"`);
    console.log(`• Sheets present: ${res.data.sheets?.map((s) => s.properties.title).join(', ')}`);
    return { success: true, data: res.data };
  } catch (err) {
    console.error(`❌ Raw Error:`, err);
    return { success: false, error: err };
  }
}

if (require.main === module) {
  verifyLive().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = verifyLive;
