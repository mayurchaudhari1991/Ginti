# Ginti

Expense tracker with month, year, bank, cash and category views, biometric lock, and a private AI assistant running on your own PC through Ollama.

Built with Expo SDK 58 (React Native 0.88), Expo Router, Reanimated 4 CSS animations, react-native-svg and Supabase.

**Screens:** sign up / log in, biometric unlock, home, add expense (typed sentence → entry), insights, banks and cash, Ginti AI chat, receipt scan, bills and subscriptions, spend calendar with search, budgets, year in review, profile, settings, auto-import.

## One-time setup

### 1. Supabase

1. Run the files in `supabase/migrations/` in order in the SQL editor. They create the tables, row level security, balances view, auto-import columns, and a trigger that gives each new user a cash wallet and default categories.
2. Authentication → URL Configuration: Site URL `ginti://auth-callback`, redirect allow list `ginti://**`. Tapping the login email's link on the phone then opens Ginti signed in.
3. Optional: with a custom SMTP provider, put `{{ .Token }}` in the Magic Link and Confirm signup templates; the app's code box then works too. Supabase's built-in mailer allows neither template edits nor more than a few emails an hour.
3. Copy the publishable key (Project Settings → API Keys) into `.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   `.env.example` lists every variable. The publishable key is safe in the app; never put the secret key or database password there.

### 2. Phone (OnePlus 13R)

1. Settings → About device → Version → tap **Build number** seven times.
2. Settings → System → Developer options → turn on **USB debugging**.
3. Reconnect the cable and accept the "Allow USB debugging" prompt.
4. Check with `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe devices`.

### 3. Ollama

The app talks to Ollama at `EXPO_PUBLIC_OLLAMA_URL` (changeable in Settings) using `gemma4:e2b`.

- **Over USB (dev):** `adb reverse tcp:11434 tcp:11434`, then set the URL in Settings to `http://localhost:11434`.
- **Over Wi-Fi:** Ollama must listen on the network. Set the user environment variable `OLLAMA_HOST=0.0.0.0`, restart Ollama, and allow inbound TCP 11434 on private networks in Windows Firewall. Then use `http://<PC IP>:11434`.

If Ollama is unreachable, adding expenses still works with an on-phone keyword parser; only the chat needs the PC.

## Run

```
npm install
npx expo start --android     # opens on the USB-connected phone in Expo Go
```

Expo Go runs everything except auto-import, which needs the native `modules/ginti-inbox` module and therefore the real APK.

## Shareable APK

```
npx expo prebuild --platform android
cd android
gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
```

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`. Build from a short path such as `F:\g`: React Native's C++ object paths exceed Windows' 260-character limit under longer folders. The release is signed with this PC's debug key, which is fine for sideloading; the Play Store needs a proper upload key.

## Auto-import

`modules/ginti-inbox` is a local Expo module that reads bank SMS (`READ_SMS`) and listens for notifications from Google Pay, PhonePe, Paytm and bank apps. `src/lib/inbox-parse.ts` turns those into entries, merges the SMS and the app notification for the same payment, and queues them for review in Settings → Auto-import. Nothing leaves the phone until the user approves an entry, and `transactions.external_ref` stops a message being imported twice (`supabase/migrations/0002_auto_import.sql`).

## Checks

```
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx tsx scripts/test-inbox-parse.ts   # bank SMS / UPI notification parser
```
