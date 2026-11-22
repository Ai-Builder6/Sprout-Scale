# SproutScale — Complete Launch Guide for https://sprout-scale.com/ & Meta Ads

Welcome! This Launch Kit contains **every instruction, URL, icon, ad banner, QR code, and compliance checklist** you need to:
1. Run your downloadable SproutScale mobile app under **https://sprout-scale.com/**
2. Approve **sprout-scale.com** across **Google Cloud Run**, **Firebase Auth**, and **Google OAuth**
3. Verify **sprout-scale.com** in **Meta Business Suite**, connect your **Meta Pixel**, configure your **Meta Developer App**, and run **Facebook & Instagram Ads** smoothly without ad rejections or domain warnings.

---

## What Is Inside This Launch Kit Folder

- `00-START-HERE-COMPLETE-GUIDE.md` — This complete start-to-finish guide (Markdown)
- `00-START-HERE-COMPLETE-GUIDE.html` — The same guide formatted nicely to open in Chrome/Safari/Edge
- `01-META-COPY-PASTE-CHEATSHEET.txt` — Every exact URL, ID, and Meta-compliant ad copy ready to copy & paste
- `02-DNS-AND-CLOUD-RUN-CHECKLIST.txt` — Quick DNS & SSL checklist for your domain registrar
- `icons/`
  - `01-meta-app-icon-1024x1024.png` — Exact **1024 × 1024 PNG** full-bleed icon for Meta for Developers
  - `02-facebook-instagram-profile-512x512.png` — **512 × 512 PNG** for Facebook Page & Instagram Profile Picture
  - `03-pwa-icon-512x512.png` — **512 × 512 PNG** mobile app icon
  - `04-pwa-maskable-512x512.png` — **512 × 512 PNG** Android adaptive maskable icon
  - `05-pwa-icon-192x192.png` — **192 × 192 PNG** mobile launcher icon
  - `06-apple-touch-icon-180x180.png` — **180 × 180 PNG** iPhone / iPad Home Screen icon
  - `07-favicon-32x32.png` — **32 × 32 PNG** browser tab favicon
  - `08-favicon.ico` — Standard `.ico` favicon
  - `09-sproutscale-logo-vector.svg` — Scalable vector logo
- `social-and-ads/`
  - `01-meta-og-link-preview-1200x630.png` — **1200 × 630 PNG** (also hosted live at `https://sprout-scale.com/og-share-1200x630.png`)
  - `02-facebook-page-cover-1640x924.png` — **1640 × 924 PNG** Facebook Business Page Cover Photo
  - `03-meta-ad-square-1080x1080.png` — **1080 × 1080 PNG** Facebook & Instagram Feed Ad Image
  - `04-meta-ad-story-reel-1080x1920.png` — **1080 × 1920 PNG** Instagram & Facebook Stories / Reels Ad Image
  - `05-storybook-daytime-scene.jpg` — Daytime Storybook visual for carousel ads
  - `06-storybook-bedtime-scene.jpg` — Bedtime Storybook visual for carousel ads
  - `07-growth-wall-playroom.jpg` — Growth Wall visual for carousel ads
- `qr-codes/`
  - `sproutscale-download-qr-sprout-scale-com.png` — Scannable PNG QR code for `https://sprout-scale.com/?install=1`
  - `sproutscale-download-qr-sprout-scale-com.svg` — Vector SVG QR code for flyers, cards, or print

---

## PHASE 1: Map https://sprout-scale.com/ to Your Live SproutScale App (Cloud Run + DNS)

> **Why this comes first:** Meta Business Manager, Meta Pixel, and Meta Ads require `https://sprout-scale.com/` to load your live SproutScale app with a valid HTTPS padlock (never a "Coming Soon" or registrar parking page!).

1. **Deploy the latest SproutScale build to Cloud Run** from AI Studio (click **Deploy / Share** in AI Studio so the newest version—including `https://sprout-scale.com/?install=1`, Storybook Time, and `/og-share-1200x630.png`—is live).
2. Open **Google Cloud Console → Cloud Run → Domain Mappings** (project: `bookmycleaning-tidyups-v001`):
   - Click **Add Mapping**.
   - Select your deployed SproutScale Cloud Run service.
   - Enter root domain: `sprout-scale.com` (verify ownership via Google Search Console TXT record if prompted).
   - Repeat **Add Mapping** for `www.sprout-scale.com` pointing to the same Cloud Run service.
3. **Update DNS records at your domain registrar** (e.g., Hostinger / GoDaddy / Namecheap / Cloudflare):
   - **CRITICAL:** Delete any old "Parking Page", "Coming Soon", or default registrar `A` / `AAAA` / `CNAME` records for `@` and `www`.
   - Add the exact `A` and `AAAA` records shown by Cloud Run for `@` (`sprout-scale.com`) — typically Google Cloud Run's 4 IPv4 (`216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21`) and 4 IPv6 addresses.
   - Add the `CNAME` record shown by Cloud Run for `www` → `ghs.googlehosted.com.`
   - Wait 10–45 minutes for Cloud Run to issue the automatic SSL certificate (green checkmark next to both `sprout-scale.com` and `www.sprout-scale.com`).
