import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ReadingRecord, DepartmentId, DepartmentPopulations, PopulationLog, UserProfile, Department } from './types';
import { INITIAL_DEPARTMENTS, DEFAULT_GOOGLE_SHEET_URL, SYNC_API_BASE, SHARED_CLOUD_ID, LOCAL_STORAGE_KEY } from './constants';
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
  Download, Plus, Trash2, Palette
} from 'lucide-react';

// Firebase Imports
import { auth, googleProvider, isConfigured } from './firebase';
import * as firebaseAuth from 'firebase/auth';

interface AppData {
  records: ReadingRecord[];
  popHistory: PopulationLog[];
  users?: UserProfile[];
  departments?: Department[];
}

const getKSTDateFromISO = (iso: string) => {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
};

const App: React.FC = () => {
  const [user, setUser] = useState<firebaseAuth.User | null>(null);
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
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isChangingDept, setIsChangingDept] = useState(false);
  const [inputName, setInputName] = useState('');

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState('');
  const [tempPopulations, setTempPopulations] = useState<DepartmentPopulations>({});
  const [popApplyDate, setPopApplyDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptEmoji, setNewDeptEmoji] = useState('🐢');
  const [newDeptColor, setNewDeptColor] = useState('#6366f1');

  const [googleSheetUrl, setGoogleSheetUrl] = useState(DEFAULT_GOOGLE_SHEET_URL);
  const isFetchingRef = useRef(false);
  const lastSaveTimeRef = useRef<number>(0);

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
           setUserProfile({ uid: currentUser.uid, displayName: initialName, email: currentUser.email });
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
    if (!auth || !googleProvider) return;
    try {
      await firebaseAuth.signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error(error);
      alert(`로그인 실패: ${error.message}`);
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

  useEffect(() => {
    let loadedLocal = false;
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
           loadedLocal = true;
        }
      } catch (e) {
        console.warn("Local storage load failed", e);
      }
    }

    loadFromGoogleSheet(googleSheetUrl, loadedLocal);

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
    if (Date.now() - lastSaveTimeRef.current < 10000) return;

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch(e) {
        console.warn("LocalStorage save failed", e);
    }

    if (data.departments && Array.isArray(data.departments)) setDepartments(data.departments);
    if (data.records && Array.isArray(data.records)) setRecords(data.records);
    if (data.popHistory && Array.isArray(data.popHistory)) {
      const sortedHistory = data.popHistory.sort((a, b) => 
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
      setPopHistory(sortedHistory);
    }
    if (data.users && Array.isArray(data.users)) setAllUsers(data.users);
  };

  const saveData = async (newRecords: ReadingRecord[], newHistory: PopulationLog[], newUsers: UserProfile[] = allUsers, newDepartments: Department[] = departments) => {
    setIsSyncing(true);
    lastSaveTimeRef.current = Date.now();

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
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    } catch(e) {
        console.warn("LocalStorage save failed", e);
    }
    
    try {
      // 1. 구글 시트 저장
      await fetch(googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }, 
        body: JSON.stringify(payload)
      });

      // 2. JsonBlob 백업 저장
      fetch(`${SYNC_API_BASE}/${SHARED_CLOUD_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Backup failed:', err));
      
      lastSaveTimeRef.current = Date.now();

      setTimeout(() => {
        if (Date.now() - lastSaveTimeRef.current >= 10000) triggerSync(true);
      }, 3000);

    } catch (e) {
      alert("저장 실패! 인터넷 연결을 확인해주세요.");
      lastSaveTimeRef.current = 0;
    } finally {
      setIsSyncing(false);
    }
  };

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
    const nextAllUsers = [...allUsers.filter(u => u.uid !== user.uid), newProfile];
    setAllUsers(nextAllUsers);
    await saveData(records, popHistory, nextAllUsers);
  };

  const startEditing = () => {
      if (userProfile) setInputName(userProfile.displayName);
      setIsChangingDept(true);
  };

  const saveDailyRecord = async (chapters: number, customDateStr?: string, targetDeptId?: DepartmentId, isAdminRecord: boolean = false) => {
    if (!isAdminRecord && (!user || !userProfile?.departmentId)) return;
    if (isAdminRecord && !targetDeptId) return;

    if (isSyncing) return;

    const targetUserId = isAdminRecord ? 'admin' : (user?.uid || 'unknown');
    const targetDateStr = customDateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    
    setIsSyncing(true);

    try {
        const uniqueUrl = `${googleSheetUrl}${googleSheetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const res = await fetch(uniqueUrl);
        let latestRecords: ReadingRecord[] = records;
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.records)) latestRecords = data.records;
        }

        let updatedRecords = [...latestRecords];
        const existingIndex = updatedRecords.findIndex(r => {
            const recordDateStr = getKSTDateFromISO(r.date);
            const isSameDate = recordDateStr === targetDateStr;
            return isAdminRecord ? (isSameDate && r.isAdminRecord && r.departmentId === targetDeptId) : (isSameDate && r.userId === targetUserId);
        });

        if (chapters === 0) {
            if (existingIndex >= 0) updatedRecords.splice(existingIndex, 1);
        } else {
            if (existingIndex >= 0) {
                updatedRecords[existingIndex] = { ...updatedRecords[existingIndex], chapters, departmentId: targetDeptId || updatedRecords[existingIndex].departmentId };
            } else {
                const [y, m, d] = targetDateStr.split('-').map(Number);
                const utcDate = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
                const newRecord: ReadingRecord = {
                    id: crypto.randomUUID(),
                    departmentId: targetDeptId || userProfile!.departmentId!,
                    userId: targetUserId,
                    userName: isAdminRecord ? '관리자' : (userProfile?.displayName || '이름 없음'),
                    chapters,
                    date: utcDate.toISOString(),
                    isAdminRecord
                };
                updatedRecords = [newRecord, ...updatedRecords];
            }
        }
        setRecords(updatedRecords);
        await saveData(updatedRecords, popHistory); 
    } catch(e) {
        alert("저장 오류 발생. 다시 시도해주세요.");
        setIsSyncing(false);
    }
  };

  const deleteRecord = async (id: string) => {
    if (!window.confirm('기록을 삭제하시겠습니까?')) return;
    setIsSyncing(true);
    try {
        const nextRecords = records.filter(r => r.id !== id);
        setRecords(nextRecords);
        await saveData(nextRecords, popHistory);
    } catch(e) {
        alert("삭제 실패");
        setIsSyncing(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    const newId = crypto.randomUUID();
    const newDept = { id: newId, name: newDeptName.trim(), emoji: newDeptEmoji, color: newDeptColor };
    const nextDepts = [...departments, newDept];
    setDepartments(nextDepts);
    setNewDeptName('');
    await saveData(records, popHistory, allUsers, nextDepts);
  };

  const handleDeleteDepartment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('부서를 삭제하시겠습니까?')) return;
    const nextDepts = departments.filter(d => d.id !== id);
    setDepartments(nextDepts);
    await saveData(records, popHistory, allUsers, nextDepts);
  };

  const handleApplyPopulations = async () => {
    if (!popApplyDate) return;
    const startDate = new Date(popApplyDate).toISOString();
    const nextHistory = [...popHistory.filter(h => h.startDate.split('T')[0] !== popApplyDate), { startDate, populations: { ...tempPopulations } }].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    setPopHistory(nextHistory);
    await saveData(records, nextHistory);
    alert('인원 설정 완료');
  };

  const handleAdminLogin = () => {
    if (adminInput === 'djcjbch') {
      setIsAdminMode(true);
      setAdminInput('');
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const handleLoadBackup = async () => {
    if (!window.confirm('JsonBlob 백업 데이터를 불러와 현재 데이터를 덮어씌울까요?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${SYNC_API_BASE}/${SHARED_CLOUD_ID}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
           lastSaveTimeRef.current = 0; 
           updateLocalState(data);
           alert('백업 데이터 복원 성공!');
        }
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

  if (!isConfigured) return <div>Firebase 설정이 필요합니다.</div>;
  if (authLoading || isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (user && (!userProfile?.departmentId || isChangingDept)) {
    return (
      <div className="min-h-screen bg-[#F2F4F8] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-xl">
           <h2 className="text-2xl font-black text-center">정보 설정</h2>
           <input type="text" value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="실명 입력" className="w-full border p-3 rounded-xl" />
           <div className="grid grid-cols-1 gap-2">
             {departments.map(dept => (
               <button key={dept.id} onClick={() => handleSelectDepartment(dept.id)} className="p-4 border rounded-xl flex items-center gap-3 hover:bg-slate-50">
                 <span>{dept.emoji}</span> {dept.name}
               </button>
             ))}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F8] font-sans text-slate-900 pb-32">
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-black">📖 성경읽기 대항전</h1>
          <div className="flex items-center gap-2">
            <InstallPrompt />
            {isSyncing && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
            {user ? (
              <button onClick={handleLogout} className="text-xs text-slate-400">로그아웃</button>
            ) : (
              <button onClick={handleGoogleLogin} className="text-xs font-bold text-indigo-600">로그인</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-[2rem] shadow-sm p-6 overflow-hidden">
          <RaceTrack records={records} popHistory={popHistory} departments={departments} />
        </section>

        <section className="bg-white rounded-[2rem] shadow-sm p-6">
          <InputSection 
            isLoggedIn={!!user}
            userDeptId={userProfile?.departmentId} 
            onLogin={handleGoogleLogin}
            onAdd={saveDailyRecord}
            isAdminMode={isAdminMode} 
            departments={departments}
            records={records}
            userId={user?.uid}
          />
        </section>

        {user && (
           <section className="bg-white rounded-[2rem] shadow-sm p-6">
              <CalendarView records={records} userId={user.uid} />
           </section>
        )}

        <div className="grid grid-cols-1 gap-6">
          <section className="bg-white rounded-[2rem] shadow-sm p-6">
            <Statistics records={records} popHistory={popHistory} isAdmin={isAdminMode} departments={departments} />
          </section>
          <section className="bg-white rounded-[2rem] shadow-sm p-6">
            <HistoryTable records={records} onDelete={deleteRecord} isAdmin={isAdminMode} departments={departments} />
          </section>
        </div>

        <div className="flex justify-center gap-4">
           <button onClick={copyLink} className="bg-white px-6 py-3 rounded-full shadow-md text-sm font-bold flex items-center gap-2">
             {copyFeedback ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />} 공유하기
           </button>
        </div>

        <div className="flex justify-center pt-8">
          <button onClick={() => setShowAdminPanel(!showAdminPanel)} className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            {showAdminPanel ? 'Admin Close' : 'Admin Panel'}
          </button>
        </div>

        {showAdminPanel && (
          <div className="bg-[#1e293b] text-white p-8 rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-5">
            {!isAdminMode ? (
              <div className="flex gap-2">
                <input type="password" value={adminInput} onChange={(e) => setAdminInput(e.target.value)} placeholder="Passcode" className="flex-1 bg-slate-800 p-3 rounded-xl outline-none" />
                <button onClick={handleAdminLogin} className="bg-indigo-600 px-6 rounded-xl font-bold">OK</button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-between border-b border-slate-700 pb-4">
                  <span className="font-black text-emerald-400">ADMIN ACTIVE</span>
                  <button onClick={() => setIsAdminMode(false)} className="text-xs text-slate-400">Exit</button>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-sm font-bold">부서 관리</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {departments.map(d => (
                      <div key={d.id} className="flex justify-between bg-slate-800 p-3 rounded-xl">
                        <div className="flex items-center gap-2"><span>{d.emoji}</span> {d.name}</div>
                        <button onClick={(e) => handleDeleteDepartment(d.id, e)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="New Dept Name" className="flex-1 bg-slate-900 p-2 rounded-lg text-xs" />
                    <button onClick={handleAddDepartment} className="bg-indigo-600 px-4 rounded-lg text-xs font-bold">Add</button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-bold">인원 조정 및 백업</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map(d => (
                      <div key={d.id} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg">
                        <span className="text-[10px] flex-1">{d.name}</span>
                        <input type="number" value={tempPopulations[d.id] || ''} onChange={e => setTempPopulations({...tempPopulations, [d.id]: parseInt(e.target.value) || 1})} className="w-12 bg-transparent text-right font-bold outline-none" />
                      </div>
                    ))}
                  </div>
                  <button onClick={handleApplyPopulations} className="w-full bg-slate-700 py-3 rounded-xl text-sm font-bold">인원 변경 저장</button>
                  
                  <div className="pt-4 space-y-2">
                    <button onClick={handleLoadBackup} className="w-full bg-indigo-600 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" /> 최신 백업본 불러오기 (JsonBlob)
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">Cloud ID: {SHARED_CLOUD_ID}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
