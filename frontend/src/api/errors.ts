const statusMessages: Record<number, string> = {
  400: 'A solicitação não foi aceita. Revise os dados enviados.',
  401: 'Sua sessão expirou ou não é válida. Entre novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'Esta ação não pode ser concluída no estado atual.',
  422: 'Confira os dados informados.',
}

export async function apiErrorMessage(response: Response): Promise<string> {
  const body = await response.clone().json().catch(() => null) as {
    detail?: unknown
    message?: unknown
  } | null

  if (typeof body?.detail === 'string') return body.detail
  if (typeof body?.message === 'string') return body.message
  if (response.status >= 500) return 'Ocorreu um erro interno. Tente novamente mais tarde.'
  return statusMessages[response.status] ?? 'Não foi possível concluir a solicitação.'
}

export function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
  }
  if (error instanceof SyntaxError) return 'O conteúdo enviado está inválido ou malformado.'
  if (error instanceof Error) return error.message
  return fallback
}