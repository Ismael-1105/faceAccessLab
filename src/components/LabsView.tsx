'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Flask, MagnifyingGlass, X, PencilSimple, Trash,
  CircleNotch, CheckCircle, Archive, Hash,
} from '@phosphor-icons/react';
import type { Lab } from '../types.ts';
import { api } from '../lib/api.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; lab: Lab };

const inputClass =
  'w-full text-xs p-3 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all';

export default function LabsView() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [deleteTarget, setDeleteTarget] = useState<Lab | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');

  const loadLabs = async () => {
    setLoading(true);
    try {
      const data = await api.getLabs();
      setLabs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar laboratorios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  const openCreate = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormActive(true);
    setFormError('');
    setModal({ type: 'create' });
  };

  const openEdit = (lab: Lab) => {
    setFormName(lab.name);
    setFormCode(lab.code);
    setFormDescription(lab.description || '');
    setFormActive(lab.active);
    setFormError('');
    setModal({ type: 'edit', lab });
  };

  const closeModal = () => {
    if (saving) return;
    setModal({ type: 'none' });
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    if (!/^[A-Za-z0-9-]{2,12}$/.test(formCode.trim())) {
      setFormError('El código debe tener entre 2 y 12 caracteres alfanuméricos (ej. LAB-03)');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (modal.type === 'create') {
        await api.createLab({
          name: formName.trim(),
          code: formCode.trim(),
          description: formDescription.trim() || undefined,
          active: formActive,
        });
        setNotice('Laboratorio creado correctamente.');
      } else if (modal.type === 'edit') {
        await api.updateLab(modal.lab.id, {
          name: formName.trim(),
          code: formCode.trim(),
          description: formDescription.trim() || undefined,
          active: formActive,
        });
        setNotice('Laboratorio actualizado correctamente.');
      }
      await loadLabs();
      setModal({ type: 'none' });
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar laboratorio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteLab(deleteTarget.id);
      setLabs(prev => prev.filter(l => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Laboratorio eliminado.');
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar laboratorio');
      setDeleteTarget(null);
    }
  };

  const toggleActive = async (lab: Lab) => {
    setLabs(prev => prev.map(l => l.id === lab.id ? { ...l, active: !l.active } : l));
    try {
      await api.updateLab(lab.id, { active: !lab.active });
    } catch (e) {
      setLabs(prev => prev.map(l => l.id === lab.id ? lab : l));
      setError(e instanceof Error ? e.message : 'Error al actualizar laboratorio');
    }
  };

  const filtered = labs.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.code.toLowerCase().includes(search.toLowerCase())
  );

  const modalTitle = modal.type === 'create' ? 'Nuevo laboratorio' : modal.type === 'edit' ? 'Editar laboratorio' : '';
  const modalMessage = modal.type === 'create'
    ? 'Crea un laboratorio para otorgar acceso a los estudiantes.'
    : modal.type === 'edit'
    ? 'Actualiza los datos del laboratorio. El estado define si está disponible para asignar.'
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Laboratorios</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Gestión de laboratorios con acceso biométrico.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent-600 hover:bg-accent-700 text-white font-semibold px-4 py-2.5 text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" weight="bold" />
          Nuevo laboratorio
        </button>
      </div>

      {notice && (
        <div role="status" className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" weight="fill" />
          <p className="text-xs text-green-800 dark:text-green-300 font-medium">{notice}</p>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      <div className="relative w-full sm:max-w-xs">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
        <input
          type="text"
          placeholder="Buscar laboratorio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs transition-all duration-200"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-14 flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-500">
              <CircleNotch className="w-6 h-6 animate-spin" weight="bold" />
              <p className="text-sm">Cargando laboratorios...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
              <Flask className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {labs.length === 0 ? 'No hay laboratorios registrados' : 'Sin resultados para la búsqueda'}
              </p>
              <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">
                {labs.length === 0 ? 'Crea el primero con "Nuevo laboratorio".' : 'Prueba con otro término.'}
              </p>
            </div>
          ) : (
            <table aria-label="Laboratorios" className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                  <th className="p-4">Laboratorio</th>
                  <th className="p-4">Código</th>
                  <th className="p-4">Descripción</th>
                  <th className="p-4 text-center">Acceso</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lab => (
                  <tr key={lab.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          lab.active
                            ? 'bg-accent-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                        }`}>
                          <Flask className="w-4 h-4" weight="fill" />
                        </div>
                        <p className="font-bold text-zinc-900 dark:text-white text-sm">{lab.name}</p>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-accent-600 dark:text-accent-400 font-bold">{lab.code}</td>
                    <td className="p-4 text-zinc-500 dark:text-zinc-400 max-w-[240px] truncate" title={lab.description}>
                      {lab.description || '—'}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleActive(lab)}
                        role="switch"
                        aria-checked={lab.active}
                        aria-label={`${lab.active ? 'Deshabilitar' : 'Habilitar'} acceso a ${lab.name}`}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                          lab.active ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          lab.active ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(lab)}
                          className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-accent-600 dark:hover:text-accent-400 transition-all cursor-pointer"
                          title="Editar"
                          aria-label={`Editar ${lab.name}`}
                        >
                          <PencilSimple className="w-4 h-4" weight="regular" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(lab)}
                          className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer"
                          title="Eliminar"
                          aria-label={`Eliminar ${lab.name}`}
                        >
                          <Trash className="w-4 h-4" weight="regular" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      <AnimatePresence>
        {modal.type !== 'none' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full shadow-xl overflow-hidden"
            >
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
                      <Flask className="w-5 h-5 text-white" weight="fill" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-900 dark:text-white">{modalTitle}</h3>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{modalMessage}</p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" weight="bold" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="lab-name" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Nombre</label>
                    <div className="relative">
                      <Flask className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                      <input id="lab-name" type="text" placeholder="Ej. Sistemas Operativos"
                        value={formName} onChange={e => setFormName(e.target.value)}
                        className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lab-code" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Código</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                      <input id="lab-code" type="text" placeholder="Ej. LAB-03"
                        value={formCode} onChange={e => setFormCode(e.target.value)}
                        className={`${inputClass} uppercase`} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lab-desc" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Descripción (opcional)</label>
                    <div className="relative">
                      <Archive className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                      <input id="lab-desc" type="text" placeholder="Ej. Laboratorio de redes y conectividad"
                        value={formDescription} onChange={e => setFormDescription(e.target.value)}
                        className={inputClass} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Acceso habilitado</p>
                      <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-0.5">Disponible para asignar a estudiantes</p>
                    </div>
                    <button
                      onClick={() => setFormActive(!formActive)}
                      role="switch"
                      aria-checked={formActive}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                        formActive ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        formActive ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {formError && (
                  <div role="alert" className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" weight="bold" />
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">{formError}</p>
                  </div>
                )}

                <div className="flex gap-2.5">
                  <button
                    onClick={closeModal}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-accent-600 hover:bg-accent-700 text-white transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving && <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />}
                    {saving ? 'Guardando...' : modal.type === 'create' ? 'Crear laboratorio' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar laboratorio"
        message={`¿Estás seguro de eliminar el laboratorio ${deleteTarget?.code ?? ''} (${deleteTarget?.name ?? ''})? Los estudiantes ya asignados conservarán su permiso actual. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
