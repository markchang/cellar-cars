/**
 * Cellar Cars — read-only JSON API for the "Thing Doing - Cellar Cars Fleet" sheet.
 *
 * The same page (docs/index.html) works from two addresses:
 *  - GitHub Pages: the page POSTs a passphrase to this script's /exec URL (doPost) and gets JSON back.
 *  - The /exec URL itself: doGet serves the page (pasted into this project as the "Index" HTML file),
 *    and the page calls getFleetDataForKey() directly.
 * Either way the passphrase is required. This script never writes to the sheet.
 *
 * Setup: Project Settings → Script Properties → add API_KEY = <your passphrase>.
 * The passphrase lives only in Script Properties, never in this file, because
 * this file is published in a public GitHub repo.
 */

const SPREADSHEET_ID = '1-Utm4rmbU2xA7oYEPLYfbGY5mIuSKvsM_0WvuF5t-Mw';

// One entry per fleet tab. The order here is the order (and color) owners get on the page.
const FLEETS = [
  { owner: 'Mark', sheet: "Mark's Fleet" },
  { owner: 'Jostin', sheet: "Jostin's Fleet" },
];

/**
 * The page sends the passphrase in a text/plain POST body (a "simple" request, so the
 * browser doesn't need a CORS preflight, and the passphrase stays out of URLs and logs).
 */
function doPost(e) {
  let key = '';
  try {
    key = JSON.parse((e && e.postData && e.postData.contents) || '{}').key || '';
  } catch (err) {
    return json_({ error: 'bad_request' });
  }
  return json_(getFleetDataForKey(key));
}

/** Opening the /exec URL in a browser serves the dashboard page. It shows no data until the passphrase is entered. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Cellar Cars')
    // Google serves the page from its own domain, so point at the icon in the GitHub repo.
    .setFaviconUrl('https://raw.githubusercontent.com/markchang/cellar-cars/main/docs/favicon-32.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called by the page when Google hosts it (google.script.run), and by doPost. */
function getFleetDataForKey(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) return { error: 'not_configured', message: 'Set the API_KEY script property.' };
  if (String(key || '') !== expected) return { error: 'unauthorized' };
  try {
    return getFleetData_();
  } catch (err) {
    return { error: 'read_failed', message: String(err && err.message || err) };
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getFleetData_() {
  // This script is bound to the sheet (Extensions → Apps Script), so it reads its own sheet.
  // That needs only the "spreadsheets.currentonly" scope: access to this one sheet, not all your sheets.
  // (openById would need full access to every spreadsheet you own; the read-only scope isn't enough for it.)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the script from the sheet (Extensions → Apps Script) so it is bound to it.');
  if (ss.getId() !== SPREADSHEET_ID) throw new Error('This script is bound to a different spreadsheet: ' + ss.getName());
  const cars = [];
  FLEETS.forEach(function (fleet) {
    readFleet_(ss, fleet).forEach(function (car) { cars.push(car); });
  });
  return {
    title: ss.getName(),
    url: ss.getUrl(),
    owners: FLEETS.map(function (f) { return f.owner; }),
    generatedAt: new Date().toISOString(),
    cars: cars,
  };
}

/** Run this once from the editor (select it, click Run) to approve access and check the output. */
function testRead() {
  const data = getFleetData_();
  Logger.log(data.cars.length + ' cars read from ' + data.title);
}

/**
 * Finds the header row (the one containing "In" and "Car") instead of assuming a
 * fixed position, so the tabs can have summary rows above it or be shifted a column
 * (Jostin's tab starts in column B).
 */
function readFleet_(ss, fleet) {
  const sheet = ss.getSheetByName(fleet.sheet);
  if (!sheet) throw new Error('Missing tab: ' + fleet.sheet);

  // Display values keep dates as the "M/YYYY" text shown in the sheet and prices as "$1,234".
  const values = sheet.getDataRange().getDisplayValues();
  const headerIndex = values.findIndex(function (row) {
    const cells = row.map(function (c) { return String(c).trim(); });
    return cells.indexOf('In') !== -1 && cells.indexOf('Car') !== -1;
  });
  if (headerIndex === -1) throw new Error('No header row with "In" and "Car" in ' + fleet.sheet);

  const header = values[headerIndex].map(function (c) { return String(c).trim(); });
  const col = function (name) { return header.indexOf(name); };
  const cell = function (row, name) {
    const i = col(name);
    return i === -1 ? '' : String(row[i]).trim();
  };

  return values.slice(headerIndex + 1)
    .filter(function (row) { return cell(row, 'Car') && cell(row, 'In'); })
    .map(function (row) {
      return {
        owner: fleet.owner,
        car: cell(row, 'Car'),
        in: cell(row, 'In'),
        out: cell(row, 'Out'),
        inPrice: cell(row, 'In $'),
        outPrice: cell(row, 'Out $'),
        est: cell(row, 'Est $'),
        color: cell(row, 'Color'),
      };
    });
}
