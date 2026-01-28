import React, { useState, useEffect } from 'react';
import { DepartmentId, Department, ReadingRecord } from '../types';
import { CheckCircle2, Calendar, Info, ShieldCheck, ChevronDown } from 'lucide-react';

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

const getKSTDateString = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstObj = new Date(utc + (9 * 60 * 60 * 1000));
  return kstObj.toISOString().split('T')[0];
};

const InputSection: React.FC<InputSectionProps> = ({ isLoggedIn, userDeptId, onLogin, onAdd, isAdminMode, departments, records, userId }) => {
  const [input, setInput] = useState('');
  const [date, setDate] = useState(getKSTDateString());
  const [isDateEditable, setIsDateEditable] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<DepartmentId | undefined>(userDeptId || (departments.length > 0 ? departments[0].id : ''));

  // 현재 날짜 체크 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      const todayKST = getKSTDateString();
      if (!isDateEditable && date !== todayKST) {
        setDate(todayKST);
      }
    }, 1000 * 60); // Check every minute
    return () => clearInterval(timer);
  }, [isDateEditable, date]);

  // 관리자 모드일 때는 선택된 부서를, 아닐 때는 자신의 부서를 사용
  const currentDeptId = isAdminMode ? (selectedDeptId || userDeptId) : userDeptId;
  
  // 날짜나 부서(관리자모드)가 변경되면 해당 날짜의 기존 기록을 찾아서 입력창에 표시
  useEffect(() => {
    // 부서나 날짜가 유효하지 않으면 패스
    if (!date) return;
    
    // 타겟 유저 ID 설정 (관리자면 'admin', 아니면 로그인 유저)
    const targetUserId = isAdminMode ? 'admin' : (userId || '');
    
    // 해당 조건에 맞는 기록 찾기
    const foundRecord = records.find(r => {
        const rDate = r.date.split('T')[0];
        const isDateMatch = rDate === date;

        if (isAdminMode) {
            // 관리자 모드: 날짜 + 관리자 기록 여부 + 부서 일치 확인
            return isDateMatch && r.isAdminRecord && r.departmentId === selectedDeptId;
        } else {
            // 일반 유저: 날짜 + 유저 ID 일치 확인
            return isDateMatch && r.userId === targetUserId;
        }
    });

    if (foundRecord) {
        setInput(foundRecord.chapters.toString());
    } else {
        setInput('');
    }
  }, [date, selectedDeptId, isAdminMode, records, userId]);


  // 1. 비로그인 상태 UI (관리자 모드가 아닐 때만 노출)
  if (!isLoggedIn && !isAdminMode) {
    return (
      <div className="w-full max-w-sm mx-auto text-center py-4">
         <div className="mb-6 space-y-2">
           <h3 className="text-xl font-black text-slate-800">나의 기록 추가하기</h3>
           <p className="text-slate-500 text-sm">로그인하고 우리 부서에 점수를 더해보세요!</p>
         </div>
         <button 
           onClick={onLogin}
           className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
         >
           <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
           구글 계정으로 시작하기
         </button>
         <p className="mt-4 text-[10px] text-slate-400">
           안전한 Google 로그인을 사용합니다.
         </p>
      </div>
    );
  }

  const myDept = departments.find(d => d.id === currentDeptId);

  // 2. 로그인 했으나 부서 정보가 없는 경우
  if (!myDept && !isAdminMode) return <div className="text-center text-slate-400 py-4">부서 정보를 불러오는 중...</div>;

  const handleInputChange = (value: string) => {
    if (/^\d*$/.test(value)) setInput(value);
  };

  const handleSubmit = () => {
    const amount = parseInt(input);
    if (isNaN(amount) || amount <= 0) return;
    
    // 관리자 모드에서는 targetDeptId와 isAdminRecord를 명시적으로 전달
    onAdd(amount, date, isAdminMode ? selectedDeptId : undefined, isAdminMode);
    // 수정 모드이므로 입력값을 초기화하지 않고, 변경된 값이 그대로 보이도록 유지할 수도 있지만
    // 사용성을 위해 보통 유지하거나 저장 알림을 줌. 여기선 날짜가 그대로라면 값이 유지되는게(useEffect 로직상) 자연스러움
    // 하지만 onAdd 실행 후 records가 업데이트되어 useEffect가 다시 돌면서 값을 채울 것임.
    // 일시적으로 비우는 것보다 UX상 놔두는게 나을 수도 있으나, 저장됨을 인지시키기 위해 깜빡임이나 알림이 있으면 좋음.
    // 일단 기존 로직대로 유지하되, useEffect가 다시 값을 채워줄 것이므로 setInput('')을 제거해도 되지만
    // 리액트 상태 업데이트 타이밍 고려하여 안전하게 둠 (records 변경 -> useEffect -> setInput)
  };

  // 3. 정상 입력 폼 UI
  return (
    <div className="w-full max-w-sm mx-auto">
        <div className={`p-1 rounded-2xl border shadow-sm ${isAdminMode ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-br from-indigo-50 to-slate-50 border-indigo-100'}`}>
            <div className="bg-white p-6 rounded-xl flex flex-col gap-5">
                
                {/* Department Info/Selector */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                    <div className="flex items-center gap-3 w-full">
                        {isAdminMode ? (
                            <div className="w-full space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                                    <span className="text-xs font-black text-amber-600 uppercase">관리자 기록 부여</span>
                                </div>
                                <div className="relative">
                                    <select 
                                        value={selectedDeptId} 
                                        onChange={(e) => setSelectedDeptId(e.target.value as DepartmentId)}
                                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all text-sm"
                                    >
                                        <option value="" disabled>부서 선택</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-slate-50 shadow-inner" style={{ color: myDept?.color }}>
                                    {myDept?.emoji}
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 font-bold">나의 소속</p>
                                    <h3 className="font-black text-slate-800 text-lg leading-none">{myDept?.name}</h3>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Input Fields */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">읽은 장수 (수정 가능)</label>
                        <div className="relative">
                            <input
                                type="tel"
                                value={input}
                                onChange={(e) => handleInputChange(e.target.value)}
                                placeholder="0"
                                className={`w-full pl-4 pr-12 py-4 border rounded-xl outline-none transition-all text-2xl font-black bg-slate-50 text-slate-900 focus:bg-white border-slate-200 ${isAdminMode ? 'focus:border-amber-600 focus:ring-4 focus:ring-amber-100/50' : 'focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50'}`}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">장</span>
                        </div>
                        <p className="text-[10px] text-slate-400 px-1 flex items-center gap-1 font-bold">
                            <Info className="w-2.5 h-2.5" /> 
                            {isAdminMode 
                                ? "관리자 기록은 장수 제한 없이 부서 점수에 전량 반영됩니다." 
                                : "일반 기록은 부서 점수에 1인당 하루 최대 4장까지만 합산됩니다."}
                        </p>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1 uppercase">
                                <Calendar className="w-3 h-3" /> 날짜 선택
                            </label>
                            <button onClick={() => setIsDateEditable(!isDateEditable)} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700">
                                {isDateEditable ? '완료' : '날짜 변경'}
                            </button>
                        </div>
                        <input
                            type="date"
                            value={date}
                            max={getKSTDateString()}
                            disabled={!isDateEditable}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 bg-white outline-none disabled:bg-slate-50 disabled:text-slate-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={!input || (isAdminMode && !selectedDeptId)}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl text-white text-base font-bold shadow-lg transition-all active:scale-95 mt-2 ${isAdminMode ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'} disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed`}
                >
                    {isAdminMode ? '관리자 점수 부여' : '기록 저장하기'} <CheckCircle2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
  );
};

export default InputSection;