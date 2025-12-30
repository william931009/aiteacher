
import { TrafficResult, TrafficStep } from '../types';

// Declare google variable and global handlers to avoid TS errors
declare var google: any;
declare global {
    interface Window {
        gm_authFailure?: () => void;
        initGoogleMaps?: () => void;
    }
}

let googleMapsPromise: Promise<void> | null = null;
let currentLoadedKey: string | null = null;

// Helper to dynamically load the Google Maps Script
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
    // If key changed, reset promise to force reload
    if (apiKey !== currentLoadedKey) {
        googleMapsPromise = null;
        currentLoadedKey = apiKey;
        
        // Clean up old script tags
        const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
        existingScripts.forEach(s => s.remove());
    }

    if (googleMapsPromise) return googleMapsPromise;

    googleMapsPromise = new Promise((resolve, reject) => {
        // Check if already available globally and fully loaded
        if (typeof google !== 'undefined' && google.maps && google.maps.DirectionsService) {
            resolve();
            return;
        }

        // Setup Global Auth Failure Handler
        window.gm_authFailure = () => {
            console.error("Google Maps Auth Failure detected.");
            alert("Google Maps API Key 無效！請確認 Key 正確且已啟用 'Maps JavaScript API'。");
            window.dispatchEvent(new Event('google-maps-auth-failure'));
        };

        // Setup Success Callback (Required for loading=async)
        window.initGoogleMaps = () => {
            resolve();
        };

        const script = document.createElement('script');
        // Use callback=initGoogleMaps
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=zh-TW&loading=async&callback=initGoogleMaps`;
        script.async = true;
        script.defer = true;
        
        script.onerror = () => {
            reject(new Error("Google Maps Script failed to load. Check Network/API Key."));
        };

        document.head.appendChild(script);
    });

    return googleMapsPromise;
};

/**
 * Localization Helper: Converts generic/English names to Taiwanese terms.
 * e.g. "High-Speed Rail" -> "高鐵", "Subway" -> "捷運"
 */
const formatVehicleName = (name: string, vehicleType?: string): string => {
    const n = name.toLowerCase();
    const t = vehicleType ? vehicleType.toUpperCase() : '';

    // 1. High Speed Rail (高鐵)
    if (t === 'HIGH_SPEED_RAIL' || n.includes('high speed') || n.includes('high-speed') || n.includes('高速火車')) {
        return '高鐵';
    }

    // 2. MRT / Subway (捷運)
    if (t === 'SUBWAY' || t === 'METRO' || t === 'HEAVY_RAIL' || n.includes('metro') || n.includes('subway') || n.includes('捷運') || n.includes('地下鐵')) {
        // If the name is generic, return "捷運"
        if (n === 'subway' || n === 'metro' || n === '地下鐵' || n === '捷運') return '捷運';
        // If specific (e.g. "Red Line"), we usually keep it, but ensure it doesn't sound foreign.
        // For Google Maps in TW, "Red Line" usually comes as "淡水信義線", which is fine.
        return name; 
    }

    // 3. Train (火車)
    if (t === 'RAIL' || n.includes('train') || n.includes('rail') || n.includes('鐵路')) {
        // Keep specific train names like "Local Train" (區間車) if localized, 
        // but if generic "Train", return "火車".
        if (n === 'train' || n === 'railway' || n === '鐵路') return '火車';
    }

    // 4. Bus / Intercity (公車/客運)
    if (t === 'INTERCITY_BUS' || n.includes('intercity') || n.includes('客運')) {
        return '客運';
    }
    if (t === 'BUS' || n.includes('bus') || n.includes('公車')) {
        // If name is just "Bus", return "公車". If it's "307", keep "307".
        if (n === 'bus' || n === '公車') return '公車';
    }

    return name;
};

// Simple formatter for fallback time
const formatSimpleTime = (date: Date): string => {
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const searchRoute = async (
    origin: string, 
    destination: string, 
    apiKey: string, 
    departureTimeStr?: string,
    preferredMode?: string
): Promise<TrafficResult> => {
    
    if (!apiKey) {
        throw new Error("請先在設定輸入 Google Maps API Key");
    }

    try {
        await loadGoogleMapsScript(apiKey);
    } catch (e) {
        throw new Error("無法載入地圖元件，請檢查 API Key 是否正確");
    }

    return new Promise((resolve, reject) => {
        if (typeof google === 'undefined' || !google.maps || !google.maps.DirectionsService) {
            reject(new Error("Google Maps SDK 尚未就緒"));
            return;
        }

        const directionsService = new google.maps.DirectionsService();

        // 1. Configure Request Options with Time and Mode
        const requestOptions: any = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            provideRouteAlternatives: false,
            language: 'zh-TW',
            transitOptions: {} // Init transit options
        };

        // Handle Departure Time
        let requestedDepDate: Date | null = null;
        if (departureTimeStr && departureTimeStr !== 'now') {
            requestedDepDate = new Date(departureTimeStr);
            // Verify date is valid
            if (!isNaN(requestedDepDate.getTime())) {
                requestOptions.transitOptions.departureTime = requestedDepDate;
            } else {
                requestedDepDate = null;
            }
        }

        // Handle Preferred Mode (TRAIN / BUS / SUBWAY)
        if (preferredMode) {
            const modeMap: {[key: string]: any} = {
                'TRAIN': google.maps.TransitMode.TRAIN, // Covers Intercity Rail & HSR
                'BUS': google.maps.TransitMode.BUS,
                'SUBWAY': google.maps.TransitMode.SUBWAY
            };
            const mode = modeMap[preferredMode];
            if (mode) {
                // If user specifies a mode, we configure the API to prioritize/restrict to it.
                requestOptions.transitOptions.modes = [mode];
            }
        }

        directionsService.route(
            requestOptions,
            (response: any, status: string) => {
                if (status === 'OK' && response.routes.length > 0) {
                    const route = response.routes[0];
                    const leg = route.legs[0];
                    
                    // --- 1. Departure Time Logic ---
                    // Ensures departureTime is never undefined.
                    // Priority: 1. API Text, 2. API Value (Formatted), 3. Requested Time (Formatted), 4. "立即"
                    
                    let departureTime = '';
                    let startMs = 0;

                    if (leg.departure_time) {
                        departureTime = leg.departure_time.text || '';
                        if (leg.departure_time.value) {
                            startMs = leg.departure_time.value.getTime();
                            // Fix: If text is missing but we have value, format it.
                            if (!departureTime) {
                                departureTime = formatSimpleTime(leg.departure_time.value);
                            }
                        }
                    }
                    
                    // If still no departure time (e.g. driving/walking or API didn't return leg.departure_time)
                    if (!departureTime) {
                         if (requestedDepDate) {
                            departureTime = formatSimpleTime(requestedDepDate);
                            startMs = requestedDepDate.getTime();
                         } else {
                            departureTime = '立即';
                            startMs = Date.now();
                         }
                    }

                    // --- 2. Arrival Time Calculation ---
                    // Often missing for future dates in API response. We calculate it: Start + Duration.
                    let arrivalTime = leg.arrival_time?.text;
                    if (!arrivalTime) {
                        const durationSecs = leg.duration?.value || 0;
                        if (startMs > 0 && durationSecs > 0) {
                            const endMs = startMs + (durationSecs * 1000);
                            arrivalTime = formatSimpleTime(new Date(endMs));
                        } else {
                             arrivalTime = '未定';
                        }
                    }

                    // --- 3. Fare Calculation ---
                    // If route-level fare is missing (common with mixed agencies), sum up leg fares.
                    let fareText = route.fare ? route.fare.text : ''; 
                    
                    if (!fareText) {
                        let totalVal = 0;
                        let currency = '';
                        let hasFare = false;

                        // Iterate legs (usually 1, but multiple for complex transfers)
                        if (route.legs) {
                            route.legs.forEach((l: any) => {
                                if (l.fare && l.fare.value) {
                                    totalVal += l.fare.value;
                                    currency = l.fare.currency || 'TWD';
                                    hasFare = true;
                                }
                            });
                        }
                        
                        if (hasFare) {
                            if (currency === 'TWD' || currency === 'NT$') {
                                fareText = `$${totalVal}`;
                            } else {
                                fareText = `${currency} ${totalVal}`;
                            }
                        }
                    }

                    let mainVehicle = '';
                    let bestExit = '';

                    const steps: TrafficStep[] = leg.steps.map((s: any) => {
                        let type: 'TRANSIT' | 'WALK' | 'OTHER' = 'OTHER';
                        let vehicleName = '';
                        let transitDetails = undefined;
                        let exitInfo = undefined;

                        if (s.travel_mode === 'TRANSIT') {
                            type = 'TRANSIT';
                            const line = s.transit.line;
                            
                            // Get raw name
                            const rawName = line.short_name || line.name || line.vehicle?.name || '公車/火車';
                            const vehicleType = line.vehicle?.type;

                            // Apply Localization
                            vehicleName = formatVehicleName(rawName, vehicleType);
                            
                            // Save detailed info
                            transitDetails = {
                                lineName: line.name || '',
                                headsign: s.transit.headsign || '',
                                numStops: s.transit.num_stops || 0
                            };

                            // Update main summary vehicle (Take the first major transit)
                            if (!mainVehicle) {
                                // Prioritize heavy transit for summary
                                if (vehicleName === '高鐵' || vehicleName === '火車' || vehicleName === '捷運' || vehicleName === '客運') {
                                     mainVehicle = vehicleName;
                                } else if (!mainVehicle) {
                                     mainVehicle = vehicleName;
                                }
                            }

                        } else if (s.travel_mode === 'WALKING') {
                            type = 'WALK';
                            const exitRegex = /(出口\s*[A-Za-z0-9]+|[A-Za-z0-9]+\s*號?出口|Exit\s*[A-Za-z0-9]+)/i;
                            const match = s.instructions.match(exitRegex);
                            if (match) {
                                exitInfo = match[0];
                                if (!bestExit) bestExit = exitInfo; 
                            }
                        }

                        return {
                            type,
                            instructions: s.instructions,
                            distance: s.distance.text,
                            duration: s.duration.text,
                            vehicle: vehicleName,
                            transitDetails,
                            exitInfo
                        };
                    });

                    // Fallback
                    if (!mainVehicle) mainVehicle = '大眾運輸';

                    resolve({
                        origin: origin,
                        destination: destination,
                        totalDuration: leg.duration.text,
                        steps: steps,
                        departureTime,
                        arrivalTime,
                        fare: fareText,
                        mainVehicle,
                        bestExit
                    });
                } else {
                    console.error("Maps Direction Status:", status);
                    if (status === 'REQUEST_DENIED') {
                         reject(new Error("API Key 權限不足或無效 (REQUEST_DENIED)"));
                    } else if (status === 'ZERO_RESULTS') {
                        reject(new Error("找不到符合條件的路線"));
                    } else {
                        reject(new Error(`查詢失敗: ${status}`));
                    }
                }
            }
        );
    });
};
