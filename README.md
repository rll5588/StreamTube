# Stream Tube Interface Prototype v3 — Portable Edition

This is the portable browser-based Version 3 prototype of Stream Tube.

## How to open it on another computer
1. Copy or download the complete ZIP file.
2. Extract/unzip the entire `StreamTubePrototype_v3_Portable` folder.
3. Open the extracted folder.
4. Double-click `index.html`.
5. Open it with a modern browser such as Chrome, Edge, Firefox, or Safari if prompted.

No Dreamweaver, VS Code, Node.js, database server, or installation process is required for this prototype.

## Important
Keep `index.html`, the `css` folder, and the `js` folder together in the same project folder. Do not move only `index.html`, because it uses relative paths to load `css/styles.css` and `js/app.js`.

## Version 3 features
- Stream Tube account creation and sign-in prototype
- Account/profile view and sign out
- Streaming-service selection
- Streaming account connection-status workflow
- Simulated provider verification for demonstration
- Movie/TV search using the prototype catalog
- Subscription-to-provider matching
- Watchlist add/remove behavior
- Responsive Stream Tube interface
- Browser localStorage for prototype data

## Portability and saved data
The application files are portable, but localStorage data is not transferred automatically between computers. An account, service selections, connection statuses, or watchlist created on one computer remain in that browser on that computer. A production version will require the planned Node.js/Express backend and database for accounts and saved information to follow a user between devices.

## Security / provider note
This is a classroom/interface prototype. Provider verification is simulated. Stream Tube does not collect streaming-provider passwords. A production implementation should use secure server-side password hashing, secure sessions/tokens, persistent database storage, and only officially supported provider authorization APIs or linking mechanisms.
