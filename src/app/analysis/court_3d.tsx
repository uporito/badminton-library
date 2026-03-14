"use client";

import { useRef, useState, useMemo, Fragment, useCallback } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line, ContactShadows } from "@react-three/drei";
import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import * as THREE from "three";
import type { Side, Zone, ShotType } from "@/db/schema";
import type { CourtRow, ShotForStats } from "@/lib/shot_chart_utils";
import { SHOT_TYPE_LABELS } from "@/lib/shot_chart_utils";

// ─── Court dimensions (metres, matching BWF spec) ─────────────────────────────
const CW = 6.1;       // full width (doubles)
const HALF_L = 6.7;   // half-length
const NET_H = 1.55;   // net height
const SLAB_H = 0.35;  // court slab thickness for shadow casting

const CELL_W = CW / 3;
const CELL_D = HALF_L / 3;

// ─── Zone list (mirrors schema order) ────────────────────────────────────────
const ALL_ZONES: Zone[] = [
  "left_front", "left_mid", "left_back",
  "center_front", "center_mid", "center_back",
  "right_front", "right_mid", "right_back",
] as Zone[];

const ALL_SIDES: Side[] = ["me", "opponent"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseZone(zone: Zone): { col: number; row: number } {
  const [s, r] = zone.split("_");
  return {
    col: ({ left: 0, center: 1, right: 2 } as Record<string, number>)[s] ?? 0,
    row: ({ front: 0, mid: 1, back: 2 } as Record<string, number>)[r] ?? 0,
  };
}

function zoneCenter(side: Side, zone: Zone): [number, number] {
  const { col, row } = parseZone(zone);
  const effectiveCol = side === "opponent" ? 2 - col : col;
  const x = -CW / 2 + CELL_W * (effectiveCol + 0.5);
  const depth = CELL_D * (row + 0.5);
  return [x, side === "me" ? depth : -depth];
}

function zoneRow(zone: Zone): CourtRow {
  return zone.split("_")[1] as CourtRow;
}

function zoneDisplayName(zone: Zone): string {
  const [s, r] = zone.split("_");
  const depth = ({ front: "Front", mid: "Mid", back: "Back" } as Record<string, string>)[r] ?? r;
  const side = ({ left: "Left", center: "Center", right: "Right" } as Record<string, string>)[s] ?? s;
  return `${depth} ${side}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const p = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  return `#${[
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function heatColor(t: number): string {
  if (t < 0.5) return lerpHex("#43d1a7", "#fbbf24", t * 2);
  return lerpHex("#fbbf24", "#ef4444", (t - 0.5) * 2);
}

// ─── Public types ─────────────────────────────────────────────────────────────
export type SelectedZone = { side: Side; zone: Zone } | null;

type TooltipState = { zone: Zone; side: Side; x: number; y: number } | null;

export interface Court3DProps {
  selectedZone: SelectedZone;
  highlightedCourtRow?: CourtRow | null;
  shots?: ShotForStats[];
  onZoneClick?: (zone: Zone, side: Side) => void;
  showHeatmap?: boolean;
  /** Ground plane colour — should match the page background for seamless blending */
  groundColor?: string;
}

// ─── Zone mesh ────────────────────────────────────────────────────────────────

interface ZoneMeshProps {
  side: Side;
  zone: Zone;
  isSelected: boolean;
  isHighlighted: boolean;
  onPointerOver: (e: ThreeEvent<PointerEvent>, zone: Zone, side: Side) => void;
  onPointerOut: () => void;
  onClick: (zone: Zone, side: Side) => void;
}

function ZoneMesh({
  side,
  zone,
  isSelected,
  isHighlighted,
  onPointerOver,
  onPointerOut,
  onClick,
}: ZoneMeshProps) {
  const [hovered, setHovered] = useState(false);
  const [cx, cz] = zoneCenter(side, zone);

  const color = useMemo(() => {
    if (isSelected || isHighlighted) return "#43d1a7";
    if (hovered) return "#7ee8cc";
    return side === "me" ? "#6b7280" : "#5b6470";
  }, [isSelected, isHighlighted, hovered, side]);

  const opacity = isSelected ? 0.72 : isHighlighted ? 0.55 : hovered ? 0.48 : 0.2;

  return (
    <mesh
      position={[cx, 0.008, cz]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onPointerOver(e, zone, side);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onPointerOut();
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(zone, side);
      }}
    >
      <boxGeometry args={[CELL_W - 0.09, 0.016, CELL_D - 0.09]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={opacity}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
}

// ─── Heatmap bar ──────────────────────────────────────────────────────────────

interface HeatmapBarProps {
  side: Side;
  zone: Zone;
  count: number;
  maxCount: number;
  onZoneClick?: (zone: Zone, side: Side) => void;
}

function HeatmapBar({ side, zone, count, maxCount, onZoneClick }: HeatmapBarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentH = useRef(0);
  const [cx, cz] = zoneCenter(side, zone);

  const t = maxCount > 0 ? count / maxCount : 0;
  const targetH = t * 3.5;
  const color = useMemo(() => new THREE.Color(heatColor(t)), [t]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    currentH.current = THREE.MathUtils.lerp(
      currentH.current,
      targetH,
      Math.min(1, delta * 4),
    );
    const h = Math.max(0.001, currentH.current);
    meshRef.current.scale.y = h;
    meshRef.current.position.y = h / 2;
  });

  return (
    <mesh
      ref={meshRef}
      position={[cx, 0, cz]}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        onZoneClick?.(zone, side);
      }}
    >
      <boxGeometry args={[CELL_W * 0.56, 1, CELL_D * 0.56]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.88}
        roughness={0.3}
        metalness={0.15}
        emissive={color}
        emissiveIntensity={0.18}
      />
    </mesh>
  );
}

