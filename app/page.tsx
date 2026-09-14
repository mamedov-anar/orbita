"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

const DAY = 86_400_000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const TAU = Math.PI * 2;

type Planet = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  accent: string;
  radius: number;
  a: number;
  e: number;
  inclination: number;
  longitude: number;
  perihelion: number;
  node: number;
  period: number;
  note: string;
};

type Position = {
  x: number;
  y: number;
  z: number;
  distance: number;
  longitude: number;
  speed: number;
};

type MoonPosition = {
  x: number;
  y: number;
  z: number;
  distanceEarthRadii: number;
  distanceKm: number;
  longitude: number;
  illumination: number;
};

type ProjectedPlanet = {
  id: string;
  x: number;
  y: number;
  hitRadius: number;
};

const PLANETS: Planet[] = [
  {
    id: "mercury",
    name: "Меркурий",
    symbol: "☿",
    color: "#b8b2aa",
    accent: "#e6ded3",
    radius: 4.5,
    a: 0.387098,
    e: 0.20563,
    inclination: 7.005,
    longitude: 252.250906,
    perihelion: 77.456119,
    node: 48.339618,
    period: 87.9691,
    note: "Быстрейшая планета — один оборот занимает меньше трёх земных месяцев.",
  },
  {
    id: "venus",
    name: "Венера",
    symbol: "♀",
    color: "#dcae72",
    accent: "#ffd9a4",
    radius: 6.5,
    a: 0.723332,
    e: 0.006772,
    inclination: 3.3946,
    longitude: 181.979801,
    perihelion: 131.563707,
    node: 76.679843,
    period: 224.701,
    note: "Почти круговая орбита и самая плотная атмосфера среди каменных планет.",
  },
  {
    id: "earth",
    name: "Земля",
    symbol: "⊕",
    color: "#4a9dff",
    accent: "#81c8ff",
    radius: 7,
    a: 1,
    e: 0.016709,
    inclination: 0,
    longitude: 100.466457,
    perihelion: 102.937348,
    node: -11.26064,
    period: 365.256,
    note: "Наш дом. Среднее расстояние до Солнца — одна астрономическая единица.",
  },
  {
    id: "mars",
    name: "Марс",
    symbol: "♂",
    color: "#cf6546",
    accent: "#ff9a76",
    radius: 5.5,
    a: 1.523679,
    e: 0.0934,
    inclination: 1.8497,
    longitude: 355.433,
    perihelion: 336.06,
    node: 49.558,
    period: 686.98,
    note: "Эксцентричная орбита заметно меняет расстояние Марса до Солнца в течение года.",
  },
  {
    id: "jupiter",
    name: "Юпитер",
    symbol: "♃",
    color: "#d5a16f",
    accent: "#f4cda1",
    radius: 11,
    a: 5.2026,
    e: 0.048498,
    inclination: 1.303,
    longitude: 34.351,
    perihelion: 14.331,
    node: 100.464,
    period: 4332.59,
    note: "Крупнейшая планета системы завершает оборот примерно за двенадцать земных лет.",
  },
  {
    id: "saturn",
    name: "Сатурн",
    symbol: "♄",
    color: "#d7bd83",
    accent: "#f5dfa9",
    radius: 9.5,
    a: 9.5549,
    e: 0.0555,
    inclination: 2.489,
    longitude: 50.077,
    perihelion: 93.057,
    node: 113.665,
    period: 10759.22,
    note: "Ледяные кольца образуют тонкую систему шириной в сотни тысяч километров.",
  },
  {
    id: "uranus",
    name: "Уран",
    symbol: "⛢",
    color: "#78c8cb",
    accent: "#b9f2ef",
    radius: 8,
    a: 19.2184,
    e: 0.0463,
    inclination: 0.773,
    longitude: 314.055,
    perihelion: 173.005,
    node: 74.006,
    period: 30688.5,
    note: "Ледяной гигант вращается почти лёжа на боку из-за сильного наклона оси.",
  },
  {
    id: "neptune",
    name: "Нептун",
    symbol: "♆",
    color: "#446ce8",
    accent: "#7896ff",
    radius: 8,
    a: 30.11,
    e: 0.009456,
    inclination: 1.77,
    longitude: 304.348,
    perihelion: 48.123,
    node: 131.784,
    period: 60182,
    note: "Самая дальняя планета: солнечному свету требуется больше четырёх часов, чтобы её достичь.",
  },
];

const SPEEDS = [
  { label: "1 день / сек", value: 1 },
  { label: "10 дней / сек", value: 10 },
  { label: "100 дней / сек", value: 100 },
  { label: "1 год / сек", value: 365.256 },
];

