// 파일 위치: app/submit/page.tsx
// 용도: 새 글 작성 페이지 (다크 테마)
// 기능:
//   - 비로그인 사용자 → 로그인 페이지로 리다이렉트
//   - 로그인 사용자 → 제목/카테고리/본문/미디어 첨부 → Supabase posts 테이블에 저장
//   - 이미지 첨부 시 browser-image-compression으로 자동 압축 (maxSizeMB: 1, maxWidthOrHeight: 1920)
//   - 동영상 첨부 시 50MB 하드 리미트 검증
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import imageCompression from "browser-image-compression";
import {
  FileText,
  Type,
  AlignLeft,
  Tag,
  Loader2,
  ArrowLeft,
  Paperclip,
  ImageIcon,
  Film,
  X,
  CheckCircle2,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// 카테고리 옵션 목록
const CATEGORIES = ["자유", "사업", "마케팅", "커리어"];

// ═══════════════════════════════════════════════════════
// 미디어 파일 제한 상수
// 이미지: 압축 후 최대 1MB / 1920px
// 동영상: 원본 최대 50MB (클라이언트 단 압축 불가하므로 하드 리미트)
// ═══════════════════════════════════════════════════════
const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 1, // 압축 후 최대 1MB
  maxWidthOrHeight: 1920, // 가로 또는 세로 최대 1920px
  useWebWorker: true, // 웹 워커 사용 (메인 스레드 블로킹 방지)
};
const VIDEO_MAX_SIZE_MB = 50; // 동영상 최대 50MB
const VIDEO_MAX_SIZE_BYTES = VIDEO_MAX_SIZE_MB * 1024 * 1024;

// ─── 첨부 파일 타입 정의 ───
type AttachedFile = {
  id: string; // 고유 식별자 (미리보기 key용)
  file: File; // 실제 파일 객체 (압축 후)
  originalName: string; // 원본 파일명
  type: "image" | "video" | "other"; // 파일 분류
  previewUrl: string | null; // 이미지 미리보기 URL
  originalSize: number; // 압축 전 원본 크기 (바이트)
  compressedSize: number; // 압축 후 크기 (바이트)
};

