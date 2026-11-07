# Cellar Cars

A read-only dashboard for the "Thing Doing - Cellar Cars Fleet" Google Sheet.

The same page works at two addresses:

```
markchang.net/cellar-cars/ (GitHub Pages) ──POST passphrase──▶ ┐
                                                                ├─ Apps Script (runs as Mark, checks passphrase) ──reads──▶ Google Sheet
script.google.com/…/exec (Google serves the page) ──────────────▶ ┘
```

- **`docs/index.html`**: the page. It has no data in it, so it's safe to host publicly. The same file is
  pasted into the Apps Script project as `Index`, so Google can serve it too.
- **`apps-script/Code.gs`**: returns the **Mark's Fleet** and **Jostin's Fleet** rows, but only to someone
  with the right passphrase. Opening its `/exec` URL in a browser serves the dashboard. It never writes to the sheet.

The page reloads the sheet every time you open it, so edits to the sheet show up on refresh.

## Part 1: Set up the Apps Script API (about 5 minutes)

1. Open the sheet and choose **Extensions → Apps Script**.
2. Rename the project (top left), for example to `Cellar Cars API`.
3. **Project Settings** (gear icon):
   - Turn on **Show "appsscript.json" manifest file in editor**.
   - Under **Script Properties**, click **Add script property**. Set the name to `API_KEY` and the value to a
     long passphrase you'll share with Jostin, for example four random words. Click **Save**.
4. **Editor**: replace `Code.gs` and `appsscript.json` with the files in `apps-script/`. Then click **+** next to
   Files → **HTML**, name it `Index` (the editor adds `.html`), and paste in all of `docs/index.html`.
   Save with Cmd+S.
5. Pick `testRead` in the function menu at the top and click **Run**. Approve the access prompt
   (choose **Advanced → Go to Cellar Cars API** if Google says the app isn't verified). It asks only
   for access to *this* spreadsheet. Google has no read-only version of that permission, but the
   code never writes.
   The log should say `86 cars read from Thing Doing - Cellar Cars Fleet` (or however many there are).
6. **Deploy → New deployment**, gear icon → **Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
7. Open the `/exec` URL. You should see the dashboard's passphrase prompt. This is the "direct Google"
   address, served over HTTPS by Google, and it works without GitHub Pages.

"Anyone" is required because a page on github.io can't use your Google sign-in. Anyone can open
the URL, but without the passphrase it shows only the prompt (or `{"error":"unauthorized"}` to the API).

## Part 2: Publish the page on GitHub Pages

1. In `docs/index.html`, find `const API_URL = 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE';` near the top of
   the script and paste in your `/exec` URL.
2. Create the repo and push. With the GitHub CLI:

   ```bash
   cd ~/Code/thing-doing
   git init -b main
   git add README.md docs apps-script
   git commit -m "Cellar Cars dashboard"
   gh repo create cellar-cars --public --source . --push
   ```

   Free GitHub accounts can only use Pages on **public** repos. That's fine here, because the repo holds
   code but no car data and no passphrase.
3. Turn on Pages, publishing from the `docs/` folder:

   ```bash
   gh api -X POST repos/{owner}/cellar-cars/pages -f "source[branch]=main" -f "source[path]=/docs"
   ```

   Or in the browser: repo **Settings → Pages → Build and deployment → Deploy from a branch →
   `main` / `/docs` → Save**.
4. After a minute or two the site is live at `https://<your-github-username>.github.io/cellar-cars/`.
   Open it, enter the passphrase, and send Jostin the link and the passphrase (separately).

## Making changes later

- **Page changes** (`docs/index.html`): commit and push. GitHub Pages republishes within a minute or two.
  For the Google address, also paste the file into `Index` in the editor and deploy a new version (next bullet).
- **API changes** (`Code.gs`): paste the new code into the Apps Script editor, then **Deploy → Manage
  deployments → pencil → Version: New version → Deploy**. The URL stays the same.
- **Change the passphrase**: edit the `API_KEY` script property. No redeploy is needed. Everyone will be
  asked for the new one on their next visit.

## How the sheet is read

- Each fleet tab needs a header row containing `In`, `Out`, `In $`, `Out $`, `Est $` and `Car`
  (`Color` is optional). The header can be in any row and column.
- Dates are month/year, like `3/2025`. An empty `Out` means the car is still owned.
- "Gain / loss" is `Out $` minus `In $`, only for sold cars with both prices.
- "Garage value" uses `Est $` for current cars, or `In $` when there's no estimate.
- To add another person, add a tab with the same headers and a line to `FLEETS` in `Code.gs`.
- The **Transactions** tab isn't read.
