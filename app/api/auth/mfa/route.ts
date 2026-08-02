import { getAuthPayload } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';
import { generateSecret, generateTotp, verifyTotp } from '@/lib/totp';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST { action: 'setup' } → genera secreto MFA para el usuario autenticado (no lo activa aún).
// POST { action: 'verify', token } → activa MFA si el token es válido contra el secreto pendiente.
// POST { action: 'disable', token } → desactiva MFA (requiere token válido).
// POST { action: 'login', email, token } → verifica el token MFA durante el login (público).
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action?: string;
      email?: string;
      token?: string;
    };

    if (body.action === 'login') {
      await connectDB();
      const user = await User.findOne({ email: String(body.email || '').toLowerCase() });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return json({ ok: false, error: 'MFA no habilitado para esta cuenta' }, 400);
      }
      const valid = verifyTotp(user.mfaSecret, String(body.token || ''));
      if (!valid) return json({ ok: false, error: 'Código MFA inválido' }, 401);
      return json({ ok: true });
    }

    const auth = getAuthPayload(req);
    if (!auth) return json({ error: 'No autorizado' }, 401);

    await connectDB();
    const user = await User.findById(auth.userId);
    if (!user) return json({ error: 'Usuario no encontrado' }, 404);
    if (user.role !== 'admin') return json({ error: 'Solo administradores' }, 403);

    if (body.action === 'setup') {
      if (user.mfaEnabled) return json({ ok: false, error: 'MFA ya está habilitado' }, 400);
      const secret = generateSecret();
      user.mfaSecret = secret;
      user.mfaEnabled = false;
      await user.save();
      return json({ ok: true, secret, qrLabel: `FaceAccess Lab (${user.email})` });
    }

    if (body.action === 'verify') {
      if (!user.mfaSecret) return json({ ok: false, error: 'Inicia el setup primero' }, 400);
      const valid = verifyTotp(user.mfaSecret, String(body.token || ''));
      if (!valid) return json({ ok: false, error: 'Código inválido' }, 401);
      user.mfaEnabled = true;
      user.mfaVerifiedAt = new Date();
      await user.save();
      return json({ ok: true, message: 'MFA habilitado' });
    }

    if (body.action === 'disable') {
      if (!user.mfaEnabled || !user.mfaSecret) return json({ ok: false, error: 'MFA no está habilitado' }, 400);
      const valid = verifyTotp(user.mfaSecret, String(body.token || ''));
      if (!valid) return json({ ok: false, error: 'Código inválido' }, 401);
      user.mfaEnabled = false;
      user.mfaSecret = undefined;
      user.mfaVerifiedAt = undefined;
      await user.save();
      return json({ ok: true, message: 'MFA deshabilitado' });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error' }, 500);
  }
}
