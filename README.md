# Maqaṣṣ — Barber Booking Prototype

A bilingual (English / Arabic) barbershop website prototype. Visitors pick a service, a barber, a date and a time, then leave their name and phone. The flow is fully working — bookings are stored in `localStorage` so the demo feels real end-to-end. Designed to be wired to Firebase later in one place.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home — hero, barbers, services teaser, CTA band |
| `services.html` | Full services menu (tasting-menu layout) |
| `book.html` | Four-step booking flow + confirmation |
| `mine.html` | List of past/upcoming reservations |

The header, nav, language toggle, and footer are duplicated across all four files.

## Stack

- Plain HTML + CSS + vanilla JS (ES modules). No build step, no dependencies.
- Fonts loaded from Google Fonts: **Fraunces** (EN display), **Geist** (EN body), **Rubik** (AR display), **IBM Plex Sans Arabic** (AR body).
- The chair photo at `assets/chair.png` is used as the hero image.

## Files

```
barber prototype/
├── index.html        — home
├── services.html     — services menu
├── book.html         — booking flow
├── mine.html         — my bookings
├── README.md
├── assets/
│   └── chair.png     — hero image
├── css/
│   └── styles.css    — full styles incl. RTL overrides + mobile nav
└── js/
    ├── app.js        — state, language toggle, booking logic, submitBooking()
    ├── i18n.js       — { en: {...}, ar: {...} } dictionary
    └── data.js       — services, barbers, slot generator (Fridays closed before 14:00)
```

## Running it locally

ES modules need a real HTTP server (opening `index.html` via `file://` will fail with a CORS error). From the project folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

Any other static server works too:
- `npx http-server` if you have Node.js
- VS Code "Live Server" extension

## Language toggle

Click `EN / ع` in the header. The choice is saved to `localStorage` so it persists across page loads.

- All translatable strings live in `i18n.js` under `dict.en` and `dict.ar`, keyed by `data-i18n="key.path"` attributes in the HTML.
- The `setLanguage()` function in `app.js` swaps `<html lang>`, `<html dir>`, walks all `[data-i18n]` elements, and re-renders dynamic UI.
- RTL is handled by CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.), so most layout flips for free. Only the hero image and a few icons are explicitly mirrored under `[dir="rtl"]`.

## Mobile

- Below 880px the desktop top nav becomes a **fixed bottom tab bar** (thumb-zone reachable), and the hero image stacks above the headline.
- All interactive elements meet the 44–48px touch-target minimum.
- `:hover` states are paired with `:active` states for tap feedback.
- The Confirm button shows a "Reserving…" loading state with a pulsing dot while submission is in flight.

## Wiring Firebase later

Only **one function** changes when you connect Firebase. In `app.js`, find:

```js
async function submitBooking(booking) {
  // === FIREBASE INTEGRATION POINT =========================
  // Replace this localStorage block with Firestore later, e.g.:
  //
  //   import { db } from './firebase.js';
  //   import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  //   const ref = await addDoc(collection(db, 'bookings'), {
  //     ...booking,
  //     createdAt: serverTimestamp(),
  //   });
  //   return ref.id;
  //
  // Everything outside this function stays the same.
  // ========================================================

  const all = JSON.parse(localStorage.getItem('bookings') || '[]');
  ...
}
```

Replace the localStorage body with an `addDoc` call (or whatever backend you choose). The signature stays `async function submitBooking(booking) → string id`, and nothing else in the app needs to change.

If you also want to read bookings from Firestore on `mine.html`, replace the `JSON.parse(localStorage.getItem('bookings'))` call inside `renderMine()` with a Firestore `getDocs(...)` call.

## Prototype data

Currency is **SAR**, set in `data.js`. Change once and it propagates everywhere.

| Service | Duration | Price |
|---|---|---|
| Classic Haircut | 30 min | 60 SAR |
| Beard Trim | 20 min | 35 SAR |
| Hot Towel Shave | 40 min | 75 SAR |
| Hair & Beard | 50 min | 90 SAR |
| Kids Cut | 25 min | 45 SAR |

Barbers: Ahmed Al-Rashid, Khalid Mansour, Yousef Ibrahim, Omar Saleh.

Time slots: 10:00 to 21:00, every 30 min. Fridays closed before 14:00 (for demo variety).

## Notes

- This is a prototype. No real auth, no SMS confirmation, no payments, no admin dashboard.
- Names, prices and phone number are placeholders — adjust them in `data.js` and `i18n.js` for a real shop.
