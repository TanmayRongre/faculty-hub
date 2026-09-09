const { getSpreadsheetInfo, readRange } = require('./googleSheetsService');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function checkSheets() {
  try {
    const info = await getSpreadsheetInfo();
    console.log('Spreadsheet Title:', info.properties?.title);
    console.log('Worksheets:');
    for (const s of info.sheets) {
      console.log(` - ${s.properties.title}`);
    }

    // Let's check headers of marks sheets if any
    for (const s of info.sheets) {
      const title = s.properties.title;
      if (title.toUpperCase().includes('MARK') || title.toUpperCase().includes('PA')) {
        const rows = await readRange(`${title}!A1:Z2`);
        console.log(`\nHeader for ${title}:`, rows?.[0]);
        console.log(`Row 2 sample:`, rows?.[1]);
      }
    }
  } catch (err) {
    console.error('Error inspecting sheets:', err);
  }
}

checkSheets();
