# 0028. Appen kontrollerar Access-token själv

- **Status:** Beslutat
- **Datum:** 2026-11-22

## Sammanhang

Appen läste vem som var inloggad ur huvudet `Cf-Access-Authenticated-User-Email` och litade på
att Cloudflare Access (0005, 0021) täcker varje sökväg. Ett undantag i Access, eller en adress som
inte ligger bakom Access, hade öppnat Claude-anropen för vem som helst, och hur Access är inställt
syns inte i repot. Ägaren godkände planen i #194 2026-11-22.

## Beslut

Varje begäran utom `/api/health` måste ha en giltig `Cf-Access-Jwt-Assertion`, annars svarar
Workern 403 (`src/hooks.server.ts`). Token kontrolleras mot teamets publika nycklar
(`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, sparade i minnet en timme och
hämtade igen för en okänd nyckel), applikationens `aud`, utfärdaren och giltighetstiden, med en
minuts marginal för klockorna (`src/lib/server/access.ts`). E-posten tas ur token och läggs i
`event.locals.email`; huvudet med e-posten läses inte längre i drift. En service token, som
saknar e-post, släpps in utan konto.

Teamets domän och AUD-taggen är hemligheter på Workern (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`),
inte `vars`, eftersom repot är publikt (0004). Saknas de släpps ingen in.

I `vite dev` och i webbproven, som inte har Access framför sig, är kontrollen avstängd och huvudet
med e-posten står för den (`SKIP_ACCESS`, som bara `wrangler dev` i Playwright sätter).

## Följder

- Ägaren lade in hemligheterna på `veckansmat` 2026-11-22. `veckansmat-preview` har dem inte och
  svarar därför 403 på allt utom hälsokollen, tills de läggs in där också.
- En ny Access-applikation får en ny AUD-tagg, som måste läggas in som hemlighet innan nästa release.
