/**
 * Cellar Cars — read-only JSON API for the "Thing Doing - Cellar Cars Fleet" sheet.
 *
 * The page (docs/index.html, hosted on GitHub Pages) POSTs a passphrase here and
 * gets the fleet rows back as JSON. This script never writes to the sheet.
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
  const expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) return json_({ error: 'not_configured', message: 'Set the API_KEY script property.' });
  if (key !== expected) return json_({ error: 'unauthorized' });
  try {
    return json_(getFleetData_());
  } catch (err) {
    return json_({ error: 'read_failed', message: String(err && err.message || err) });
  }
}

/** Opening the /exec URL directly just confirms the API is up; it never returns data. */
function doGet() {
  return json_({ ok: true, message: 'Cellar Cars API. POST {"key": "..."} to get data.' });
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
