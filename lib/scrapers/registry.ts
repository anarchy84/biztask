// ================================================================
// 콘텐츠 팜 — 스크래퍼 레지스트리 (팩토리 패턴)
// 날짜: 2026-03-30
// 용도: 카테고리별 스크래퍼를 등록하고, 크론 실행 시 랜덤 선택
// ================================================================

import type { Scraper } from "./types";

// ─── 스크래퍼 저장소 ───
// 카테고리 → 스크래퍼 배열 (하나의 카테고리에 여러 스크래퍼 가능)
const scraperMap: Map<string, Scraper[]> = new Map();

// ─── 스크래퍼 등록 함수 ───
// 새 스크래퍼를 만들면 이 함수로 등록
export function registerScraper(scraper: Scraper): void {
  const existing = scraperMap.get(scraper.category) || [];
  existing.push(scraper);
  scraperMap.set(scraper.category, existing);
  console.log(
    `[ScraperRegistry] "${scraper.name}" 등록 완료 (카테고리: ${scraper.category})`
  );
}

// ─── 특정 카테고리의 스크래퍼 목록 가져오기 ───
export function getScrapersByCategory(category: string): Scraper[] {
  return scraperMap.get(category) || [];
}

// ─── 등록된 모든 카테고리 목록 ───
export function getAllCategories(): string[] {
  return Array.from(scraperMap.keys());
}

// ─── 등록된 모든 스크래퍼 목록 (플랫) ───
export function getAllScrapers(): Scraper[] {
  const all: Scraper[] = [];
  for (const scrapers of scraperMap.values()) {
    all.push(...scrapers);
  }
  return all;
}

// ─── 랜덤 스크래퍼 1개 선택 (Hit & Run용) ───
// 크론 실행할 때마다 랜덤으로 1개 스크래퍼만 골라서 실행
// → 부하 분산 + Vercel 타임아웃 방어
export function pickRandomScraper(): Scraper | null {
  const all = getAllScrapers();
  if (all.length === 0) return null;
  const index = Math.floor(Math.random() * all.length);
  return all[index];
}

// ─── 디버그용: 등록 현황 출력 ───
export function printRegistry(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [category, scrapers] of scraperMap.entries()) {
    result[category] = scrapers.map((s) => s.name);
  }
  return result;
}
