'use client'

import { X } from 'lucide-react'
import type { PlantItem } from '@/lib/types'

// Scottish postcode area → [lat, lon]
const POSTCODE_COORDS: Record<string, [number, number]> = {
  'AB54': [57.23, -2.71], // Alford depot
  'AB':   [57.15, -2.09],
  'DD':   [56.46, -2.97],
  'EH':   [55.95, -3.19],
  'G':    [55.86, -4.26],
  'IV':   [57.48, -4.22],
  'KY':   [56.22, -3.15],
  'PA':   [55.85, -4.43],
  'PH':   [56.40, -3.47],
  'FK':   [56.12, -3.94],
  'KA':   [55.61, -4.50],
  'ML':   [55.77, -3.99],
  'TD':   [55.60, -2.80],
  'DG':   [55.07, -3.60],
  'KW':   [58.44, -3.09],
  'IV2':  [57.48, -4.22],
  'HS':   [57.86, -7.00],
}

const DEPOT_LAT = 57.23
const DEPOT_LON = -2.71

// ViewBox 0 0 500 700 — lat 54.4–61.0, lon -7.7 to -0.7
function latLonToSVG(lat: number, lon: number): [number, number] {
  const x = (lon + 7.7) / 7.0 * 500
  const y = (61.0 - lat) / 6.6 * 700
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

function postcodeToSVG(postcode: string | null): [number, number] {
  if (!postcode) return latLonToSVG(DEPOT_LAT, DEPOT_LON)
  const clean = postcode.toUpperCase().trim()
  const district = clean.match(/^[A-Z]{1,2}\d{1,2}/)?.[0] ?? ''
  const area = clean.match(/^[A-Z]{1,2}/)?.[0] ?? ''
  const coords = POSTCODE_COORDS[district] ?? POSTCODE_COORDS[area]
  if (!coords) return latLonToSVG(DEPOT_LAT, DEPOT_LON)
  return latLonToSVG(coords[0], coords[1])
}

const CATEGORY_IMAGE: Record<string, string> = {
  excavator:   '/Plant/Excavator .png',
  dumper:      '/Plant/Dumper.png',
  telehandler: '/Plant/telehandler.png',
  crane:       '/Plant/crane.png',
  roller:      '/Plant/Roller.png',
  generator:   '/Plant/Generator.png',
  lorry:       '/Plant/Lorry.png',
  scaffold:    '/Plant/Scaffold.png',
  pump:        '/Plant/Pump.png',
}

function plantImage(category: string) {
  return CATEGORY_IMAGE[category.toLowerCase()] ?? '/Plant/Default.png'
}

interface Props {
  plant: (PlantItem & { project?: { name: string; location: string } | null })[]
  onClose: () => void
}

export default function PlantMap({ plant, onClose }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const depotXY = latLonToSVG(DEPOT_LAT, DEPOT_LON)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="relative rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Plant Overview — Scotland</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Depot: AB54 4RD · Alford</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="relative" style={{ height: 560, overflow: 'hidden' }}>
          <svg viewBox="0 0 500 700" className="w-full h-full" style={{ background: '#0f1929' }}>
            {/* Scotland mainland outline */}
            <path
              d="M 325,630 L 370,628 L 408,628 L 402,590 L 385,570 L 415,555 L 418,530 L 412,510 L 430,470 L 438,440 L 432,415 L 440,390 L 442,370 L 432,340 L 420,315 L 398,295 L 362,275 L 350,265 L 346,248 L 338,238 L 332,228 L 320,220 L 295,218 L 268,220 L 240,218 L 215,218 L 198,225 L 180,238 L 158,260 L 148,285 L 145,310 L 138,335 L 132,358 L 130,378 L 128,398 L 125,418 L 122,440 L 118,462 L 115,482 L 112,502 L 110,520 L 108,542 L 112,565 L 108,585 L 120,598 L 138,610 L 158,620 L 175,625 L 192,628 L 218,630 L 248,628 L 280,629 L 310,630 L 325,630 Z"
              fill="#1a2a3a"
              stroke="#2d4a6a"
              strokeWidth="1.5"
            />
            {/* Firth of Forth indent */}
            <path d="M 385,570 L 355,558 L 340,552 L 345,545 L 365,548 L 385,555 Z" fill="#0f1929" stroke="#2d4a6a" strokeWidth="0.5" />

            {/* Depot marker — AB54 4RD */}
            <circle cx={depotXY[0]} cy={depotXY[1]} r="8" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5" />
            <text x={depotXY[0]} y={depotXY[1] + 20} textAnchor="middle" fontSize="8" fill="#3b82f6">DEPOT</text>

            {/* Plant pins */}
            {plant.map((p) => {
              const location = p.status === 'available' || !p.project?.location
                ? null
                : p.project?.location ?? null
              const [px, py] = postcodeToSVG(location)
              const img = plantImage(p.category)
              const isHovered = hovered === p.id

              return (
                <g
                  key={p.id}
                  transform={`translate(${px - 16}, ${py - 16})`}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx="16" cy="16" r="18"
                    fill={p.status === 'breakdown' ? '#7f1d1d' : p.status === 'on_hire' ? '#1e3a1e' : '#1e2a3a'}
                    stroke={p.status === 'breakdown' ? '#ef4444' : p.status === 'on_hire' ? '#22c55e' : '#64748b'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                  />
                  <image href={img} x="4" y="4" width="24" height="24" style={{ imageRendering: 'pixelated' }} />

                  {isHovered && (
                    <g transform="translate(-40, -52)">
                      <rect x="0" y="0" width="120" height="42" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                      <text x="8" y="14" fontSize="9" fontWeight="600" fill="#f1f5f9">{p.name}</text>
                      <text x="8" y="26" fontSize="8" fill="#94a3b8">{p.make} {p.model}</text>
                      <text x="8" y="38" fontSize="8" fill={p.status === 'breakdown' ? '#ef4444' : p.status === 'on_hire' ? '#22c55e' : '#64748b'}>
                        {p.status === 'available' ? 'At depot' : p.status === 'on_hire' ? `On hire — ${p.project?.name ?? 'unknown'}` : p.status}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 right-3 rounded-lg px-3 py-2 text-xs space-y-1" style={{ background: 'rgba(15,25,41,0.9)', border: '1px solid #2d4a6a' }}>
            {[['#22c55e', 'On hire'], ['#64748b', 'Available (depot)'], ['#ef4444', 'Breakdown']].map(([col, label]) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col }} />
                <span style={{ color: '#94a3b8' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Need useState import
import { useState } from 'react'
