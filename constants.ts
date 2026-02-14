
import { Department } from './types';

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'GIDEON', name: '기드온부', color: '#ef4444', emoji: '🐢' },
  { id: 'DANIEL', name: '다니엘부', color: '#3b82f6', emoji: '🐢' },
  { id: 'JOSEPH', name: '요셉부', color: '#10b981', emoji: '🐢' },
];

export const LOCAL_STORAGE_KEY = 'church_bible_race_v2_data';

// JsonBlob: 무료 공용 DB (백업용)
export const SYNC_API_BASE = 'https://jsonblob.com/api/jsonBlob';

// -------------------------------------------------------------------------
// [고정 ID] 백업용 클라우드 ID
// -------------------------------------------------------------------------
export const SHARED_CLOUD_ID: string = '13476903-8025-11ef-8b1d-910406692985';

// -------------------------------------------------------------------------
// [고정 구글 시트 URL] 
// 앱이 시작될 때 이 URL을 사용하여 데이터를 동기화합니다.
// -------------------------------------------------------------------------
export const DEFAULT_GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxsDwj687IHP-g9tu_ksTIsLDOz_OKvCHOVWsHBG7TqieYhJUpu4IJPY69NZCfwyZY4og/exec';

// -------------------------------------------------------------------------
// [대회 기간 설정]
// 이 기간 내의 기록만 순위 및 통계에 반영됩니다. (KST 기준 YYYY-MM-DD)
// -------------------------------------------------------------------------
export const RACE_START_DATE = '2026-02-08';
export const RACE_END_DATE = '2026-12-31';