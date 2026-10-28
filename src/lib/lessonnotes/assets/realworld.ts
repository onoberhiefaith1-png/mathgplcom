import type { AssetDef } from "./types";

const V = (id: string, label: string, group: string, keywords: string[]): AssetDef => ({
  id,
  label,
  category: "Real-world",
  group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual: "illus", attrs: { variant: id } },
});

export const REALWORLD: AssetDef[] = [
  // Money
  V("money", "Coin", "Money", ["coin", "cash"]),
  V("banknote", "Banknote", "Money", ["cash", "bill"]),

  // Vehicles
  V("car", "Car", "Vehicles", ["transport"]),
  V("bus", "Bus", "Vehicles", ["transport"]),
  V("train", "Train", "Vehicles", ["transport"]),
  V("bicycle", "Bicycle", "Vehicles", ["transport"]),
  V("airplane", "Airplane", "Vehicles", ["transport"]),

  // Food
  V("apple", "Apple", "Food", ["fruit"]),
  V("pizza", "Pizza", "Food", ["slice", "fraction"]),
  V("cake", "Cake", "Food", ["dessert"]),
  V("bottle", "Bottle", "Food", ["container"]),

  // Nature
  V("tree", "Tree", "Nature", ["nature"]),
  V("sun", "Sun", "Nature", ["nature"]),
  V("animal", "Animal", "Nature", ["pet"]),
  V("dog", "Dog", "Nature", ["pet"]),
  V("cat", "Cat", "Nature", ["pet"]),
  V("bird", "Bird", "Nature", ["pet"]),

  // Architecture
  V("house", "House", "Architecture", ["building"]),
  V("building", "Building", "Architecture", ["office"]),
  V("box", "Box", "Architecture", ["container"]),
  V("book", "Book", "Architecture", ["object"]),
  V("person", "Person", "Architecture", ["figure"]),
  V("ball", "Ball", "Architecture", ["sport"]),
  V("shoppingitem", "Shopping item", "Architecture", ["price"]),
];
