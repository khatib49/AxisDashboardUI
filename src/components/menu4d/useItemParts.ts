import { useEffect, useState } from "react";
import { listPublicParts, type Item4DPublic } from "../../services/menu4dService";

let cache: Promise<Map<number, Item4DPublic>> | null = null;

/** itemId → published parts and real size, fetched once per page load and shared by every menu. */
export function useItemParts(): Map<number, Item4DPublic> {
  const [map, setMap] = useState<Map<number, Item4DPublic>>(new Map());
  useEffect(() => {
    let alive = true;
    cache ??= listPublicParts().then((l) => new Map(l.map((p) => [p.itemId, p]))).catch(() => { cache = null; return new Map(); });
    void cache.then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, []);
  return map;
}
