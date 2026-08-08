# Re:Form — sajt sa bazom (GitHub → Netlify)

Prijava sa forme ide na dva mesta odjednom: **Telegram** (odmah te obavesti) i **bazu** (trajno stoji, panel je čita).

## 1. Napravi repo
1. Otvori [github.com/new](https://github.com/new) → ime npr. `reform-sajt` → **Create repository**.
2. Na stranici repoa klikni **uploading an existing file**.
3. Prevuci sve iz ovog foldera (`index.html`, `panel.html`, `package.json`, `netlify.toml`, folder `netlify`) → **Commit changes**.

## 2. Poveži Netlify
1. Netlify → **Add new site → Import an existing project → GitHub** → izaberi repo.
2. Build command: `npm install` · Publish directory: `.` (već stoji u `netlify.toml`, samo potvrdi).
3. **Deploy site**.

## 3. Environment variables
Netlify → **Site configuration → Environment variables**:

| Ključ | Vrednost |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token iz @BotFather |
| `TELEGRAM_CHAT_ID` | `1261547087` |
| `ADMIN_KEY` | lozinka koju sam izmisliš (za panel) |

Pa **Deploys → Trigger deploy → Clear cache and deploy site**.

## 4. Panel
Otvori `tvoj-sajt.netlify.app/panel.html` i unesi `ADMIN_KEY`. Prijave, statusi i beleške se od tada čuvaju na serveru i vidiš ih sa bilo kog uređaja.

> Ako panel otvoriš lokalno (bez servera), tražiće ti Telegram bot token i radiće u starom režimu.

## 5. Kasnije izmene
Kad zameniš `index.html` ili `panel.html` u repou, Netlify sam ponovo deployuje. Nema ponovnog prevlačenja foldera.
