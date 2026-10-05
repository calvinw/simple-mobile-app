# Simple Mobile App

A standalone React Native app built with Expo SDK 54, TypeScript, and Expo Router.
The Expo project lives directly in the repository root.

Based on the `mobile/` app from
[elenachoi1/product-graph-editor-mobile](https://github.com/elenachoi1/product-graph-editor-mobile).
Includes its existing product graph editor and LCA analysis screens.

## Quick start

Use Node.js 20.19+ (Node.js 22 LTS recommended).

```bash
git clone https://github.com/calvinw/simple-mobile-app.git
cd simple-mobile-app
npm ci
npm start
```

Install an Expo Go version compatible with SDK 54 on your phone and scan the QR
code. For LAN development, keep your phone and computer on the same Wi-Fi.
See [Expo Go downloads](https://expo.dev/go) for SDK compatibility information.

For remote development, Codespaces, or restrictive Wi-Fi networks:

```bash
npm run start:tunnel
```

## Development commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server |
| `npm run start:lan` | Connect over your local network |
| `npm run start:tunnel` | Connect through a tunnel |
| `npm run ios` | Open in an iOS simulator (requires macOS and Xcode) |
| `npm run android` | Open in an Android emulator (requires Android Studio setup) |
| `npm run web` | Run in a browser |
| `npm run check` | Run ESLint and TypeScript checks |

## Project layout

```text
app/          Expo Router screens and layouts
assets/       App icons, splash images, and other assets
components/   Reusable UI and graph components
constants/    Theme configuration
hooks/        React hooks
lib/          Product graph model and LCA API client
scripts/      Starter reset utility
app.json      Expo app configuration
package.json  Dependencies and development commands
```

Edit `app/(tabs)/index.tsx` to change the main screen.
Imports using `@/` resolve from the repository root.

## API configuration

The inherited LCA features use `https://lca.mathplosion.com` by default.
To use a different backend, create `.env.local` at the repository root:

```dotenv
EXPO_PUBLIC_LCA_API_BASE=https://your-api.example.com
```

Restart Expo after changing this value. `EXPO_PUBLIC_*` values are included in the
client bundle and should contain only public configuration.

## Reset to a starter screen

`npm run reset-project` moves the current `app`, `components`, `hooks`,
`constants`, and `scripts` directories into `app-example/` and creates a minimal
`app/`. Commit any work you want to keep before using this command.

## License

MIT; see [LICENSE](LICENSE).
