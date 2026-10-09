# Stream Tube Interface Prototype — Version 3

Open `index.html` in Chrome, Edge, or Firefox. No server is required for this prototype.

## Version 3 features
- Movie/TV discovery demo and sample availability matching
- Select and save streaming services
- Watchlist
- Create a Stream Tube account, sign in, profile, and sign out
- New **Connect Streaming Services** workflow
- Connection states: Not Selected, Selected / Not Verified, Verified / Active, and Disconnected
- Simulated provider verification so the UI can be demonstrated without collecting streaming-service credentials
- Account profile displays selected and verified service counts
- Manage connections from both My Services and Account

## Important security note
This is a browser-only classroom prototype. Account information and the demo password are stored in localStorage, so do not use a real password. The provider verification button is also simulated. A production Stream Tube application should use a Node.js/Express back end, secure password hashing, server-side sessions/tokens, and only officially supported provider authorization APIs. Stream Tube should never collect or store Netflix, Hulu, Disney+, Max, Peacock, Prime Video, or other provider passwords.
