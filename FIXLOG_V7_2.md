# v7.2 Vercel Hobby Function Limit Fix

Vercel Hobby plan allows a maximum of 12 Serverless Functions per deployment.

This package removes `api/reddit.js` from active Serverless Functions and moves it to `disabled-api/reddit.js`.
Reddit sentiment is still covered inside snapshot/daily-report/congress modules through internal fetch/fallback logic, so the active dashboard does not require a standalone `/api/reddit` function.

Important: when updating an existing GitHub repository, you must delete the old `api/reddit.js` from GitHub. Uploading files alone will not remove old files.
