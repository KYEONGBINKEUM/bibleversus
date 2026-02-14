import React, { useState } from 'react';
import { ReadingRecord, Department } from '../types';
import { Trash2, ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';

interface HistoryTableProps {
  records: ReadingRecord[];
  onDelete: (id: string) => void;
  isAdmin: boolean;
  departments: Department[];
  pendingIds: Set<string>;
}

const ITEMS_PER_PAGE = 20;

const HistoryTable: React.FC<HistoryTableProps> = ({ records, onDelete, isAdmin, departments, pendingIds }) => {
  const [currentPage, setCurrentPage] = useState(1);

  if (records.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-400 italic">아직 기록이 없습니다. 첫 읽기를 시작해보세요!</p>
      </div>
    );
  }

  const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRecords = records.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="py-4 font-semibold text-slate-500 px-2 pl-4">
                {isAdmin ? '날짜/이름' : '날짜/상태'}
              </th>
              <th className="py-4 font-semibold text-slate-500 px-2">부서</th>
              <th className="py-4 font-semibold text-slate-500 px-2 text-right pr-4">장수</th>
              {isAdmin && <th className="py-4 font-semibold text-slate-500 px-2 text-center w-10">삭제</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentRecords.map((record) => {
              const dept = departments.find(d => d.id === record.departmentId);
              const isPending = pendingIds.has(record.id);
              
              const kstDateString = new Date(record.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
              const [_, m, d] = kstDateString.split('-').map(Number);
              const dateDisplay = `${m}월 ${d}일`;
              
              return (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-3 px-2 pl-4">
                      <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-xs font-bold">{dateDisplay}</span>
                            {!isAdmin && (
                                isPending ? (
                                    <span title="서버 동기화 중..." className="text-amber-400"><Loader2 className="w-3 h-3 animate-spin" /></span>
                                ) : (
                                    <span title="서버 인증 완료" className="text-emerald-500"><CheckCircle2 className="w-3 h-3" /></span>
                                )
                            )}
                          </div>
                          {isAdmin && (
                            <span className="text-slate-400 text-[10px] mt-0.5">{record.userName}</span>
                          )}
                      </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dept?.color }} />
                      <span className="font-bold text-xs text-slate-600">{dept?.name || '삭제된 부서'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right pr-4">
                       <span className={`font-black text-sm ${isPending ? 'text-slate-400' : 'text-indigo-600'}`}>{record.chapters}</span>
                       <span className="text-xs text-slate-400 ml-0.5">장</span>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-2 text-center">
                      <button 
                        onClick={() => onDelete(record.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="기록 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 mt-2 border-t border-slate-50">
          <button 
            onClick={handlePrevPage} 
            disabled={currentPage === 1}
            className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-xs font-bold text-slate-500">
            {currentPage} / {totalPages}
          </span>
          
          <button 
            onClick={handleNextPage} 
            disabled={currentPage === totalPages}
            className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryTable;