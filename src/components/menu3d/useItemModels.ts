import { useEffect, useState } from "react";
import { listPublicItemModels, type PublicItemModelDto } from "../../services/phase4Service";

let cache: Promise<Map<number, PublicItemModelDto>> | null = null;

/** itemId → 3D model, fetched once per page load and shared by every menu. */
export function useItemModels(): Map<number, PublicItemModelDto> {
  const [map, setMap] = useState<Map<number, PublicItemModelDto>>(new Map());
  useEffect(() => {
    let alive = true;
    cache ??= listPublicItemModels().then((l) => new Map(l.map((m) => [m.itemId, m]))).catch(() => { cache = null; return new Map(); });
    void cache.then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, []);
  return map;
}