// ─── Court floor (thick slab that casts shadows) ─────────────────────────────

function CourtFloor({ groundColor }: { groundColor: string }) {
  return (
    <>
      {/* Infinite ground plane — matches page bg, receives shadows */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -SLAB_H - 0.001, 0]}
        receiveShadow
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={groundColor} roughness={0.95} metalness={0} />
      </mesh>

      {/* My half — thick slab */}
      <mesh position={[0, -SLAB_H / 2, HALF_L / 2]} castShadow receiveShadow>
        <boxGeometry args={[CW, SLAB_H, HALF_L]} />
        <meshStandardMaterial color="#7c8a9d" roughness={0.65} metalness={0.08} />
      </mesh>

      {/* Opponent half — slightly different shade */}
      <mesh position={[0, -SLAB_H / 2, -HALF_L / 2]} castShadow receiveShadow>
        <boxGeometry args={[CW, SLAB_H, HALF_L]} />
        <meshStandardMaterial color="#6d7b8e" roughness={0.65} metalness={0.08} />
      </mesh>
    </>
  );
}

// ─── Court lines ──────────────────────────────────────────────────────────────

function CourtLines() {
  const hw = CW / 2;
  const hl = HALF_L;
  const sw = 5.18 / 2;
  const lsl = HALF_L - 0.76;
  const Y = 0.025;

  const segments: [[number, number, number][], number, number][] = [
    [[[-hw, Y, -hl], [hw, Y, -hl]], 2.0, 0.8],
    [[[-hw, Y, hl], [hw, Y, hl]], 2.0, 0.8],
    [[[-hw, Y, -hl], [-hw, Y, hl]], 2.0, 0.8],
    [[[hw, Y, -hl], [hw, Y, hl]], 2.0, 0.8],
    [[[-hw, Y, 0], [hw, Y, 0]], 1.6, 0.7],
    [[[-hw, Y, 1.98], [hw, Y, 1.98]], 1.4, 0.6],
    [[[-hw, Y, -1.98], [hw, Y, -1.98]], 1.4, 0.6],
    [[[-sw, Y, -hl], [-sw, Y, hl]], 1.3, 0.5],
    [[[sw, Y, -hl], [sw, Y, hl]], 1.3, 0.5],
    [[[-sw, Y, lsl], [sw, Y, lsl]], 1.2, 0.48],
    [[[-sw, Y, -lsl], [sw, Y, -lsl]], 1.2, 0.48],
    [[[0, Y, 1.98], [0, Y, hl]], 1.2, 0.48],
    [[[0, Y, -1.98], [0, Y, -hl]], 1.2, 0.48],
  ];

  return (
    <>
      {segments.map(([pts, lw, op], i) => (
        <Line
          key={i}
          points={pts}
          color="#ffffff"
          lineWidth={lw}
          transparent
          opacity={op}
        />
      ))}
    </>
  );
}

