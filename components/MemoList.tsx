import React from 'react';
import { Memo } from '../types';
import { StickyNote, Trash2, Clock } from 'lucide-react';

interface Props {
  memos: Memo[];
  onDelete: (id: number) => void;
}

const MemoList: React.FC<Props> = ({ memos, onDelete }) => {
  return (
    <div className="space-y-4 pb-24">
        {memos.length === 0 ? (
            <div className="text-center mt-20 opacity-40">
                <StickyNote size={100} className="mx-auto mb-4 text-slate-300"/>
                <p className="text-2xl font-bold text-slate-400">目前沒有記事</p>
            </div>
        ) : (
            memos.map(m => (
                <div key={m.id} className="bg-white p-6 rounded-2xl shadow-sm border-l-[10px] border-blue-400 relative">
                    <div className="flex gap-3 mb-3 items-center text-slate-500">
                        <Clock size={20} />
                        <span className="font-bold text-lg">{m.displayTime}</span>
                    </div>
                    <p className="text-2xl text-slate-800 font-medium leading-relaxed">
                        {m.content}
                    </p>
                    <button 
                        onClick={() => { if(confirm('確定要刪除這條記事嗎？')) onDelete(m.id) }} 
                        className="absolute top-6 right-6 text-slate-300 hover:text-red-500 p-2 transition-colors"
                    >
                        <Trash2 size={28}/>
                    </button>
                </div>
            ))
        )}
    </div>
  );
};

export default MemoList;
