import type { Destination, Ride } from '../../../types'

// How many of this house's rides went to each saved place
export function usageCounts(rides: Ride[], houseId: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rides) {
    if (r.houseId === houseId && r.destinationId) {
      counts.set(r.destinationId, (counts.get(r.destinationId) ?? 0) + 1)
    }
  }
  return counts
}

// Orders destinations by how often this house has used them, most-visited first.
export function sortByPopularity(destinations: Destination[], rides: Ride[], houseId: string): Destination[] {
  const counts = usageCounts(rides, houseId)
  return [...destinations].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
}

// The few places this house actually goes to most, for one-tap booking. Only places with past rides count:
// a place nobody has been to yet is never shown as frequent.
export function frequentDestinations(
  destinations: Destination[],
  rides: Ride[],
  houseId: string,
  limit = 3,
): { destination: Destination; rides: number }[] {
  const counts = usageCounts(rides, houseId)
  return sortByPopularity(destinations, rides, houseId)
    .filter((d) => (counts.get(d.id) ?? 0) > 0)
    .slice(0, limit)
    .map((destination) => ({ destination, rides: counts.get(destination.id) ?? 0 }))
}

// Lower case, without punctuation, so "st pauls" finds "St. Paul's Hospital"
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’'`.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Saved places whose name or address holds every word typed, in the order given.
export function filterDestinations(destinations: Destination[], query: string): Destination[] {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return destinations
  return destinations.filter((d) => {
    const text = normalize(`${d.name} ${d.address} ${d.city}`)
    return words.every((w) => text.includes(w))
  })
}