// ─── Net ──────────────────────────────────────────────────────────────────────

function NetMesh() {
  return (
    <group>
      <mesh position={[0, NET_H / 2, 0]}>
        <planeGeometry args={[CW, NET_H]} />
        <meshStandardMaterial
          color="#c8d6e8"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>
      {/* Top tape */}
      <mesh position={[0, NET_H + 0.015, 0]} castShadow>
        <boxGeometry args={[CW + 0.06, 0.03, 0.025]} />
        <meshStandardMaterial color="#e8eef5" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Poles */}
      {([-CW / 2, CW / 2] as number[]).map((x, i) => (
        <mesh key={i} position={[x, NET_H / 2, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, NET_H, 8]} />
          <meshStandardMaterial
            color="#8899aa"
            roughness={0.25}
            metalness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── 3-D scene ────────────────────────────────────────────────────────────────

interface SceneProps {
  selectedZone: SelectedZone;
  highlightedCourtRow: CourtRow | null;
  shotCountMap: Map<string, number>;
  maxShotCount: number;
  onPointerOver: (e: ThreeEvent<PointerEvent>, zone: Zone, side: Side) => void;
  onPointerOut: () => void;
  onZoneClick: (zone: Zone, side: Side) => void;
  showHeatmap: boolean;
  autoRotate: boolean;
  groundColor: string;
}

function CourtScene({
  selectedZone,
  highlightedCourtRow,
  shotCountMap,
  maxShotCount,
  onPointerOver,
  onPointerOut,
  onZoneClick,
  showHeatmap,
  autoRotate,
  groundColor,
}: SceneProps) {
  return (
    <>
      {/* ── Lighting — cinematic, high-contrast ── */}
      <ambientLight intensity={0.35} />

      {/* Key light — strong from upper-right, casts hard shadows */}
      <directionalLight
        position={[10, 20, 8]}
        intensity={3.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
      />

      {/* Fill light — cool, dim, opposite side */}
      <directionalLight position={[-8, 12, -10]} intensity={0.4} color="#a3bfdb" />

      {/* Subtle rim/accent glow at court level */}
      <pointLight position={[0, 1.2, 0]} intensity={0.4} color="#43d1a7" distance={14} decay={2} />

      {/* ── Court geometry ── */}
      <CourtFloor groundColor={groundColor} />
      <CourtLines />
      <NetMesh />

      {/* Contact shadows for a soft, diffused shadow layer below the court slab */}
      <ContactShadows
        position={[0, -SLAB_H - 0.0005, 0]}
        width={20}
        height={20}
        far={6}
        opacity={0.45}
        blur={2.5}
        color="#000000"
      />

      {/* ── Interactive zone meshes ── */}
      {ALL_SIDES.flatMap((side) =>
        ALL_ZONES.map((zone) => (
          <ZoneMesh
            key={`${side}-${zone}`}
            side={side}
            zone={zone}
            isSelected={selectedZone?.side === side && selectedZone?.zone === zone}
            isHighlighted={
              side === "me" &&
              highlightedCourtRow !== null &&
              zoneRow(zone) === highlightedCourtRow
            }
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            onClick={onZoneClick}
          />
        )),
      )}

      {/* ── Heatmap bars ── */}
      {showHeatmap &&
        ALL_SIDES.flatMap((side) =>
          ALL_ZONES.map((zone) => {
            const count = shotCountMap.get(`${side}:${zone}`) ?? 0;
            if (count === 0) return null;
            return (
              <HeatmapBar
                key={`bar-${side}-${zone}`}
                side={side}
                zone={zone}
                count={count}
                maxCount={maxShotCount}
                onZoneClick={onZoneClick}
              />
            );
          }),
        )}

      {/* ── Camera controls — view locked, only auto-rotate runs ── */}
      <OrbitControls
        makeDefault
        enableRotate={false}
        enableZoom={false}
        enablePan={false}
        target={[-7, -2, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.4}
      />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Court3D({
  selectedZone,
  highlightedCourtRow = null,
  shots = [],
  onZoneClick,
  showHeatmap = false,
  groundColor = "#e4e6ec",
}: Court3DProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [autoRotate, setAutoRotate] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const shotCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shots) {
      const key = `${s.zoneFromSide}:${s.zoneFrom}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [shots]);

  const maxShotCount = useMemo(() => {
    let max = 0;
    for (const v of shotCountMap.values()) if (v > max) max = v;
    return max;
  }, [shotCountMap]);

  const shotsByZoneKey = useMemo(() => {
    const map = new Map<string, { shotType: ShotType; count: number; percentage: number }[]>();
    if (shots.length === 0) return map;
    const raw = new Map<string, Map<ShotType, number>>();
    for (const s of shots) {
      const key = `${s.zoneFromSide}:${s.zoneFrom}`;
      if (!raw.has(key)) raw.set(key, new Map());
      const tm = raw.get(key)!;
      tm.set(s.shotType, (tm.get(s.shotType) ?? 0) + 1);
    }
    for (const [key, tm] of raw) {
      const total = Array.from(tm.values()).reduce((a, b) => a + b, 0);
      map.set(
        key,
        Array.from(tm.entries())
          .map(([shotType, count]) => ({
            shotType,
            count,
            percentage: Math.round((count / total) * 100),
          }))
          .sort((a, b) => b.count - a.count),
      );
    }
    return map;
  }, [shots]);

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>, zone: Zone, side: Side) => {
      setTooltip({ zone, side, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handlePointerOut = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleZoneClick = useCallback(
    (zone: Zone, side: Side) => onZoneClick?.(zone, side),
    [onZoneClick],
  );

  const tooltipBreakdown = tooltip
    ? (shotsByZoneKey.get(`${tooltip.side}:${tooltip.zone}`) ?? [])
    : [];

  return (
    <div ref={wrapperRef} className="absolute inset-0 select-none">
      <Canvas
        camera={{ position: [1, 10, 20], fov: 40 }}
        shadows
        frameloop="always"
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <CourtScene
          selectedZone={selectedZone}
          highlightedCourtRow={highlightedCourtRow ?? null}
          shotCountMap={shotCountMap}
          maxShotCount={maxShotCount}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onZoneClick={handleZoneClick}
          showHeatmap={showHeatmap}
          autoRotate={autoRotate}
          groundColor={groundColor}
        />
      </Canvas>

      {/* Auto-rotate toggle */}
      <button
        type="button"
        onClick={() => setAutoRotate((v) => !v)}
        title={autoRotate ? "Pause rotation" : "Resume rotation"}
        className="absolute top-3 right-3 flex items-center justify-center h-7 w-7 rounded-full bg-ui-frame/60 text-text-soft hover:bg-ui-elevated hover:text-text-main transition-colors backdrop-blur-sm"
      >
        {autoRotate ? (
          <PauseIcon weight="fill" className="h-3.5 w-3.5" />
        ) : (
          <PlayIcon weight="fill" className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Tooltip */}
      {tooltip != null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="frame pointer-events-none fixed z-[200] min-w-[160px] rounded-xl px-4 py-3 text-xs shadow-lg"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            <p className="font-semibold text-text-main">
              {tooltip.side === "me" ? "My " : "Opponent "}
              {zoneDisplayName(tooltip.zone)}
            </p>
            {tooltipBreakdown.length === 0 ? (
              <p className="mt-1.5 text-text-main">No shots recorded</p>
            ) : (
              <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 border-t border-ui-elevated pt-2">
                {tooltipBreakdown.map(({ shotType, count, percentage }) => (
                  <Fragment key={shotType}>
                    <span className="text-text-main">{SHOT_TYPE_LABELS[shotType]}</span>
                    <span className="tabular-nums text-right text-text-main">{count}</span>
                    <span className="tabular-nums text-right text-text-main">
                      {percentage}&thinsp;%
                    </span>
                  </Fragment>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
