import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { getRankForLevel, type RankStyle } from '../constants/ranks';
import { AppText } from './AppText';

interface RankFrameProps {
  level: number;
  size: number;
  children: React.ReactNode;
  label?: string;
  showLabel?: boolean;
}

function FrameOrnaments({
  rank,
  cx,
  cy,
  r,
}: {
  rank: RankStyle;
  cx: number;
  cy: number;
  r: number;
}) {
  const { metal, dark, light } = rank;

  if (rank.family === 'master') {
    const crown = [
      [cx - r * 0.72, cy - r - 1],
      [cx - r * 0.46, cy - r - r * 0.55],
      [cx - r * 0.22, cy - r - r * 0.12],
      [cx, cy - r - r * 0.72],
      [cx + r * 0.22, cy - r - r * 0.12],
      [cx + r * 0.46, cy - r - r * 0.55],
      [cx + r * 0.72, cy - r - 1],
    ];
    return (
      <G>
        <Circle cx={cx} cy={cy} r={r + 5} fill={dark} />
        <Circle cx={cx} cy={cy} r={r + 2} fill={metal} />
        <Circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke={light} strokeWidth={1.6} />
        <Path
          d={`M ${crown.map((p) => p.join(' ')).join(' L ')} Z`}
          fill={metal}
          stroke={dark}
          strokeWidth={0.9}
        />
        <Circle cx={cx} cy={cy - r - r * 0.72} r={2.4} fill={light} />
        <Circle cx={cx - r * 0.46} cy={cy - r - r * 0.55} r={1.7} fill={light} />
        <Circle cx={cx + r * 0.46} cy={cy - r - r * 0.55} r={1.7} fill={light} />
        <Polygon
          points={`${cx - 8},${cy + r + 1} ${cx + 8},${cy + r + 1} ${cx + 6},${cy + r + 8} ${cx - 6},${cy + r + 8}`}
          fill={dark}
        />
        <Polygon
          points={`${cx - 7},${cy + r + 2} ${cx + 7},${cy + r + 2} ${cx + 5},${cy + r + 7} ${cx - 5},${cy + r + 7}`}
          fill={metal}
        />
      </G>
    );
  }

  if (rank.family === 'diamond') {
    const spikes = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const x1 = cx + Math.cos(a - 0.2) * (r + 1);
      const y1 = cy + Math.sin(a - 0.2) * (r + 1);
      const x2 = cx + Math.cos(a) * (r + r * 0.38);
      const y2 = cy + Math.sin(a) * (r + r * 0.38);
      const x3 = cx + Math.cos(a + 0.2) * (r + 1);
      const y3 = cy + Math.sin(a + 0.2) * (r + 1);
      return `${x1},${y1} ${x2},${y2} ${x3},${y3}`;
    });
    return (
      <G>
        {spikes.map((points) => (
          <Polygon key={points} points={points} fill={light} stroke={dark} strokeWidth={0.6} />
        ))}
        <Circle cx={cx} cy={cy} r={r + 2.5} fill={dark} />
        <Circle cx={cx} cy={cy} r={r} fill={metal} />
        <Circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="#fff" strokeWidth={1} opacity={0.75} />
      </G>
    );
  }

  if (rank.family === 'platinum') {
    return (
      <G>
        <Circle cx={cx} cy={cy} r={r + 4.5} fill={dark} />
        <Circle cx={cx} cy={cy} r={r + 2} fill={light} />
        <Circle cx={cx} cy={cy} r={r} fill={metal} />
        <Rect x={cx - 8} y={cy - r - 8} width={16} height={3.2} rx={1.2} fill={dark} />
        {rank.division >= 2 ? <Rect x={cx - 6} y={cy - r - 13} width={12} height={2.6} rx={1} fill={metal} /> : null}
      </G>
    );
  }

  if (rank.family === 'gold') {
    return (
      <G>
        <Path
          d={`M ${cx - r - 3} ${cy} C ${cx - r - 10} ${cy - 18}, ${cx - 10} ${cy - r - 12}, ${cx} ${cy - r - 5} C ${cx + 10} ${cy - r - 12}, ${cx + r + 10} ${cy - 18}, ${cx + r + 3} ${cy}`}
          fill="none"
          stroke={metal}
          strokeWidth={2.4}
        />
        <Path
          d={`M ${cx - r - 3} ${cy} C ${cx - r - 10} ${cy + 18}, ${cx - 10} ${cy + r + 12}, ${cx} ${cy + r + 5} C ${cx + 10} ${cy + r + 12}, ${cx + r + 10} ${cy + 18}, ${cx + r + 3} ${cy}`}
          fill="none"
          stroke={metal}
          strokeWidth={2.4}
        />
        <Circle cx={cx} cy={cy} r={r + 3} fill={dark} />
        <Circle cx={cx} cy={cy} r={r} fill={metal} />
        <Circle cx={cx - (rank.division >= 2 ? 5 : 0)} cy={cy + r + 5} r={1.8} fill={light} />
        {rank.division >= 2 ? <Circle cx={cx + 5} cy={cy + r + 5} r={1.8} fill={light} /> : null}
      </G>
    );
  }

  if (rank.family === 'silver') {
    return (
      <G>
        <Circle cx={cx} cy={cy} r={r + 3.5} fill={dark} />
        <Circle cx={cx} cy={cy} r={r} fill={metal} />
        <Circle cx={cx - r + 3} cy={cy} r={1.7} fill={light} />
        <Circle cx={cx + r - 3} cy={cy} r={1.7} fill={light} />
        <Circle cx={cx} cy={cy - r + 3} r={1.7} fill={light} />
        {rank.division >= 2 ? <Circle cx={cx} cy={cy + r - 3} r={1.7} fill={light} /> : null}
      </G>
    );
  }

  return (
    <G>
      <Circle cx={cx} cy={cy} r={r + 3.5} fill={dark} />
      <Circle cx={cx} cy={cy} r={r} fill={metal} />
      <Circle cx={cx} cy={cy + r + 4} r={2} fill={light} />
      {rank.division >= 2 ? (
        <>
          <Circle cx={cx - 6} cy={cy + r + 3} r={1.7} fill={light} />
          <Circle cx={cx + 6} cy={cy + r + 3} r={1.7} fill={light} />
        </>
      ) : null}
    </G>
  );
}

