import type { ItineraryInput } from "@/lib/itineraries/schema";
import { routeStops } from "@/lib/itineraries/schema";
const places: Record<string, [number, number]> = {
  colombo: [96, 232],
  negombo: [91, 210],
  sigiriya: [143, 133],
  dambulla: [136, 148],
  kandy: [139, 194],
  ella: [180, 231],
  "nuwara eliya": [161, 216],
  galle: [126, 288],
  mirissa: [149, 293],
  yala: [204, 271],
  trincomalee: [177, 101],
  anuradhapura: [118, 111],
  polonnaruwa: [164, 139],
  bentota: [108, 267],
  udawalawe: [175, 267],
};
export function RouteMap({ input }: { input: ItineraryInput }) {
  const stops = routeStops(input);
  const points = stops
    .map((s) => ({ name: s, point: places[s.toLowerCase()] }))
    .filter((p) => p.point);
  return (
    <figure className="rounded-xl border bg-muted/20 p-4">
      <svg
        viewBox="45 30 215 300"
        role="img"
        aria-label="Illustrative Sri Lanka travel route"
        className="mx-auto max-h-72 w-full"
      >
        <path
          d="M139 39 C117 85 79 123 83 185 C62 242 116 307 156 303 C201 300 237 259 218 207 C215 156 181 77 139 39Z"
          fill="currentColor"
          className="text-muted"
          stroke={input.primary_color}
          strokeWidth="2"
        />
        {points.length > 1 && (
          <polyline
            points={points.map((p) => p.point.join(",")).join(" ")}
            fill="none"
            stroke={input.primary_color}
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.point[0]}
              cy={p.point[1]}
              r="6"
              fill={input.accent_color}
              stroke={input.primary_color}
            />
            <text
              x={p.point[0] + 8}
              y={p.point[1] - 7}
              fontSize="9"
              fill={input.primary_color}
            >
              {i + 1}. {p.name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {stops.join(" → ") || "Add destinations to see your route."}
        <br />
        Illustrative route; lines do not represent driving directions.
        {stops.some((s) => !places[s.toLowerCase()]) &&
          " Unmapped stops remain in the route list."}
      </figcaption>
    </figure>
  );
}
