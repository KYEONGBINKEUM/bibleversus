import React, { useState, useEffect, useRef } from 'react';
import { ReadingRecord, DepartmentId, DepartmentPopulations, PopulationLog, UserProfile, Department } from './types';
import { INITIAL_DEPARTMENTS, DEFAULT_GOOGLE_SHEET_URL, LOCAL_STORAGE_KEY } from './constants';
import RaceTrack from './components/RaceTrack';
import InputSection from './components/InputSection';
import HistoryTable from './components/HistoryTable';
import Statistics from './components/Statistics';
import CalendarView from './components/CalendarView';
import { InstallPrompt } from './components/InstallPrompt';
import { 
  Trophy, BarChart3, BookOpen, Lock, Unlock, 
  Loader2, Check, LogIn, UserCircle, LogOut,
  Save, ChevronRight, Edit2, Calendar,
  Trash2
} from 'lucide-react';

// Firebase Imports (Auth Only)
import { auth, googleProvider, isConfigured } from './firebase';
// Fix: Separated type and function imports from firebase/auth to resolve export member errors
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import type { User } from 'firebase/auth';

interface AppData {
  records: ReadingRecord[];
  popHistory: PopulationLog[];
  users?: UserProfile[];
  departments?: Department[];
}

const formatKSTDate = (date: Date | string | number) => {
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

const App: React.FC = () => {
  // Use User interface directly from firebase/auth
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [popHistory, setPopHistory] = useState<PopulationLog[]>([
    { startDate: new Date(0).toISOString(), populations: { GIDEON: 10, DANIEL: 10, JOSEPH: 10 } }
  ]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChangingDept, setIsChangingDept] = useState(false);
  const [inputName, setInputName] = useState('');

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [tempPopulations, setTempPopulations] = useState<DepartmentPopulations>({});
  const [popApplyDate, setPopApplyDate] = useState<string>(formatKSTDate(new Date()));

  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptEmoji, setNewDeptEmoji] = useState('🐢');
  const [newDeptColor, setNewDeptColor] = useState('#6366f1');

  const [googleSheetUrl] = useState(DEFAULT_GOOGLE_SHEET_URL);
  
  const isFetchingRef = useRef(false);
  
  const PENDING_RECORDS_KEY = 'confirmed_pending_v3';
  const PENDING_DELETES_KEY = 'confirmed_deletes_v3';

  const getPendingRecords = (): ReadingRecord[] => {
    try {
      const data = localStorage.getItem(PENDING_RECORDS_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.filter((r: any) => Date.now() - (r._ts || 0) < 43200000);
    } catch(e) { return []; }
  };

  const getPendingDeletes = (): {id: string, _ts: number}[] => {
    try {
      const data = localStorage.getItem(PENDING_DELETES_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.filter((r: any) => Date.now() - (r._ts || 0) < 43200000);
    } catch(e) { return []; }
  };

  useEffect(() => {
    if (popHistory.length > 0) {
      const lastPop = popHistory[popHistory.length - 1].populations;
      const initialPop: DepartmentPopulations = {};
      departments.forEach(d => { initialPop[d.id] = lastPop[d.id] || 1; });
      setTempPopulations(initialPop);
    }
  }, [departments, popHistory]);

  useEffect(() => {
    if (!isConfigured || !auth) { setAuthLoading(false); return; }
    // Call modular onAuthStateChanged directly
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const foundUser = allUsers.find(u => u.uid === currentUser.uid);
        if (foundUser) {
           setUserProfile(foundUser);
           if (!inputName) setInputName(foundUser.displayName);
        } else {
           const initialName = currentUser.displayName || '이름 없음';
           setUserProfile({ uid: currentUser.uid, displayName: initialName, email: currentUser.email });
           if (!inputName) setInputName(initialName);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [allUsers]);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed: AppData = JSON.parse(saved);
        if (parsed) {
           if(parsed.departments) setDepartments(parsed.departments);
           if(parsed.records) setRecords(parsed.records);
           if(parsed.popHistory) setPopHistory(parsed.popHistory);
           if(parsed.users) setAllUsers(parsed.users);
           setIsLoading(false);
        }
      } catch (e) {}
    }
    loadFromGoogleSheet(googleSheetUrl, true);

    const interval = setInterval(() => { if (!document.hidden) triggerSync(true); }, 15000); 
    const handleVisibilityChange = () => { if (!document.hidden) triggerSync(true); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [googleSheetUrl]);

  const triggerSync = (silent: boolean) => {
    if (isFetchingRef.current) return;
    loadFromGoogleSheet(googleSheetUrl, silent);
  };

  const loadFromGoogleSheet = async (url: string, silent = false) => {
    if (!silent) setIsLoading(true);
    isFetchingRef.current = true;
    try {
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data) updateLocalState(data);
      }
    } catch (e) {
      console.warn("Load failed");
    } finally {
      if (!silent) setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const updateLocalState = (data: AppData) => {
    if (data.records && Array.isArray(data.records)) {
      setRecords(prevRecords => {
        if (prevRecords.length > 5 && data.records.length === 0) return prevRecords;

        const serverRecords = [...data.records];
        const pending = getPendingRecords();
        const deletes = getPendingDeletes();
        
        const stillPending = pending.filter(p => !serverRecords.find(s => s.id === p.id));
        localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(stillPending));

        const stillDeleting = deletes.filter(d => serverRecords.find(s => s.id === d.id));
        localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(stillDeleting));

        const deleteIdsSet = new Set(stillDeleting.map(d => d.id));
        let merged = serverRecords.filter(s => !deleteIdsSet.has(s.id));
        
        stillPending.forEach(p => {
          if (!merged.find(m => m.id === p.id)) {
            merged.unshift(p);
          }
        });

        const result = merged;
        try { 
            const updatedData = { ...data, records: result };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedData)); 
        } catch(e) {}
        
        return JSON.stringify(prevRecords) !== JSON.stringify(result) ? result : prevRecords;
      });
    }

    if (data.departments) setDepartments(prev => JSON.stringify(prev) !== JSON.stringify(data.departments) ? data.departments : prev);
    if (data.popHistory) setPopHistory(prev => JSON.stringify(prev) !== JSON.stringify(data.popHistory) ? data.popHistory : prev);
    if (data.users) setAllUsers(prev => JSON.stringify(prev) !== JSON.stringify(data.users) ? data.users : prev);
  };

  const saveData = async (newRecords: ReadingRecord[], newHistory: PopulationLog[], newUsers: UserProfile[] = allUsers, newDepartments: Department[] = departments) => {
    setIsSyncing(true);

    setRecords(newRecords);
    setPopHistory(newHistory);
    setAllUsers(newUsers);
    setDepartments(newDepartments);

    const payload = { records: newRecords, popHistory: newHistory, users: newUsers, departments: newDepartments };
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload)); } catch(e) {}
    
    try {
      await fetch(googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Sync warning - saved locally");
    } finally {
      setIsSyncing(false);
      setTimeout(() => triggerSync(true), 3000);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isConfigured || !auth || !googleProvider) return;
    try { 
      // Call modular signInWithPopup function
      await signInWithPopup(auth, googleProvider); 
    } 
    catch (e) { alert("로그인 실패"); }
  };

  const handleSelectDepartment = async (deptId: DepartmentId) => {
    if (!user || !inputName.trim()) return;
    const newProfile = { uid: user.uid, displayName: inputName.trim(), email: user.email, departmentId: deptId };
    setUserProfile(newProfile);
    setIsChangingDept(false);
    const nextAllUsers = [...allUsers.filter(u => u.uid !== user.uid), newProfile];
    await saveData(records, popHistory, nextAllUsers);
  };

  const saveDailyRecord = async (chapters: number, customDateStr?: string, targetDeptId?: DepartmentId, isAdminRecord: boolean = false) => {
    if (!isAdminRecord && (!user || !userProfile?.departmentId)) return;
    if (isSyncing) return;

    const targetUserId = isAdminRecord ? 'admin' : user!.uid;
    const targetDateStr = customDateStr || formatKSTDate(new Date());
    
    setIsSyncing(true);
    try {
        let updated = [...records];
        const existingIdx = updated.findIndex(r => {
            const rDate = formatKSTDate(r.date);
            if (isAdminRecord) return rDate === targetDateStr && r.isAdminRecord && r.departmentId === targetDeptId;
            return rDate === targetDateStr && r.userId === targetUserId;
        });

        if (chapters === 0) {
            if (existingIdx >= 0) {
                const idToDelete = updated[existingIdx].id;
                const deletes = getPendingDeletes();
                deletes.push({ id: idToDelete, _ts: Date.now() });
                localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(deletes));
                updated = updated.filter((_, i) => i !== existingIdx);
            }
        } else {
            if (existingIdx >= 0) {
                const updatedRec = { ...updated[existingIdx], chapters, userName: isAdminRecord ? '관리자' : (userProfile?.displayName || '이름 없음'), _ts: Date.now() };
                updated[existingIdx] = updatedRec;
                const pending = getPendingRecords();
                localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify([...pending.filter(p => p.id !== updatedRec.id), updatedRec]));
            } else {
                const [y, m, d] = targetDateStr.split('-').map(Number);
                const kstNoon = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
                const newRec: ReadingRecord = {
                    id: crypto.randomUUID(),
                    departmentId: targetDeptId || userProfile!.departmentId!,
                    userId: targetUserId,
                    userName: isAdminRecord ? '관리자' : (userProfile?.displayName || '이름 없음'),
                    chapters,
                    date: kstNoon.toISOString(),
                    isAdminRecord
                };
                updated = [newRec, ...updated];
                const pending = getPendingRecords();
                pending.push({ ...newRec, _ts: Date.now() } as any);
                localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(pending));
            }
        }
        await saveData(updated, popHistory); 
    } finally {
        setIsSyncing(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const deletes = getPendingDeletes();
    deletes.push({ id, _ts: Date.now() });
    localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(deletes));
    await saveData(records.filter(r => r.id !== id), popHistory);
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    const newId = crypto.randomUUID();
    const next = [...departments, { id: newId, name: newDeptName.trim(), emoji: newDeptEmoji, color: newDeptColor }];
    setTempPopulations(prev => ({ ...prev, [newId]: 10 }));
    await saveData(records, popHistory, allUsers, next);
    setNewDeptName('');
  };

  const handleDeleteDepartment = async (deptId: DepartmentId, e: React.MouseEvent) => {
    e.preventDefault();
    if (departments.length <= 1) return;
    if (!window.confirm("부서를 삭제하시겠습니까?")) return;
    await saveData(records, popHistory, allUsers, departments.filter(d => d.id !== deptId));
  };

  const handleAdminLogin = () => {
    if (adminInput === 'djcjbch') { setIsAdminMode(true); setAdminInput(''); }
    else alert('비밀번호 오류');
  };

  if (!isConfigured) return <div className="p-10 text-center font-bold">Config Error</div>;
  if (authLoading || isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  const pendingIds = new Set(getPendingRecords().map(r => r.id));

  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-32">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20"><BookOpen className="text-white w-5 h-5" /></div>
            <h1 className="text-lg font-[900] text-slate-800 leading-none">부서별<span className="text-indigo-600">성경읽기대항전</span></h1>
          </div>
          <div className="flex items-center gap-2">
             <InstallPrompt />
             {isSyncing && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
             {user ? (
               <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                 {user.photoURL ? <img src={user.photoURL} alt="P" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><UserCircle className="w-5 h-5" /></div>}
               </div>
             ) : (
                <button onClick={handleGoogleLogin} className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 active:scale-95 shadow-md shadow-indigo-200"><LogIn className="w-3 h-3" /> 로그인</button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {user && userProfile?.departmentId && (
            <section className="flex items-center justify-between px-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div>
                <p className="text-xs font-bold text-slate-400 mb-1">나의 소속</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-800">{departments.find(d => d.id === userProfile.departmentId)?.name}</h2>
                  <button onClick={() => setIsChangingDept(true)} className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                </div>
                <div className="mt-1"><span className="bg-indigo-50 text-indigo-600 text-[11px] px-2 py-0.5 rounded-full font-bold border border-indigo-100">{userProfile.displayName}</span></div>
            </div>
            <button onClick={() => { if(window.confirm("로그아웃?")) auth?.signOut(); }} className="text-xs font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100"><LogOut className="w-3 h-3" /> 로그아웃</button>
            </section>
        )}

        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="p-6 pb-2 flex items-center gap-2.5"><div className="bg-amber-100 p-2 rounded-xl"><Trophy className="text-amber-600 w-5 h-5" /></div><h2 className="text-lg font-black text-slate-800">실시간 순위</h2></div>
          <div className="p-2 sm:p-6"><RaceTrack records={records} popHistory={popHistory} departments={departments} /></div>
        </section>

        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-3"><div className="bg-indigo-50 p-2 rounded-xl"><Save className="w-5 h-5 text-indigo-600" /></div><h2 className="text-lg font-black text-slate-800">기록하기</h2></div>
          <div className="p-6 bg-gradient-to-b from-white to-slate-50/50"><InputSection isLoggedIn={!!user} userDeptId={userProfile?.departmentId} onLogin={handleGoogleLogin} onAdd={saveDailyRecord} isAdminMode={isAdminMode} departments={departments} records={records} userId={user?.uid}/></div>
        </section>

        {user && (
           <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden"><div className="p-6 border-b border-slate-50 flex items-center gap-3"><div className="bg-violet-50 p-2 rounded-xl"><Calendar className="w-5 h-5 text-violet-600" /></div><h2 className="text-lg font-black text-slate-800">나의 캘린더</h2></div><div className="p-6"><CalendarView records={records} userId={user.uid} /></div></section>
        )}

        <div className="grid grid-cols-1 gap-6 text-center">
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden"><div className="p-6 border-b border-slate-50 flex items-center gap-3 text-left"><div className="bg-blue-50 p-2 rounded-xl"><BarChart3 className="text-blue-600 w-5 h-5" /></div><h2 className="text-lg font-black text-slate-800">통계</h2></div><div className="p-6"><Statistics records={records} popHistory={popHistory} isAdmin={isAdminMode} departments={departments} /></div></section>
          <section className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden"><div className="p-6 border-b border-slate-50 flex items-center justify-between text-left"><div className="flex items-center gap-3"><div className="bg-emerald-50 p-2 rounded-xl"><Save className="text-emerald-600 w-5 h-5" /></div><h2 className="text-lg font-black text-slate-800">최근 인증</h2></div><ChevronRight className="w-5 h-5 text-slate-300" /></div><div className="p-4"><HistoryTable records={records} onDelete={deleteRecord} isAdmin={isAdminMode} departments={departments} pendingIds={pendingIds} /></div></section>
        </div>

        <div className="flex justify-center pt-4 pb-10"><button onClick={() => setShowAdminPanel(!showAdminPanel)} className="flex items-center gap-2 px-4 py-2 text-slate-400 font-bold"><Lock className="w-3 h-3" /><span className="text-xs">{showAdminPanel ? '관리자 닫기' : '관리자 설정'}</span></button></div>

        {showAdminPanel && (
          <section className="pb-20">
            <div className="bg-[#1e293b] rounded-[2rem] p-6 text-white shadow-2xl text-left">
              {!isAdminMode ? (
                <div className="flex gap-2"><input type="password" value={adminInput} onChange={(e) => setAdminInput(e.target.value)} placeholder="코드" className="flex-1 bg-slate-800/80 rounded-xl px-4 py-3 outline-none"/><button onClick={handleAdminLogin} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold">확인</button></div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4"><div className="flex items-center gap-2 text-emerald-400 font-black"><Unlock className="w-4 h-4" /> ADMIN</div><button onClick={() => setIsAdminMode(false)} className="text-xs text-slate-400">로그아웃</button></div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-300">부서 관리</h3>
                    <div className="space-y-2">{departments.map(dept => (<div key={dept.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl"><span>{dept.emoji} {dept.name}</span><button onClick={(e) => handleDeleteDepartment(dept.id, e)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div>))}</div>
                    <div className="bg-slate-800/50 p-4 rounded-xl space-y-3"><div className="flex gap-2"><input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="부서명" className="flex-1 bg-slate-900 px-3 py-2 rounded-lg"/><input type="text" value={newDeptEmoji} onChange={e => setNewDeptEmoji(e.target.value)} className="w-16 bg-slate-900 px-3 py-2 rounded-lg text-center"/></div><div className="flex gap-2 items-center"><input type="color" value={newDeptColor} onChange={e => setNewDeptColor(e.target.value)} className="w-8 h-8 rounded"/><button onClick={handleAddDepartment} className="flex-1 bg-indigo-600 py-2 rounded-lg font-bold">부서 추가</button></div></div>
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