4. **Verify in a private browser tab:**
   - Open `https://sprout-scale.com/` → SproutScale loads with a padlock.
   - Open `https://sprout-scale.com/privacy` → Privacy Policy loads cleanly.
   - Open `https://sprout-scale.com/terms` → Terms of Service loads cleanly.
   - Open `https://sprout-scale.com/data-deletion` → Data Deletion page loads cleanly.
   - Open `https://sprout-scale.com/og-share-1200x630.png` → Share banner loads cleanly.

---

## PHASE 2: Approve sprout-scale.com in Firebase Auth & Google Cloud OAuth

> **Why this matters:** Without adding `sprout-scale.com` here, parents clicking "Sign in with Google" on your live domain will see an `auth/unauthorized-domain` error!

### Step 2A — Firebase Authorized Domains
1. Go to **Firebase Console**: `https://console.firebase.google.com/project/bookmycleaning-tidyups-v001/authentication/settings`
2. Click **Authorized domains** → **Add domain**.
3. Add `sprout-scale.com` and click **Add**.
4. Add `www.sprout-scale.com` and click **Add**.

### Step 2B — Google Cloud OAuth Client
1. Go to **Google Cloud Console → APIs & Services → Credentials** (project: `bookmycleaning-tidyups-v001`).
2. Click your Web OAuth 2.0 Client ID: `509716171565-mfan543u4mv1lvee97hupkovlk201nh2.apps.googleusercontent.com`
3. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `https://sprout-scale.com`
   - `https://www.sprout-scale.com`
4. Under **Authorized redirect URIs**, make sure `https://sprout-scale.com` and `https://bookmycleaning-tidyups-v001.firebaseapp.com/__/auth/handler` are present.
5. Click **Save**.

---

## PHASE 3: Verify sprout-scale.com in Meta Business Portfolio (Required Before Running Ads!)

> **Why this matters:** Domain verification tells Meta that YOU own `sprout-scale.com`, protects your ad links from being rejected, and unlocks full conversion tracking & link preview editing.

1. Open **Meta Business Settings**: `https://business.facebook.com/settings`
2. In the left sidebar, go to **Brand Safety and Suitability → Domains**.
3. Click **Add** → **Create a new domain** → enter `sprout-scale.com` (no `https://`, no trailing slash) → click **Add**.
4. Choose the **Update the DNS TXT record with your domain registrar** tab (recommended because it stays verified permanently even across app redeploys!).
5. Copy the TXT string Meta gives you (looks like `facebook-domain-verification=xxxxxxxxxxxx`).
6. Go to your domain registrar DNS panel for `sprout-scale.com`:
   - Add a **TXT** record
   - Host / Name: `@`
   - Value: paste `facebook-domain-verification=xxxxxxxxxxxx`
   - TTL: Automatic / 300 seconds → Save.
7. Wait 5–15 minutes, return to Meta Business Settings, and click **Verify Domain** until it turns **Verified (Green)**.
8. Inside that same Domain screen, click **Connected Assets → Assign Assets** and connect your **SproutScale Facebook Page**.

---

## PHASE 4: Configure Meta Pixel (`1701764191622077`) in Meta Events Manager

> **Good news:** Your Meta Pixel ID `1701764191622077` is **already installed** inside SproutScale (`index.html`), firing `PageView` automatically!

1. Open **Meta Events Manager**: `https://business.facebook.com/events_manager2`
2. Select your Dataset / Pixel **`1701764191622077`**.
3. Go to **Settings → Traffic Permissions**:
   - Choose **Create allow list** and add `sprout-scale.com` and `www.sprout-scale.com`.
   - This prevents spam domains from polluting your Pixel data.
4. Go to **Test Events**:
   - Enter `https://sprout-scale.com/` and click **Open Website**.
   - Confirm a green **`PageView`** event appears in real time!
5. Go to **Business Settings → Data Sources → Datasets & Pixels → `1701764191622077` → Connected Assets**:
   - Assign your **Meta Ad Account** to this Pixel so Ads Manager can track clicks and landing-page views with zero warnings.

---

## PHASE 5: Create & Configure Your Meta App (Meta for Developers)

> Do this if you want SproutScale linked as an official Meta App and to enable direct Facebook / Instagram sharing from inside the app.

