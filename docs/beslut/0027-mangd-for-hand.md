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

## Tillägg 2026-11-22: när rätterna ändras (#197)

En ändrad vara låg kvar oförändrad så länge någon av dess rätter fanns i veckan. Fick den en ny
rätt med samma ingrediens överlevde Claudes nya vara bredvid den, och förlorade den en rätt stod den
gamla mängden kvar. Ägaren valde 2026-11-22 att varan frågar.

- När listan görs om tar en ändrad vara in Claudes nya vara för samma rader: dess rader blir den
  ändrade varans, dess mängd sparas som förslag (`amount_suggested`) och Claudes vara läggs inte
  till. Hur rätterna ändrats sparas i `amount_change` (`added`, `removed` eller `changed`), och en
  borttagen rätts rader tas bort ur varan.
- Varan visar frågan på raden och i arket: "Behåll" tar bort frågan och mängden är fortfarande
  ändrad; "Ta Claudes" gör mängden till Claudes, och varan räknas om nästa gång.
- Är rätterna desamma som när mängden ändrades frågar varan inget. Räknar Claude samma mängd som
  den ändrade frågar den inte heller. En vara vars alla rätter är borta tas bort som förut.
- Varor utan rader jämförs med Å, Ä och Ö vikta till gemener; SQLites `lower()` gör det bara för
  ASCII.
