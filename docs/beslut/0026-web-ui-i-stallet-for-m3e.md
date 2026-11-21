# 0026. web-ui i stället för m3e

- **Status:** Beslutat
- **Datum:** 2026-11-21

## Sammanhang

Kodhästs Android-apparna har samma utseende genom biblioteket android-ui, och webbapparna får samma
utseende genom webbiblioteket [Kodhast/web-ui](https://github.com/Kodhast/web-ui) (android-ui #93),
som Husjakt redan använder. `@m3e/web` (beslut 0002) har stängd insida (shadow DOM), så dess delar går
inte att få att se ut som android-ui:s, och premiumkänslan för hand ovanpå m3e (#172) blev lager på
lager. Ägaren valde 2026-11-21 att Veckans mat får Android-looken på plats i appen, med en fast färg,
Saffran, i stället för färgvalen (#174).

## Beslut

- Utseendet kommer från `@kodhast/web-ui`, installerat från GitHub med en låst tagg
  (`github:Kodhast/web-ui#v<version>`): `tokens.css` och `kh.css` i layouten, `kh.js` efter hydrering
  som m3e. Detta ersätter komponentdelen av beslut 0002; SvelteKit och TypeScript står kvar.
- Appens tema står i `src/lib/tema.css`: färgerna (Saffran, ljust och mörkt), Roboto och
  textstorlekarna. Inga färgval i appen och ingen färgmotor.
- Vyerna flyttas en i taget (V1–V6 i #174). Medan m3e finns kvar får dess delar web-ui:s färger
  i layouten, och m3e tas bort helt när den sista vyn har flyttat.

## Följder

- Samma kort, rader, sidhuvud, avatarmeny och flikrad som i de andra Kodhäst-apparna; en ändring i
  android-ui når appen genom en ny web-ui-tagg.
- web-ui publiceras inte till ett register, så en ny version är en ändrad tagg i `package.json`.
- Under flytten finns två bibliotek i bunten, och de vyer som inte flyttat ser blandade ut.
- Färgvalen (fem teman och egen färg) försvinner; ett val som sparats i telefonen läses inte längre.
