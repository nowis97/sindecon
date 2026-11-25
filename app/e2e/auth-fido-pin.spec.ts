import { test, expect } from '@playwright/test'

test.describe('Autenticación Clínica: PIN PBKDF2, Lockout y FIDO2 Passkey', () => {
  test('configura PIN de 6 dígitos y Passkey FIDO2 virtual, bloquea tras 5 fallos, persiste al recargar y desbloquea con biometría offline', async ({
    page,
  }) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()

    // 1. Ingreso inicial demo con PIN 1234
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toBeVisible()
    for (const d of ['1', '2', '3', '4']) {
      await page.getByRole('button', { name: `Dígito ${d}` }).click()
    }

    // 2. Abrir Seguridad desde cabecera y fijar PIN de 6 dígitos + Passkey FIDO2
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('header-security-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toBeVisible()

    await page.getByRole('button', { name: '6 dígitos' }).click()
    await page.getByTestId('pin-new-input').fill('482910')
    await page.getByTestId('pin-confirm-input').fill('482910')
    await page.getByTestId('save-pin-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toContainText(
      'PIN de guardia cifrado (PBKDF2) guardado correctamente.',
    )

    await page.getByTestId('register-passkey-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toContainText('1 registradas')
    await page.getByTestId('security-close-btn').click()
    await expect(page.getByTestId('security-settings-modal')).not.toBeVisible()

    // 3. Bloquear estación, verificar persistencia tras recarga y lockout tras 5 fallos
    await page.getByTestId('header-lock-btn').click()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(6)

    await page.reload()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(6)

    for (let attempt = 0; attempt < 5; attempt++) {
      for (const d of ['0', '0', '0', '0', '0', '0']) {
        const digitBtn = page.getByRole('button', { name: `Dígito ${d}` })
        await expect(digitBtn).toBeEnabled()
        await digitBtn.click()
      }
      await expect(page.getByRole('alert')).toBeVisible()
    }
    await expect(page.getByRole('alert')).toContainText(/bloqueado|Espera/i)
    await expect(page.getByRole('button', { name: 'Dígito 0' })).toBeDisabled()

    // Confirmar que el bloqueo temporal persiste al recargar (sindecon_security_state + mirror db.meta)
    await page.reload()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByRole('status')).toContainText(/Bloqueo temporal activo/i)
    await expect(page.getByRole('button', { name: 'Dígito 0' })).toBeDisabled()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(6)

    // 4. Desbloquear con llave biométrica FIDO2 virtual (resetea lockout y autentica offline)
    await page.getByTestId('fido-unlock-btn').click()
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })

    // 5. Confirmar que FIDO limpió el lockout y el nuevo PIN PBKDF2 de 6 dígitos desbloquea el terminal
    await page.getByTestId('header-lock-btn').click()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    for (const d of ['4', '8', '2', '9', '1', '0']) {
      const digitBtn = page.getByRole('button', { name: `Dígito ${d}` })
      await expect(digitBtn).toBeEnabled()
      await digitBtn.click()
    }
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
  })
})
