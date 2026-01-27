import React, { useState, useMemo } from 'react';
import { ReadingRecord } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  records: ReadingRecord[];
  userId: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ records, userId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday

  const monthlyData = useMemo(() => {
    const data: Record<number, number> = {};
    records.forEach(r => {
      if (r.userId !== userId) return;
      const d = new Date(r.date);
      // Compare year and month using local time
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        data[day] = (data[day] || 0) + r.chapters;
      }
    });
    return data;
  }, [records, userId, year, month]);

  const renderDays = () => {
    const days = [];
    
    // Empty cells for offset
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 bg-slate-50/30" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const count = monthlyData[day] || 0;
      const today = new Date();
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      
      days.push(
        <div key={day} className={`h-16 sm:h-20 border-t border-l border-slate-100 relative p-1 transition-colors hover:bg-slate-50 ${isToday ? 'bg-indigo-50/30' : ''}`}>
          <span className={`text-[10px] font-bold ${isToday ? 'text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md' : 'text-slate-400'} absolute top-1 left-1`}>
            {day}
          </span>
          {count > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pt-3">
                <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
                    <span className="text-xl sm:text-2xl font-black text-indigo-600 leading-none filter drop-shadow-sm">
                        {count}
                    </span>
                    <span className="text-[8px] sm:text-[10px] text-indigo-400 font-bold -mt-0.5">장</span>
                </div>
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-4">
        {/* Navigation */}
        <div className="flex items-center justify-between">
             <h3 className="text-sm font-bold text-slate-500 pl-1">
                {year}년 {month + 1}월
             </h3>
             <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-700 shadow-sm hover:shadow">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-white rounded-md hover:text-indigo-600 transition-all">
                    오늘
                </button>
                <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-700 shadow-sm hover:shadow">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
        
        {/* Calendar Grid */}
        <div className="select-none">
            <div className="grid grid-cols-7 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                    <div key={d} className={`text-center text-xs font-bold py-2 ${i === 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 border-r border-b border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-100">
                {renderDays()}
            </div>
             <div className="mt-3 flex justify-end items-center gap-2 text-[10px] text-slate-400 font-medium">
                 <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    <span>읽은 장수</span>
                 </div>
                 <span className="text-slate-300">|</span>
                 <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>일요일</span>
                 </div>
             </div>
        </div>
    </div>
  );
};

export default CalendarView;