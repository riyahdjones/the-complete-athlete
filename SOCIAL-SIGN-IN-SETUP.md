# Apple and Google sign-in

Code and production provider configuration are complete as of 2026-10-03. Apple and Google both reach their provider sign-in screens from the local app preview. Full account creation, role/link initialization, native device behavior, and returning-user acceptance checks still require test accounts before release.

## Provider configuration

Supabase project: `nddtgwygnzjikjynrzen`.
Provider callback URL: `https://nddtgwygnzjikjynrzen.supabase.co/auth/v1/callback`.

Allow these application redirects in Supabase Auth URL Configuration:
- `https://the-complete-athlete.vercel.app/?socialAuth=1`
- `com.riyahdjones.thecompleteathlete://auth/callback`
- Exact localhost callback URLs used for development, only when needed.

### Google

Create/select the app's Google Cloud project. Configure Google Auth Platform branding, audience, contact email and authorized domains. Create a Web OAuth client with the Supabase callback above. Store its client ID and secret in Supabase's Google provider configuration, never in browser source. Publish the consent configuration for external users after completing Google's required verification, if requested.

### Apple

In the owning Apple Developer team, enable Sign in with Apple on the primary app identifier `com.riyahdjones.thecompleteathlete`. Create a Services ID associated with that app, configure the Supabase domain and callback, and create a Sign in with Apple signing key. Generate the client-secret JWT securely and configure the Services ID and secret in Supabase. Apple OAuth client secrets expire within six months; establish rotation before launch. Configure private email relay sender domains if sending email to Apple's relay addresses.

## Implementation

- `src/socialAuth.js`: PKCE OAuth, short-lived role/link intent, native callback validation, new-account profile initialization, and existing-role preservation.
- `src/supabaseClient.js`: separate verifier-only OAuth storage; existing email/password recovery remains on its original flow.
- `src/main.jsx`: signup/login buttons, session restoration and family-link feedback.
- `src/styles.css`: social sign-in buttons.
- `ios/App/App/AppDelegate.swift`: ASWebAuthenticationSession plugin in an already compiled Swift source file.
- `ios/App/App/Base.lproj/Main.storyboard`: bridge subclass registration.
- `ios/App/App/Info.plist`: callback URL scheme.

A new native build is required. Native Swift syntax checking does not replace an Xcode build or device test.

## Acceptance checks

Test Apple and Google for a new athlete, a new parent (with/without an invitation code), and a returning user. Confirm existing email accounts retain their role and data, cancellation returns to the form, wrong codes provide Settings recovery, relaunch retains the session, onboarding/paywall behavior is unchanged, password reset still works across devices, and Apple Hide My Email works. Test provider errors and expired/missing PKCE verifier. Do not log authorization codes, access tokens, refresh tokens or provider secrets.

## Remaining validation

There are no remaining provider-configuration blockers. Complete the acceptance checks above before releasing a native build. The Apple client secret was generated on 2026-10-03 with a 180-day lifetime and must be rotated before it expires.

## Provider setup progress (2026-10-03)

- Apple primary App ID enabled for Sign in with Apple. Apple warned that provisioning profiles must be regenerated for future builds.
- Registered and configured Services ID `com.riyahdjones.thecompleteathlete.web` with the Supabase callback.
- Created Apple Sign in with Apple key `Q753B834L7`, scoped to the primary App ID. The private key was downloaded, verified, and restricted to owner-only file permissions. The signed OAuth client secret was stored directly in Supabase and removed from temporary storage.
- Google project `the-complete-athlete-510412` created; consent branding and public policy links saved; audience External and In production.
- Google Web client `758378168777-dhn3s3c8por3e6uhvi4qa2c9pptn8f3o.apps.googleusercontent.com` created. Secret saved directly to Supabase (not source files).
- Apple and Google enabled in Supabase; public settings verified `apple: true`, `google: true`, `email: true`.
- Native redirect `com.riyahdjones.thecompleteathlete://auth/callback` and local callback `http://127.0.0.1:5176/?socialAuth=1` are saved in Supabase.
- Local signup buttons were verified to reach Apple's account sign-in page and Google's account chooser with the correct client IDs and Supabase callback. No account was created during this verification.
- No app deployment or native archive was performed. A new Xcode build and on-device acceptance tests are still required.
