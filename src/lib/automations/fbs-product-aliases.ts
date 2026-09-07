// Physical identities confirmed by the owner on 2026-09-07. Cabinet listings
// remain separate technical tuples; only their accounting name is shared.
export const FBS_CONFIRMED_PRODUCT_GROUPS = [
  {
    name: 'туника с поясом синие разводы',
    listings: [
      { accountKey: 'nimba', nmId: 202642536, chrtId: 326715982, vendorCode: 'пояс синие разводы' },
      { accountKey: 'galioni', nmId: 1127646467, chrtId: 1667932730, vendorCode: 'парео пояс синий развод' },
    ],
  },
  {
    name: 'туника с поясом черные разводы',
    listings: [
      { accountKey: 'nimba', nmId: 202642537, chrtId: 326715987, vendorCode: 'туника пояс черные разводы' },
      { accountKey: 'galioni', nmId: 1127619819, chrtId: 1667899910, vendorCode: 'парео пояс черн. развод' },
    ],
  },
  {
    name: 'туника с поясом светло-зеленая',
    listings: [
      { accountKey: 'nimba', nmId: 1016390072, chrtId: 1516964386, vendorCode: 'туника с поясом св.зеленая' },
      { accountKey: 'galioni', nmId: 1017525831, chrtId: 1518679227, vendorCode: 'парео пояс зеленое' },
    ],
  },
  {
    name: 'туника с поясом зеленый лист змея',
    listings: [
      { accountKey: 'nimba', nmId: 1134467682, chrtId: 1676890599, vendorCode: 'туника пояс зеленый лист змея' },
      { accountKey: 'galioni', nmId: 1127644456, chrtId: 1667930707, vendorCode: 'парео пояс зелен. лист змея' },
    ],
  },
  {
    name: 'туника с поясом леопард/пятна',
    listings: [
      { accountKey: 'nimba', nmId: 1016398118, chrtId: 1516968330, vendorCode: 'туника с поясом леопард пятна' },
    ],
  },
] as const

export const FBS_CONFIRMED_PRODUCT_ALIASES: Record<string, string> = Object.fromEntries(
  FBS_CONFIRMED_PRODUCT_GROUPS.flatMap((group) => group.listings.map((listing) => [
    `${listing.accountKey}:${listing.nmId}:${listing.chrtId}`, group.name,
  ])),
)
