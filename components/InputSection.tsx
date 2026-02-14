import React, { useState, useEffect } from 'react';
import { DepartmentId, Department, ReadingRecord } from '../types';
import { CheckCircle2, Calendar, Info, ShieldCheck, ChevronDown, Trash2 } from 'lucide-react';

interface InputSectionProps {
  isLoggedIn: boolean;
  userDeptId?: DepartmentId;
  onLogin: () => void;
  onAdd: (chapters: number, date?: string, targetDeptId?: DepartmentId, isAdminRecord?: boolean) => void;
  isAdminMode: boolean;
  departments: Department[];
  records: ReadingRecord[];
  userId?: string;
}

/**
 * Robust KST Date Formatter
 */
const formatKSTDate = (date: Date | string | number) => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

const InputSection: React.FC<InputSectionProps> = ({ isLoggedIn, userDeptId, onLogin, onAdd, isAdminMode, departments, records, userId }) => {
  const [input, setInput] = useState('');
  const [date, setDate] = useState(formatKSTDate(new Date()));
  const [isDateEditable, setIsDateEditable] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<DepartmentId | undefined>(userDeptId || (departments.length > 0 ? departments[0].id : ''));

  // 현재 날짜 체크 타이머 (KST 기준)
  useEffect(() => {
    const timer = setInterval(() => {
      const todayKST = formatKSTDate(new Date());
      if (!isDateEditable && date !== todayKST) {
        setDate(todayKST);
      }
    }, 1000 * 60);
    return () => clearInterval(timer);
  }, [isDateEditable, date]);

  // 관리자 모드일 때는 선택된 부서를, 아닐 때는 자신의 부서를 사용
  const currentDeptId = isAdminMode ? (selectedDeptId || userDeptId) : userDeptId;
  
  // 날짜나 부서가 변경되면 해당 날짜의 기존 기록을 찾아서 입력창에 표시
  useEffect(() => {
    if (!date) return;
    const targetUserId = isAdminMode ? 'admin' : (userId || '');
    
    // 해당 조건에 맞는 기록 찾기 (날짜 포맷 통일)
    const foundRecord = records.find(r => {
        const rDate = formatKSTDate(r.date);
        const isDateMatch = rDate === date;
        if (isAdminMode) {
            return isDateMatch && r.isAdminRecord && r.departmentId === selectedDeptId;
        } else {
            return isDateMatch && r.userId === targetUserId;
        }
    });

    if (foundRecord) {
        setInput(foundRecord.chapters.toString());
    } else {
        // [Safety] 기존 기록이 없으면 빈칸으로 초기화 (0이 아닌 빈칸으로 두어 중복 제출 방지)
        setInput('');
    }
  }, [date, selectedDeptId, isAdminMode, records, userId]);


  if (!isLoggedIn && !isAdminMode) {
    return (
      <div className="w-full max-w-sm mx-auto text-center py-4">
         <div className="mb-6 space-y-2">
           <h3 className="text-xl font-black text-slate-800">기록 추가하기</h3>
           <p className="text-slate-500 text-sm">로그인 후 우리 부서 점수를 높여보세요!</p>
         </div>
         <button onClick={onLogin} className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 shadow-sm">
           <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
           구글 계정으로 시작하기
         </button>
      </div>
    );
  }

  const myDept = departments.find(d => d.id === currentDeptId);
  if (!myDept && !isAdminMode) return <div className="text-center text-slate-400 py-4">부서 확인 중...</div>;

  const handleInputChange = (value: string) => {
    if (/^\d*$/.test(value)) setInput(value);
  };

  const handleSubmit = () => {
    if (input === '') return;
    const amount = parseInt(input);
    if (isNaN(amount) || amount < 0) return;
    onAdd(amount, date, isAdminMode ? selectedDeptId : undefined, isAdminMode);
  };

  const isZeroInput = input === '0' || parseInt(input) === 0;

  return (
    <div className="w-full max-w-sm mx-auto">
        <div className={`p-1 rounded-2xl border shadow-sm ${isAdminMode ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className="bg-white p-6 rounded-xl flex flex-col gap-5">
                <div className="pb-2 border-b border-slate-50">
                    {isAdminMode ? (
                        <div className="w-full space-y-2">
                            <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-amber-500" /><span className="text-xs font-black text-amber-600 uppercase">관리자 기록 부여</span></div>
                            <div className="relative">
                                <select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value as DepartmentId)} className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none">
                                    <option value="" disabled>부서 선택</option>
                                    {departments.map(d => (<option key={d.id} value={d.id}>{d.emoji} {d.name}</option>))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-slate-50 shadow-inner" style={{ color: myDept?.color }}>{myDept?.emoji}</div>
                            <div><p className="text-xs text-slate-400 font-bold">소속 부서</p><h3 className="font-black text-slate-800 text-lg leading-none">{myDept?.name}</h3></div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">읽은 장수</label>
                        <div className="relative">
                            <input type="tel" value={input} onChange={(e) => handleInputChange(e.target.value)} placeholder="0" className={`w-full pl-4 pr-12 py-4 border rounded-xl outline-none transition-all text-2xl font-black bg-slate-50 text-slate-900 focus:bg-white border-slate-200`}/>
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">장</span>
                        </div>
                        <p className="text-[10px] text-slate-400 px-1 font-bold"><Info className="inline w-2.5 h-2.5 mr-1" />{isAdminMode ? "관리자 점수는 제한 없이 전량 반영됩니다." : "일반 점수는 인당 하루 최대 4장까지 합산됩니다."}</p>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1"><Calendar className="w-3 h-3" /> 날짜</label>
                            <button onClick={() => setIsDateEditable(!isDateEditable)} className="text-[11px] font-bold text-indigo-600">{isDateEditable ? '완료' : '변경'}</button>
                        </div>
                        <input type="date" value={date} max={formatKSTDate(new Date())} disabled={!isDateEditable} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-white disabled:bg-slate-50 transition-colors" />
                    </div>
                </div>

                <button onClick={handleSubmit} disabled={input === '' || (isAdminMode && !selectedDeptId)} className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold shadow-lg transition-all active:scale-95 ${isZeroInput ? 'bg-red-500' : (isAdminMode ? 'bg-amber-600' : 'bg-indigo-600')} disabled:bg-slate-300`}>
                    {isZeroInput ? (<>기록 삭제 <Trash2 className="w-5 h-5" /></>) : (<>{isAdminMode ? '점수 부여' : '기록 저장'} <CheckCircle2 className="w-5 h-5" /></>)}
                </button>
            </div>
        </div>
    </div>
  );
};

export default InputSection;