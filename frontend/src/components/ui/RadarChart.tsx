import {
  RadarChart as ReRadar,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { ATTR_SHORT } from '@/utils/constants'

interface Props {
  values: number[]
  color?: string
  fillColor?: string
  size?: number
  showLabels?: boolean
  compareValues?: number[]
  compareColor?: string
}

export default function RadarChart({
  values,
  color = '#C4602A',
  fillColor,
  size = 240,
  showLabels = true,
  compareValues,
  compareColor = '#2A7B6F',
}: Props) {
  const fill = fillColor ?? color + '22'

  const data = ATTR_SHORT.map((label, i) => ({
    label,
    value:   +(values[i] ?? 0).toFixed(3),
    compare: compareValues ? +(compareValues[i] ?? 0).toFixed(3) : undefined,
  }))

  return (
    <ResponsiveContainer width="100%" height={size}>
      <ReRadar cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="rgba(26,22,20,0.08)" strokeWidth={0.5} />
        {showLabels && (
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'rgba(26,22,20,0.45)', fontFamily: 'DM Sans, sans-serif' }}
          />
        )}
        <Tooltip
          contentStyle={{
            background: 'var(--white)',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: 'var(--shadow-md)',
          }}
          formatter={(val: number, name: string) => [val.toFixed(3), name]}
        />
        <Radar
          dataKey="value"
          name="Fingerprint"
          stroke={color}
          strokeWidth={1.5}
          fill={fill}
        />
        {compareValues && (
          <Radar
            dataKey="compare"
            name="Compare"
            stroke={compareColor}
            strokeWidth={1.5}
            fill={compareColor + '18'}
          />
        )}
      </ReRadar>
    </ResponsiveContainer>
  )
}
