/**
 * Mascot actions configuration.
 * Maps action names to their image assets and display properties.
 */

export type MascotAction = 
  | 'padrao'
  | 'acenando'
  | 'alegre'
  | 'apontando'
  | 'assustado'
  | 'comemorando'
  | 'com_duvida'
  | 'concentrado'
  | 'escondendo'
  | 'formando'
  | 'impressionado'
  | 'joystick'
  | 'lendo'
  | 'mentalizando'
  | 'pensamento_positivo'
  | 'piscando'
  | 'sorrindo'
  | 'torcendo'
  | 'triste'
  | 'advinha'

interface MascotActionConfig {
  label: string
  image: string
  duration: number
}

export const MASCOT_ACTIONS: Record<MascotAction, MascotActionConfig> = {
  padrao: {
    label: 'Padrão',
    image: '/assets/padrao.jpg',
    duration: 1600,
  },
  acenando: {
    label: 'Acenando',
    image: '/assets/acenando.jpg',
    duration: 1600,
  },
  alegre: {
    label: 'Alegre',
    image: '/assets/alegre.jpg',
    duration: 1600,
  },
  apontando: {
    label: 'Apontando',
    image: '/assets/apontando.jpg',
    duration: 1600,
  },
  assustado: {
    label: 'Assustado',
    image: '/assets/assustado.jpg',
    duration: 1600,
  },
  comemorando: {
    label: 'Comemorando',
    image: '/assets/comemorando.jpg',
    duration: 1600,
  },
  com_duvida: {
    label: 'Com Dúvida',
    image: '/assets/com_duvida.jpg',
    duration: 1600,
  },
  concentrado: {
    label: 'Concentrado',
    image: '/assets/concentrado.jpg',
    duration: 1600,
  },
  escondendo: {
    label: 'Escondendo',
    image: '/assets/escondendo.jpg',
    duration: 2100,
  },
  formando: {
    label: 'Formando',
    image: '/assets/formando.jpg',
    duration: 1600,
  },
  impressionado: {
    label: 'Impressionado',
    image: '/assets/impressionado.jpg',
    duration: 1600,
  },
  joystick: {
    label: 'Joystick',
    image: '/assets/joystick.jpg',
    duration: 1600,
  },
  lendo: {
    label: 'Lendo',
    image: '/assets/lendo.jpg',
    duration: 1600,
  },
  mentalizando: {
    label: 'Mentalizando',
    image: '/assets/mentalizando.jpg',
    duration: 1600,
  },
  pensamento_positivo: {
    label: 'Pensamento Positivo',
    image: '/assets/pensamento_positivo.jpg',
    duration: 1600,
  },
  piscando: {
    label: 'Piscando',
    image: '/assets/piscando.jpg',
    duration: 1600,
  },
  sorrindo: {
    label: 'Sorrindo',
    image: '/assets/sorrindo.jpeg',
    duration: 1600,
  },
  torcendo: {
    label: 'Torcendo',
    image: '/assets/torcendo.jpg',
    duration: 1600,
  },
  triste: {
    label: 'Triste',
    image: '/assets/triste.jpg',
    duration: 1600,
  },
  advinha: {
    label: 'Advinha',
    image: '/assets/advinha.jpg',
    duration: 1600,
  },
}

export const DEFAULT_ACTION: MascotAction = 'padrao'

/**
 * Get all available actions excluding the default one
 */
export function getAvailableActions(): Array<[MascotAction, MascotActionConfig]> {
  return Object.entries(MASCOT_ACTIONS).filter(
    ([action]) => action !== DEFAULT_ACTION
  ) as Array<[MascotAction, MascotActionConfig]>
}
