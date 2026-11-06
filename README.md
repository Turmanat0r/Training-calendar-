# 2027 Training Calendar

Hosted on Vercel: https://training-calendar-indol.vercel.app

- `index.html` is the calendar page.
- `api/events.js` stores the course dates in a Vercel Blob store so every device sees the same calendar.
- Changing the calendar needs the passcode set in the `CALENDAR_PASSCODE` environment variable.
