'use client';

import type { NormalizedBox } from '@/src/hooks/useFaceFraming';

interface KioskGuideOverlayProps {
  /** Calidad del encuadre, de 0 a 1. Tiñe el óvalo guía. */
  quality: number;
  /** Verdadero cuando el encuadre ya es válido. */
  valid: boolean;
  /** Avance del tiempo de espera antes de verificar, de 0 a 1. */
  holdProgress: number;
  /** Caja del rostro en coordenadas del cuadro sin espejar. */
  box: NormalizedBox | null;
}

// Geometría del óvalo guía sobre el viewBox de 100 por 56.25.
const CX = 50;
const CY = 28;
const RX = 22.5;
const RY = 18.3;
/** Perímetro aproximado del óvalo, para animar el anillo de espera. */
const PERIMETER = 128.6;

/** Verde cuando el encuadre sirve, ámbar cuando falta poco, rojo cuando no. */
function guideColor(quality: number, valid: boolean): string {
  if (valid) return 'rgb(52, 211, 153)';
  if (quality >= 0.5) return 'rgb(251, 191, 36)';
  return 'rgb(248, 113, 113)';
}

/**
 * Máscara biométrica del kiosco. Es la retroalimentación permanente: el óvalo
 * cambia de color según el encuadre y el anillo se completa mientras la persona
 * sostiene la posición correcta.
 */
export default function KioskGuideOverlay({ quality, valid, holdProgress, box }: KioskGuideOverlayProps) {
  const color = guideColor(quality, valid);

  // El video se muestra espejado, así que la caja detectada se refleja para que
  // coincida con lo que la persona ve de sí misma.
  const mirrored = box
    ? { x: (1 - box.x - box.width) * 100, y: box.y * 56.25, w: box.width * 100, h: box.height * 56.25 }
    : null;

  return (
    <svg
      className="biometric-mask"
      viewBox="0 0 100 56.25"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <mask id="face-guide-mask">
          <rect width="100" height="56.25" fill="white" />
          <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="black" />
        </mask>
      </defs>

      <rect width="100" height="56.25" fill="rgba(0,0,0,0.28)" mask="url(#face-guide-mask)" />

      {mirrored && (
        <rect
          x={mirrored.x}
          y={mirrored.y}
          width={mirrored.w}
          height={mirrored.h}
          rx="1.5"
          fill="none"
          stroke={color}
          strokeOpacity="0.55"
          strokeWidth="0.3"
          strokeDasharray="2 1.5"
        />
      )}

      <ellipse
        className="mask-ellipse"
        cx={CX}
        cy={CY}
        rx={RX}
        ry={RY}
        fill="none"
        stroke={color}
        strokeOpacity="0.9"
        strokeWidth="0.55"
      />

      {holdProgress > 0 && (
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeDasharray={`${PERIMETER * holdProgress} ${PERIMETER}`}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      )}
    </svg>
  );
}
