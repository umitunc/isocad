import React from 'react';
import { StampShapeKind } from '../../core/math/LeaderEdgeAnchor';

interface StampPreviewSvgProps {
  shapeKind: StampShapeKind;
  color: string;
  primaryLabel: string;
  secondaryLabel?: string;
  width?: number;
  height?: number;
}

/** Live SVG preview of a weld/spool stamp matching its canvas shape, labels, and stroke color. */
export const StampPreviewSvg: React.FC<StampPreviewSvgProps> = ({
  shapeKind,
  color,
  primaryLabel,
  secondaryLabel,
  width = 110,
  height = 54,
}) => {
  return (
    <svg width={width} height={height} viewBox="0 0 110 54" className="overflow-visible">
      {shapeKind === 'triangle' && (
        <>
          <line x1="16" y1="48" x2="40" y2="34" stroke={color} strokeWidth="1.8" />
          <polygon
            points="62,6 34,46 90,46"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <line x1="46" y1="30" x2="78" y2="30" stroke={color} strokeWidth="1.2" />
          <text
            x="62"
            y="26"
            textAnchor="middle"
            fill={color}
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="700"
          >
            {primaryLabel}
          </text>
          {secondaryLabel && (
            <text
              x="62"
              y="41"
              textAnchor="middle"
              fill={color}
              fontSize="8.5"
              fontFamily="monospace"
            >
              {secondaryLabel}
            </text>
          )}
        </>
      )}

      {shapeKind === 'circle' && (
        <>
          <line x1="18" y1="48" x2="46" y2="38" stroke={color} strokeWidth="1.8" />
          <circle cx="62" cy="27" r="21" fill="none" stroke={color} strokeWidth="1.8" />
          <line x1="42" y1="27" x2="82" y2="27" stroke={color} strokeWidth="1.2" />
          <text
            x="62"
            y="22"
            textAnchor="middle"
            fill={color}
            fontSize="9.5"
            fontFamily="monospace"
            fontWeight="700"
          >
            {primaryLabel}
          </text>
          {secondaryLabel && (
            <text
              x="62"
              y="39"
              textAnchor="middle"
              fill={color}
              fontSize="8.5"
              fontFamily="monospace"
            >
              {secondaryLabel}
            </text>
          )}
        </>
      )}

      {(shapeKind === 'rect' || shapeKind === 'hexagon') && (
        <>
          <line x1="12" y1="48" x2="26" y2="38" stroke={color} strokeWidth="1.8" />
          <rect
            x="26"
            y="11"
            width="72"
            height="32"
            rx="2"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
          />
          <text
            x="62"
            y="30"
            textAnchor="middle"
            fill={color}
            fontSize="10"
            fontFamily="monospace"
            fontWeight="700"
          >
            {primaryLabel}
          </text>
        </>
      )}
    </svg>
  );
};
