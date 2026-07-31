/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Cloud, Cpu, Database, Key, Bell, ShieldCheck,
  ArrowRight, Lightning, Info, FileArchive, ChartLine,
  type IconWeight,
} from '@phosphor-icons/react';
import { CLOUD_SERVICES } from '../data.ts';
import { CloudService } from '../types.ts';

const iconMapping: Record<string, React.ComponentType<{ className?: string; weight?: IconWeight }>> = {
  ScanFace: Cpu,
  ShieldCheck: ShieldCheck,
  Terminal: Cpu,
  Hub: Key,
  Database: Database,
  FolderArchive: FileArchive,
  Users: Key,
  BellRing: Bell,
  LineChart: ChartLine
};

const CATEGORIES = [
  { id: 'vision', label: 'Visión', icon: Cpu, services: ['aws-rekognition', 'aws-liveness'] },
  { id: 'compute', label: 'Procesamiento', icon: Cpu, services: ['aws-lambda', 'aws-api', 'mongodb-atlas'] },
  { id: 'infra', label: 'Infraestructura', icon: Database, services: ['aws-s3', 'jwt-auth', 'aws-sns', 'aws-cloudwatch'] },
];

export default function ArchitectureView() {
  const [selectedService, setSelectedService] = useState<CloudService>(CLOUD_SERVICES[0]);
  const [activeCategory, setActiveCategory] = useState('vision');
  const [liveMetrics, setLiveMetrics] = useState<Record<string, number> | null>(null);

  React.useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setLiveMetrics(data.metrics);
      })
      .catch(() => {});
  }, []);

  const getTelemetryStats = (id: string) => {
    const m = liveMetrics || {};
    switch (id) {
      case 'aws-rekognition':
        return [
          { name: 'Latencia Promedio', val: m.rekognition_latency_ms ? `${m.rekognition_latency_ms} ms` : '228 ms', status: 'Excelente' },
          { name: 'Búsquedas (24h)', val: m.faces_searched ? `${m.faces_searched}` : '1,420', status: 'Fiel' },
          { name: 'Accesos Concedidos', val: m.access_granted ? `${m.access_granted}` : '—', status: 'Estable' }
        ];
      case 'aws-liveness':
        return [
          { name: 'Liveness OK', val: m.liveness_checked ? `${m.liveness_checked}` : '—', status: 'Optima' },
          { name: 'Liveness Fallido', val: m.liveness_failed ? `${m.liveness_failed}` : '0', status: 'Preciso' },
          { name: 'Falso Positivo', val: '< 0.001%', status: 'Preciso' }
        ];
      case 'aws-lambda':
        return [
          { name: 'Rostros Indexados', val: m.faces_indexed ? `${m.faces_indexed}` : '—', status: 'Escalando' },
          { name: 'Accesos Negados', val: m.access_denied ? `${m.access_denied}` : '—', status: 'Ligero' },
          { name: 'Tasa Errores', val: '0.00%', status: 'Perfecto' }
        ];
      case 'aws-api':
        return [
          { name: 'Ancho de Banda', val: '45.1 MB', status: 'Seguro' },
          { name: 'Cache Hit', val: '86%', status: 'Rápido' },
          { name: 'SSL/TLS', val: '1.3', status: 'Cifrado' }
        ];
      case 'mongodb-atlas':
        return [
          { name: 'Operaciones/Seg', val: '14 OPS', status: 'Listo' },
          { name: 'Lecturas/Seg', val: '112 QPS', status: 'Listo' },
          { name: 'Respuesta', val: '6 ms', status: 'Ultra-bajo' }
        ];
      case 'aws-s3':
        return [
          { name: 'Objetos', val: m.faces_indexed ? `${m.faces_indexed}` : '—', status: 'Listo' },
          { name: 'Estado', val: 'Disponible', status: 'Sano' },
          { name: 'Encriptación', val: 'AES-256', status: 'Cifrado' }
        ];
      case 'jwt-auth':
        return [
          { name: 'Tokens Activos', val: '—', status: 'Activo' },
          { name: 'Roles', val: '2', status: 'Listo' },
          { name: 'Algoritmo', val: 'HS256', status: 'Seguro' }
        ];
      case 'aws-sns':
        return [
          { name: 'Alertas Enviadas', val: m.access_denied && m.access_denied > 3 ? `${Math.floor(m.access_denied / 3)}` : '0', status: 'Listo' },
          { name: 'Topic', val: 'alerts', status: 'Activo' },
          { name: 'Suscritos', val: '1', status: 'Sano' }
        ];
      case 'aws-cloudwatch':
        return [
          { name: 'Métricas', val: Object.keys(m).length ? `${Object.keys(m).length}` : '7', status: 'Activo' },
          { name: 'Namespace', val: 'FaceAccessLab', status: 'Sano' },
          { name: 'Ventana', val: '24h', status: 'Eficiente' }
        ];
      default:
        return [
          { name: 'Uso de CPU', val: '3.2%', status: 'Normal' },
          { name: 'Estado de Red', val: '100%', status: 'Sano' },
          { name: 'Ping Promedio', val: '18 ms', status: 'Eficiente' }
        ];
    }
  };

  const ActiveIcon = iconMapping[selectedService.iconName] || Cloud;

  return (
    <div className="pt-16 min-h-screen bg-surface dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Header */}
      <section className="py-14 md:py-20 px-5 md:px-8 border-b border-zinc-800/50 bg-gradient-to-b from-zinc-900 to-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a20_1px,transparent_1px),linear-gradient(to_bottom,#27272a20_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800/80 border border-zinc-700/50 text-accent-400 text-label font-mono tracking-wider uppercase rounded-xl mb-5">
            <Cloud className="w-3 h-3" weight="fill" />
            Infraestructura AWS y Despliegue Edge
          </span>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4 leading-tight text-white">
            Topologia Serverless de Grado Industrial
          </h2>
          <p className="text-zinc-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Microservicios en AWS configurados para garantizar accesos biométricos rápidos, auditables y seguros de extremo a extremo.
          </p>
        </div>
      </section>

      {/* Main grid */}
      <section className="p-5 md:p-8 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 max-w-7xl mx-auto w-full">
        {/* Left: service grid */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400 font-mono">Consola de Servicios Activos</h3>
          </div>

          {/* Category tabs — 9 servicios agrupados en 3 categorias (Hick's Law) */}
          <div className="flex gap-1 bg-zinc-800 rounded-xl p-1 w-fit">
            {CATEGORIES.map(cat => {
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  <CatIcon className="w-3.5 h-3.5" weight={activeCategory === cat.id ? 'fill' : 'regular'} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CLOUD_SERVICES.filter(srv => {
              const cat = CATEGORIES.find(c => c.services.includes(srv.id));
              return cat?.id === activeCategory;
            }).map((srv) => {
              const ServiceIcon = iconMapping[srv.iconName] || Cloud;
              const isSelected = selectedService.id === srv.id;
              return (
                <button
                  key={srv.id}
                  onClick={() => setSelectedService(srv)}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                    isSelected
                      ? 'bg-white text-zinc-900 border-white shadow-xl shadow-white/5 -translate-y-1'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-accent-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <ServiceIcon className="w-4 h-4" weight={isSelected ? 'fill' : 'regular'} />
                    </div>
                    <span className={`text-overline font-mono tracking-wider py-0.5 px-2 rounded-md uppercase font-bold ${
                      isSelected ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-accent-400'
                    }`}>
                      {srv.tag}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs leading-tight">{srv.name}</h4>
                    <p className={`text-micro mt-1 line-clamp-2 ${isSelected ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      {srv.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: telemetry panel */}
        <div className="lg:col-span-5 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedService.id}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.18 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between h-full shadow-2xl"
            >
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <ActiveIcon className="w-5 h-5 text-accent-400" weight="regular" />
                    </div>
                    <div>
                      <span className="text-micro font-mono tracking-wider text-accent-400 uppercase font-bold">{selectedService.tag}</span>
                      <h3 className="text-base font-bold text-white tracking-tight leading-none mt-1">{selectedService.name}</h3>
                    </div>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-label py-1 px-2.5 rounded-xl font-bold font-mono">
                    Operativo
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-micro font-mono tracking-wider text-zinc-500 block font-bold uppercase">Descripcion</span>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">{selectedService.description}</p>
                  </div>
                  <div>
                    <span className="text-micro font-mono tracking-wider text-zinc-500 block font-bold uppercase">Rol en el Acceso</span>
                    <p className="text-xs text-zinc-500 leading-relaxed mt-1">
                      Ejecuta <span className="text-white font-semibold">"{selectedService.actionLabel}"</span> cuando un estudiante ingresa al rango de la lente IMX415 del kiosco.
                    </p>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800/70 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-micro font-mono tracking-wider text-zinc-400 block font-bold uppercase">Telemetria (CloudWatch)</span>
                    <span className={`inline-flex items-center gap-1.5 text-micro font-mono font-bold uppercase tracking-wider ${liveMetrics ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${liveMetrics ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                      {liveMetrics ? 'En vivo' : 'Demo'}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {getTelemetryStats(selectedService.id).map((t, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-black/40 border border-zinc-800/50 rounded-xl text-xs font-mono">
                        <span className="text-zinc-500">{t.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-white font-bold">{t.val}</span>
                          <span className="text-emerald-400 font-bold text-micro uppercase tracking-wider bg-emerald-500/10 px-1.5 rounded-md">
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-label text-zinc-500 border-t border-zinc-800/50 pt-4 mt-6">
                * Las firmas biométricas se destruyen al término del ciclo lambda para salvaguardar la privacidad GDPR.
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Offline resilience */}
      <section className="bg-black py-16 px-5 md:px-8 border-t border-zinc-800/50">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <span className="text-accent-400 text-[9.5px] font-mono tracking-wider block uppercase font-bold mb-2">Motor de Accesibilidad Híbrido</span>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Resiliencia Desconectada (Sin conexión)</h2>
            <p className="text-zinc-400 text-xs md:text-sm max-w-2xl leading-relaxed mt-2">
              Para garantizar que los laboratorios no queden bloqueados ante cortes de red, el kiosco posee un microprograma autonomo de contingencia local.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: 'Cache Local Cifrada', desc: 'Conserva firmas locales con AES-256 de los 50 investigadores mas frecuentes para autorizar entradas sin contactar la nube.' },
              { title: 'Teclado Alternativo', desc: 'Un teclado físico de respaldo permite ingreso controlado mediante código OTP de un solo uso para operarios calificados.' },
              { title: 'Relé Normalmente Cerrado', desc: 'La bobina posee un capacitor de estado sólido que mantiene liberada la cerradura si se decreta contingencia crítica.' },
            ].map((item, i) => (
              <div key={i} className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-3">
                <div className="w-8 h-8 rounded-xl bg-accent-950/50 border border-accent-800/30 flex items-center justify-center">
                  <span className="text-accent-400 font-mono font-bold text-xs">{i + 1}</span>
                </div>
                <span className="text-white font-bold text-sm tracking-tight block">{item.title}</span>
                <p className="text-zinc-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

