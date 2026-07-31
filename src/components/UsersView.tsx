'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserPlus, User, MagnifyingGlass, X, PencilSimple, Trash,
  Envelope, Key, CircleNotch, Users, ShieldCheck, CheckCircle,
} from '@phosphor-icons/react';
import type { AdminUser } from '../types.ts';
import { api } from '../lib/api.ts';
import ConfirmDialog from './ConfirmDialog.tsx';

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; user: AdminUser };

const inputClass =
  'w-full text-xs p-3 pl-10 rounded-xl border border-zinc-300 dark:border-zinc-700 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-all';

export default function UsersView() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formError, setFormError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar docentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormError('');
    setModal({ type: 'create' });
  };

  const openEdit = (user: AdminUser) => {
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormError('');
    setModal({ type: 'edit', user });
  };

  const closeModal = () => {
    if (saving) return;
    setModal({ type: 'none' });
  };

  const handleSave = async () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formEmail.trim());
    if (!formName.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    if (!emailOk) {
      setFormError('Ingresa un correo válido');
      return;
    }
    if (modal.type === 'create' && formPassword.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (modal.type === 'create') {
        await api.createUser({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword,
        });
        setNotice('Docente creado correctamente.');
      } else if (modal.type === 'edit') {
        const updates: { name?: string; email?: string; password?: string } = {
          name: formName.trim(),
          email: formEmail.trim(),
        };
        if (formPassword) updates.password = formPassword;
        await api.updateUser(modal.user.id, updates);
        setNotice('Docente actualizado correctamente.');
      }
      await loadUsers();
      setModal({ type: 'none' });
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar docente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteUser(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Docente eliminado.');
      setTimeout(() => setNotice(''), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar docente');
      setDeleteTarget(null);
    }
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'D';

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const modalTitle = modal.type === 'create' ? 'Nuevo docente' : modal.type === 'edit' ? 'Editar docente' : '';
  const modalMessage = modal.type === 'create'
    ? 'Crea una cuenta de acceso para un nuevo docente del laboratorio.'
    : modal.type === 'edit'
    ? 'Actualiza los datos de la cuenta. Deja la contraseña en blanco para no cambiarla.'
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Cuentas de Docente</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Gestión de accesos al portal administrativo.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent-600 hover:bg-accent-700 text-white font-semibold px-4 py-2.5 text-xs rounded-lg uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <UserPlus className="w-4 h-4" weight="bold" />
          Nuevo docente
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
          placeholder="Buscar docente..."
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
              <p className="text-sm">Cargando docentes...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-zinc-400 dark:text-zinc-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-zinc-300 dark:text-zinc-600" weight="regular" />
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {users.length === 0 ? 'No hay docentes registrados' : 'Sin resultados para la búsqueda'}
              </p>
              <p className="text-caption text-zinc-400 dark:text-zinc-500 mt-1">
                {users.length === 0 ? 'Crea la primera cuenta con "Nuevo docente".' : 'Prueba con otro término.'}
              </p>
            </div>
          ) : (
            <table aria-label="Cuentas de docente" className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 uppercase text-label font-bold text-left">
                  <th className="p-4">Docente</th>
                  <th className="p-4">Correo</th>
                  <th className="p-4">Creado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent-600 text-white text-label font-bold flex items-center justify-center flex-shrink-0">
                          {initials(user.name)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-sm">{user.name}</p>
                          <span className="inline-flex items-center gap-1 text-label font-semibold text-accent-600 dark:text-accent-400">
                            <ShieldCheck className="w-3 h-3" weight="fill" />
                            Docente
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-zinc-500 dark:text-zinc-400">{user.email}</td>
                    <td className="p-4 font-mono text-zinc-400 dark:text-zinc-500">{formatDate(user.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-accent-600 dark:hover:text-accent-400 transition-all cursor-pointer"
                          title="Editar"
                          aria-label={`Editar a ${user.name}`}
                        >
                          <PencilSimple className="w-4 h-4" weight="regular" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="p-2.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer"
                          title="Eliminar"
                          aria-label={`Eliminar a ${user.name}`}
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
                      <User className="w-5 h-5 text-white" weight="fill" />
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
                    <label htmlFor="u-name" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Nombre completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                      <input id="u-name" type="text" placeholder="Ej. María Fernanda López"
                        value={formName} onChange={e => setFormName(e.target.value)}
                        className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="u-email" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">Correo</label>
                    <div className="relative">
                      <Envelope className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                      <input id="u-email" type="email" placeholder="docente@uide.edu.ec"
                        value={formEmail} onChange={e => setFormEmail(e.target.value)}
                        className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="u-password" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1.5">
                      {modal.type === 'create' ? 'Contraseña' : 'Nueva contraseña (opcional)'}
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" weight="regular" />
                      <input id="u-password" type="password" placeholder={modal.type === 'create' ? 'Mínimo 6 caracteres' : 'Dejar en blanco para no cambiar'}
                        value={formPassword} onChange={e => setFormPassword(e.target.value)}
                        className={inputClass} />
                    </div>
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
                    {saving ? 'Guardando...' : modal.type === 'create' ? 'Crear docente' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar docente"
        message={`¿Estás seguro de eliminar la cuenta de ${deleteTarget?.name ?? ''}? Perderá el acceso al portal administrativo. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
