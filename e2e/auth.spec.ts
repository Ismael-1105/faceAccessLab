import { test, expect } from '@playwright/test';

test.describe('Autenticación', () => {
  test('inicia sesión con credenciales correctas y llega al panel', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/correo/i).fill('admin@faceaccess.lab');
    await page.getByLabel(/contraseña/i).fill('admin123');
    await page.getByRole('button', { name: /ingresar|iniciar sesión/i }).click();

    // El panel requiere sesión admin/docente.
    await expect(page).toHaveURL(/\/docente/);
    await expect(page.getByText(/vista general|dashboard/i).first()).toBeVisible();
  });

  test('rechaza credenciales incorrectas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/correo/i).fill('admin@faceaccess.lab');
    await page.getByLabel(/contraseña/i).fill('incorrecta');
    await page.getByRole('button', { name: /ingresar|iniciar sesión/i }).click();

    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
  });
});
