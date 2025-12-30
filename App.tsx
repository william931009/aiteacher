import React, { useState, useEffect, useRef } from 'react';
import { Mic, ArrowLeft, Settings, Loader2, Volume2, StopCircle, Bus, StickyNote } from 'lucide-react';
import { ApiKeys, AppView, ProcessingState, Memo, TrafficResult } from './types';
import SettingsModal from './components/SettingsModal';
import TrafficCard from './components/TrafficCard';
import MemoList from './components/MemoList';
import * as OpenAIService from './services/openaiService';
import * as TaigiService from './services/taigiService';
import * as MapService from './services/mapService';

const App: React.FC = () => {
    // --- State ---
    const [currentView, setCurrentView] = useState<AppView>('home');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [processingStep, setProcessingStep] = useState<ProcessingState>('idle');
    const [showSettings, setShowSettings] = useState<boolean>(false);
    
    // Keys - Initialize purely from localStorage
    const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
        try {
            const saved = localStorage.getItem('silverlink_apikeys_v1');
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    openai: parsed.openai || '',
                    taigi: parsed.taigi || '',
                    googleMaps: parsed.googleMaps || ''
                };
            }
        } catch (e) {
            console.warn("Failed to parse saved API keys");
        }
        // Default to empty strings, allowing user to input everything
        return { 
            openai: '', 
            taigi: '', 
            googleMaps: ''
        };
    });

    // Content Data
    const [memos, setMemos] = useState<Memo[]>(() => {
        try { return JSON.parse(localStorage.getItem('silverlink_memos_v6') || '[]'); } catch { return []; }
    });
    const [trafficResult, setTrafficResult] = useState<TrafficResult | null>(null);

    // Audio Refs
    // Use a Ref to keep the same Audio instance across renders to maintain the "unlocked" state on mobile
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null); // Keep track of stream to release it
    const audioChunksRef = useRef<Blob[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement>(null); // Ref to DOM element

    // --- Effects ---
    
    // Persist API Keys
    useEffect(() => {
        localStorage.setItem('silverlink_apikeys_v1', JSON.stringify(apiKeys));
    }, [apiKeys]);

    // Persist Memos
    useEffect(() => {
        localStorage.setItem('silverlink_memos_v6', JSON.stringify(memos));
    }, [memos]);

    // Listen for Google Maps Auth Failure (dispatched from mapService)
    useEffect(() => {
        const handleAuthFailure = () => {
            setShowSettings(true);
            setStatusMessage("Map Key 無效，請重新設定");
        };
        window.addEventListener('google-maps-auth-failure', handleAuthFailure);
        return () => window.removeEventListener('google-maps-auth-failure', handleAuthFailure);
    }, []);

    // --- Logic Functions ---

    /**
     * Mobile Autoplay Fix:
     * Mobile browsers (iOS Safari/Android Chrome) block audio.play() if not triggered 
     * immediately by a user gesture. We play a silent buffer on click.
     * 
     * CHANGE: We do NOT pause immediately. We let the tiny silent file play out.
     * Interrupting play() with pause() causes errors on iOS.
     */
    const unlockAudioContext = () => {
        const audio = audioPlayerRef.current;
        if (audio) {
            // Shortest valid silent WAV file
            audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
            // We set volume to 1 just in case, though it's silent
            audio.volume = 1.0;
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.debug("Audio unlock silent fail (normal if already unlocked):", e);
                });
            }
        }
    };

    const startRecording = async () => {
        if (!apiKeys.openai) { 
            alert("請先在設定中輸入 OpenAI API Key (sk-...)！"); 
            setShowSettings(true); 
            return; 
        }

        // CRITICAL: Unlock audio immediately on user click
        unlockAudioContext();
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream; // Store stream to stop tracks later

            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            
            mediaRecorderRef.current.onstop = handleRecordingStop;
            mediaRecorderRef.current.start();
            setProcessingStep('recording');
            setStatusMessage("請說話...");
        } catch (err) {
            console.error(err);
            alert("無法開啟麥克風，請確認權限");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && processingStep === 'recording') {
            mediaRecorderRef.current.stop();
            
            // IMPORTANT: Stop all tracks to release the microphone hardware
            // This is crucial on iOS to switch Audio Session from "Record" back to "Playback"
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach(track => track.stop());
                audioStreamRef.current = null;
            }
        }
    };

    const handleRecordingStop = async () => {
        setProcessingStep('transcribing');
        setStatusMessage("正在聽...");
        
        if (audioChunksRef.current.length === 0) {
            setStatusMessage("沒有錄到聲音");
            setProcessingStep('idle');
            return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (audioBlob.size < 500) { 
            setStatusMessage("錄音太短，請再試一次");
            setProcessingStep('idle');
            return;
        }
        
        try {
            // 1. STT (Whisper)
            const text = await OpenAIService.transcribeAudio(audioBlob, apiKeys.openai);
            setStatusMessage(`聽到：「${text}」`);
            
            // 2. Intent (GPT)
            setProcessingStep('thinking');
            const intentData = await OpenAIService.determineIntent(text, apiKeys.openai);
            
            // 3. Process Intent
            await handleIntent(intentData);

        } catch (error: any) {
            console.error(error);
            setStatusMessage(`錯誤：${error.message}`);
            setProcessingStep('idle');
        }
    };

    const handleIntent = async (data: any) => {
        let replyText = data.reply; 

        // --- Action Logic ---
        if (data.intent === 'traffic') {
            // Check for Map Key before proceeding
            if (!apiKeys.googleMaps) {
                setStatusMessage("請輸入 Google Maps Key");
                setShowSettings(true);
                setProcessingStep('idle');
                return;
            }

            const origin = data.origin || '台北';
            const dest = data.destination || '高雄';
            setStatusMessage(`查詢 ${origin} 到 ${dest}...`);
            
            try {
                // Pass preferred_mode from intent data to MapService
                const result = await MapService.searchRoute(
                    origin, 
                    dest, 
                    apiKeys.googleMaps, 
                    data.departure_time,
                    data.preferred_mode
                );
                
                setTrafficResult(result);
                setCurrentView('traffic');

                const timeText = result.departureTime;
                const arrivalText = result.arrivalTime;
                const vehicleText = result.mainVehicle || '車';
                
                let script = `好的，幫您查去${dest}的路線。`;
                script += `建議搭 ${vehicleText}，${timeText}發車，預計 ${arrivalText} 會到。`;
                
                if (result.fare) {
                    script += `票價大約 ${result.fare}。`;
                }
                
                if (result.bestExit) {
                    script += `到站後，請從 ${result.bestExit} 出去比較近。`;
                }

                replyText = script;

            } catch (err: any) {
                console.error(err);
                setStatusMessage(`查詢失敗: ${err.message}`);
                replyText = "不好意思，我查不到路線，請確認地點或網路。";
                setTimeout(() => setProcessingStep('idle'), 3000);
            }
        } 
        else if (data.intent === 'memo') {
            const content = data.memo_content || '未命名記事';
            const newMemo: Memo = {
                id: Date.now(),
                content,
                timestamp: Date.now(),
                displayTime: new Date().toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })
            };
            setMemos(prev => [newMemo, ...prev]);
            setCurrentView('memo');
            replyText = `好，已經幫您記下來：${content}`;
        }

        // --- Voice Feedback Logic (Taigi) ---
        if (replyText) {
            setProcessingStep('translating'); 
            try {
                if(!apiKeys.taigi) {
                    setStatusMessage(replyText); 
                    throw new Error("Missing Taigi Key");
                }
                
                const audioUrl = await TaigiService.getTaigiVoiceUrl(replyText, apiKeys.taigi);
                
                setStatusMessage(replyText);
                setProcessingStep('speaking');
                
                // Use the SAME audio reference that was unlocked earlier
                if (audioPlayerRef.current) {
                    const audio = audioPlayerRef.current;
                    
                    // Reset onended from previous usage to prevent weird loops
                    audio.onended = null;
                    
                    audio.src = audioUrl;
                    
                    const playPromise = audio.play();
                    
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                // Playback started successfully
                            })
                            .catch(error => {
                                console.warn("Playback failed:", error);
                                setStatusMessage("無法播放語音 (請點擊畫面)");
                                // Fallback: If it fails, we might need another user gesture. 
                                // But since we unlocked it, it SHOULD work.
                            });
                    }

                    audio.onended = () => {
                        setProcessingStep('idle');
                    };
                }
            } catch (e) {
                console.warn("Voice gen failed", e);
                setProcessingStep('idle');
            }
        } else {
            setProcessingStep('idle');
        }
    };

    const getButtonConfig = () => {
        switch (processingStep) {
            case 'recording': return { color: 'bg-red-500 shadow-none', text: '停止錄音', icon: <StopCircle size={32} /> };
            case 'transcribing': return { color: 'bg-yellow-500', text: '正在聽...', icon: <Loader2 className="animate-spin" size={32} /> };
            case 'thinking': return { color: 'bg-blue-500', text: '正在想...', icon: <Loader2 className="animate-spin" size={32} /> };
            case 'translating': return { color: 'bg-purple-500', text: '生成台語...', icon: <Loader2 className="animate-spin" size={32} /> };
            case 'speaking': return { color: 'bg-green-500', text: '正在說...', icon: <Volume2 size={32} className="animate-pulse" /> };
            default: return { color: 'bg-teal-600 hover:bg-teal-700', text: '按此說話 (講台語)', icon: <Mic size={32} /> };
        }
    };

    const btnConfig = getButtonConfig();
    const hasRequiredKeys = apiKeys.openai && apiKeys.taigi;

    return (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 relative border-x border-slate-200 shadow-2xl overflow-hidden">
            {/* Hidden Audio Element for Mobile Compatibility */}
            <audio ref={audioPlayerRef} className="hidden" playsInline />

            {showSettings && <SettingsModal apiKeys={apiKeys} setApiKeys={setApiKeys} onClose={()=>setShowSettings(false)} />}

            {/* Header */}
            <div className="bg-teal-700 text-white p-5 flex justify-between items-center shadow-lg z-10 shrink-0">
                {currentView !== 'home' ? (
                    <button onClick={()=>setCurrentView('home')} className="p-2 -ml-2 active:bg-teal-800 rounded-full">
                        <ArrowLeft size={32}/>
                    </button>
                ) : <div className="w-10"/>}
                <h1 className="text-2xl font-bold tracking-wider">樂齡語音助理</h1>
                <button onClick={()=>setShowSettings(true)} className="p-2 -mr-2 active:bg-teal-800 rounded-full">
                    <Settings size={32}/>
                </button>
            </div>

            {/* Status Bar */}
            <div className={`text-center py-3 text-lg font-bold transition-colors duration-300 shrink-0 px-2 truncate ${processingStep === 'recording' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-700'}`}>
                {statusMessage || (hasRequiredKeys ? "準備好了，請按下方按鈕" : "請點擊右上角設定 Key")}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 scroll-smooth no-scrollbar">
                {currentView === 'home' && (
                    <div className="flex flex-col gap-6 pt-4">
                        <div className="text-center mb-4">
                            <h2 className="text-3xl font-bold text-slate-800 mb-2">早安！想做什麼？</h2>
                            <div className="bg-white p-5 rounded-2xl shadow-sm text-slate-600 border border-slate-200">
                                <p className="mb-3 font-bold text-teal-700 text-lg">試著說說看：</p>
                                <ul className="text-left space-y-3 text-xl font-medium bg-slate-50 p-4 rounded-xl w-full">
                                    <li>🚆 "我要查去高雄的火車"</li>
                                    <li>🚆 "查下午兩點去板橋的車"</li>
                                    <li>💊 "幫我記下午兩點吃藥"</li>
                                </ul>
                            </div>
                        </div>
                        <button onClick={()=>setCurrentView('traffic')} className="bg-white p-6 rounded-3xl shadow-md border-l-[10px] border-orange-400 flex items-center gap-6 active:scale-95 transition hover:bg-orange-50">
                            <div className="bg-orange-100 p-4 rounded-full text-orange-600 flex-shrink-0"><Bus size={40}/></div>
                            <div className="text-left"><h3 className="text-2xl font-bold text-slate-800">查公車火車</h3></div>
                        </button>
                        <button onClick={()=>setCurrentView('memo')} className="bg-white p-6 rounded-3xl shadow-md border-l-[10px] border-blue-400 flex items-center gap-6 active:scale-95 transition hover:bg-blue-50">
                            <div className="bg-blue-100 p-4 rounded-full text-blue-600 flex-shrink-0"><StickyNote size={40}/></div>
                            <div className="text-left"><h3 className="text-2xl font-bold text-slate-800">記事本</h3></div>
                        </button>
                    </div>
                )}

                {currentView === 'traffic' && <TrafficCard data={trafficResult} />}
                
                {currentView === 'memo' && <MemoList memos={memos} onDelete={(id) => setMemos(prev => prev.filter(m => m.id !== id))} />}
            </div>

            {/* Footer with Attribution */}
            <div className="bg-slate-100 p-2 text-center border-t border-slate-200 shrink-0">
                <p className="text-xs text-slate-400">
                    技術支援：OpenAI • Google Maps<br/>
                    <span className="font-bold text-slate-500">＊使用 Taigi AI Labs 提供之 API</span>
                </p>
            </div>

            {/* Action Button Area */}
            <div className="bg-white p-6 shadow-[0_-4px_30px_rgba(0,0,0,0.15)] rounded-t-[2.5rem] z-20 shrink-0">
                <button 
                    onClick={processingStep === 'recording' ? stopRecording : startRecording} 
                    disabled={processingStep !== 'idle' && processingStep !== 'recording'}
                    className={`w-full py-6 rounded-full text-2xl font-bold flex items-center justify-center gap-4 transition-all shadow-xl text-white ${btnConfig.color} ${processingStep === 'idle' ? 'active:scale-95' : ''}`}
                >
                    {btnConfig.icon}
                    <span>{btnConfig.text}</span>
                </button>
                {processingStep === 'idle' && <p className="text-center text-slate-400 mt-3 text-base">👆 按一下開始說話</p>}
            </div>
        </div>
    );
};

export default App;