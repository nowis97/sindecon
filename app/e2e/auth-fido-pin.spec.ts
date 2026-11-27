import { test, expect, type Page } from '@playwright/test'

async function setupVirtualAuthenticator(page: Page) {
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
}

async function openCleanOnboarding(page: Page) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()

  await expect(page.getByTestId('login-screen')).toBeVisible()
  await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
  await expect(page.getByText('Credenciales')).toHaveCount(0)
  await expect(page.getByTestId('google-login-btn')).toBeVisible()
  await expect(page.getByTestId('setup-pin-input')).toBeVisible()
}

test.describe('Autenticación Clínica: Onboarding Obligatorio, PIN PBKDF2, Lockout y FIDO2 Passkey', () => {
  test('configura PIN inicial de 6 dígitos en onboarding y Passkey FIDO2 virtual, bloquea tras 5 fallos, persiste al recargar y desbloquea con biometría offline', async ({
    page,
  }) => {
    await setupVirtualAuthenticator(page)
    await openCleanOnboarding(page)

    // 1. Primer arranque sin bypass: alternar 4 -> 6 dígitos y crear PIN inicial de 6 dígitos
    await expect(page.getByTestId('setup-pin-input')).toHaveAttribute('maxlength', '4')
    await page.getByRole('button', { name: '6 dígitos' }).click()
    await expect(page.getByTestId('setup-pin-input')).toHaveAttribute('maxlength', '6')

    await page.getByTestId('setup-pin-input').fill('482910')
    await expect(page.getByTestId('setup-pin-input')).toHaveValue('482910')
    await page.getByTestId('setup-pin-confirm-input').fill('482910')
    await page.getByTestId('setup-pin-submit-btn').click()

    // 2. Ya autenticado en el Dashboard: abrir Seguridad y registrar Passkey FIDO2 virtual
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
    await page.getByTestId('header-security-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toBeVisible()

    await page.getByTestId('register-passkey-btn').click()
    await expect(page.getByTestId('security-settings-modal')).toContainText('1 registradas')
    await page.getByTestId('security-close-btn').click()
    await expect(page.getByTestId('security-settings-modal')).not.toBeVisible()

    // 3. Bloquear estación, verificar persistencia tras recarga y lockout tras 5 fallos
    await page.getByTestId('header-lock-btn').click()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('setup-pin-input')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(6)

    await page.reload()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('setup-pin-input')).toHaveCount(0)
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
    await expect(page.getByTestId('setup-pin-input')).toHaveCount(0)
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

  test('onboarding directo con Passkey FIDO2 virtual (setup-fido-btn), bloqueo sin PIN y desbloqueo biométrico tras recargar', async ({
    page,
  }) => {
    await setupVirtualAuthenticator(page)
    await openCleanOnboarding(page)

    const setupFidoBtn = page.getByTestId('setup-fido-btn')
    await expect(setupFidoBtn).toBeVisible()
    await expect(setupFidoBtn).toBeEnabled()
    await setupFidoBtn.click()

    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })

    await page.getByTestId('header-lock-btn').click()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('emergency-offline-btn')).toHaveCount(0)
    await expect(page.getByTestId('setup-pin-input')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(0)
    await expect(page.getByTestId('fido-unlock-btn')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('login-screen')).toBeVisible()
    await expect(page.getByTestId('setup-pin-input')).toHaveCount(0)
    await expect(page.getByTestId('pin-dot')).toHaveCount(0)

    await page.getByTestId('fido-unlock-btn').click()
    await expect(page.getByTestId('header-security-btn')).toBeVisible({ timeout: 10000 })
  })

  test('muestra Política de Privacidad pública en /privacy.html y resumen de sindecon.app sin exigir login', async ({
    page,
  }) => {
    await openCleanOnboarding(page)

    const overview = page.getByTestId('login-public-overview')
    await expect(overview).toBeVisible()
    await expect(overview).toContainText('SINDECON — Cuaderno Médico Personal')
    await expect(overview).toContainText('sindecon.app')
    await expect(overview).toContainText('Google Calendar')
    await expect(page.getByTestId('overview-terms-link')).toHaveAttribute('href', '/privacy.html#terminos')

    const privacyLink = page.getByTestId('overview-privacy-link')
    await expect(privacyLink).toBeVisible()
    await expect(privacyLink).toHaveAttribute('href', '/privacy.html')
    await privacyLink.click()

    await expect(page).toHaveURL(/\/privacy\.html$/)
    await expect(
      page.getByRole('heading', { name: /Política de Privacidad y Condiciones de Uso/i }),
    ).toBeVisible()
    await expect(page.locator('#limited-use')).toContainText('Google API Services User Data Policy')
    await expect(page.locator('#google-data')).toContainText('calendar.events')
    await expect(page.locator('#google-data')).toContainText('calendar.calendarlist.readonly')
    await expect(page.locator('#terminos')).toBeVisible()
  })
})
