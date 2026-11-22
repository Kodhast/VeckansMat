# 0027. En mängd ändrad för hand ligger kvar

- **Status:** Beslutat
- **Datum:** 2026-11-22

## Sammanhang

Claude avrundar och gissar mängderna på inköpslistan, och hushållet vet ofta bättre. Förut gick
det bara att ta bort varan och skriva in den igen själv, och då försvann kopplingen till rätterna
(0017) och "gissat". När listan gjordes om (0015) togs alla Claudes varor bort utom de i korgen,
så en ändrad mängd hade försvunnit. Ägaren godkände planen i #163 2026-11-15.

## Beslut

En mängd kan ändras för hand i ett ark, som fri text med − och + för första talet. En vara med
ändrad mängd (`amount_edited`) behandlas som en vara i korgen när listan görs om: den ligger kvar,
räknas inte om, och Claudes nya vara läggs inte till när alla dess rader täcks av varor i korgen
eller ändrade varor (0017, utvidgad). En ändrad vara vars rätter inte längre finns i veckan tas
bort; en ändrad vara utan rätter (som Claude inte knöt till någon rad, eller vars rätt raderats)
ligger kvar som det man skrivit själv. Det Claude räknade sparas (`amount_before`) så att "Som Claude räknade" kan sätta tillbaka
det.

## Följder

- Det man skrivit själv är aldrig en ändring av Claudes lista; dess mängd sparas utan märkning.
- Sätts mängden tillbaka till Claudes, för hand eller med knappen, är varan inte längre ändrad och
  räknas om nästa gång.
- Ingen enhet lagras separat; − och + tolkar texten (`stepAmount` i `src/lib/shopping.ts`).
