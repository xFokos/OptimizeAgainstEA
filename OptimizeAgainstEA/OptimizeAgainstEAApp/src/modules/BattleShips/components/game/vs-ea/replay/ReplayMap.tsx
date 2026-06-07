import type { IndividualSnapshot } from '../../../../engine/ea/eaReplayLog';
import { sampleGradientRgb } from '../../../../engine/colorScale';

interface ReplayMapProps {
  individuals:     IndividualSnapshot[];
  highlightIds?:   Set<string>;
  highlightColor?: string;
  dimIds?:         Set<string>;
  markerIds?:      Set<string>;
  markerColor?:    string;
  solutionIds?:    Set<string>;
  /** Per-individual opacity override (0–1). Used for roulette selection. */
  customOpacities?: Map<string, number>;
  /** Extra dots to render (e.g. crossover child before it joins the population) */
  extraDots?:      { id: string; position: { x: number; y: number }; color: string; label?: string }[];
  /** Arrow from → to for mutation visualization */
  arrow?:          { from: { x: number; y: number }; to: { x: number; y: number } };
  /** Dashed line between two parents — used for arithmetic crossover */
  parentLine?:     { from: { x: number; y: number }; to: { x: number; y: number } };
  /** L-shaped gene-source lines for uniform / single-point crossover */
  geneLines?:      { xSource: { x: number; y: number }; ySource: { x: number; y: number }; child: { x: number; y: number } };
}

export function ReplayMap({
                            individuals,
                            highlightIds,
                            highlightColor = '#fff',
                            dimIds,
                            markerIds,
                            markerColor = '#4a90f0',
                            solutionIds,
                            customOpacities,
                            extraDots = [],
                            arrow,
                            parentLine,
                            geneLines,
                          }: ReplayMapProps) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '1 / 1',
      background: 'var(--map-bg)',
      border: '1px solid var(--map-border)',
      overflow: 'hidden',
      borderRadius: 4,
    }}>
      {/* Grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
           viewBox="0 0 100 100" preserveAspectRatio="none">
        {[10,20,30,40,50,60,70,80,90].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,.04)" strokeWidth=".3"/>
            <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,.04)" strokeWidth=".3"/>
          </g>
        ))}

        <defs>
          <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#fff" opacity={0.7}/>
          </marker>
        </defs>

        {/* Arithmetic crossover: dashed line connecting the two parents */}
        {parentLine && (
          <line
            x1={parentLine.from.x * 100} y1={parentLine.from.y * 100}
            x2={parentLine.to.x * 100}   y2={parentLine.to.y * 100}
            stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" strokeDasharray="2 1.5"
          />
        )}

        {/* Uniform / single-point crossover: L-shaped gene-source lines */}
        {geneLines && (
          <>
            {/* Horizontal leg: xSource.x → child.x at child.y */}
            <line
              x1={geneLines.xSource.x * 100} y1={geneLines.child.y * 100}
              x2={geneLines.child.x * 100}   y2={geneLines.child.y * 100}
              stroke="#4af0a0" strokeWidth="0.6" strokeDasharray="1.5 1"
              opacity={0.7}
            />
            {/* Vertical leg: ySource.y → child.y at child.x */}
            <line
              x1={geneLines.child.x * 100} y1={geneLines.ySource.y * 100}
              x2={geneLines.child.x * 100} y2={geneLines.child.y * 100}
              stroke="#4a90f0" strokeWidth="0.6" strokeDasharray="1.5 1"
              opacity={0.7}
            />
          </>
        )}

        {/* Mutation arrow */}
        {arrow && (
          <line
            x1={arrow.from.x * 100} y1={arrow.from.y * 100}
            x2={arrow.to.x * 100}   y2={arrow.to.y * 100}
            stroke="#fff" strokeWidth="0.8" strokeDasharray="2 1.5"
            markerEnd="url(#arrowhead)" opacity={0.7}
          />
        )}
      </svg>

      {/* Individuals */}
      {individuals.map((ind) => {
        const isHighlighted = highlightIds?.has(ind.id);
        const isDimmed      = dimIds?.has(ind.id);
        const isMarked      = markerIds?.has(ind.id);
        const isSolution    = solutionIds?.has(ind.id);

        const color = isSolution  ? 'var(--accent)'
          : isHighlighted ? highlightColor
            : sampleGradientRgb(ind.fitness);

        const size    = isHighlighted || isSolution ? 14 : 9;
        const opacity = customOpacities?.get(ind.id) ?? (isDimmed ? 0.25 : 1);

        return (
          <div key={ind.id} style={{
            position: 'absolute',
            left:   `${ind.position.x * 100}%`,
            top:    `${ind.position.y * 100}%`,
            transform: 'translate(-50%,-50%)',
            width:  size, height: size,
            borderRadius: '50%',
            background: color,
            border: isMarked    ? `2px solid ${markerColor}`
              : isHighlighted ? '2px solid #fff'
                : '1px solid rgba(255,255,255,.2)',
            boxShadow: isHighlighted || isSolution ? `0 0 8px ${color}` : 'none',
            opacity,
            transition: 'all 0.3s ease',
            zIndex: isHighlighted || isSolution ? 3 : 1,
            pointerEvents: 'none',
          }}/>
        );
      })}

      {/* Extra dots (child preview, etc.) */}
      {extraDots.map((dot) => (
        <div key={dot.id} style={{
          position: 'absolute',
          left:  `${dot.position.x * 100}%`,
          top:   `${dot.position.y * 100}%`,
          transform: 'translate(-50%,-50%)',
          width: 12, height: 12,
          borderRadius: '50%',
          background: dot.color,
          border: '2px solid #fff',
          boxShadow: `0 0 10px ${dot.color}`,
          zIndex: 5,
          pointerEvents: 'none',
        }}>
          {dot.label && (
            <div style={{
              position: 'absolute', top: -18, left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.55rem', fontFamily: 'var(--font-mono)',
              color: '#fff', whiteSpace: 'nowrap',
              background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 2,
            }}>{dot.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}