"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { LatLng } from "@/lib/geo";

export type MapStop = LatLng & { id: string; name: string; next?: boolean };

// Route line, stops and (when a run is live) the shuttle. Leaflet is loaded
// on the client only. Tiles default to OpenStreetMap; set
// NEXT_PUBLIC_MAP_TILE_URL for Mapbox/MapTiler in production.
type Props = {
  stops: MapStop[];
  path?: LatLng[];
  shuttle?: (LatLng & { heading?: number | null }) | null;
  color?: string;
  className?: string;
};

type Leaflet = typeof import("leaflet");

function drawLayers(leaflet: Leaflet, map: LeafletMap, layer: LayerGroup, p: Props, fit: boolean) {
  const color = p.color ?? "#1b2a4a";
  layer.clearLayers();
  const line = p.path?.length ? p.path : p.stops;
  if (line.length > 1) leaflet.polyline(line.map((pt) => [pt.lat, pt.lng]), { color, weight: 4, opacity: 0.7 }).addTo(layer);
  for (const s of p.stops) {
    leaflet
      .circleMarker([s.lat, s.lng], { radius: s.next ? 9 : 6, color, weight: 2, fillColor: s.next ? "#b08a4f" : "#fff", fillOpacity: 1 })
      .bindTooltip(s.name, { direction: "top" })
      .addTo(layer);
  }
  if (p.shuttle) {
    const icon = leaflet.divIcon({
      className: "",
      html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;color:#fff;font:700 13px system-ui">M</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    leaflet.marker([p.shuttle.lat, p.shuttle.lng], { icon, title: "Shuttle" }).addTo(layer);
  }
  if (fit && line.length) map.fitBounds(leaflet.latLngBounds(line.map((pt) => [pt.lat, pt.lng])).pad(0.2));
}

// Route line, stops and (when a run is live) the shuttle. Leaflet is loaded
// on the client only. Tiles default to OpenStreetMap; set
// NEXT_PUBLIC_MAP_TILE_URL for Mapbox/MapTiler in production.
export function RouteMap(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup } | null>(null);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
    const s = state.current;
    if (s) drawLayers(s.L, s.map, s.layer, props, false);
  });

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((leaflet) => {
      if (cancelled || !el.current || state.current) return;
      const map = leaflet.map(el.current).setView([42.99, -81.25], 14);
      leaflet
        .tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap contributors",
        })
        .addTo(map);
      const layer = leaflet.layerGroup().addTo(map);
      state.current = { L: leaflet, map, layer };
      drawLayers(leaflet, map, layer, latest.current, true);
    });
    return () => {
      cancelled = true;
      state.current?.map.remove();
      state.current = null;
    };
  }, []);

  return <div ref={el} className={`w-full overflow-hidden rounded-xl border border-line ${props.className ?? "h-72"}`} role="img" aria-label="Shuttle route map" />;
}
