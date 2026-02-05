import React, { useMemo, useState } from 'react';
import { ReadingRecord, ChartData, PopulationLog, DepartmentId, Department } from '../types';
import { BarChart3, TrendingUp, Users, Crown } from 'lucide-react';
import { RACE_START_DATE, RACE_END_DATE } from '../constants';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface StatisticsProps {
  records: ReadingRecord[];
  popHistory: PopulationLog[];
  isAdmin: boolean;
  departments: Department[];
}

type Period = 'daily' | 'weekly' | 'monthly';
type ChartType = 'bar' | 'line';
type ViewMode = 'total' | 'average';

// Helper: ISO 문자열을 KST 날짜 문자열(YYYY-MM-DD)로 변환
const getKSTDateFromISO = (iso: string) => {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
};

const Statistics: React.FC<StatisticsProps> = ({ records, popHistory, isAdmin, departments }) => {
  const [period, setPeriod] = useState<Period>('daily');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [viewMode, setViewMode] = useState<ViewMode>('average');

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

  // [중요] 모든 통계는 지정된 레이스 기간 내의 기록만 사용합니다.
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const kstDate = getKSTDateFromISO(r.date);
      return kstDate >= RACE_START_DATE && kstDate <= RACE_END_DATE;
    });
  }, [records]);

  const chartData = useMemo(() => {
    // 점수 계산 로직: 
    // 1. 일반 기록(isAdminRecord: false) -> 사용자별/날짜별 합산 후 4장 제한 캡핑
    // 2. 관리자 기록(isAdminRecord: true) -> 제한 없이 모든 장수를 합산
    
    // key: date_department -> total_score
    const processedScores: { departmentId: DepartmentId, date: string, scoreChapters: number, timestamp: number }[] = [];
    
    // 부서별로 그룹화
    departments.forEach(dept => {
        const deptRecords = filteredRecords.filter(r => r.departmentId === dept.id);
        const normalGroup: Record<string, { date: string, chapters: number, timestamp: number }> = {};
        
        deptRecords.forEach(r => {
            const timestamp = new Date(r.date).getTime();
            if (r.isAdminRecord) {
                // 관리자 기록은 그대로 리스트에 추가
                processedScores.push({ departmentId: dept.id, date: r.date, scoreChapters: r.chapters, timestamp });
            } else {
                const dateKey = r.date.split('T')[0];
                const userKey = `${r.userId}_${dateKey}`;
                if (!normalGroup[userKey]) {
                    normalGroup[userKey] = { date: r.date, chapters: 0, timestamp };
                }
                normalGroup[userKey].chapters += r.chapters;
            }
        });

        // 일반 기록 캡핑 후 추가
        Object.values(normalGroup).forEach(item => {
            processedScores.push({ departmentId: dept.id, date: item.date, scoreChapters: Math.min(item.chapters, 4), timestamp: item.timestamp });
        });
    });

    const data: Record<string, ChartData & { timestamp: number }> = {};

    processedScores.forEach(record => {
      const date = new Date(record.date);
      let key = '';
      let representativeTimestamp = 0;

      if (period === 'daily') {
        key = `${date.getMonth() + 1}/${date.getDate()}`;
        representativeTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      } else if (period === 'weekly') {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        key = `${date.getFullYear()}년 ${weekNum}주차`;
        representativeTimestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()).getTime();
      } else {
        key = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
        representativeTimestamp = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      }

      if (!data[key]) {
        // Initialize all departments with 0
        const initialData: any = { label: key, timestamp: representativeTimestamp };
        departments.forEach(d => initialData[d.id] = 0);
        data[key] = initialData;
      }

      // Ensure key exists (in case departments changed dynamically)
      if (typeof data[key][record.departmentId] !== 'number') {
        data[key][record.departmentId] = 0;
      }

      if (viewMode === 'total') {
        (data[key][record.departmentId] as number) += record.scoreChapters;
      } else {
        const pop = getPopulationAtDate(record.date, record.departmentId);
        (data[key][record.departmentId] as number) += (record.scoreChapters / pop);
      }
    });

    // 시간 순서대로 정렬 (과거 -> 현재 순)
    const sorted = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
    
    // 최신 데이터 조각 가져오기 (이미 오름차순 정렬되었으므로 끝에서 자름)
    const limit = period === 'daily' ? 7 : period === 'weekly' ? 4 : 6;
    return sorted.slice(-limit);
  }, [filteredRecords, period, viewMode, popHistory, departments]);

  // 개인별 랭킹 데이터 (관리자용) - 전체 인원 노출
  const individualRankings = useMemo(() => {
    if (!isAdmin) return [];
    
    const userStats: Record<string, { name: string, deptId: DepartmentId, total: number }> = {};
    
    filteredRecords.forEach(r => {
      if (!userStats[r.userId]) {
        userStats[r.userId] = { name: r.userName || '익명', deptId: r.departmentId, total: 0 };
      }
      // 최신 이름으로 업데이트
      userStats[r.userId].name = r.userName || '익명';
      userStats[r.userId].total += r.chapters; 
    });

    return Object.values(userStats).sort((a, b) => b.total - a.total);
  }, [filteredRecords, isAdmin]);

  const renderChart = () => {
    const formatValue = (val: number) => viewMode === 'average' ? parseFloat(val.toFixed(2)) : val;

    if (chartType === 'bar') {
      return (
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            formatter={(value: number) => [formatValue(value), viewMode === 'average' ? '점 (인원보정)' : '장']}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
          {departments.map(dept => (
            <Bar key={dept.id} dataKey={dept.id} name={dept.name} fill={dept.color} radius={[4, 4, 0, 0]} barSize={period === 'daily' ? 12 : 24} />
          ))}
        </BarChart>
      );
    } else {
      return (
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip 
            formatter={(value: number) => [formatValue(value), viewMode === 'average' ? '점 (인원보정)' : '장']}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
          {departments.map(dept => (
            <Line key={dept.id} type="monotone" dataKey={dept.id} name={dept.name} stroke={dept.color} strokeWidth={3} dot={{ r: 4, fill: dept.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
          ))}
        </LineChart>
      );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setViewMode('average')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    viewMode === 'average' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                    <Users className="w-3.5 h-3.5" /> 1인 평균
                </button>
                <button
                    onClick={() => setViewMode('total')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    viewMode === 'total' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                    <TrendingUp className="w-3.5 h-3.5" /> 총 장수
                </button>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setChartType('bar')} className={`p-1.5 rounded-md transition-all ${chartType === 'bar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                <BarChart3 className="w-4 h-4" />
            </button>
            <button onClick={() => setChartType('line')} className={`p-1.5 rounded-md transition-all ${chartType === 'line' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                <TrendingUp className="w-4 h-4" />
            </button>
            </div>
        </div>
        <div className="flex w-full">
            <div className="flex flex-1 gap-1 bg-slate-100 p-1 rounded-lg">
            {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                {p === 'daily' ? '일별' : p === 'weekly' ? '주간' : '월별'}
                </button>
            ))}
            </div>
        </div>
      </div>

      <div className="h-[300px] w-full relative">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
            <BarChart3 className="w-12 h-12" />
            <p className="text-sm">해당 기간({RACE_START_DATE} ~)에 입력된 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-slate-100 pt-6 animate-in slide-in-from-bottom-5">
           <div className="flex items-center gap-2 mb-4">
             <div className="bg-amber-100 p-1.5 rounded-lg text-amber-600"><Crown className="w-4 h-4" /></div>
             <h3 className="text-sm font-black text-slate-700">개인별 다독 순위 (기간 내 총합)</h3>
           </div>
           
           <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100 max-h-[500px] overflow-y-auto">
             <table className="w-full text-left text-xs">
               <thead className="bg-slate-100 text-slate-500 sticky top-0 z-10 shadow-sm">
                 <tr>
                   <th className="py-3 pl-4">순위</th>
                   <th className="py-3">이름</th>
                   <th className="py-3">부서</th>
                   <th className="py-3 pr-4 text-right">총 장수</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {individualRankings.map((user, index) => {
                   const dept = departments.find(d => d.id === user.deptId);
                   return (
                     <tr key={index} className="hover:bg-white transition-colors">
                       <td className="py-3 pl-4 font-bold text-slate-400 w-12">{index + 1}</td>
                       <td className="py-3 font-bold text-slate-700">{user.name}</td>
                       <td className="py-3 text-slate-500">
                         <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dept?.color }}></span>
                            {dept?.name || '삭제됨'}
                         </span>
                       </td>
                       <td className="py-3 pr-4 text-right font-black text-indigo-600">{user.total}</td>
                     </tr>
                   );
                 })}
                 {individualRankings.length === 0 && (
                   <tr><td colSpan={4} className="py-8 text-center text-slate-400">기간 내 데이터가 없습니다</td></tr>
                 )}
               </tbody>
             </table>
           </div>
           <p className="text-[10px] text-slate-400 text-right mt-2">
              * {RACE_START_DATE} ~ {RACE_END_DATE} 기간의 기록만 반영됩니다.
           </p>
        </div>
      )}
    </div>
  );
};

export default Statistics;