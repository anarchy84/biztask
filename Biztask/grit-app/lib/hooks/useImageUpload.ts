// 한글 주석: 이미지 선택 + 압축 + Supabase Storage 업로드 훅
//
// ▣ 이 훅이 하는 일:
//   - expo-image-picker로 사진 라이브러리에서 1장 선택
//   - expo-image-manipulator로 1280px·80% 압축 (보통 200KB~800KB)
//   - Supabase Storage 버킷에 업로드 (post-images 또는 avatars)
//   - 공개 URL 반환
//
// ▣ 사용 예 (글쓰기 화면):
//   const { pickAndUpload, uploading, error, progress } = useImageUpload({ bucket: 'post-images' })
//   const url = await pickAndUpload()
//   if (url) setImageUrl(url)
//
// ▣ 파일 경로 컨벤션:
//   - post-images/{user_id}/{uuid}.jpg
//   - avatars/{user_id}/{timestamp}.jpg
//   → RLS 정책이 첫 폴더가 user_id인지 검사
//
// ▣ 권한:
//   - iOS: app.json infoPlist에 NSPhotoLibraryUsageDescription 등록 (이미 완료)
//   - Android: ImagePicker.requestMediaLibraryPermissionsAsync() 자동 처리

import { useCallback, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// 한글 주석: 지원 버킷 (Storage 정책에 등록된 것만)
export type StorageBucket = 'post-images' | 'avatars'

// 한글 주석: 압축 설정 (버킷별 다르게)
const BUCKET_CONFIG: Record<
  StorageBucket,
  { maxWidth: number; quality: number }
> = {
  'post-images': { maxWidth: 1280, quality: 0.8 },
  avatars: { maxWidth: 512, quality: 0.85 },
}

export interface UseImageUploadArgs {
  bucket: StorageBucket
}

export interface UseImageUploadReturn {
  /**
   * 한글 주석: 사진 선택 + 압축 + 업로드 → public URL 반환
   * - 사용자 취소 시 null 반환 (에러 아님)
   * - 실패 시 null + error 상태 설정
   */
  pickAndUpload: () => Promise<string | null>
  uploading: boolean
  error: string | null
  clearError: () => void
}

export function useImageUpload({
  bucket,
}: UseImageUploadArgs): UseImageUploadReturn {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickAndUpload = useCallback(async (): Promise<string | null> => {
    setError(null)

    if (!user?.id) {
      setError('로그인 세션이 없어. 앱 재실행 후 다시 시도해줘')
      return null
    }

    try {
      // ─────────────────────────────────────────────
      // 1) 권한 요청 (이미 허용했으면 즉시 통과)
      // ─────────────────────────────────────────────
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (perm.status !== 'granted') {
        setError('사진 라이브러리 접근 권한이 필요해. 설정에서 허용해줘')
        return null
      }

      // ─────────────────────────────────────────────
      // 2) 사진 선택 (한 장만, 즉시 닫힘)
      //   - mediaTypes: Images 만
      //   - allowsMultipleSelection + selectionLimit 명시 → single mode 강제
      //     (iOS PHPicker가 multi-select 모드로 뜨면 "추가" 버튼 누르기 전까지 안 닫힘)
      //   - allowsEditing: false (자유 비율 유지)
      //   - quality: 1.0 (원본 받아서 우리가 manipulator로 직접 압축)
      // ─────────────────────────────────────────────
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        selectionLimit: 1,
        allowsEditing: false,
        quality: 1.0,
      })

      if (picked.canceled || !picked.assets?.[0]) {
        // 한글 주석: 사용자가 취소 → 조용히 종료
        return null
      }

      setUploading(true)

      const asset = picked.assets[0]
      const cfg = BUCKET_CONFIG[bucket]

      // ─────────────────────────────────────────────
      // 3) 압축 + 리사이즈 (jpeg, maxWidth 기준)
      //   - 큰 사진도 보통 1MB 미만으로 줄어듦
      //   - 작은 사진은 quality만 적용
      // ─────────────────────────────────────────────
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: cfg.maxWidth } }],
        {
          compress: cfg.quality,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      )

      // ─────────────────────────────────────────────
      // 4) 파일을 base64 → ArrayBuffer 로 변환 후 업로드
      //   - Supabase JS는 React Native 환경에서 ArrayBuffer 받음
      //   - FileSystem.readAsStringAsync로 base64 읽고 디코딩
      // ─────────────────────────────────────────────
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const arrayBuffer = decodeBase64ToArrayBuffer(base64)

      // ─────────────────────────────────────────────
      // 5) Supabase Storage 업로드
      //   - 파일 경로: {user_id}/{timestamp}-{random}.jpg
      //   - upsert: false (중복 방지, 매번 새 파일명)
      // ─────────────────────────────────────────────
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const path = `${user.id}/${filename}`

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadErr) throw new Error(uploadErr.message)

      // ─────────────────────────────────────────────
      // 6) 공개 URL 생성
      //   - 버킷이 public이라 getPublicUrl로 즉시 사용 가능
      // ─────────────────────────────────────────────
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

      return urlData.publicUrl
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 에러'
      console.error('[useImageUpload] 실패:', msg)
      setError(msg)
      return null
    } finally {
      setUploading(false)
    }
  }, [bucket, user?.id])

  const clearError = useCallback(() => setError(null), [])

  return {
    pickAndUpload,
    uploading,
    error,
    clearError,
  }
}

// ─────────────────────────────────────────────
// 한글 주석: base64 → ArrayBuffer 변환
//   - React Native 환경에선 atob 없으니 직접 구현
//   - Buffer 모듈도 React Native에 없음
// ─────────────────────────────────────────────
function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}
