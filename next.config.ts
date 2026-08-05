import type { NextConfig } from 'next';

// Cabeceras de seguridad (Fase 2). CSP funcional para el kiosco: permite
// WebAssembly de MediaPipe (self), streaming a AWS (connect-src https/wss) y
// la cámara del navegador (Permissions-Policy camera).
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss: blob:",
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', 'motion'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
