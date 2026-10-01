# firebase/

The Firebase project behind `FirebaseSignaling`: deploy these to the project whose web config is
`DEFAULT_FIREBASE_CONFIG`, or to your own project (then pass its config as `FirebaseSignaling`'s
`config`). Not part of the npm package.

| File | What |
|---|---|
| `database.rules.json` | Realtime Database rules - the contract the client relies on (see the package README's "Firebase project setup") |
| `functions/index.js` | optional `sweepStaleRooms`, a scheduled function removing nodes older than 10 minutes |
| `firebase.json` | deploy targets for both |

## Project setup

1. **Authentication** → Sign-in method → enable **Anonymous**.
2. **Realtime Database** → create it (locked mode; the rules below replace it). Make sure the web
   config you use contains its `databaseURL`.
3. Deploy the rules:

   ```bash
   npm install -g firebase-tools
   firebase login
   cd packages/multiplayer/firebase
   firebase use --add            # writes .firebaserc (gitignored)
   firebase deploy --only database
   ```

This is all the client needs, and it runs on the free Spark plan.

## The sweep function (optional, Blaze plan)

Every node a client writes is removed by its `onDisconnect()`, so the function only cleans up what a
client that never reached the database again left behind. Scheduled functions need the Blaze
(pay-as-you-go) plan:

```bash
cd packages/multiplayer/firebase/functions && npm install && cd ..
firebase deploy --only functions   # approve enabling Cloud Scheduler when asked
```

If you enable App Check enforcement on the database, pass `appCheckSiteKey` to `FirebaseSignaling`
too, or every client is rejected.
