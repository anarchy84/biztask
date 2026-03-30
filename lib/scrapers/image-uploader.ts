// ================================================================
// 스크래퍼 이미지 업로더
// 날짜: 2026-03-30
// 용도: 외부 사이트 이미지를 다운로드 → Supabase Storage에 업로드
//
// 흐름: 원본 이미지 URL → fetch로 다운로드 → Buffer 변환
//       → post_images 버킷에 업로드 → 공개 URL 반환
//
// 설계 원칙:
// - 실패에 강건하게: 개별 이미지 실패 시 스킵 (전체 중단 X)
// - Vercel 타임아웃 방어: 최대 5장, 이미지당 8초 타임아웃
// - 저장 경로: scraper/{author_id}/{timestamp}_{index}.{ext}
// ================================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 이미지 업로드 결과 타입 ───
interface ImageUploadResult {
  uploaded: string[];     // 성공한 공개 URL 목록
  failed: number;         // 실패 건수
  skipped: number;        // 스킵 건수 (너무 작은 이미지 등)
}

// ─── 설정 상수 ───
const MAX_IMAGES = 5;            // 한 게시글당 최대 업로드 이미지 수
const FETCH_TIMEOUT_MS = 8000;   // 이미지 다운로드 타임아웃 (8초)
const MIN_IMAGE_SIZE = 5000;     // 최소 이미지 크기 (5KB 미만은 아이콘/스페이서)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 최대 이미지 크기 (10MB)
const BUCKET_NAME = "post_images";

// ─── 이미지 다운로드용 헤더 ───
// 일부 사이트는 이미지 핫링크 차단을 하므로 브라우저처럼 위장
const IMAGE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Sec-Fetch-Dest": "image",
  "Sec-Fetch-Mode": "no-cors",
  "Sec-Fetch-Site": "cross-site",
};

// ─── URL에서 파일 확장자 추출 ───
function getExtensionFromUrl(url: string, contentType?: string): string {
  // Content-Type에서 먼저 시도
  if (contentType) {
    const typeMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/svg+xml": "svg",
    };
    for (const [mime, ext] of Object.entries(typeMap)) {
      if (contentType.includes(mime)) return ext;
    }
  }

  // URL 경로에서 추출
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i);
    if (match) return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  } catch {
    // URL 파싱 실패 시 무시
  }

  // 기본값
  return "jpg";
}

// ─── 이미지 URL 검증 ───
// 다운로드할 가치가 있는 이미지인지 사전 필터링
function isValidImageUrl(url: string): boolean {
  if (!url || url.startsWith("data:")) return false;

  // 아이콘, 이모티콘, 스페이서 등 제외
  const skipPatterns = [
    /icon/i, /emoji/i, /emoticon/i, /btn_/i, /bullet/i,
    /logo.*small/i, /spacer/i, /blank\./i, /pixel\./i,
    /1x1/i, /tracking/i, /beacon/i, /ad[_-]?banner/i,
  ];

  return !skipPatterns.some((pattern) => pattern.test(url));
}

// ─── 타임아웃 포함 fetch ───
async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ================================================================
// 메인 함수: 이미지 다운로드 → Supabase Storage 업로드
// ================================================================
// authorId: NPC의 user_id (폴더 구분용)
// sourceImages: 스크래퍼가 추출한 원본 이미지 URL 배열
// referer: 이미지 핫링크 차단 우회용 Referer 헤더
// ================================================================
export async function downloadAndUploadImages(
  sourceImages: string[],
  supabase: SupabaseClient,
  authorId: string,
  referer?: string
): Promise<ImageUploadResult> {
  const result: ImageUploadResult = {
    uploaded: [],
    failed: 0,
    skipped: 0,
  };

  // 이미지가 없으면 바로 반환
  if (!sourceImages || sourceImages.length === 0) {
    return result;
  }

  // 유효한 이미지만 필터링 + 최대 개수 제한
  const validImages = sourceImages.filter(isValidImageUrl).slice(0, MAX_IMAGES);
  result.skipped = sourceImages.length - validImages.length;

  console.log(
    `[ImageUploader] ${validImages.length}개 이미지 업로드 시작 (전체: ${sourceImages.length}개, 스킵: ${result.skipped}개)`
  );

  for (let i = 0; i < validImages.length; i++) {
    const imageUrl = validImages[i];

    try {
      // ─── 1단계: 이미지 다운로드 ───
      const headers = { ...IMAGE_HEADERS };

      // 이미지 출처 사이트에 맞는 Referer 설정
      if (referer) {
        headers["Referer"] = referer;
      } else {
        // URL에서 자동으로 Referer 추출
        try {
          const origin = new URL(imageUrl).origin;
          headers["Referer"] = origin + "/";
        } catch {
          // 무시
        }
      }

      const response = await fetchWithTimeout(imageUrl, headers, FETCH_TIMEOUT_MS);

      if (!response.ok) {
        console.warn(
          `[ImageUploader] 다운로드 실패 (HTTP ${response.status}): ${imageUrl.substring(0, 60)}`
        );
        result.failed++;
        continue;
      }

      // ─── 2단계: Buffer 변환 + 크기 검증 ───
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < MIN_IMAGE_SIZE) {
        // 5KB 미만: 아이콘이나 스페이서일 가능성 높음
        result.skipped++;
        continue;
      }

      if (buffer.length > MAX_IMAGE_SIZE) {
        // 10MB 초과: 너무 큰 이미지 스킵
        console.warn(
          `[ImageUploader] 이미지 너무 큼 (${(buffer.length / 1024 / 1024).toFixed(1)}MB): ${imageUrl.substring(0, 60)}`
        );
        result.skipped++;
        continue;
      }

      // ─── 3단계: Supabase Storage에 업로드 ───
      const contentType = response.headers.get("content-type") || "";
      const ext = getExtensionFromUrl(imageUrl, contentType);

      // 파일 경로: scraper/{author_id}/{timestamp}_{index}.{ext}
      // → 기존 유저 업로드와 구분 + 시간순 정렬 가능
      const timestamp = Date.now();
      const filePath = `scraper/${authorId}/${timestamp}_${i}.${ext}`;

      // MIME 타입 결정
      const mimeType = contentType.includes("image/")
        ? contentType.split(";")[0].trim()
        : `image/${ext === "jpg" ? "jpeg" : ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          cacheControl: "86400",    // 24시간 CDN 캐시
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.warn(
          `[ImageUploader] 업로드 실패: ${uploadError.message} (${imageUrl.substring(0, 60)})`
        );
        result.failed++;
        continue;
      }

      // ─── 4단계: 공개 URL 획득 ───
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        result.uploaded.push(urlData.publicUrl);
        console.log(
          `[ImageUploader] ✅ 업로드 성공 [${i + 1}/${validImages.length}]: ${(buffer.length / 1024).toFixed(0)}KB → ${filePath}`
        );
      } else {
        result.failed++;
      }
    } catch (err) {
      // AbortError = 타임아웃, 그 외 = 네트워크 에러
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.includes("abort");
      console.warn(
        `[ImageUploader] ${isTimeout ? "타임아웃" : "에러"}: ${errMsg.substring(0, 50)} (${imageUrl.substring(0, 60)})`
      );
      result.failed++;
    }
  }

  console.log(
    `[ImageUploader] 완료 — 성공: ${result.uploaded.length}, 실패: ${result.failed}, 스킵: ${result.skipped}`
  );

  return result;
}
