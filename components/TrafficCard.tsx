import React from 'react';
import { TrafficResult } from '../types';
import { Train, MapPin, MoveRight, Clock, Footprints, DollarSign, LogOut } from 'lucide-react';

interface Props {
  data: TrafficResult | null;
}

const TrafficCard: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="space-y-5 animate-fade-in pb-24">
        <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-200">
            {/* Header: Origin -> Destination */}
            <div className="flex items-center justify-between text-slate-500 mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-lg font-bold truncate max-w-[40%] text-slate-800">
                    <MapPin size={24} className="text-teal-600" /> {data.origin}
                </div>
                <MoveRight size={28} className="text-slate-300"/>
                <div className="flex items-center gap-2 text-lg font-bold truncate max-w-[40%] text-slate-800 justify-end">
                    {data.destination} <MapPin size={24} className="text-orange-600" />
                </div>
            </div>

            {/* Time & Fare Summary - NEW UI */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-bold">出發</span>
                        <span className="text-2xl font-bold text-slate-800">{data.departureTime}</span>
                    </div>
                    <MoveRight size={20} className="text-slate-300"/>
                    <div className="flex flex-col items-end">
                        <span className="text-slate-500 text-sm font-bold">抵達</span>
                        <span className="text-2xl font-bold text-slate-800">{data.arrivalTime}</span>
                    </div>
                </div>
                
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                     <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full font-bold text-sm inline-flex items-center gap-1">
                        <Clock size={16}/> {data.totalDuration}
                     </span>
                     {data.fare ? (
                         <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold text-sm inline-flex items-center gap-1">
                            <DollarSign size={16}/> {data.fare}
                         </span>
                     ) : (
                        <span className="text-slate-400 text-sm">票價依現場</span>
                     )}
                </div>
            </div>

            {/* Recommended Exit Alert */}
            {data.bestExit && (
                <div className="bg-orange-100 border border-orange-200 rounded-xl p-3 mb-6 flex items-center gap-3 text-orange-800 animate-pulse-slow">
                    <LogOut size={24} />
                    <div>
                        <p className="text-xs font-bold opacity-70">建議出口</p>
                        <p className="text-lg font-bold">{data.bestExit}</p>
                    </div>
                </div>
            )}
            
            {/* Steps List */}
            <div className="space-y-4">
                {data.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-4 relative">
                        {/* Timeline Connector */}
                        {idx !== data.steps.length - 1 && (
                            <div className="absolute left-[19px] top-10 bottom-[-20px] w-[2px] bg-slate-200 z-0"></div>
                        )}

                        {/* Icon */}
                        <div className={`z-10 relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${step.type === 'TRANSIT' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                            {step.type === 'TRANSIT' ? <Train size={20} /> : <Footprints size={20} />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-2">
                             {/* Vehicle Tag */}
                             {step.vehicle && (
                                <div className="inline-block bg-blue-600 text-white text-xs px-2 py-0.5 rounded-md font-bold mb-1">
                                    {step.vehicle}
                                </div>
                             )}
                             
                             <div 
                                className="font-bold text-lg text-slate-800 leading-snug"
                                dangerouslySetInnerHTML={{__html: step.instructions}} 
                            />
                            
                            {/* Transit Extra Details */}
                            {step.transitDetails && (
                                <div className="text-sm text-slate-500 mt-1">
                                    {step.transitDetails.headsign && <span>往 {step.transitDetails.headsign} • </span>}
                                    <span>{step.transitDetails.numStops} 站</span>
                                </div>
                            )}

                             {/* Specific Exit Bubble in Step */}
                             {step.exitInfo && (
                                <span className="inline-block mt-2 bg-orange-50 text-orange-700 text-xs px-2 py-1 rounded border border-orange-100 font-bold">
                                    📍 {step.exitInfo}
                                </span>
                             )}

                            <div className="text-slate-400 text-xs mt-1 font-mono">
                                {step.duration}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <p className="text-center text-slate-300 mt-6 text-xs">資料來源：Google Maps Platform</p>
        </div>
    </div>
  );
};

export default TrafficCard;