const deg = (value: number) => (value * Math.PI) / 180;
const normalizeDegrees = (value: number) => ((value % 360) + 360) % 360;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function solveKepler(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = meanAnomaly;
  for (let index = 0; index < 7; index += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly -
        eccentricity * Math.sin(eccentricAnomaly) -
        meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function positionFromAnomaly(planet: Planet, meanAnomaly: number): Position {
  const eccentricAnomaly = solveKepler(meanAnomaly, planet.e);
  const orbitalX = planet.a * (Math.cos(eccentricAnomaly) - planet.e);
  const orbitalY =
    planet.a * Math.sqrt(1 - planet.e * planet.e) * Math.sin(eccentricAnomaly);
  const argument = deg(planet.perihelion - planet.node);
  const node = deg(planet.node);
  const inclination = deg(planet.inclination);
  const cosArgument = Math.cos(argument);
  const sinArgument = Math.sin(argument);
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);
  const x =
    orbitalX * (cosArgument * cosNode - sinArgument * sinNode * cosInclination) +
    orbitalY * (-sinArgument * cosNode - cosArgument * sinNode * cosInclination);
  const y =
    orbitalX * (cosArgument * sinNode + sinArgument * cosNode * cosInclination) +
    orbitalY * (-sinArgument * sinNode + cosArgument * cosNode * cosInclination);
  const z =
    orbitalX * sinArgument * sinInclination +
    orbitalY * cosArgument * sinInclination;
  const distance = Math.hypot(x, y, z);
  return {
    x,
    y,
    z,
    distance,
    longitude: normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI),
    speed: 29.78 * Math.sqrt(2 / distance - 1 / planet.a),
  };
}

function planetPosition(planet: Planet, timestamp: number) {
  const days = (timestamp - J2000) / DAY;
  const meanAtEpoch = deg(normalizeDegrees(planet.longitude - planet.perihelion));
  const meanNow = meanAtEpoch + (TAU * days) / planet.period;
  return positionFromAnomaly(planet, meanNow);
}

function moonPositionFromAnomaly(
  timestamp: number,
  meanAnomalyOverride?: number,
): Omit<MoonPosition, "illumination"> {
  const moonEpoch = Date.UTC(1999, 11, 31);
  const days = (timestamp - moonEpoch) / DAY;
  const ascendingNode = deg(normalizeDegrees(125.1228 - 0.0529538083 * days));
  const inclination = deg(5.1454);
  const periapsis = deg(normalizeDegrees(318.0634 + 0.1643573223 * days));
  const meanAnomaly =
    meanAnomalyOverride ??
    deg(normalizeDegrees(115.3654 + 13.0649929509 * days));
  const semiMajorAxis = 60.2666;
  const eccentricity = 0.0549;
  const eccentricAnomaly = solveKepler(meanAnomaly, eccentricity);
  const orbitalX =
    semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);
  const orbitalY =
    semiMajorAxis *
    Math.sqrt(1 - eccentricity * eccentricity) *
    Math.sin(eccentricAnomaly);
  const trueAnomaly = Math.atan2(orbitalY, orbitalX);
  const distanceEarthRadii = Math.hypot(orbitalX, orbitalY);
  const argument = trueAnomaly + periapsis;
  const x =
    distanceEarthRadii *
    (Math.cos(ascendingNode) * Math.cos(argument) -
      Math.sin(ascendingNode) * Math.sin(argument) * Math.cos(inclination));
  const y =
    distanceEarthRadii *
    (Math.sin(ascendingNode) * Math.cos(argument) +
      Math.cos(ascendingNode) * Math.sin(argument) * Math.cos(inclination));
  const z =
    distanceEarthRadii * Math.sin(argument) * Math.sin(inclination);
  return {
    x,
    y,
    z,
    distanceEarthRadii,
    distanceKm: distanceEarthRadii * 6378.14,
    longitude: normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI),
  };
}

function moonPosition(timestamp: number): MoonPosition {
  const moon = moonPositionFromAnomaly(timestamp);
  const earth = planetPosition(PLANETS[2], timestamp);
  const sunX = -earth.x;
  const sunY = -earth.y;
  const sunZ = -earth.z;
  const dot = moon.x * sunX + moon.y * sunY + moon.z * sunZ;
  const cosine = clamp(
    dot / (moon.distanceEarthRadii * Math.hypot(sunX, sunY, sunZ)),
    -1,
    1,
  );
  return {
    ...moon,
    illumination: (1 - cosine) / 2,
  };
}

function formatUtc(timestamp: number | null) {
  if (timestamp === null) return "СИНХРОНИЗАЦИЯ…";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
    .format(new Date(timestamp))
    .replace(" г.", "")
    .toUpperCase();
}

function inputDate(timestamp: number | null) {
  if (timestamp === null) return "";
  return new Date(timestamp).toISOString().slice(0, 16);
}

function periodLabel(days: number) {
  if (days < 1000) return `${Math.round(days)} суток`;
  return `${(days / 365.256).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} лет`;
}

function seededStars(count: number) {
  let seed = 41721;
  return Array.from({ length: count }, () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const x = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const y = seed / 4294967296;
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const size = seed / 4294967296;
    return { x, y, size };
  });
}

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const smoothstep = (value: number) => value * value * (3 - 2 * value);

