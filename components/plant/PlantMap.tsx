'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { PlantItem } from '@/lib/types'

// ViewBox: 0 0 500 600
// Lat 54.5–59.0 (4.5°), Lon -7.5 to -1.0 (6.5°)
function latLonToSVG(lat: number, lon: number): [number, number] {
  const x = (lon + 7.5) / 6.5 * 500
  const y = (59.0 - lat) / 4.5 * 600
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
}

const POSTCODE_COORDS: Record<string, [number, number]> = {
  'AB54': [57.23, -2.71],
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
}

function postcodeToSVG(postcode: string | null): [number, number] {
  if (!postcode) return latLonToSVG(57.23, -2.71)
  const clean = postcode.toUpperCase().trim()
  const district = clean.match(/^[A-Z]{1,2}\d{1,2}/)?.[0] ?? ''
  const area = clean.match(/^[A-Z]{1,2}/)?.[0] ?? ''
  const coords = POSTCODE_COORDS[district] ?? POSTCODE_COORDS[area]
  return coords ? latLonToSVG(coords[0], coords[1]) : latLonToSVG(57.23, -2.71)
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

// Scotland mainland path — clockwise from Berwick, ~75 points
// Coordinate system: x=(lon+7.5)/6.5*500, y=(59-lat)/4.5*600
const SCOTLAND_PATH = `
M 423,430
L 415,417 L 408,410 L 383,400
L 368,393 L 331,404 L 317,400 L 316,399
L 333,386 L 378,378
L 349,340
L 378,327 L 388,307
L 407,274
L 416,247
L 427,210 L 440,190 L 437,175 L 423,165
L 405,165 L 385,169 L 361,165 L 323,161 L 309,165
L 280,179 L 254,193
L 261,182 L 268,169 L 286,143
L 261,142
L 264,130 L 290,111 L 307,91 L 333,67 L 336,48
L 311,44 L 298,55 L 268,60 L 231,69 L 210,67 L 188,51
L 184,72 L 175,82 L 170,112 L 157,127
L 177,148
L 155,156 L 140,171 L 129,191 L 130,207 L 137,229 L 129,267
L 98,302
L 157,345
L 151,391 L 165,418
L 157,460 L 136,485
L 148,470 L 165,430
L 182,408 L 204,408
L 211,407 L 217,409
L 203,428 L 207,447 L 221,471
L 203,502 L 192,520 L 190,547
L 203,583
L 240,576 L 248,563 L 264,555 L 283,543 L 305,533 L 324,535 L 339,535
L 386,484
L 423,430 Z
`.trim()

interface Props {
  plant: (PlantItem & { project?: { name: string; location: string } | null })[]
  onClose: () => void
}

export default function PlantMap({ plant, onClose }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const depotXY = latLonToSVG(57.23, -2.71)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: '#0a1628',
          border: '1px solid #1e3a5f',
          width: '100%',
          maxWidth: 760,
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: '#1e3a5f' }}>
          <div>
            <h2 className="text-sm font-semibold text-white">Plant Overview — Scotland</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Depot: AB54 4RD · Alford · Click outside to close</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: '#64748b' }}>
            <X size={16} />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          <svg
            viewBox="0 0 500 600"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            style={{ display: 'block', background: '#0a1628' }}
          >
            {/* Sea background */}
            <rect width="500" height="600" fill="#0d1f35" />

            {/* Scotland mainland */}
            <path
              d={SCOTLAND_PATH}
              fill="#1a2f4a"
              stroke="#2d5a8a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Major city labels for orientation */}
            {[
              { name: 'Edinburgh', lat: 55.95, lon: -3.19 },
              { name: 'Glasgow',   lat: 55.86, lon: -4.26 },
              { name: 'Aberdeen',  lat: 57.15, lon: -2.09 },
              { name: 'Inverness', lat: 57.48, lon: -4.22 },
            ].map(city => {
              const [cx, cy] = latLonToSVG(city.lat, city.lon)
              return (
                <g key={city.name}>
                  <circle cx={cx} cy={cy} r="2" fill="#334155" />
                  <text x={cx + 5} y={cy + 4} fontSize="7" fill="#475569">{city.name}</text>
                </g>
              )
            })}

            {/* Depot pin */}
            <g>
              <circle cx={depotXY[0]} cy={depotXY[1]} r="7" fill="#0f2b4d" stroke="#3b82f6" strokeWidth="1.5" />
              <text x={depotXY[0]} y={depotXY[1] + 16} textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="600">DEPOT</text>
            </g>

            {/* Clip paths for circular avatars — defined at pin coords */}
            <defs>
              {plant.map(p => {
                const loc = p.status === 'available' || !p.project?.location ? null : p.project.location
                const [px, py] = postcodeToSVG(loc)
                return (
                  <clipPath key={`clip-${p.id}`} id={`clip-${p.id}`}>
                    <circle cx={px} cy={py} r="11" />
                  </clipPath>
                )
              })}
            </defs>

            {/* Plant pins */}
            {plant.map(p => {
              const location = p.status === 'available' || !p.project?.location ? null : p.project.location
              const [px, py] = postcodeToSVG(location)
              const img = plantImage(p.category)
              const isHovered = hovered === p.id
              const pinColour = p.status === 'breakdown' ? '#ef4444' : p.status === 'on_hire' ? '#22c55e' : '#3b82f6'
              const pinFill   = p.status === 'breakdown' ? '#2d0a0a' : p.status === 'on_hire' ? '#0a2d0a' : '#0a1628'

              return (
                <g
                  key={p.id}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer ring */}
                  <circle cx={px} cy={py} r="14" fill={pinFill} stroke={pinColour} strokeWidth={isHovered ? 2.5 : 1.5} />
                  {/* Avatar image clipped to circle */}
                  <image
                    href={img}
                    x={px - 11} y={py - 11}
                    width="22" height="22"
                    clipPath={`url(#clip-${p.id})`}
                  />

                  {isHovered && (
                    <g>
                      <rect x={px - 55} y={py - 50} width="130" height="42" rx="5" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                      <text x={px - 48} y={py - 34} fontSize="9" fontWeight="600" fill="#f1f5f9">{p.name}</text>
                      <text x={px - 48} y={py - 22} fontSize="8" fill="#94a3b8">{p.make} {p.model}</text>
                      <text x={px - 48} y={py - 12} fontSize="8" fill={pinColour}>
                        {p.status === 'available' ? 'At depot' : p.status === 'on_hire' ? `On hire — ${p.project?.name ?? ''}` : p.status}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 right-3 rounded-lg px-3 py-2 text-xs space-y-1.5"
            style={{ background: 'rgba(10,22,40,0.92)', border: '1px solid #1e3a5f' }}>
            {[
              ['#22c55e', 'On hire'],
              ['#3b82f6', 'Available (depot)'],
              ['#ef4444', 'Breakdown'],
            ].map(([col, label]) => (
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
