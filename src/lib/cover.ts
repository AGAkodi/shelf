// Cloth colours of a real library shelf: bottle green, oxblood, navy, ochre, plum, teal, umber.
const cloth = [[152, 30, 24], [356, 38, 30], [218, 32, 28], [36, 48, 34], [300, 20, 30], [180, 28, 26], [24, 32, 28]]

/** A stable cover cloth for a title, as a tone shift within one hue. */
export function coverColor(title: string) {
  let hash = 2166136261
  for (const c of title) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0
  const [h, s, l] = cloth[hash % cloth.length]
  return `linear-gradient(150deg, hsl(${h} ${s}% ${l + 8}%), hsl(${h} ${s}% ${l - 6}%))`
}