1. Open **Meta for Developers**: `https://developers.facebook.com/apps/`
2. Click **Create App** → choose **Authenticate and request data from users with Facebook Login** (or **Other → Consumer / Business**).
3. Name the app **`SproutScale`**, set contact email **`cleaningserviceyeg@gmail.com`**, and link your **Meta Business Portfolio**.
4. Go to **App Settings → Basic** and paste these exact values:
   - **Display Name:** `SproutScale`
   - **App Domains:** `sprout-scale.com` and `www.sprout-scale.com`
   - **Privacy Policy URL:** `https://sprout-scale.com/privacy`
   - **Terms of Service URL:** `https://sprout-scale.com/terms`
   - **User Data Deletion:** Select **Data Deletion Callback URL** and enter:
     - `https://sprout-scale.com/api/meta/data-deletion`
     - *(Or if using Data Deletion Instructions URL: `https://sprout-scale.com/data-deletion`)*
   - **Category:** `Lifestyle` (or `Family & Parenting`)
   - **App Icon (1024 × 1024):** Upload `icons/01-meta-app-icon-1024x1024.png` from this ZIP!
   - Scroll to the bottom → **+ Add Platform → Website** → **Site URL:** `https://sprout-scale.com/`
   - Click **Save Changes**.
5. Go to **Facebook Login for Business (or Facebook Login) → Settings**:
   - **Valid OAuth Redirect URIs:** `https://sprout-scale.com/auth/meta/callback`
   - Click **Save Changes**.
6. *(Optional — to enable direct 1-click FB/IG posting inside SproutScale)*:
   - Copy **App ID** and **App Secret** from **App Settings → Basic**.
   - Add them as environment secrets `META_APP_ID` and `META_APP_SECRET` in your Cloud Run service / AI Studio Secrets.
7. Toggle App Mode from **Development** to **Live** once all Basic Settings are saved.

---

## PHASE 6: Set Up Your Facebook Page & Instagram Profile (Using Included Icons & Covers)

1. **Facebook Page** (`SproutScale`):
   - Profile Picture: upload `icons/02-facebook-instagram-profile-512x512.png`
   - Cover Photo: upload `social-and-ads/02-facebook-page-cover-1640x924.png`
   - Website: `https://sprout-scale.com/`
   - Contact Email: `cleaningserviceyeg@gmail.com`
   - Category: `App Page` or `Baby & Children's Product / Parenting`
   - Make 2–3 organic posts using `social-and-ads/03-meta-ad-square-1080x1080.png` and the storybook scenes so your Page looks active and trustworthy before launching paid ads!
2. **Instagram Professional Account** (`@sproutscale` or similar):
   - Profile Picture: upload `icons/02-facebook-instagram-profile-512x512.png`
   - Link in Bio: `https://sprout-scale.com/?install=1`
   - Link your Instagram Account to your Facebook Page inside **Meta Business Settings → Accounts → Instagram Accounts**.

---

## PHASE 7: Pre-Ad Launch Checklist (Prevent Meta Ad Rejections!)

Run through these 6 checks BEFORE publishing your first ad campaign:

1. **Test Meta Link Preview Cache**:
   - Open **Facebook Sharing Debugger**: `https://developers.facebook.com/tools/debug/`
   - Enter `https://sprout-scale.com/` and click **Debug** (then click **Scrape Again** once).
   - Confirm it shows your **SproutScale title**, **description**, and the **1200×630 illustration preview** with zero errors.
2. **Verify All Legal & Trust Pages Return HTTP 200**:
   - `https://sprout-scale.com/privacy`
   - `https://sprout-scale.com/terms`
   - `https://sprout-scale.com/contact`
   - `https://sprout-scale.com/support`
   - `https://sprout-scale.com/data-deletion`
3. **Target Parents (Adults 18+ Only)**:
   - In Meta Ads Manager, set Audience Age to **22–55+** (Parents of Toddlers / Preschoolers / Early School-Age Kids).
   - Never target users under 18.
4. **Follow Meta's "Personal Attributes" Ad Policy**:
   - **DO NOT write:** *"Is your child too short?"* or *"Are you a stressed parent?"* (Meta flags ads that directly assert personal attributes about the viewer or children's health).
   - **DO write:** Positive, benefit-driven copy celebrating milestones, growth keepsakes, and bedtime storybooks! (Ready-to-use compliant ad copy is in `01-META-COPY-PASTE-CHEATSHEET.txt`.)
5. **Avoid Medical Claims**:
   - Describe SproutScale as a **family growth keepsake, photo height ruler, kids playroom, and personalized storybook app** — never as a medical diagnostic tool.
6. **Destination URL for Ads**:
   - Use **`https://sprout-scale.com/?install=1`** for mobile app install campaigns, or **`https://sprout-scale.com/`** for general Traffic / Awareness campaigns.
   - Add UTM parameters cleanly, e.g.:
     `https://sprout-scale.com/?install=1&utm_source=meta&utm_medium=paid_social&utm_campaign=launch`

---

You're ready to launch SproutScale on `https://sprout-scale.com/` and advertise on Meta with confidence!
