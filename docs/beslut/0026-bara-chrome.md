# 0026. Bara Chrome på dator och Android

- **Status:** Beslutat
- **Datum:** 2026-11-19

## Sammanhang

Appen och biblioteket web-ui (android-ui:s utseende för webben) behövde en gräns för vilka
webbläsare och vilket stöd som ska provas och byggas för. Hushållet använder appen i Chrome, mest på
telefonen. Ingen kör iOS, på dator eller telefon, och ingen använder skärmläsare.

## Beslut

Appen byggs och provas för Chrome på dator och Chrome på Android. Det finns ingen iOS, Safari
eller Firefox att ta hänsyn till, och ingen hänsyn till skärmläsare (uppläsning). Vanlig användbarhet
gäller fortfarande: tryckytor för tummen, läsbar kontrast och små telefonskärmar.

## Följder

- Chrome-funktioner (`text-box`, `:has()`, `@property`) får användas utan reserv.
- Playwright-proven körs bara i Chromium.
- ARIA-attribut som bär ett läge som stilen läser (`aria-pressed`, `aria-current`) står kvar. Etiketter
  och upplästa beskrivningar enbart för skärmläsare behöver inte läggas till eller granskas.
