# Wave Scape website

The website for Wave Scape mobile auto and marine detailing (wavescaperi.org).

- **Home page** (`/`): services, the price menu, marine pricing, service area, memberships and an instant quote.
- **Booking** (`/book/`): customers pick a detail, enter their address (the travel fee is calculated from it), pick an open time, add photos, and pay a 10% deposit by card through Square.
- **Admin** (`/admin/`, password protected): upcoming and past bookings, mark jobs done or cancelled, close days on the calendar, and handle membership requests.

## Monthly cost

| Item | Cost |
|---|---|
| Hosting, booking database, photo storage (Cloudflare free tier) | $0 |
| Domain (keep wavescaperi.org where it's registered) | about $20/year |
| Address lookups (Google Maps; covered by Google's free monthly usage at this volume) | $0 |
| Confirmation emails (Resend free tier, 3,000/month) | $0 |
| Card payments (Square) | 2.9% + 30¢ per online charge, same as today |

## Business rules (all in `public/assets/pricing.js`)

Change prices in that one file. The website and the server both read it, so the price a customer sees is always the price they're charged.

- **Auto, sedan prices:** Interior $150 / $225, Exterior $100 / $150, Full $225 / $350 (Basic / Select).
- **Vehicle size:** SUV is 15% more than sedan, truck is a further 10% more than SUV. Prices round to the nearest $5.
- **Paint polish** from $300 and **ceramic coating** 3 / 5 / 10 years at $200 / $250 / $300. Both scale by size and are only offered with a Select Exterior or Select Full Detail (those include the iron decontamination and clay bar prep). The site recommends a polish before a coating.
- **Add-ons:** pet hair $75, engine bay $75, headlight restoration $125.
- **Boats:** priced per square foot (length × beam): wash & wax $1.25, polish $6, ceramic $15. Boats 10 to 200 ft.
- **Travel:** free within 5 driving miles of 19 Hope Rd, Cranston; $20 from 5 to 10 miles; $20 plus $1 per mile past 10.
- **Deposit:** 10% of the total, taken off the final bill.
- **Memberships** (sedan): Exterior $75, Interior $75, Full $120 a month, scaled by size. A customer can only request one after a completed Select detail: Select Exterior unlocks Exterior, Select Interior unlocks Interior, Select Full unlocks all three.

Calendar rules are in `functions/_lib/schedule.js`: one tech, 9 AM to 5 PM every day, 30 minutes between jobs for driving, closed on New Year's Day, Easter, Memorial Day, July 4, Labor Day, Thanksgiving and Christmas. Job lengths are at the bottom of `pricing.js`. Customers can book from tomorrow up to 60 days out.

## Setting it up

You'll need free accounts at Cloudflare, Square Developer, Google Cloud and Resend. Steps 1 to 3 use a terminal with Node.js installed.

1. **Install and sign in**
   ```
   npm install
   npx wrangler login
   ```
2. **Create the booking database** and paste the `database_id` it prints into `wrangler.toml`. The tables are created automatically the first time the site runs.
   ```
   npx wrangler d1 create wavescape
   ```
3. **Create the photo bucket** (turn on R2 in the Cloudflare dashboard first):
   ```
   npx wrangler r2 bucket create wavescape-photos
   ```
4. **Create the site:** in the Cloudflare dashboard go to Workers & Pages → Create → Pages → Connect to Git, pick this repository, leave the build command empty and set the output directory to `public`. Every push to `main` then updates the live site.
5. **Add the settings** under the Pages project → Settings → Variables and secrets (mark the keys as encrypted):

   | Name | What it is |
   |---|---|
   | `ADMIN_PASSWORD` | Password for `/admin/` (any username works) |
   | `OWNER_EMAIL` | Where new booking and membership emails go |
   | `SQUARE_APPLICATION_ID`, `SQUARE_LOCATION_ID`, `SQUARE_ACCESS_TOKEN` | From developer.squareup.com → your app → Credentials and Locations |
   | `GOOGLE_MAPS_API_KEY` | Google Cloud console → enable the Distance Matrix API → create a key restricted to it |
   | `RESEND_API_KEY`, `FROM_EMAIL` | From resend.com after verifying wavescaperi.org, e.g. `Wave Scape <bookings@wavescaperi.org>` |

6. **Test with Square sandbox keys** first. Book a detail using the test card `4111 1111 1111 1111`, any future date and any CVV. When it works, swap in your production Square keys and change `SQUARE_ENVIRONMENT` in `wrangler.toml` to `production`.
7. **Point the domain:** in the Pages project → Custom domains, add `www.wavescaperi.org` and `wavescaperi.org` and follow the DNS records it shows, entering them where the domain is registered (Squarespace Domains). Once the new site loads on your domain, cancel the Squarespace website plan but keep the domain.

## Day to day

- New bookings email you and show up on `/admin/`. The deposit is already in Square; collect the balance at the job with Square as usual.
- Mark a job **done** after a Select detail and the customer is emailed an invite to the monthly membership.
- To cancel, use **Cancel** on the admin page, then refund the deposit in the Square dashboard if you're refunding it.
- To take a day off, add it under **Closed days**.
- Membership requests arrive by email and on the admin page. Set up the monthly billing in Square (Invoices → recurring series), then mark the request **active**.

## Working on the code

```
cp .dev.vars.example .dev.vars   # test mode: no card charged, every address is 8 miles away
npm run db:local
npm run dev                      # http://localhost:8788
npm test                         # pricing and calendar tests
```
