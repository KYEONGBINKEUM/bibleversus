
export type DepartmentId = string;

export interface Department {
  id: DepartmentId;
  name: string;
  color: string;
  emoji: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  departmentId?: DepartmentId; // 선택 전에는 없을 수 있음
  isAdmin?: boolean;
}

export interface ReadingRecord {
  id: string;
  departmentId: DepartmentId;
  userId: string;       // 누가 읽었는지
  userName: string;     // 기록 당시의 이름
  chapters: number;
  date: string; // ISO string
  isAdminRecord?: boolean; // 관리자가 입력한 기록 여부
}

export interface PopulationLog {
  startDate: string; // 이 설정이 시작된 날짜 (ISO)
  populations: Record<DepartmentId, number>;
}

export interface ChartData {
  label: string;
  [key: string]: number | string; // Dynamic department keys
}

export type DepartmentPopulations = Record<DepartmentId, number>;
