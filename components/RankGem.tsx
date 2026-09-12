import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import type { RankFamily, RankStyle } from '../constants/ranks';

interface RankGemProps {
  rank: RankStyle;
  size: number;
}

function gid(rank: RankStyle, suffix: string): string {
  return `gem-${rank.family}-${rank.level}-${suffix}`;
}

function Cabochon({
  rank,
  cx,
  cy,
  rx,
  ry,
}: {
  rank: RankStyle;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}) {
  const fill = gid(rank, 'body');
  const shine = gid(rank, 'shine');
  return (
    <G>
      <Defs>
        <RadialGradient id={fill} cx="38%" cy="32%" r="72%">
          <Stop offset="0%" stopColor={rank.light} />
          <Stop offset="42%" stopColor={rank.metal} />
          <Stop offset="100%" stopColor={rank.dark} />
        </RadialGradient>
        <RadialGradient id={shine} cx="32%" cy="28%" r="28%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={rank.dark} />
      <Ellipse cx={cx} cy={cy} rx={rx - 0.7} ry={ry - 0.7} fill={`url(#${fill})`} />
      <Ellipse cx={cx - rx * 0.22} cy={cy - ry * 0.28} rx={rx * 0.28} ry={ry * 0.2} fill={`url(#${shine})`} />
    </G>
  );
}

function FacetGem({
  rank,
  points,
  inner,
}: {
  rank: RankStyle;
  points: string;
  inner?: string;
}) {
  const gloss = gid(rank, 'gloss');
  return (
    <G>
      <Defs>
        <LinearGradient id={gloss} x1="20%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor={rank.light} />
          <Stop offset="45%" stopColor={rank.metal} />
          <Stop offset="100%" stopColor={rank.dark} />
        </LinearGradient>
      </Defs>
      <Polygon points={points} fill={rank.dark} />
      {inner ? <Polygon points={inner} fill={`url(#${gloss})`} stroke={rank.light} strokeWidth={0.7} /> : null}
    </G>
  );
}

function stonePoints(family: RankFamily, cx: number, cy: number, r: number): { outer: string; inner?: string } {
  if (family === 'emerald') {
    const w = r;
    const h = r * 0.82;
    return {
      outer: `${cx - w * 0.55},${cy - h} ${cx + w * 0.55},${cy - h} ${cx + w},${cy} ${cx + w * 0.55},${cy + h} ${cx - w * 0.55},${cy + h} ${cx - w},${cy}`,
      inner: `${cx - w * 0.42},${cy - h + 1.4} ${cx + w * 0.42},${cy - h + 1.4} ${cx + w - 1.4},${cy} ${cx + w * 0.42},${cy + h - 1.4} ${cx - w * 0.42},${cy + h - 1.4} ${cx - w + 1.4},${cy}`,
    };
  }
  if (family === 'sapphire') {
    const hex = (scale: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        return `${cx + Math.cos(a) * r * scale},${cy + Math.sin(a) * r * scale}`;
      }).join(' ');
    return { outer: hex(1), inner: hex(0.72) };
  }
  if (family === 'ruby' || family === 'master') {
    const pent = (scale: number) =>
      Array.from({ length: 5 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        return `${cx + Math.cos(a) * r * scale},${cy + Math.sin(a) * r * scale}`;
      }).join(' ');
    return { outer: pent(1), inner: pent(0.68) };
  }
  if (family === 'diamond') {
    const spikes = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    }).join(' ');
    const table = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      return `${cx + Math.cos(a) * r * 0.38},${cy + Math.sin(a) * r * 0.38}`;
    }).join(' ');
    return { outer: spikes, inner: table };
  }
  if (family === 'jade') {
    const cut = r * 0.86;
    return {
      outer: `${cx - cut},${cy - cut} ${cx + cut},${cy - cut} ${cx + cut},${cy + cut} ${cx - cut},${cy + cut}`,
      inner: `${cx - cut + 1.6},${cy - cut + 1.6} ${cx + cut - 1.6},${cy - cut + 1.6} ${cx + cut - 1.6},${cy + cut - 1.6} ${cx - cut + 1.6},${cy + cut - 1.6}`,
    };
  }
  return { outer: '', inner: '' };
}

export const RankGem: React.FC<RankGemProps> = ({ rank, size }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 0.4;
  const family = rank.family;

  if (
    family === 'bronze' ||
    family === 'silver' ||
    family === 'gold' ||
    family === 'amber' ||
    family === 'pearl' ||
    family === 'platinum'
  ) {
    const tall = family === 'amber' ? 0.82 : family === 'pearl' ? 1 : 0.92;
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Cabochon rank={rank} cx={cx} cy={cy} rx={r} ry={r * tall} />
        {family === 'pearl' ? (
          <Circle cx={cx - r * 0.22} cy={cy - r * 0.28} r={r * 0.16} fill="#fff" opacity={0.7} />
        ) : null}
      </Svg>
    );
  }

  const { outer, inner } = stonePoints(family, cx, cy, r);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <FacetGem rank={rank} points={outer} inner={inner} />
      {family === 'diamond' ? (
        <G>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4 - Math.PI / 2;
            const x = cx + Math.cos(a) * r * 0.62;
            const y = cy + Math.sin(a) * r * 0.62;
            return <Path key={a} d={`M ${cx} ${cy} L ${x} ${y}`} stroke={rank.light} strokeWidth={0.5} opacity={0.8} />;
          })}
          <Circle cx={cx} cy={cy} r={r * 0.16} fill="#fff" opacity={0.9} />
        </G>
      ) : (
        <Circle cx={cx} cy={cy} r={Math.max(1.2, r * 0.12)} fill={rank.light} opacity={0.75} />
      )}
    </Svg>
  );
};
