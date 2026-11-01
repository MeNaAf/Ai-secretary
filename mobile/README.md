# AI Secretary mobile (Expo WebView wrapper)

Wraps https://aisecratory.netlify.app. Change `APP_URL` in `App.tsx` if the origin changes.

```bash
cd mobile
npm install
npx expo install expo react react-native react-native-webview expo-status-bar expo-updates
npx expo start                      # test in Expo Go

npm i -g eas-cli && eas login
eas init                            # links the project to your Expo account
eas build --profile preview --platform android   # installable APK for testing
eas build --profile production --platform all
eas submit --platform all --latest
```

OTA updates (JS-only changes): `eas update --branch production --message "..."`.

Before store submission: Apple requires In-App Purchase for digital subscriptions (guideline 3.1.1),
so PayPal checkout inside the iOS app is likely to be rejected.
