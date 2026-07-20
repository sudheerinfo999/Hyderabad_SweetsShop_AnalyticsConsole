/** Counter promo sweets — free 2 pieces offer. */
export const FAVOURITE_SWEETS = [
  "Kova",
  "Arisalu",
  "Pakundalu",
  "Sunnundalu",
  "Ragi Laddu",
  "Motichur Laddu",
  "Malai Puri",
  "Gori Meti",
  "Kaja",
  "Kaju Burfi",
  "Dry Fruit Burfi",
  "Ghee Mysore Pak",
  "Kova Kajjikaya",
  "Gottam Kaja",
  "Chitti Kajjikaya",
  "Ravva Laddu",
  "Gavvalu",
  "Dry Fruit Laddu",
  "Pootarekulu",
  "Bobbatlu",
  "Rose Milk",
  "Badam Milk",
] as const;

export type FavouriteSweet = (typeof FAVOURITE_SWEETS)[number];

export const FAVOURITE_SWEET_PROMPT =
  "Please select your favorite sweet and grab a free piece on above purchase off 500";