export const RankFrame: React.FC<RankFrameProps> = ({
  level,
  size,
  children,
  label,
  showLabel = size >= 36,
}) => {
  const rank = getRankForLevel(level);
  const ring = Math.max(4, Math.round(size * 0.08));
  const outer =
    rank.family === 'master' || rank.family === 'diamond' || rank.family === 'gold'
      ? Math.round(size * 0.26)
      : Math.round(size * 0.14);
  const crest =
    rank.family === 'master' ? Math.round(size * 0.42) : rank.family === 'diamond' ? Math.round(size * 0.28) : Math.round(size * 0.16);
  const box = size + (ring + outer) * 2;
  const cx = box / 2;
  const cy = crest + ring + outer + size / 2;
  const r = size / 2 + ring;
  const caption = label || '';
  const captionH = showLabel && caption ? 13 : 0;
  const svgH = cy + r + (rank.family === 'gold' || rank.family === 'master' ? 10 : 7);
  const height = Math.max(svgH, cy + size / 2) + captionH;
  const photoTop = cy - size / 2;

  return (
    <View style={[styles.wrap, { width: box, height }]}>
      <Svg width={box} height={svgH} style={styles.svg}>
        <FrameOrnaments rank={rank} cx={cx} cy={cy} r={r} />
      </Svg>
      <View
        style={[
          styles.photo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            marginTop: photoTop,
            borderColor: rank.light,
          },
        ]}
      >
        {children}
      </View>
      {showLabel && caption ? (
        <AppText style={[styles.caption, { color: rank.text }]} numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  photo: {
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#111',
  },
  caption: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: '100%',
  },
});