function Icon({ name, size = 18 }: { name: "orbit" | "plus" | "minus" | "reset" | "focus" | "back" | "play" | "pause"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "orbit" && <><circle cx="12" cy="12" r="8.5" /><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-35 12 12)" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></>}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "minus" && <path d="M5 12h14" />}
      {name === "reset" && <><path d="M4 9a8 8 0 1 1 0 6M4 4v5h5" /></>}
      {name === "focus" && <><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" /><circle cx="12" cy="12" r="3" /></>}
      {name === "back" && <path d="m10 5-7 7 7 7M3 12h18" />}
      {name === "play" && <path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none" />}
      {name === "pause" && <><path d="M9 6v12M15 6v12" strokeWidth="2.5" /></>}
    </svg>
  );
}

// Render the surface maps once, then reuse the shaded spheres at every zoom level.
const sphereSurfaces = new Map<string, HTMLCanvasElement>();

function loadPlanetSurface(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const texture = document.createElement("canvas");
      texture.width = 1024;
      texture.height = 512;
      const textureContext = texture.getContext("2d", { willReadFrequently: true });
      if (!textureContext) { reject(new Error("Canvas unavailable")); return; }
      textureContext.drawImage(image, 0, 0, texture.width, texture.height);
      const pixels = textureContext.getImageData(0, 0, texture.width, texture.height).data;
      const surface = document.createElement("canvas");
      const size = 512;
      surface.width = size;
      surface.height = size;
      const surfaceContext = surface.getContext("2d");
      if (!surfaceContext) { reject(new Error("Canvas unavailable")); return; }
      const rendered = surfaceContext.createImageData(size, size);
      for (let sy = 0; sy < size; sy += 1) {
        const ny = 1 - (sy + 0.5) / (size / 2);
        for (let sx = 0; sx < size; sx += 1) {
          const nx = (sx + 0.5) / (size / 2) - 1;
          const radial = nx * nx + ny * ny;
          if (radial >= 1) continue;
          const nz = Math.sqrt(1 - radial);
          const longitude = Math.atan2(nx, nz);
          const latitude = Math.asin(ny);
          const tx = Math.floor(((0.5 + longitude / TAU) % 1) * texture.width);
          const ty = Math.min(texture.height - 1, Math.floor((0.5 - latitude / Math.PI) * texture.height));
          const input = (ty * texture.width + tx) * 4;
          const output = (sy * size + sx) * 4;
          const diffuse = Math.max(0, nx * -0.62 + ny * 0.38 + nz * 0.69);
          const light = 0.045 + Math.pow(diffuse, 0.8) * 0.98;
          const atmosphere = id === "earth" ? Math.pow(1 - nz, 3) * diffuse * 35 : 0;
          rendered.data[output] = pixels[input] * light + atmosphere * 0.28;
          rendered.data[output + 1] = pixels[input + 1] * light + atmosphere * 0.62;
          rendered.data[output + 2] = pixels[input + 2] * light + atmosphere;
          rendered.data[output + 3] = Math.min(255, (1 - Math.sqrt(radial)) * size * 180);
        }
      }
      surfaceContext.putImageData(rendered, 0, 0);
      sphereSurfaces.set(id, surface);
      resolve();
    };
    image.onerror = () => reject(new Error("Unable to load " + id + " surface"));
    image.src = (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/textures/" + id + ".jpg";
  });
}

function drawSaturnRings(context: CanvasRenderingContext2D, x: number, y: number, radius: number, front: boolean) {
  context.save();
  context.translate(x, y);
  context.rotate(-0.3);
  context.scale(1, 0.3);
  for (let ring = 0; ring < 40; ring += 1) {
    const distance = 1.24 + ring * 0.025;
    if ((distance > 1.78 && distance < 1.85) || (distance > 2.08 && distance < 2.12)) continue;
    const opacity = (front ? 0.66 : 0.38) * (0.45 + Math.sin(ring * 1.8) * 0.15);
    context.strokeStyle = "rgba(204, 192, 165, " + opacity + ")";
    context.lineWidth = Math.max(0.6, radius * 0.024);
    context.beginPath();
    context.arc(0, 0, radius * distance, front ? 0 : Math.PI, front ? Math.PI : TAU);
    context.stroke();
  }
  context.restore();
}

