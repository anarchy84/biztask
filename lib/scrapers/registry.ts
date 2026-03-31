// ================================================================
// 콘텐츠 팜 — 스크래퍼 레지스트리 (팩토리 패턴)
// 날짜: 2026-03-30
// 용도: 카테고리별 스크래퍼를 등록하고, 크론 실행 시 랜덤 선택
// ================================================================

import type { Scraper } from "./types";
import { SCRAPER_CATEGORY_MAP, getGeeknewsCategory } from "@/lib/constants";

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

// ─── 가중치 랜덤 스크래퍼 선택 (Project DNA 비율 적용) ───
// 크론 실행할 때마다 이 비율에 따라 1개 스크래퍼를 골라서 실행
// ※ 스크래퍼 내부 카테고리(car, ai 등)는 그대로 사용
// ※ 실제 발행 시 SCRAPER_CATEGORY_MAP으로 공식 6개 카테고리로 변환됨
// ── 소스 맵 (2026-03-31 기준) ──
// humor(40%): 보배드림, 디시실베, 개드립, 더쿠, 웃긴대학
// car(10%): 클리앙 굴러간당, 뽐뿌 자동차포럼 → 발행 시 "free"로 변환
// qa(15%): 아이보스 질문답변
// marketing(15%): 아이보스 정보공유
// business(10%): (Hard Track — 향후)
// ai(10%): (향후) → 발행 시 "free"로 변환
const CATEGORY_WEIGHTS: Record<string, number> = {
  humor: 35,      // 유머 35% — 보배드림, 디시실베, 개드립, 더쿠, 웃긴대학
  car: 10,        // 자동차 10% → 발행 시 "자유" 탭으로 편입
  qa: 15,         // Q&A 15% — 아이보스 질문답변
  marketing: 13,  // 마케팅 13% — 아이보스 정보공유
  business: 10,   // 사업 10% — (Hard Track 향후 추가)
  ai: 5,          // AI 5% → 발행 시 "자유" 탭으로 편입
  geeknews: 12,   // 긱뉴스 12% — AI/기술 트렌드 (자유60%/사업20%/마케팅20% 랜덤)
};

export function pickRandomScraper(): Scraper | null {
  const all = getAllScrapers();
  if (all.length === 0) return null;

  // 카테고리별 스크래퍼를 그룹화
  const categoryGroups: Map<string, Scraper[]> = new Map();
  for (const s of all) {
    const group = categoryGroups.get(s.category) || [];
    group.push(s);
    categoryGroups.set(s.category, group);
  }

  // 가중치 기반 카테고리 선택
  const entries = Array.from(categoryGroups.keys());
  const weights = entries.map((cat) => CATEGORY_WEIGHTS[cat] || 5);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let rand = Math.random() * totalWeight;

  let selectedCategory = entries[0];
  for (let i = 0; i < entries.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      selectedCategory = entries[i];
      break;
    }
  }

  // 선택된 카테고리 내에서 랜덤 스크래퍼 1개
  const scrapers = categoryGroups.get(selectedCategory) || all;
  const index = Math.floor(Math.random() * scrapers.length);
  console.log(
    `[ScraperRegistry] 카테고리 "${selectedCategory}" 선택 (가중치 기반) → ${scrapers[index].name}`
  );
  return scrapers[index];
}

// ─── 스크래퍼 내부 카테고리 → 공식 slug 변환 ───
// 스크래퍼가 사용하는 내부 코드(car, ai 등)를 공식 6개 카테고리 slug로 변환
// content_backlog INSERT 시 반드시 이 함수를 거쳐야 함
export function toOfficialCategory(scraperCategory: string): string {
  // 긱뉴스는 자유60%/사업20%/마케팅20% 랜덤 배분
  if (scraperCategory === "geeknews") return getGeeknewsCategory();
  return SCRAPER_CATEGORY_MAP[scraperCategory] || "free";
}

// ─── 디버그용: 등록 현황 출력 ───
export function printRegistry(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [category, scrapers] of scraperMap.entries()) {
    result[category] = scrapers.map((s) => s.name);
  }
  return result;
}
