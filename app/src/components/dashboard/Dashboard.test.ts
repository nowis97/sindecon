import { describe, it, expect } from 'vitest'
import { Dashboard, type DashboardProps } from './Dashboard'

describe('Dashboard Component Contract', () => {
  it('exporta Dashboard como componente funcional de React', () => {
    expect(typeof Dashboard).toBe('function')
  })

  it('acepta las props completas de la estación clínica y callbacks de herramientas', () => {
    let captureOpened = false
    let driveOpened = false
    let studyOpened = false

    const props: DashboardProps = {
      nodes: [],
      templates: [],
      onSelectArticle: () => {},
      onOpenQuickCapture: () => {
        captureOpened = true
      },
      onCreateNode: () => {},
      onCreateFromTemplate: () => {},
      onOpenGoogleDriveSync: () => {
        driveOpened = true
      },
      onOpenStudy: () => {
        studyOpened = true
      },
      userName: 'Médico de Guardia',
      theme: 'light',
      dueFlashcardsCount: 4,
      totalFlashcardsCount: 32,
      favoriteIds: [],
      showTemplatesFolder: true,
    }

    expect(props.userName).toBe('Médico de Guardia')
    props.onOpenQuickCapture()
    props.onOpenGoogleDriveSync?.()
    props.onOpenStudy?.()
    expect(captureOpened).toBe(true)
    expect(driveOpened).toBe(true)
    expect(studyOpened).toBe(true)
  })
})