function drawPlanetSphere(
  context: CanvasRenderingContext2D,
  planet: Pick<Planet, "id" | "color" | "accent">,
  x: number,
  y: number,
  radius: number,
  alpha: number,
  detailed: boolean,
  _timestamp: number,
) {
  if (alpha <= 0.002 || radius <= 0.5) return;
  context.save();
  context.globalAlpha *= alpha;
  if (planet.id === "saturn") drawSaturnRings(context, x, y, radius, false);

  const halo = context.createRadialGradient(x, y, radius * 0.95, x, y, radius * 1.18);
  halo.addColorStop(0, planet.color + (detailed ? "32" : "35"));
  halo.addColorStop(0.35, planet.color + "12");
  halo.addColorStop(1, planet.color + "00");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(x, y, radius * 1.18, 0, TAU);
  context.fill();

  const surface = sphereSurfaces.get(planet.id);
  if (surface) {
    context.drawImage(surface, x - radius, y - radius, radius * 2, radius * 2);
  } else {
    const sphere = context.createRadialGradient(x - radius * 0.45, y - radius * 0.35, 0, x - radius * 0.2, y - radius * 0.15, radius * 1.25);
    sphere.addColorStop(0, planet.accent);
    sphere.addColorStop(0.45, planet.color);
    sphere.addColorStop(0.82, "#18202c");
    sphere.addColorStop(1, "#080a0e");
    context.fillStyle = sphere;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }
  if (planet.id === "saturn") drawSaturnRings(context, x, y, radius, true);
  context.restore();
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projectedRef = useRef<ProjectedPlanet[]>([]);
  const simulationRef = useRef(Date.now());
  const lastFrameRef = useRef<number | null>(null);
  const lastLabelUpdateRef = useRef(0);
  const focusAmountRef = useRef(0);
  const focusSubjectRef = useRef("earth");
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    rotation: number;
    tilt: number;
    moved: boolean;
  } | null>(null);
  const [displayTime, setDisplayTime] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [selectedId, setSelectedId] = useState("earth");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [camera, setCamera] = useState({ rotation: -0.42, tilt: 0.82, zoom: 1 });
  const stars = useMemo(() => seededStars(125), []);
  const [planetPreviews, setPlanetPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    loadPlanetSurface("moon").catch(() => {});
    PLANETS.forEach((planet) => {
      loadPlanetSurface(planet.id).then(() => {
        if (cancelled) return;
        const thumbnail = document.createElement("canvas");
        thumbnail.width = 120;
        thumbnail.height = 96;
        const thumbnailContext = thumbnail.getContext("2d");
        if (!thumbnailContext) return;
        drawPlanetSphere(thumbnailContext, planet, 60, 48, planet.id === "saturn" ? 23 : 36, 1, false, J2000);
        setPlanetPreviews((current) => ({ ...current, [planet.id]: thumbnail.toDataURL("image/png") }));
      }).catch(() => { /* The shaded sphere remains available if a texture cannot load. */ });
    });
    return () => { cancelled = true; };
  }, []);

  const selectedPlanet =
    PLANETS.find((planet) => planet.id === selectedId) ?? PLANETS[2];
  const selectedPosition = useMemo(
    () => planetPosition(selectedPlanet, displayTime ?? J2000),
    [displayTime, selectedPlanet],
  );
  const currentMoon = useMemo(
    () => moonPosition(displayTime ?? J2000),
    [displayTime],
  );

  const focusPlanet = useCallback((planetId: string) => {
    focusSubjectRef.current = planetId;
    setSelectedId(planetId);
    setFocusedId(planetId);
    if (window.innerWidth <= 820) window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);

  const exitFocus = useCallback(() => {
    setFocusedId(null);
  }, []);

  const goLive = useCallback(() => {
    const now = Date.now();
    simulationRef.current = now;
    setDisplayTime(now);
    setIsLive(true);
    setIsPaused(false);
  }, []);

  const shiftTime = useCallback((days: number) => {
    simulationRef.current += days * DAY;
    setDisplayTime(simulationRef.current);
    setIsLive(false);
  }, []);

  useEffect(() => {
    const now = Date.now();
    simulationRef.current = now;
    setDisplayTime(now);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    const draw = (frameTime: number) => {
      const delta = lastFrameRef.current
        ? Math.min((frameTime - lastFrameRef.current) / 1000, 0.1)
        : 0;
      lastFrameRef.current = frameTime;

      if (isLive) {
        simulationRef.current = Date.now();
      } else if (!isPaused) {
        simulationRef.current += delta * speed * DAY;
      }
      if (frameTime - lastLabelUpdateRef.current > 250) {
        setDisplayTime(simulationRef.current);
        lastLabelUpdateRef.current = frameTime;
      }
      const focusTarget = focusedId ? 1 : 0;
      const focusStep = 1 - Math.exp(-Math.max(delta, 0.016) * 4.6);
      focusAmountRef.current = lerp(
        focusAmountRef.current,
        focusTarget,
        focusStep,
      );
      if (focusTarget === 0 && focusAmountRef.current < 0.001) {
        focusAmountRef.current = 0;
      }
      if (focusTarget === 1 && focusAmountRef.current > 0.999) {
        focusAmountRef.current = 1;
      }
      const focusAmount = smoothstep(focusAmountRef.current);
      const systemAlpha = 1 - focusAmount;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      const width = rect.width;
      const height = rect.height;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        context.globalAlpha = 0.1 + star.size * 0.3;
        context.fillStyle = star.size > 0.92 ? "#d9e8ff" : "#6b7890";
        context.fillRect(
          star.x * width,
          star.y * height,
          0.45 + star.size * 0.8,
          0.45 + star.size * 0.8,
        );
      }
      context.globalAlpha = 1;

      const centerX = width * 0.52;
      const centerY = height * 0.60;
      const viewRadius = Math.min(width * 0.435, height * 0.47) * camera.zoom;
      const maxOrbit = Math.log1p(30.5 * 0.86);
      const cosRotation = Math.cos(camera.rotation);
      const sinRotation = Math.sin(camera.rotation);
      const cosTilt = Math.cos(camera.tilt);
      const sinTilt = Math.sin(camera.tilt);

      const project = (position: { x: number; y: number; z: number }) => {
        const radius = Math.max(0.0001, Math.hypot(position.x, position.y, position.z));
        const compressed =
          (Math.log1p(radius * 0.86) / maxOrbit) * viewRadius;
        const factor = compressed / radius;
        const x = position.x * factor;
        const y = position.y * factor;
        const z = position.z * factor;
        const rotatedX = x * cosRotation - y * sinRotation;
        const rotatedY = x * sinRotation + y * cosRotation;
        const screenPlaneY = rotatedY * cosTilt - z * sinTilt;
        const depth = rotatedY * sinTilt + z * cosTilt;
        const perspective = clamp(1 + depth / (viewRadius * 3.8), 0.78, 1.22);
        return {
          x: centerX + rotatedX * perspective,
          y: centerY + screenPlaneY * perspective,
          depth,
          perspective,
        };
      };

      context.save();
      context.globalAlpha = systemAlpha;
      context.lineWidth = 1;
      for (const planet of PLANETS) {
        const isSelected = selectedId === planet.id;
        context.beginPath();
        for (let sample = 0; sample <= 100; sample += 1) {
          const position = positionFromAnomaly(planet, (sample / 100) * TAU);
          const point = project(position);
          if (sample === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        context.strokeStyle = isSelected
          ? `${planet.accent}80`
          : "rgba(167, 185, 214, .2)";
        context.lineWidth = isSelected ? 1.1 : 0.65;
        context.stroke();
      }

      const sunGlow = context.createRadialGradient(
        centerX,
        centerY,
        2,
        centerX,
        centerY,
        48,
      );
      sunGlow.addColorStop(0, "rgba(255, 244, 190, 1)");
      sunGlow.addColorStop(0.15, "rgba(255, 190, 76, .94)");
      sunGlow.addColorStop(0.36, "rgba(255, 132, 28, .28)");
      sunGlow.addColorStop(1, "rgba(255, 105, 18, 0)");
      context.fillStyle = sunGlow;
      context.beginPath();
      context.arc(centerX, centerY, 48, 0, TAU);
      context.fill();
      context.fillStyle = "#fff2b8";
      context.beginPath();
      context.arc(centerX, centerY, 10.5, 0, TAU);
      context.fill();
      context.restore();

      const positioned = PLANETS.map((planet) => {
        const position = planetPosition(planet, simulationRef.current);
        return { planet, point: project(position) };
      }).sort((a, b) => a.point.depth - b.point.depth);

      const projected: ProjectedPlanet[] = [];
      for (const { planet, point } of positioned) {
        const selected = planet.id === selectedId;
        const hovered = planet.id === hoveredId;
        const radius = planet.radius * point.perspective * (selected ? 1.26 : 1.12);
        drawPlanetSphere(
          context,
          planet,
          point.x,
          point.y,
          radius,
          systemAlpha,
          false,
          simulationRef.current,
        );

        if ((selected || hovered) && systemAlpha > 0.03) {
          context.save();
          context.globalAlpha = systemAlpha;
          context.font = `${selected ? "500" : "400"} 14px -apple-system, BlinkMacSystemFont, sans-serif`;
          context.fillStyle = selected ? "#f3f6fb" : "#bcc6d6";
          context.textAlign = "left";
          context.fillText(
            planet.name,
            point.x + radius + 8,
            point.y + 4,
          );
          context.restore();
        }
        if (focusAmount < 0.55) {
          projected.push({
            id: planet.id,
            x: point.x,
            y: point.y,
            hitRadius: Math.max(17, radius + 8),
          });
        }
      }

      const focusPlanetData =
        PLANETS.find(
          (planet) => planet.id === (focusedId ?? focusSubjectRef.current),
        ) ?? PLANETS[2];
      const focusSystemPoint =
        positioned.find(({ planet }) => planet.id === focusPlanetData.id)?.point ??
        project(planetPosition(focusPlanetData, simulationRef.current));

      if (focusAmount > 0.002) {
        const closeCenterX = width * 0.5;
        const closeCenterY = height * 0.56;
        const baseFocusRadius = clamp(
          Math.min(
            Math.min(width, height) * (focusPlanetData.id === "saturn" ? 0.2 : 0.24),
            focusPlanetData.id === "earth" ? width * 0.165 : Infinity,
          ) * camera.zoom,
          focusPlanetData.id === "earth" ? 46 : 62,
          focusPlanetData.id === "saturn" ? 138 : 172,
        );
        const startRadius =
          focusPlanetData.radius * focusSystemPoint.perspective * 1.18;
        const focusedX = lerp(focusSystemPoint.x, closeCenterX, focusAmount);
        const focusedY = lerp(focusSystemPoint.y, closeCenterY, focusAmount);
        const focusedRadius = lerp(startRadius, baseFocusRadius, focusAmount);

        drawPlanetSphere(
          context,
          focusPlanetData,
          focusedX,
          focusedY,
          focusedRadius,
          focusAmount,
          true,
          simulationRef.current,
        );

        if (focusPlanetData.id === "earth") {
          const currentLunarPosition = moonPosition(simulationRef.current);
          const moonOrbitRadius = focusedRadius * 2.55;
          const projectMoon = (position: {
            x: number;
            y: number;
            z: number;
            distanceEarthRadii: number;
          }) => {
            const orbitalScale = moonOrbitRadius / 60.2666;
            const x = position.x * orbitalScale;
            const y = position.y * orbitalScale;
            const z = position.z * orbitalScale;
            const rotatedX = x * cosRotation - y * sinRotation;
            const rotatedY = x * sinRotation + y * cosRotation;
            const screenY = rotatedY * cosTilt - z * sinTilt;
            const depth = rotatedY * sinTilt + z * cosTilt;
            return {
              x: focusedX + rotatedX,
              y: focusedY + screenY,
              depth,
            };
          };

          context.save();
          context.globalAlpha = focusAmount * 0.72;
          context.beginPath();
          for (let sample = 0; sample <= 96; sample += 1) {
            const orbitPosition = moonPositionFromAnomaly(
              simulationRef.current,
              (sample / 96) * TAU,
            );
            const orbitPoint = projectMoon(orbitPosition);
            if (sample === 0) context.moveTo(orbitPoint.x, orbitPoint.y);
            else context.lineTo(orbitPoint.x, orbitPoint.y);
          }
          context.setLineDash([3, 5]);
          context.strokeStyle = "rgba(208, 218, 232, .5)";
          context.lineWidth = 0.9;
          context.stroke();
          context.setLineDash([]);

          const moonPoint = projectMoon(currentLunarPosition);
          const moonPerspective = clamp(
            1 + moonPoint.depth / (moonOrbitRadius * 4),
            0.86,
            1.14,
          );
          const moonRadius = clamp(
            focusedRadius * 0.145 * moonPerspective,
            7,
            23,
          );
          drawPlanetSphere(context, { id: "moon", color: "#aaa9a5", accent: "#e0dfd7" }, moonPoint.x, moonPoint.y, moonRadius, 1, false, simulationRef.current);

          context.save();
          context.beginPath();
          context.arc(moonPoint.x, moonPoint.y, moonRadius, 0, TAU);
          context.clip();
          context.fillStyle = "rgba(8, 10, 14, .82)";
          context.beginPath();
          context.arc(
            moonPoint.x +
              moonRadius * 2.05 * currentLunarPosition.illumination,
            moonPoint.y,
            moonRadius * 1.02,
            0,
            TAU,
          );
          context.fill();
          context.restore();

          context.fillStyle = "#d9e0ea";
          context.font = "400 14px -apple-system, BlinkMacSystemFont, sans-serif";
          context.textAlign = "left";
          context.fillText(
            "Луна",
            moonPoint.x + moonRadius + 8,
            moonPoint.y + 3,
          );
          context.restore();
        }

        if (focusAmount > 0.55) {
          projected.push({
            id: focusPlanetData.id,
            x: focusedX,
            y: focusedY,
            hitRadius: focusedRadius,
          });
        }
      }
      projectedRef.current = projected;
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      lastFrameRef.current = null;
    };
  }, [
    camera,
    focusedId,
    hoveredId,
    isLive,
    isPaused,
    selectedId,
    speed,
    stars,
  ]);

  const findPlanetAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let nearest: { id: string; distance: number } | null = null;
    for (const planet of projectedRef.current) {
      const distance = Math.hypot(planet.x - x, planet.y - y);
      if (distance <= planet.hitRadius && (!nearest || distance < nearest.distance)) {
        nearest = { id: planet.id, distance };
      }
    }
    return nearest?.id ?? null;
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      rotation: camera.rotation,
      tilt: camera.tilt,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true;
      setCamera((current) => ({
        ...current,
        rotation: drag.rotation + deltaX * 0.005,
        tilt: clamp(drag.tilt + deltaY * 0.004, 0.12, 1.35),
      }));
      return;
    }
    setHoveredId(findPlanetAt(event.clientX, event.clientY));
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      const planetId = findPlanetAt(event.clientX, event.clientY);
      if (planetId) setSelectedId(planetId);
    }
    dragRef.current = null;
  };

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setCamera((current) => ({
      ...current,
      zoom: clamp(current.zoom - event.deltaY * 0.0007, 0.65, 1.65),
    }));
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "Escape" && focusedId) {
      event.preventDefault();
      exitFocus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (focusedId) exitFocus();
      else focusPlanet(selectedId);
      return;
    }
    const keyedPlanet = PLANETS[Number(event.key) - 1];
    if (keyedPlanet) {
      setSelectedId(keyedPlanet.id);
      if (focusedId) {
        focusSubjectRef.current = keyedPlanet.id;
        setFocusedId(keyedPlanet.id);
      }
      return;
    }
    const cameraKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_"];
    if (!cameraKeys.includes(event.key)) return;
    event.preventDefault();
    setCamera((current) => ({
      rotation:
        current.rotation +
        (event.key === "ArrowLeft" ? -0.08 : event.key === "ArrowRight" ? 0.08 : 0),
      tilt: clamp(
        current.tilt +
          (event.key === "ArrowUp" ? -0.06 : event.key === "ArrowDown" ? 0.06 : 0),
        0.12,
        1.35,
      ),
      zoom: clamp(
        current.zoom *
          (event.key === "+" || event.key === "="
            ? 1.08
            : event.key === "-" || event.key === "_"
              ? 0.92
              : 1),
        0.65,
        1.65,
      ),
    }));
  };

  return (
    <main className={focusedId ? "solar-app is-focused" : "solar-app"}>
      <div className="space-haze" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Орбита — наверх">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="orbit" size={28} />
          </span>
          <span>ОРБИТА</span>
          <small>Живой атлас</small>
        </a>
        <div className="topbar-status">
          <span className={isLive ? "live-dot" : "sim-dot"} />
          <span>{isLive ? "В реальном времени" : isPaused ? "На паузе" : "Симуляция"}</span>
          <time>{formatUtc(displayTime)} UTC</time>
        </div>
        <div className="coordinates-label">
          {focusedId === "earth"
            ? "ЗЕМЛЯ—ЛУНА · РАСЧЁТ ПО ВРЕМЕНИ МОДЕЛИ"
            : focusedId
              ? "ОРБИТАЛЬНЫЙ ОБЪЕКТ · БЛИЖНИЙ ВИД"
              : "ГЕЛИОЦЕНТРИЧЕСКАЯ МОДЕЛЬ · J2000"}
        </div>
      </header>

      <section className="hero-copy" id="top">
        <p className="eyebrow">СОЛНЕЧНАЯ СИСТЕМА · 8 ПЛАНЕТ</p>
        <h1>Всё движется.<br /><span>Прямо сейчас.</span></h1>
        <p className="intro">
          Выберите планету. Измените ракурс.<br />
          Откройте Солнечную систему поближе.
        </p>
      </section>

      <canvas
        ref={canvasRef}
        className={dragRef.current ? "universe is-dragging" : "universe"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={(event) => {
          if (focusedId) {
            exitFocus();
            return;
          }
          const planetId =
            findPlanetAt(event.clientX, event.clientY) ?? selectedId;
          focusPlanet(planetId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => setHoveredId(null)}
        onWheel={handleWheel}
        onKeyDown={handleKeyboard}
        role="img"
        tabIndex={0}
        aria-label="Интерактивная карта Солнечной системы. Стрелки меняют ракурс, плюс и минус меняют масштаб, клавиши от 1 до 8 выбирают планету, Enter приближает, Escape возвращает к системе."
      />

      <div className="view-tools" role="group" aria-label="Ракурс и масштаб">
        <button aria-label="Уменьшить масштаб" title="Уменьшить масштаб" onClick={() => setCamera((current) => ({ ...current, zoom: clamp(current.zoom / 1.15, 0.65, 1.65) }))}><Icon name="minus" /></button>
        <button aria-label="Увеличить масштаб" title="Увеличить масштаб" onClick={() => setCamera((current) => ({ ...current, zoom: clamp(current.zoom * 1.15, 0.65, 1.65) }))}><Icon name="plus" /></button>
        <button aria-label="Исходный ракурс" title="Исходный ракурс" onClick={() => setCamera({ rotation: -0.42, tilt: 0.82, zoom: 1 })}><Icon name="reset" size={16} /></button>
        <span>Потяните, чтобы повернуть</span>
      </div>

      {focusedId && (
        <div className="focus-bar" aria-live="polite">
          <button onClick={exitFocus}><Icon name="back" size={16} /> Вся система</button>
          <span>
            {selectedPlanet.name}{focusedId === "earth" ? " и Луна" : " · Ближний вид"}
          </span>
        </div>
      )}

      <section className="time-panel glass-panel" aria-label="Управление временем">
        <div className="panel-heading">
          <span>Время модели</span>
          <b>{isLive ? "Сейчас" : isPaused ? "На паузе" : "Симуляция"}</b>
        </div>
        <label className="date-field">
          <span>Дата и время · UTC</span>
          <input
            type="datetime-local"
            value={inputDate(displayTime)}
            onFocus={() => {
              setIsLive(false);
              setIsPaused(true);
            }}
            onChange={(event) => {
              const timestamp = Date.parse(`${event.target.value}Z`);
              if (Number.isNaN(timestamp)) return;
              simulationRef.current = timestamp;
              setDisplayTime(timestamp);
              setIsLive(false);
              setIsPaused(true);
            }}
            aria-label="Дата и время модели в UTC"
          />
        </label>
        <div className="time-actions">
          <button onClick={() => shiftTime(-1)} aria-label="Назад на один день">−1д</button>
          <button
            className="play-button"
            onClick={() => {
              if (isLive) {
                setIsLive(false);
                setIsPaused(true);
              } else {
                setIsPaused((current) => !current);
              }
            }}
            aria-label={isPaused ? "Запустить время" : "Поставить на паузу"}
          >
            <Icon name={isPaused ? "play" : "pause"} size={17} />
          </button>
          <button onClick={() => shiftTime(1)} aria-label="Вперёд на один день">+1д</button>
          <button className={isLive ? "now-button is-active" : "now-button"} onClick={goLive}>
            Сейчас
          </button>
        </div>
        <label className="speed-field">
          <span>Скорость времени</span>
          <select
            value={speed}
            onChange={(event) => {
              setSpeed(Number(event.target.value));
              setIsLive(false);
              setIsPaused(false);
            }}
          >
            {SPEEDS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </section>

      <aside className="planet-panel glass-panel" aria-label={`Планета ${selectedPlanet.name}`}>
        <div className="planet-title-row">
          <span className="planet-symbol" style={{ color: selectedPlanet.accent }}>
            {planetPreviews[selectedId] ? <img className="planet-thumbnail" src={planetPreviews[selectedId]} alt="" /> : selectedPlanet.symbol}
          </span>
          <div>
            <p>{focusedId ? "Ближний вид" : "Выбранная планета"}</p>
            <h2>{selectedPlanet.name}</h2>
          </div>
          <span className="planet-index">
            {String(PLANETS.findIndex((planet) => planet.id === selectedId) + 1).padStart(2, "0")}
          </span>
        </div>
        <p className="planet-note">{selectedPlanet.note}</p>
        <button
          className={focusedId ? "focus-button is-active" : "focus-button"}
          onClick={() =>
            focusedId ? exitFocus() : focusPlanet(selectedPlanet.id)
          }
        >
          <Icon name={focusedId ? "back" : "focus"} size={16} />
          {focusedId
            ? "Вернуться к системе"
            : "Рассмотреть планету"}
        </button>
        <dl className="metrics-grid">
          <div>
            <dt>До Солнца</dt>
            <dd>{selectedPosition.distance.toFixed(3)} <small>а.е.</small></dd>
          </div>
          <div>
            <dt>Скорость</dt>
            <dd>{selectedPosition.speed.toFixed(1)} <small>км/с</small></dd>
          </div>
          <div>
            <dt>Долгота</dt>
            <dd>{selectedPosition.longitude.toFixed(1)}<small>°</small></dd>
          </div>
          <div>
            <dt>Период обращения</dt>
            <dd>{periodLabel(selectedPlanet.period)}</dd>
          </div>
        </dl>
        {focusedId === "earth" && (
          <section className="moon-readout" aria-label="Положение Луны">
            <div className="moon-readout-heading">
              <span>Луна</span>
              <b>☾</b>
            </div>
            <p>Положение спутника рассчитано для выбранных даты и времени.</p>
            <dl>
              <div>
                <dt>До Земли</dt>
                <dd>{Math.round(currentMoon.distanceKm).toLocaleString("ru-RU")} <small>км</small></dd>
              </div>
              <div>
                <dt>Освещено</dt>
                <dd>{Math.round(currentMoon.illumination * 100)}<small>%</small></dd>
              </div>
              <div>
                <dt>Долгота</dt>
                <dd>{currentMoon.longitude.toFixed(1)}<small>°</small></dd>
              </div>
            </dl>
          </section>
        )}
      </aside>

      <nav className="planet-rail" aria-label="Выбор планеты">
        {PLANETS.map((planet, index) => (
          <button
            key={planet.id}
            className={planet.id === selectedId ? "planet-chip is-selected" : "planet-chip"}
            onClick={() => {
              setSelectedId(planet.id);
              if (focusedId) {
                focusSubjectRef.current = planet.id;
                setFocusedId(planet.id);
              }
            }}
            style={{ "--planet-color": planet.accent } as React.CSSProperties}
            aria-pressed={planet.id === selectedId}
          >
            <span className="chip-number">{String(index + 1).padStart(2, "0")}</span>
            {planetPreviews[planet.id] ? <img className="chip-thumbnail" src={planetPreviews[planet.id]} alt="" /> : <i aria-hidden="true" />}
            <span>{planet.name}</span>
          </button>
        ))}
      </nav>

      <footer className="model-note">
        <span>Расстояния показаны в сжатом масштабе</span>
        <span>Расчётная модель · Не для навигации</span>
        <a className="texture-credit" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/textures/credits.html`} target="_blank" rel="noreferrer">Текстуры и авторы</a>
      </footer>
    </main>
  );
}
