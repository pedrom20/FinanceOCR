<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1XvYpq1zcJN1-l9lSLjG-D9jq85OT-3PK

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firestore / Storage security rules

`firestore.rules` and `storage.rules` restrict every user to their own invoices and uploaded files. They only take effect once deployed with the Firebase CLI:

```
firebase deploy --only firestore:rules,storage:rules
```

## API authentication

`api/server.js` requires a Firebase ID token (`Authorization: Bearer <token>`) on `/api/ocr/process-invoice` and `/api/reports/pdf`. To validate end-to-end after `npm run start` (with real Firebase Admin credentials in `.env`): log in from the frontend, upload an invoice, and download the PDF report — both should succeed while a request without the header returns `401`.
