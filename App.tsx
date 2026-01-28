import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReadingRecord, DepartmentId, DepartmentPopulations, PopulationLog, UserProfile, Department } from './types';
import { INITIAL_DEPARTMENTS, DEFAULT_GOOGLE_SHEET_URL, SYNC_API_BASE, SHARED_CLOUD_ID } from './constants';
import RaceTrack from './components/RaceTrack';
import InputSection from './components/InputSection';
import HistoryTable from './components/HistoryTable';
import Statistics from './components/Statistics';
import CalendarView from './components/CalendarView';
import { InstallPrompt } from './components/InstallPrompt';
import { 
  Trophy, BarChart3, BookOpen, Lock, Unlock, 
  Settings, Loader2, Share2, Check, LogIn, UserCircle, LogOut,
  Save, ChevronRight, FileSpreadsheet, AlertTriangle, Edit2, UserPen, Calendar,
  Database, Cloud, Download, Plus, Trash2, Palette
} from 'lucide-react';

// Firebase Imports (Auth Only)
import { auth, googleProvider, isConfigured } from './firebase';
import * as firebaseAuth from 'firebase/auth';

interface AppData {
  records: ReadingRecord[];
  popHistory: PopulationLog[];
  users?: UserProfile[];
  departments?: Department[]; // Dynamic departments
}

