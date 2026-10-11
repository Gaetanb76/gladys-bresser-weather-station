// Which Gladys house the moon is seen from.
//
// The only use of the house is its hemisphere: the moon's lit side is on the
// right in the north and on the left in the south. The manifest declares
// `"location": true` (shown to the user at install) so the host API answers
// GET /house; the coordinates never leave this process - not logged, not
// published, not put in a widget.
//
// Best effort: no house, an unlocated house, an older core answering 403 or a
// network error all resolve to `null`, and the widget falls back to the
// northern hemisphere view it always had.

import { logger } from "@gladysassistant/integration-sdk";

const CACHE_TTL_MS = 60 * 60 * 1000; // a house does not move
const FAILURE_TTL_MS = 2 * 60 * 1000; // a blip should not cost an hour

// "Résidence" and "residence " name the same house.
function nameKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {{ getHouses: () => Promise<object[]> }} gladys SDK instance
 */
export function createHouseLookup(gladys) {
  let cached = null; // { at, ttl, houses }
  let inFlight = null;
  let warnedName = null;

  async function list() {
    if (cached && Date.now() - cached.at < cached.ttl) return cached.houses;
    inFlight ??= gladys
      .getHouses()
      .then(
        (houses) => ({
          ttl: CACHE_TTL_MS,
          houses: (Array.isArray(houses) ? houses : []).filter(
            (h) => Number.isFinite(h?.latitude) && Number.isFinite(h?.longitude),
          ),
        }),
        (err) => {
          logger.debug(`Gladys houses unavailable for now: ${err.message}`);
          return { ttl: FAILURE_TTL_MS, houses: [] };
        },
      )
      .then(({ ttl, houses }) => {
        cached = { at: Date.now(), ttl, houses };
        inFlight = null;
        return houses;
      });
    return inFlight;
  }

  return {
    /**
     * The located house named in the configuration; empty name or no match:
     * the first located house. `null` when Gladys has no located house.
     * @param {string} [preferredName]
     * @returns {Promise<{ house: { name: string, latitude: number }|null, count: number }>}
     */
    async get(preferredName) {
      const houses = await list();
      if (houses.length === 0) return { house: null, count: 0 };
      const wanted = nameKey(preferredName);
      const match = wanted && houses.find((h) => nameKey(h.name) === wanted);
      if (wanted && !match && warnedName !== wanted) {
        warnedName = wanted;
        logger.warn(
          `No located Gladys house named "${preferredName}": using "${houses[0].name}". ` +
            `Houses Gladys knows: ${houses.map((h) => h.name).join(", ")}.`,
        );
      }
      const { name, latitude } = match || houses[0];
      return { house: { name, latitude }, count: houses.length };
    },

    /** Forget the cached answer (the user may have just located a house). */
    invalidate() {
      cached = null;
      warnedName = null;
    },
  };
}
