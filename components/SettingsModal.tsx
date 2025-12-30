import React from 'react';
import { Settings, X, AlertTriangle, Map, Key, Trash2 } from 'lucide-react';
import { ApiKeys } from '../types';

interface Props {
  apiKeys: ApiKeys;
  setApiKeys: (keys: ApiKeys) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<Props> = ({ apiKeys, setApiKeys, onClose }) => {
  
  const isGoogleKey = (key: string) => key && key.startsWith('AIza');

  const handleClearAll = () => {
    if (confirm('確定要清除所有金鑰嗎？\n清除後需重新輸入才能使用。')) {
        setApiKeys({ openai: '', taigi: '', googleMaps: '' });
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                <Settings size={28} /> 設定 API 金鑰
            </h2>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                <X size={24} />
            </button>
        </div>
        
        <div className="space-y-6">
            {/* OpenAI */}
            <div className={`p-4 rounded-xl border ${isGoogleKey(apiKeys.openai) ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-200'}`}>
                <label className="text-sm text-blue-800 font-bold block mb-2 flex items-center gap-1">
                    <Key size={16}/> OpenAI API Key (必填)
                </label>
                <input 
                    type="password" 
                    value={apiKeys.openai} 
                    onChange={e => setApiKeys({...apiKeys, openai: e.target.value})} 
                    placeholder="sk-..." 
                    className="w-full p-4 border rounded-xl border-blue-300 text-lg bg-white placeholder:text-slate-300"
                />
                {isGoogleKey(apiKeys.openai) && (
                    <div className="flex items-start gap-2 mt-2 text-red-600 text-sm font-bold">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p>警告：格式看起來像 Google Key。請確認這是 OpenAI 的 Key (通常以 sk- 開頭)。</p>
                    </div>
                )}
            </div>
            
            {/* Taigi */}
            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <label className="text-sm text-green-800 font-bold block mb-2 flex items-center gap-1">
                    <Key size={16}/> Taigi API Key (必填)
                </label>
                <input 
                    type="password" 
                    value={apiKeys.taigi} 
                    onChange={e => setApiKeys({...apiKeys, taigi: e.target.value})} 
                    placeholder="輸入台語通用金鑰" 
                    className="w-full p-4 border rounded-xl border-green-300 text-lg bg-white placeholder:text-slate-300"
                />
                <div className="text-xs text-green-800 mt-2 leading-relaxed">
                    用於翻譯與語音合成 (Model 7)。<br/>
                    <span className="font-bold">＊API 由 Taigi AI Labs 提供</span>
                </div>
            </div>

            {/* Google Maps */}
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                <label className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-1">
                    <Map size={16} />
                    Google Maps Key (必填)
                </label>
                <input 
                    type="password" 
                    value={apiKeys.googleMaps} 
                    onChange={e => setApiKeys({...apiKeys, googleMaps: e.target.value})} 
                    placeholder="AIza..." 
                    className="w-full p-3 border rounded-lg text-lg font-mono bg-white placeholder:text-slate-300"
                />
                <p className="text-xs text-orange-700 mt-2">
                    請自行申請並啟用 <b>Maps JavaScript API</b>。
                </p>
            </div>

            {/* Clear Button */}
            <div className="pt-2 flex justify-center">
                <button 
                    onClick={handleClearAll}
                    className="flex items-center gap-1 text-slate-400 hover:text-red-500 text-sm transition-colors"
                >
                    <Trash2 size={14} /> 清除所有已儲存的金鑰
                </button>
            </div>
        </div>
        
        <button 
            onClick={onClose} 
            className="w-full mt-6 bg-teal-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition hover:bg-teal-700"
        >
            儲存並返回
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;