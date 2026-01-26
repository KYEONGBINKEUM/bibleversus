
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, Download, X, Share, PlusSquare } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. 이미 앱으로 실행 중인지 확인 (Standalone 모드)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                             (window.navigator as any).standalone === true;
    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // 2. iOS 감지
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // 3. Android/Chrome 설치 프롬프트 이벤트 포착
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault(); // 기본 배너 막기
      setDeferredPrompt(e); // 이벤트 저장
      console.log("Install prompt captured");
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // 안드로이드/PC에서 브라우저가 설치 이벤트를 준 경우 -> 즉시 시스템 팝업 호출
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // iOS이거나, 아직 설치 이벤트가 준비 안 된 경우(혹은 이미 무시함) -> 가이드 모달 열기
      setShowModal(true);
    }
  };

  // 이미 설치된 앱이면 버튼 숨김
  if (isStandalone) return null;

  return (
    <>
      {/* Header Button */}
      <button 
        onClick={handleInstallClick}
        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-all active:scale-95 shadow-sm border border-indigo-100/50"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="text-[11px] font-bold">앱 설치</span>
      </button>

      {/* Install Guide Modal - React Portal을 사용해 body 최상단으로 탈출시킴 */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors z-10"
            >
                <X className="w-6 h-6" />
            </button>

            <div className="p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-200">
                    {isIOS ? <PlusSquare className="w-8 h-8" /> : <Download className="w-8 h-8" />}
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-800">
                      {isIOS ? '홈 화면에 추가하기' : '앱 설치하기'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isIOS 
                      ? '아이폰은 아래 방법으로 추가해주세요.' 
                      : '앱을 설치하면 더 빠르게 접속할 수 있습니다.'}
                  </p>
                </div>
                
                {isIOS ? (
                    <div className="space-y-4 text-left bg-slate-50 p-5 rounded-2xl text-sm text-slate-600 border border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-500 border border-slate-100">
                                <Share className="w-5 h-5" />
                            </div>
                            <p className="flex-1 text-xs font-bold text-slate-700">
                              1. Safari 하단 <span className="text-blue-600">공유 버튼</span> 터치
                            </p>
                        </div>
                        <div className="w-full h-px bg-slate-200/60" />
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg shadow-sm text-slate-700 border border-slate-100">
                                <PlusSquare className="w-5 h-5" />
                            </div>
                            <p className="flex-1 text-xs font-bold text-slate-700">
                              2. 메뉴에서 <span className="text-indigo-600">'홈 화면에 추가'</span> 선택
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                         {deferredPrompt ? (
                             <button 
                                onClick={handleInstallClick}
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                             >
                                <Download className="w-4 h-4" /> 지금 설치하기
                             </button>
                         ) : (
                             <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 text-left border border-slate-100">
                                 <p className="leading-relaxed font-medium">
                                   <strong className="text-indigo-600 block mb-1">자동 설치가 안 되나요?</strong>
                                   브라우저 우측 상단 메뉴(점 3개)를 누르고 <br/>
                                   <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 직접 선택해주세요.
                                 </p>
                             </div>
                         )}
                    </div>
                )}
            </div>
            
            <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 w-full py-2">
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