const App: React.FC = () => {
  // --- Auth & User State ---
  const [user, setUser] = useState<firebaseAuth.User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- Data State ---
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [popHistory, setPopHistory] = useState<PopulationLog[]>([
    { startDate: new Date(0).toISOString(), populations: { GIDEON: 10, DANIEL: 10, JOSEPH: 10 } }
  ]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  // --- UI State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isChangingDept, setIsChangingDept] = useState(false);
  
  // 이름 입력 상태
  const [inputName, setInputName] = useState('');

  // --- Admin State ---
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [tempPopulations, setTempPopulations] = useState<DepartmentPopulations>({});
  const [popApplyDate, setPopApplyDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Admin: New Department State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptEmoji, setNewDeptEmoji] = useState('🐢');
  const [newDeptColor, setNewDeptColor] = useState('#6366f1');

  const [googleSheetUrl, setGoogleSheetUrl] = useState(DEFAULT_GOOGLE_SHEET_URL);
  const isFetchingRef = useRef(false);
  const lastSaveTimeRef = useRef<number>(0); // 저장 직후 동기화로 인한 롤백 방지용

  // Initialize temp populations when departments change
  useEffect(() => {
    if (popHistory.length > 0) {
      const lastPop = popHistory[popHistory.length - 1].populations;
      const initialPop: DepartmentPopulations = {};
      departments.forEach(d => {
        initialPop[d.id] = lastPop[d.id] || 1;
      });
      setTempPopulations(initialPop);
    }
  }, [departments, popHistory]);

  // --------------------------------------------------------------------------
  // 1. Auth Management
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = firebaseAuth.onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const foundUser = allUsers.find(u => u.uid === currentUser.uid);
        
        if (foundUser) {
           setUserProfile(foundUser);
           if (!inputName) setInputName(foundUser.displayName);
        } else {
           const initialName = currentUser.displayName || '이름 없음';
           setUserProfile({
             uid: currentUser.uid,
             displayName: initialName,
             email: currentUser.email,
           });
           if (!inputName) setInputName(initialName);
        }
      } else {
        setUserProfile(null);
        setInputName('');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [allUsers]);

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      alert("Firebase 인증 설정이 완료되지 않았습니다.");
      return;
    }
    try {
      await firebaseAuth.signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error(error);
      alert(`로그인 실패: ${error.message}\n설정을 확인해주세요.`);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    if(window.confirm("로그아웃 하시겠습니까?")) {
      await firebaseAuth.signOut(auth);
      setIsAdminMode(false);
      setInputName('');
    }
  };

  // --------------------------------------------------------------------------
  // 2. Data Sync
  // --------------------------------------------------------------------------
  useEffect(() => {
    loadFromGoogleSheet(googleSheetUrl);
    const interval = setInterval(() => {
      if (!document.hidden) triggerSync(true);
    }, 5000);
    const handleVisibilityChange = () => {
      if (!document.hidden) triggerSync(true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [googleSheetUrl]);

  const triggerSync = (silent: boolean) => {
    // 저장 직후 10초간은 자동 동기화 무시 (서버 반영 지연으로 인한 롤백 방지)
    if (Date.now() - lastSaveTimeRef.current < 10000) return;
    if (isFetchingRef.current) return;
    loadFromGoogleSheet(googleSheetUrl, silent);
  };

  const loadFromGoogleSheet = async (url: string, silent = false) => {
    if (!silent) setIsLoading(true);
    isFetchingRef.current = true;
    try {
      const uniqueUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res = await fetch(uniqueUrl);
      if (res.ok) {
        const data = await res.json();
        if (data) {
           updateLocalState(data);
        }
      }
    } catch (e) {
      if (!silent) console.warn("데이터 로드 실패");
    } finally {
      if (!silent) setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const updateLocalState = (data: AppData) => {
    // 저장 직후 10초간은 외부 데이터 반영 차단 (이중 안전장치)
    if (Date.now() - lastSaveTimeRef.current < 10000) return;

    if (data.departments && Array.isArray(data.departments)) {
      setDepartments(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data.departments)) return data.departments;
        return prev;
      });
    }
    if (data.records && Array.isArray(data.records)) {
      setRecords(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data.records)) return data.records;
        return prev;
      });
    }
    if (data.popHistory && Array.isArray(data.popHistory)) {
      setPopHistory(prev => {
        const sortedHistory = data.popHistory.sort((a, b) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
        if (JSON.stringify(prev) !== JSON.stringify(sortedHistory)) return sortedHistory;
        return prev;
      });
    }
    if (data.users && Array.isArray(data.users)) {
      setAllUsers(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data.users)) return data.users;
        return prev;
      });
    }
  };

  const saveData = async (newRecords: ReadingRecord[], newHistory: PopulationLog[], newUsers: UserProfile[] = allUsers, newDepartments: Department[] = departments) => {
    setIsSyncing(true);
    lastSaveTimeRef.current = Date.now(); // 저장 시작 시점 기록

    // Optimistic Update (UI 즉시 반영)
    setRecords(newRecords);
    setPopHistory(newHistory);
    setAllUsers(newUsers);
    setDepartments(newDepartments);

    const payload = { 
      records: newRecords, 
      popHistory: newHistory, 
      users: newUsers,
      departments: newDepartments 
    };
    
    try {
      await fetch(googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify(payload)
      });

      fetch(`${SYNC_API_BASE}/${SHARED_CLOUD_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Backup failed:', err));
      
      // 저장 성공으로 간주하고 다시 타임스탬프 갱신
      lastSaveTimeRef.current = Date.now();

      // 3초 후 강제 동기화 시도 (단, triggerSync 내부에서 10초 쿨타임 체크하므로 실질적으로는 스킵될 수 있음. 
      // 이는 의도된 동작으로, 사용자가 계속 앱을 켜두면 10초 후 자연스럽게 동기화됨)
      setTimeout(() => {
        if (Date.now() - lastSaveTimeRef.current >= 10000) triggerSync(true);
      }, 3000);

    } catch (e) {
      alert("저장 실패! 인터넷 연결을 확인해주세요.");
      // 실패 시 쿨타임 해제하여 다시 불러오도록 함
      lastSaveTimeRef.current = 0;
    } finally {
      setIsSyncing(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. Actions
  // --------------------------------------------------------------------------
  const handleSelectDepartment = async (deptId: DepartmentId) => {
    if (!user) return;
    if (!inputName.trim()) {
        alert("이름을 입력해주세요.");
        return;
    }
    
    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: inputName.trim(), 
      email: user.email,
      departmentId: deptId
    };

    setUserProfile(newProfile);
    setIsChangingDept(false);

    const otherUsers = allUsers.filter(u => u.uid !== user.uid);
    const nextAllUsers = [...otherUsers, newProfile];
    setAllUsers(nextAllUsers);

    await saveData(records, popHistory, nextAllUsers);
  };

  const startEditing = () => {
      if (userProfile) {
          setInputName(userProfile.displayName);
      }
      setIsChangingDept(true);
  };

  const addRecord = async (chapters: number, customDate?: string, targetDeptId?: DepartmentId, isAdminRecord: boolean = false) => {
    if (!isAdminRecord && (!user || !userProfile?.departmentId)) return;
    if (isAdminRecord && !targetDeptId) return;

    const recordDate = customDate ? new Date(customDate) : new Date();
    const now = new Date();
    if (customDate) recordDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    const newRecord: ReadingRecord = {
      id: crypto.randomUUID(),
      departmentId: targetDeptId || userProfile!.departmentId!,
      userId: user?.uid || 'admin',
      userName: userProfile?.displayName || '관리자',
      chapters,
      date: recordDate.toISOString(),
      isAdminRecord: isAdminRecord
    };
    
    const nextRecords = [newRecord, ...records];
    setRecords(nextRecords);
    await saveData(nextRecords, popHistory);
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm('기록을 삭제하시겠습니까? (복구 불가)')) return;
    const nextRecords = records.filter(r => r.id !== id);
    setRecords(nextRecords);
    await saveData(nextRecords, popHistory);
  };

  // --- Department Management (Admin) ---
  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) {
      alert('부서 이름을 입력해주세요.');
      return;
    }
    const newId = crypto.randomUUID();
    const newDept: Department = {
      id: newId,
      name: newDeptName.trim(),
      emoji: newDeptEmoji,
      color: newDeptColor
    };
    const nextDepts = [...departments, newDept];
    
    // Update temp populations for UI consistency
    setTempPopulations(prev => ({ ...prev, [newId]: 10 }));
    
    setDepartments(nextDepts);
    setNewDeptName('');
    await saveData(records, popHistory, allUsers, nextDepts);
    alert(`${newDept.name} 부서가 추가되었습니다.`);
  };

  const handleDeleteDepartment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 버튼 클릭시 이벤트 전파 방지
    if (!window.confirm('정말 이 부서를 삭제하시겠습니까?\n해당 부서의 기록은 유지되지만, 레이스 및 선택 목록에서 사라집니다.')) return;
    
    // 1. UI 즉시 반영 (낙관적 업데이트)
    const nextDepts = departments.filter(d => d.id !== id);
    setDepartments(nextDepts); // 즉시 상태 변경

    // 2. 서버 저장
    await saveData(records, popHistory, allUsers, nextDepts);
    
    // 3. 완료 피드백
    alert('부서가 삭제되었습니다.');
  };

  const handleApplyPopulations = async () => {
    if (!popApplyDate) {
      alert('적용 시작 날짜를 입력해주세요.');
      return;
    }
    const startDate = new Date(popApplyDate).toISOString();
    const otherEntries = popHistory.filter(h => h.startDate.split('T')[0] !== popApplyDate);
    const newEntry = { startDate: startDate, populations: { ...tempPopulations } };
    const nextHistory = [...otherEntries, newEntry].sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    
    setPopHistory(nextHistory);
    await saveData(records, nextHistory);
    alert(`인원 설정이 저장되었습니다.\n적용일: ${popApplyDate}`);
  };

  const handleAdminLogin = () => {
    if (adminInput === 'djcjbch') {
      setIsAdminMode(true);
      setAdminInput('');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleGoogleSheetSave = () => {
    const targetUrl = googleSheetUrl || DEFAULT_GOOGLE_SHEET_URL;
    setGoogleSheetUrl(targetUrl);
    loadFromGoogleSheet(targetUrl);
    alert('구글 스프레드시트 주소가 갱신되었습니다.');
  };

  const handleLoadBackup = async () => {
    if (!window.confirm('현재 데이터를 덮어쓰고 최신 백업본(JsonBlob)을 불러오시겠습니까?')) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`${SYNC_API_BASE}/${SHARED_CLOUD_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
           // 백업 복원 시에는 쿨타임 무시하고 즉시 반영
           lastSaveTimeRef.current = 0; 
           updateLocalState(data);
           alert('백업 데이터가 복구되었습니다.');
        } else {
           alert('백업 데이터가 비어있습니다.');
        }
      } else {
        throw new Error('Fetch failed');
      }
    } catch (e) {
      alert('백업 불러오기 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // --------------------------------------------------------------------------
  // View: Setup Required
  // --------------------------------------------------------------------------
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
         <div className="bg-white p-8 rounded-3xl shadow-xl">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">설정 필요</h2>
            <p className="text-sm text-slate-500">firebase.ts 파일을 확인해주세요.</p>
         </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // View: Loading
  // --------------------------------------------------------------------------
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-lg font-black text-slate-800">데이터 불러오는 중...</h2>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // View: Department Selection
  // --------------------------------------------------------------------------
  if (user && (!userProfile?.departmentId || isChangingDept)) {
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
           <div className="text-center space-y-2">
             <h2 className="text-2xl font-black text-slate-800">
               {isChangingDept ? '내 정보 수정' : '환영합니다!'}
             </h2>
             <p className="text-slate-500 font-medium">이름과 소속을 설정해주세요.</p>
           </div>
           
           <div className="bg-white p-5 rounded-2xl shadow-sm space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <UserPen className="w-3 h-3" /> 이름 (실명 입력)
                </label>
                <input 
                  type="text" 
                  value={inputName} 
                  onChange={(e) => setInputName(e.target.value)} 
                  placeholder="예: 홍길동"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
           </div>

           <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 pl-1">소속 부서 선택 (저장)</label>
             <div className="grid grid-cols-1 gap-3">
               {departments.map(dept => (
                 <button
                   key={dept.id}
                   onClick={() => handleSelectDepartment(dept.id)}
                   className="bg-white p-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-indigo-500 flex items-center justify-between group transition-all"
                 >
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner bg-slate-50" style={{ color: dept.color }}>
                       {dept.emoji}
                     </div>
                     <span className="font-bold text-base text-slate-700 group-hover:text-indigo-600 transition-colors">{dept.name}</span>
                   </div>
                   {userProfile?.departmentId === dept.id && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                      </div>
                   )}
                 </button>
               ))}
             </div>
           </div>
           
           {isChangingDept && (
             <button onClick={() => setIsChangingDept(false)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors">
               취소
             </button>
           )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // View: Main Dashboard
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-32 relative">
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-[900] text-slate-800 leading-none tracking-tight">
                부서별<span className="text-indigo-600">성경읽기대항전</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <InstallPrompt />
             {isSyncing && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
             {user ? (
               <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                 {user.photoURL ? (
                   <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-400"><UserCircle className="w-5 h-5" /></div>
                 )}
               </div>
             ) : (
                <button 
                  onClick={handleGoogleLogin} 
                  className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-indigo-200"
                >
                  <LogIn className="w-3 h-3" /> 로그인
                </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        
        {/* User Greeting Info (Modified: Removed Cumulative Count) */}
        {user && userProfile?.departmentId && (
            <section className="flex items-center justify-between px-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div>
                <p className="text-xs font-bold text-slate-400 mb-1">나의 소속</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-800">
                      {departments.find(d => d.id === userProfile.departmentId)?.name || '삭제된 부서'}
                  </h2>
                  <button 
                    onClick={startEditing}
                    className="text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 p-1.5 rounded-lg transition-all"
                    title="정보 수정"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-2">
                   <span className="bg-indigo-50 text-indigo-600 text-[11px] px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                    {userProfile.displayName}
                   </span>
                </div>
            </div>
            <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 bg-slate-50 px-3 py-2 rounded-xl shadow-sm border border-slate-100 h-fit">
                <LogOut className="w-3 h-3" /> 로그아웃
            </button>
            </section>
        )}

        {/* 1. Race Track */}
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="p-6 pb-2 flex items-center gap-2.5">
            <div className="bg-amber-100 p-2 rounded-xl">
              <Trophy className="text-amber-600 w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-slate-800">실시간 순위</h2>
          </div>
          <div className="p-2 sm:p-6">
            <RaceTrack records={records} popHistory={popHistory} departments={departments} />
          </div>
        </section>

        {/* 2. Input Section */}
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-xl">
              <Save className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-black text-slate-800">오늘 읽은 말씀 기록</h2>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-slate-50/50">
            <InputSection 
              isLoggedIn={!!user}
              userDeptId={userProfile?.departmentId} 
              onLogin={handleGoogleLogin}
              onAdd={addRecord}
              isAdminMode={isAdminMode} 
              departments={departments}
            />
          </div>
        </section>

        {/* Calendar Section */}
        {user && (
           <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                 <div className="bg-violet-50 p-2 rounded-xl">
                   <Calendar className="w-5 h-5 text-violet-600" />
                 </div>
                 <h2 className="text-lg font-black text-slate-800">나의 독서 캘린더</h2>
              </div>
              <div className="p-6">
                 <CalendarView records={records} userId={user.uid} />
              </div>
           </section>
        )}

        {/* 3. Stats & History */}
        <div className="grid grid-cols-1 gap-6">
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-xl">
                <BarChart3 className="text-blue-600 w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-slate-800">통계 분석</h2>
            </div>
            <div className="p-6"><Statistics records={records} popHistory={popHistory} isAdmin={isAdminMode} departments={departments} /></div>
          </section>

          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2 rounded-xl">
                  {/* eslint-disable-next-line */}
                  <Save className="text-emerald-600 w-5 h-5" /> 
                </div>
                <h2 className="text-lg font-black text-slate-800">최신 인증</h2>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </div>
            <div className="p-4"><HistoryTable records={records} onDelete={deleteRecord} isAdmin={isAdminMode} departments={departments} /></div>
          </section>
        </div>

        {/* Share Link Button */}
        <div className="flex justify-center pt-4">
           <button 
            onClick={copyLink}
            className="flex items-center gap-2 bg-white border border-indigo-100 text-indigo-600 px-6 py-3 rounded-full shadow-lg shadow-indigo-50 active:scale-95 transition-all"
           >
             {copyFeedback ? <Check className="w-4 h-4"/> : <Share2 className="w-4 h-4"/>}
             <span className="font-bold text-sm">앱 공유하기</span>
           </button>
        </div>

        {/* Footer Admin Toggle */}
        <div className="flex justify-center pt-4 pb-10">
          <button 
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Lock className="w-3 h-3" />
            <span className="text-xs font-bold">{showAdminPanel ? '관리자 닫기' : '관리자 설정'}</span>
          </button>
        </div>

        {/* Admin Panel */}
        {showAdminPanel && (
          <section className="animate-in slide-in-from-bottom-5 duration-300 pb-20">
            <div className="bg-[#1e293b] rounded-[2rem] p-6 text-white shadow-2xl">
              {!isAdminMode ? (
                <div className="flex gap-2">
                  <input type="password" value={adminInput} onChange={(e) => setAdminInput(e.target.value)} placeholder="관리자 코드" className="flex-1 bg-slate-800/80 border border-slate-600 rounded-xl px-4 py-3 text-sm font-bold text-center outline-none focus:border-indigo-500" />
                  <button onClick={handleAdminLogin} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-500">확인</button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-black"><Unlock className="w-4 h-4" /> ADMIN MODE</div>
                    <button onClick={() => setIsAdminMode(false)} className="text-xs text-slate-400">로그아웃</button>
                  </div>

                  {/* 1. Department Management (NEW) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-300">부서 관리 (추가/삭제)</h3>
                    </div>
                    
                    {/* List Existing */}
                    <div className="space-y-2">
                      {departments.map(dept => (
                        <div key={dept.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-700" style={{ color: dept.color }}>{dept.emoji}</div>
                              <span className="font-bold">{dept.name}</span>
                           </div>
                           <button 
                             type="button"
                             onClick={(e) => handleDeleteDepartment(dept.id, e)} 
                             className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                             title="부서 삭제"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                    </div>

                    {/* Add New Form */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-3">
                        <p className="text-xs text-slate-400 font-bold mb-2">새 부서 추가</p>
                        <div className="flex gap-2">
                           <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="부서명" className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white" />
                           <input type="text" value={newDeptEmoji} onChange={e => setNewDeptEmoji(e.target.value)} placeholder="이모지" className="w-16 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-center text-white" />
                        </div>
                        <div className="flex gap-2 items-center">
                           <Palette className="w-4 h-4 text-slate-400" />
                           <input type="color" value={newDeptColor} onChange={e => setNewDeptColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent" />
                           <button onClick={handleAddDepartment} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2">
                             <Plus className="w-3 h-3" /> 부서 추가
                           </button>
                        </div>
                    </div>
                  </div>

                  {/* 2. 인원 설정 */}
                  <div className="space-y-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-300">부서 인원 조정</h3>
                        <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-400">적용 시작일:</span>
                             <input 
                                type="date" 
                                value={popApplyDate}
                                onChange={(e) => setPopApplyDate(e.target.value)}
                                className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 outline-none"
                             />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {departments.map(dept => (
                        <div key={dept.id} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                          <span className="text-xs text-slate-400 flex-1">{dept.name}</span>
                          <input type="number" value={tempPopulations[dept.id] || ''} onChange={(e) => setTempPopulations(prev => ({ ...prev, [dept.id]: parseInt(e.target.value) || 1 }))} className="w-12 bg-transparent text-right text-white font-black text-sm outline-none" />
                        </div>
                      ))}
                    </div>
                    <button onClick={handleApplyPopulations} className="w-full bg-slate-700 hover:bg-slate-600 rounded-xl p-3 font-bold text-sm text-slate-200">인원 변경사항 저장</button>
                  </div>
                  
                  {/* 3. 구글 시트 & 백업 */}
                  <div className="space-y-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-between">
                       <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                         <Settings className="w-4 h-4" /> 데이터 설정
                       </h3>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="bg-green-900/30 p-3 rounded-xl border border-green-500/30">
                           <div className="flex items-center gap-2 mb-2">
                            <FileSpreadsheet className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-bold text-green-300">구글 시트 연동 중</span>
                          </div>
                          <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={googleSheetUrl}
                                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
                                placeholder="URL"
                              />
                             <button onClick={handleGoogleSheetSave} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold">
                               수정
                             </button>
                          </div>
                        </div>
                        <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                           <button 
                             onClick={handleLoadBackup}
                             className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2"
                           >
                             <Download className="w-3 h-3" /> 최신 백업본 불러오기 (JsonBlob)
                           </button>
                        </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;