// ─── 파일 크기를 읽기 좋은 문자열로 변환 ───
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function SubmitPage() {
  // ─── 상태 관리 ───
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("자유");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── 파일 첨부 관련 상태 ───
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]); // 첨부된 파일 목록
  const [compressing, setCompressing] = useState(false); // 이미지 압축 진행 중 여부
  const [compressProgress, setCompressProgress] = useState(""); // 압축 진행 상태 메시지
  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력 ref

  const router = useRouter();

  // ─── 마운트 시 로그인 여부 확인 ───
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      setAuthLoading(false);
    };

    checkAuth();
  }, [router]);

  // ─── 컴포넌트 언마운트 시 미리보기 URL 정리 (메모리 누수 방지) ───
  useEffect(() => {
    return () => {
      attachedFiles.forEach((af) => {
        if (af.previewUrl) URL.revokeObjectURL(af.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════
  // 파일 선택 핸들러
  // 1. 이미지 파일 → browser-image-compression으로 자동 압축
  // 2. 동영상 파일 → 50MB 초과 시 업로드 차단
  // 3. 기타 파일 → 50MB 초과 시 업로드 차단
  // ═══════════════════════════════════════════════════════
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setError("");
    setCompressing(true);
    setCompressProgress("파일을 처리하고 있습니다...");

    const newAttachedFiles: AttachedFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const originalFile = selectedFiles[i];
      const fileType = originalFile.type;

      // ─── 이미지 파일 처리: 자동 압축 ───
      if (fileType.startsWith("image/")) {
        try {
          setCompressProgress(
            `이미지 최적화 중... (${i + 1}/${selectedFiles.length}) "${originalFile.name}"`
          );

          // browser-image-compression 라이브러리로 압축 실행
          // WebWorker를 사용하여 메인 스레드 블로킹 없이 백그라운드 압축
          const compressedBlob = await imageCompression(
            originalFile,
            IMAGE_COMPRESSION_OPTIONS
          );

          // 압축된 Blob을 File 객체로 변환 (Supabase Storage 업로드에 File 객체 필요)
          const compressedFile = new File(
            [compressedBlob],
            originalFile.name,
            { type: compressedBlob.type, lastModified: Date.now() }
          );

          // 이미지 미리보기 URL 생성
          const previewUrl = URL.createObjectURL(compressedFile);

          newAttachedFiles.push({
            id: `${Date.now()}-${i}`,
            file: compressedFile,
            originalName: originalFile.name,
            type: "image",
            previewUrl,
            originalSize: originalFile.size,
            compressedSize: compressedFile.size,
          });
        } catch {
          // 압축 실패 시 원본 파일을 그대로 사용
          const previewUrl = URL.createObjectURL(originalFile);
          newAttachedFiles.push({
            id: `${Date.now()}-${i}`,
            file: originalFile,
            originalName: originalFile.name,
            type: "image",
            previewUrl,
            originalSize: originalFile.size,
            compressedSize: originalFile.size,
          });
        }

        // ─── 동영상 파일 처리: 50MB 하드 리미트 검증 ───
      } else if (fileType.startsWith("video/")) {
        if (originalFile.size > VIDEO_MAX_SIZE_BYTES) {
          alert(
            `동영상은 ${VIDEO_MAX_SIZE_MB}MB 이하만 업로드 가능합니다.\n` +
              `선택한 파일: "${originalFile.name}" (${formatFileSize(originalFile.size)})`
          );
          continue; // 이 파일은 건너뛰고 다음 파일 처리
        }

        newAttachedFiles.push({
          id: `${Date.now()}-${i}`,
          file: originalFile,
          originalName: originalFile.name,
          type: "video",
          previewUrl: null,
          originalSize: originalFile.size,
          compressedSize: originalFile.size,
        });

        // ─── 기타 파일 처리: 50MB 하드 리미트 검증 ───
      } else {
        if (originalFile.size > VIDEO_MAX_SIZE_BYTES) {
          alert(
            `파일은 ${VIDEO_MAX_SIZE_MB}MB 이하만 업로드 가능합니다.\n` +
              `선택한 파일: "${originalFile.name}" (${formatFileSize(originalFile.size)})`
          );
          continue;
        }

        newAttachedFiles.push({
          id: `${Date.now()}-${i}`,
          file: originalFile,
          originalName: originalFile.name,
          type: "other",
          previewUrl: null,
          originalSize: originalFile.size,
          compressedSize: originalFile.size,
        });
      }
    }

    // 기존 첨부 파일 목록에 새로 처리된 파일 추가
    setAttachedFiles((prev) => [...prev, ...newAttachedFiles]);
    setCompressing(false);
    setCompressProgress("");

    // file input 초기화 (같은 파일 재선택 가능하도록)
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ─── 첨부 파일 삭제 핸들러 ───
  const removeFile = (fileId: string) => {
    setAttachedFiles((prev) => {
      const target = prev.find((f) => f.id === fileId);
      // 미리보기 URL이 있으면 메모리에서 해제
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== fileId);
    });
  };

  // ─── 글 발행 핸들러 ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (title.trim().length < 2) {
      setError("제목은 최소 2자 이상이어야 합니다.");
      return;
    }
    if (!content.trim()) {
      setError("본문을 입력해주세요.");
      return;
    }

    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    setSubmitting(true);

    try {
      // 1단계: 프로필이 없으면 자동 생성
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingProfile) {
        const nickname = user.email?.split("@")[0] || "익명";
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({ id: user.id, nickname });

        if (profileError) {
          setError("프로필 생성에 실패했습니다: " + profileError.message);
          return;
        }
      }

      // 2단계: 첨부 파일이 있으면 Supabase Storage에 업로드
      const uploadedUrls: string[] = [];

      for (const af of attachedFiles) {
        // 파일 확장자 추출 (없으면 bin)
        const fileExt = af.originalName.split(".").pop()?.toLowerCase() || "bin";
        // 고유 파일명 생성: user_id/timestamp_랜덤문자열.확장자
        // → 같은 유저가 같은 이름의 파일을 올려도 절대 충돌하지 않음
        const uniqueId = `${Date.now()}_${crypto.randomUUID()}`;
        const filePath = `${user.id}/${uniqueId}.${fileExt}`;

        // Supabase Storage 'post_images' 버킷에 업로드
        const { error: uploadError } = await supabase.storage
          .from("post_images")
          .upload(filePath, af.file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // Storage 버킷이 없거나 권한 문제 시 에러 로그 후 건너뛰기
          console.warn("파일 업로드 실패:", uploadError.message);
          continue;
        }

        // 업로드 완료된 파일의 공개 URL 획득
        const { data: urlData } = supabase.storage
          .from("post_images")
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // 3단계: 게시글 저장
      // 이미지 URL은 image_urls JSONB 컬럼에 별도 저장 (본문과 분리)
      const insertData: Record<string, unknown> = {
        author_id: user.id,
        title: title.trim(),
        content: content.trim(),
        category,
      };

      // 업로드된 파일 URL이 있으면 image_urls 컬럼에 배열로 저장
      if (uploadedUrls.length > 0) {
        insertData.image_urls = uploadedUrls;
      }

      const { error: insertError } = await supabase
        .from("posts")
        .insert(insertData);

      if (insertError) {
        if (insertError.message.includes("row-level security")) {
          setError("권한 오류: 게시글 작성 권한이 없습니다. 다시 로그인해주세요.");
        } else {
          setError("글 작성에 실패했습니다: " + insertError.message);
        }
        return;
      }

      // 4단계: 성공 → 홈으로 이동
      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  // 인증 확인 중 로딩 표시
  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      {/* 상단: 뒤로가기 + 페이지 제목 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 text-muted hover:bg-hover-bg hover:text-foreground"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">새 글 작성</h1>
        </div>
      </div>

      {/* 글쓰기 카드 (다크 테마) */}
      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 카테고리 선택 */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Tag className="h-4 w-4 text-muted" />
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    category === cat
                      ? "bg-primary text-black"
                      : "border border-border-color text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 입력 */}
          <div>
            <label
              htmlFor="title"
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <Type className="h-4 w-4 text-muted" />
              제목
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-3 text-base text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {title.length}/100
            </p>
          </div>

          {/* 본문 입력 */}
          <div>
            <label
              htmlFor="content"
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <AlignLeft className="h-4 w-4 text-muted" />
              본문
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 이야기를 나눠보세요. 경험, 질문, 인사이트 무엇이든 좋습니다."
              rows={10}
              className="w-full resize-y rounded-lg border border-border-color bg-input-bg px-4 py-3 text-sm leading-relaxed text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* 파일 첨부 영역                                           */}
          {/* 이미지: 자동 압축 (1MB/1920px), 동영상: 50MB 하드 리미트    */}
          {/* ═══════════════════════════════════════════════════════ */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Paperclip className="h-4 w-4 text-muted" />
              미디어 첨부
              <span className="text-xs font-normal text-muted">
                (이미지 자동 압축 · 동영상 최대 50MB)
              </span>
            </label>

            {/* 파일 선택 버튼 (숨겨진 input + 커스텀 버튼) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              aria-label="미디어 파일 첨부"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing || submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-color py-4 text-sm text-muted transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {compressing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-primary font-medium">
                    {compressProgress || "이미지 최적화 중..."}
                  </span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-5 w-5" />
                  <span>이미지 또는 동영상 추가</span>
                </>
              )}
            </button>

            {/* ─── 첨부된 파일 미리보기 목록 ─── */}
            {attachedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachedFiles.map((af) => (
                  <div
                    key={af.id}
                    className="flex items-center gap-3 rounded-lg border border-border-color bg-hover-bg p-2.5"
                  >
                    {/* 파일 아이콘 또는 이미지 썸네일 */}
                    {af.type === "image" && af.previewUrl ? (
                      <img
                        src={af.previewUrl}
                        alt={af.originalName}
                        className="h-12 w-12 rounded-md object-cover shrink-0"
                      />
                    ) : af.type === "video" ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-purple-500/20 shrink-0">
                        <Film className="h-5 w-5 text-purple-400" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-500/20 shrink-0">
                        <Paperclip className="h-5 w-5 text-gray-400" />
                      </div>
                    )}

                    {/* 파일 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {af.originalName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        {af.type === "image" && af.originalSize !== af.compressedSize ? (
                          // 이미지: 압축 전후 크기 비교 표시
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                            {formatFileSize(af.originalSize)} → {formatFileSize(af.compressedSize)}
                            <span className="text-green-400">
                              ({Math.round((1 - af.compressedSize / af.originalSize) * 100)}% 절감)
                            </span>
                          </span>
                        ) : (
                          <span>{formatFileSize(af.compressedSize)}</span>
                        )}
                      </div>
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => removeFile(af.id)}
                      className="rounded-full p-1.5 text-muted hover:bg-red-500/20 hover:text-red-400 shrink-0"
                      aria-label={`${af.originalName} 삭제`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 하단: 취소 + 발행 버튼 */}
          <div className="flex items-center justify-end gap-3 border-t border-border-color pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || compressing}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-black hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  발행 중...
                </>
              ) : compressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  이미지 최적화 중...
                </>
              ) : (
                "발행하기"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
