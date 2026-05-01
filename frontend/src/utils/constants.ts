export const ATTRIBUTES = [
  'color_vibrancy','surface_roughness','pattern_complexity',
  'striped_pattern','checkered_pattern','brightness','shininess',
  'sparkle','hardness','movement_effect','pattern_scale',
  'naturalness','thickness','multicolored','value','warmth',
] as const

export const ATTR_DISPLAY = [
  'Color Vibrancy','Surface Roughness','Pattern Complexity',
  'Striped Pattern','Checkered Pattern','Brightness','Shininess',
  'Sparkle','Hardness','Movement Effect','Pattern Scale',
  'Naturalness','Thickness','Multicolored','Value','Warmth',
] as const

export const ATTR_SHORT = [
  'Color','Roughness','Pattern','Striped','Checkered','Brightness','Shininess',
  'Sparkle','Hardness','Movement','Scale','Natural','Thickness','Multi','Value','Warmth',
] as const

export const CATEGORY_TAGS: Record<string, { bg: string; color: string }> = {
  fabric:  { bg: '#EEE4F5', color: '#7040A0' },
  wood:    { bg: '#F5EBD9', color: '#8A5520' },
  coating: { bg: '#E5F5F0', color: '#1A6B50' },
  paper:   { bg: '#E5EDF8', color: '#2A4E88' },
  plastic: { bg: '#F5E8E8', color: '#882A2A' },
  metal:   { bg: '#E8EAF0', color: '#3D4A6A' },
  leather: { bg: '#F0E8E0', color: '#6A3A18' },
  other:   { bg: '#EBEBEB', color: '#555555' },
}

export const ACCENT_COLORS = {
  orange: { accent: '#C4602A', light: '#F0E4D8', mid: '#E8C9B0' },
  teal:   { accent: '#2A7B6F', light: '#D4EDEA', mid: '#A8D5CF' },
  indigo: { accent: '#3B4F8C', light: '#E0E5F5', mid: '#B8C4E8' },
  gold:   { accent: '#B8860B', light: '#FDF5DC', mid: '#F0D888' },
}
