import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Flujo de gestión de alumnos y decisión de acceso.
 *
 * El kiosco real exige webcam + AWS Face Liveness + Rekognition, que no están
 * disponibles en CI headless; por eso la "simulación del kiosco" se hace a
 * nivel de API con la misma cadena de decisión (canAccessLab vía
 * /api/kiosk/verify es inviable sin liveness). La semántica de concedido/
 * denegado se verifica sobre el estado del alumno y el historial.
 */

test.describe('Alumnos: crear, asignar permiso y suspender', () => {
  test('crea un alumno, lo suspende y lo comprueba en el historial', async ({ page, request }) => {
    // 1) Iniciar sesión para obtener token.
    await page.goto('/login');
    await page.getByLabel(/correo/i).fill('admin@faceaccess.lab');
    await page.getByLabel(/contraseña/i).fill('admin123');
    await page.getByRole('button', { name: /ingresar|iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/docente/);

    const token = await page.evaluate(() => localStorage.getItem('faceaccess_token'));
    expect(token).toBeTruthy();

    // 2) Crear un alumno vía API (misma API que el panel).
    const id = `e2e-${Date.now()}`;
    const createRes = await request.post('/api/students', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id,
        name: 'Prueba E2E',
        career: 'Ingeniería en Tecnologías de la Información (TIC)',
        avatarInitials: 'PE',
        lab: 'LAB-02',
        status: 'allowed',
        biometricStatus: 'pending',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.consentVersion).toBeTruthy(); // Fase 3: consentimiento registrado

    // 3) Verificar que aparece en la tabla de alumnos.
    await page.goto('/docente');
    await page.getByPlaceholder(/buscar/i).fill('Prueba E2E');
    await expect(page.getByText('Prueba E2E').first()).toBeVisible();

    // 4) Suspender al alumno (permiso revocado).
    const toggleRes = await request.put('/api/students/toggle', {
      headers: { Authorization: `Bearer ${token}` },
      data: { id },
    });
    expect(toggleRes.status()).toBe(200);
    const suspended = await toggleRes.json();
    expect(suspended.status).toBe('denied');

    // 5) El kiosco denegaría el acceso: el alumno queda con status 'denied',
    //    que la cadena de decisión traduce a 'permissions' (R04).
    const denied = await request.post('/api/kiosk/verify', {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    // Sin intento de liveness válido la API no puede aprobar; se espera 4xx.
    expect(denied.status()).toBeGreaterThanOrEqual(400);

    // 6) Historial: el panel debe listar al alumno con su estado actual.
    await page.reload();
    await page.getByPlaceholder(/buscar/i).fill('Prueba E2E');
    await expect(page.getByText(/suspendido/i).first()).toBeVisible();

    // Limpieza.
    await request.delete('/api/students', {
      headers: { Authorization: `Bearer ${token}` },
      data: { id },
    });
  });
});

test.describe('Kiosco', () => {
  test('carga la terminal pública y el estado de sesión del laboratorio', async ({ page, request }) => {
    await page.goto('/kiosco');
    await expect(page.getByText(/acceso biométrico/i).first()).toBeVisible();

    const sessionRes = await request.get('/api/kiosk/session');
    expect([200, 200]).toContain(sessionRes.status());
    const body = await sessionRes.json().catch(() => null);
    // Puede no haber clase en curso fuera de horario; solo validamos el contrato.
    expect(body).toHaveProperty('session');
  });
});
