import React from 'react';
import { DepartmentId, ReadingRecord, PopulationLog } from '../types';
import { DEPARTMENTS } from '../constants';
import { Trophy, Target, Crown, Users } from 'lucide-react';

interface RaceTrackProps {
  records: ReadingRecord[];
  popHistory: PopulationLog[];
}

const RaceTrack: React.FC<RaceTrackProps> = ({ records, popHistory }) => {
  
  // 특정 날짜의 부서 인원을 찾는 헬퍼 함수
  const getPopulationAtDate = (dateStr: string, deptId: DepartmentId): number => {
    const targetDate = new Date(dateStr).getTime();
    const sortedHistory = [...popHistory].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    const applicableLog = sortedHistory.find(log => 
      new Date(log.startDate).getTime() <= targetDate
    );
    if (!applicableLog) {
       if(sortedHistory.length > 0) return sortedHistory[sortedHistory.length - 1].populations[deptId];
       return 10;
    }
    return applicableLog.populations[deptId] || 1;
  };

  // 점수 계산 로직: 
  // 1. 일반 기록(isAdminRecord: false) -> 사용자별/날짜별로 합산 후 4장 제한 캡핑
  // 2. 관리자 기록(isAdminRecord: true) -> 제한 없이 모든 장수를 합산
  const scores = DEPARTMENTS.reduce((acc, dept) => {
    const deptRecords = records.filter(r => r.departmentId === dept.id);
    
    // 일반 기록 그룹화 (user_date_key -> sum)
    const normalUserDateSum: Record<string, { date: string, chapters: number }> = {};
    // 관리자 기록 합계
    let adminTotalScore = 0;

    deptRecords.forEach(r => {
        if (r.isAdminRecord) {
            // 관리자 기록은 즉시 합산 (인원 가중치 고려)
            const popAtDate = getPopulationAtDate(r.date, dept.id);
            adminTotalScore += (r.chapters / popAtDate);
        } else {
            const datePart = r.date.split('T')[0];
            const key = `${r.userId}_${datePart}`;
            if (!normalUserDateSum[key]) {
                normalUserDateSum[key] = { date: r.date, chapters: 0 };
            }
            normalUserDateSum[key].chapters += r.chapters;
        }
    });

    // 일반 기록 캡핑 적용
    const normalTotalScore = Object.values(normalUserDateSum).reduce((sum, entry) => {
        const popAtDate = getPopulationAtDate(entry.date, dept.id);
        const cappedChapters = Math.min(entry.chapters, 4);
        return sum + (cappedChapters / popAtDate);
    }, 0);

    acc[dept.id] = normalTotalScore + adminTotalScore;
    return acc;
  }, {} as Record<DepartmentId, number>);

  const maxScore = Math.max(...Object.values(scores), 0.1);

  // 현재 시점의 인원수 (화면 표시용)
  const currentPops = popHistory.length > 0
    ? [...popHistory].sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0].populations
    : { GIDEON: 10, DANIEL: 10, JOSEPH: 10 };

  // 순위 계산
  const rankings = [...DEPARTMENTS].sort((a, b) => scores[b.id] - scores[a.id]);
  const leaderId = rankings[0].id;

  return (
    <div className="relative pt-10 pb-16 px-4 md:px-12 bg-gradient-to-b from-slate-50 to-slate-200 rounded-[3rem] border border-slate-300 shadow-inner overflow-hidden">
      <div className="relative space-y-4" style={{ perspective: '1200px' }}>
        {DEPARTMENTS.map((dept, index) => {
          const score = scores[dept.id];
          const pop = currentPops[dept.id];
          const progress = Math.min((score / maxScore) * 85, 85);
          const isLeader = dept.id === leaderId && score > 0;
          
          return (
            <div key={dept.id} className="relative group transition-all duration-500" style={{ transform: `rotateX(15deg) translateZ(${index * 2}px)`, transformStyle: 'preserve-3d' }}>
              <div className="absolute -top-8 left-2 flex items-center gap-3 z-20">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-md text-[10px] font-black" style={{ color: dept.color }}>{index + 1}</span>
                <span className="text-xs font-black text-slate-700">{dept.name}</span>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100/50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dept.color }} />
                  {pop}명
                </span>
              </div>
              <div className="relative h-20 w-full bg-slate-300/40 rounded-2xl border-t border-white/50 border-b border-slate-400/30 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)]">
                <div className="absolute inset-0 flex justify-between px-8 opacity-20">
                  {[...Array(11)].map((_, i) => <div key={i} className="h-full w-[1px] bg-slate-400" />)}
                </div>
                <div className="absolute left-0 top-0 bottom-0 opacity-10 transition-all duration-1000 ease-out" style={{ backgroundColor: dept.color, width: `${progress + 5}%`, boxShadow: `0 0 40px ${dept.color}44` }} />
                <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ease-out z-30" style={{ left: `${progress}%`, filter: `drop-shadow(0 15px 15px rgba(0,0,0,0.2))` }}>
                  <div className="relative animate-bounce-slow flex flex-col items-center">
                    {isLeader && <div className="absolute -top-10 animate-pulse text-amber-400 drop-shadow-sm"><Crown className="w-8 h-8 fill-amber-400" /></div>}
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center relative transform transition-transform hover:scale-110" style={{ backgroundColor: dept.color, boxShadow: `inset 0 -6px 0 rgba(0,0,0,0.15), 0 10px 20px -5px ${dept.color}66`, transform: 'rotateY(-20deg) rotateX(10deg)' }}>
                      <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-2 gap-1 p-2">
                        {[...Array(4)].map((_, i) => <div key={i} className="bg-black rounded-lg" />)}
                      </div>
                      <span className="text-4xl filter drop-shadow-md select-none transform transition-transform group-hover:scale-125">🐢</span>
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full w-8 h-8 flex flex-col items-center justify-center shadow-lg border-2 z-40" style={{ borderColor: dept.color }}>
                        <span className="text-[9px] font-black text-slate-800 leading-none">{score.toFixed(1)}</span>
                        <span className="text-[6px] font-bold text-slate-400 leading-none">점</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white/40 to-transparent flex items-center justify-center border-l-2 border-dashed border-slate-300">
                  <Target className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
      <div className="mt-12 flex justify-between items-end border-t border-slate-300 pt-6 px-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Race Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-600">현재 선두: <span className="text-indigo-600">{rankings[0].name}</span></span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex -space-x-2">
            {rankings.map((dept, i) => (
              <div key={dept.id} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm" style={{ backgroundColor: dept.color, zIndex: 10 - i }}>{i + 1}</div>
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase text-right leading-tight">
            점수 산정: 일반기록은 인당 일일 4장 제한 합산<br/>
            관리자 기록은 제한 없이 전량 합산
          </span>
        </div>
      </div>
    </div>
  );
};

export default RaceTrack;