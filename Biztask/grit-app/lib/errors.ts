// 한글 주석: Supabase/네트워크 에러를 화면에 보여줄 한글 문장으로 정리한다.

/** 한글 주석: 사용자에게 그대로 노출해도 되는 짧은 에러 메시지로 변환한다. */
export function toUserFacingError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const message = raw.toLowerCase()

  if (!raw) return fallback

  if (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('not authorized') ||
    message.includes('jwt')
  ) {
    return '권한이 없어. 로그인 상태나 인증 등급을 확인해줘'
  }

  if (message.includes('duplicate key') || message.includes('violates unique constraint')) {
    return '이미 처리된 요청이야. 화면을 새로고침한 뒤 다시 확인해줘'
  }

  if (message.includes('foreign key') || message.includes('violates foreign key constraint')) {
    return '연결된 글이나 계정을 찾을 수 없어. 다시 확인해줘'
  }

  if (message.includes('invalid input syntax for type uuid')) {
    return '글 ID 형식이 올바르지 않아'
  }

  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  ) {
    return '네트워크가 불안정해. 잠시 후 다시 시도해줘'
  }

  return raw.length > 120 ? fallback : raw
}
