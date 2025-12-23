
import React, { useState, useEffect, useMemo } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Star, CheckCircle2, Zap, Upload, FileText, Car, Clock, Shield, XCircle, Camera, Phone, MessageSquare, Plus, Trash2, AlertCircle, LogOut, Download, MoreHorizontal, ChevronLeft, RefreshCw, ChevronDown, Map, Navigation as NavIcon, DollarSign, Users, ShieldAlert, Briefcase, TrendingUp, Check, X, Bell, HelpCircle, Ticket, Lock } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { getStaticMapUrl, generateRideSafetyBrief } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            if (!event.target?.result) {
                reject(new Error("File is empty"));
                return;
            }
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                } else {
                    reject(new Error("Canvas failed"));
                }
            };
        };
        reader.onerror = () => reject(new Error("File read failed"));
    });
};

const getDisplayDate = (dateStr: string, t: any, lang: string) => {
  if (!dateStr) return t.today;
  const today = toLocalISOString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalISOString(tomorrowDate);
  if (dateStr === today) return t.today;
  if (dateStr === tomorrow) return t.tomorrow;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

// --- Data & Constants ---
const STORAGE_KEY_RIDES = 'alloride_rides_v10'; 
const STORAGE_KEY_USERS = 'alloride_users_v2';

const MOCK_USER_TEMPLATE: UserType = {
  id: 'u1', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com', phone: '514-555-0199', role: 'passenger', avatar: 'https://i.pravatar.cc/150?u=alex', isVerified: true, driverStatus: 'approved', documentsUploaded: { license: true, insurance: true, photo: true }, rating: 4.9, totalRides: 142,
  vehicle: { make: "Toyota", model: "RAV4", year: "2023", color: "Midnight Black", plate: "K29 4F2" }
};

const PROVINCE_NAMES: Record<string, string> = {
    "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick", 
    "NL": "Newfoundland", "NS": "Nova Scotia", "NT": "Northwest Territories", "NU": "Nunavut",
    "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec", "SK": "Saskatchewan", "YT": "Yukon"
};

const CITIES_AND_SPOTS: Record<string, Record<string, string[]>> = {
  "QC": {
    "Montreal": ["Berri-UQAM", "Radisson", "YUL Airport", "Côte-Vertu", "Namur", "McGill", "Concordia"],
    "Quebec City": ["Gare du Palais", "Sainte-Foy", "Université Laval", "Old Quebec", "Galeries Capitale"],
    "Sherbrooke": ["Université de Sherbrooke", "Carrefour de l'Estrie", "Terminus", "Bishop's"],
    "Gatineau": ["Promenades", "Place du Portage", "Museum", "Cegep"],
    "Trois-Rivieres": ["Gare d'autocars", "UQTR", "Centre Les Rivières"],
    "Laval": ["Montmorency", "Carrefour Laval", "Centropolis"],
    "Longueuil": ["Longueuil Metro", "Place Longueuil", "Cégep"]
  },
  "ON": {
    "Toronto": ["Union Station", "YYZ Airport", "Yorkdale", "Scarborough TC", "CN Tower", "Fairview", "Kipling"],
    "Ottawa": ["Rideau Centre", "Train Station", "Bayshore", "Kanata", "Parliament", "UOttawa"],
    "Kingston": ["Queens", "Bus Terminal", "Carpool Lot"],
    "Mississauga": ["Square One", "Port Credit", "Heartland"],
    "London": ["Western U", "Masonville", "White Oaks"],
    "Hamilton": ["McMaster", "GO Centre", "Lime Ridge"],
    "Windsor": ["UWindsor", "Devonshire"]
  },
  "BC": {
    "Vancouver": ["Pacific Central", "UBC", "Waterfront", "YVR Airport", "Commercial-Bwy"],
    "Victoria": ["Mayfair", "UVic", "Swartz Bay"],
    "Kelowna": ["UBCO", "Orchard Park"],
    "Kamloops": ["TRU", "Aberdeen"],
    "Whistler": ["Gateway", "Creekside"]
  },
  "AB": {
    "Calgary": ["UCalgary", "Chinook", "Calgary Tower", "YYC Airport"],
    "Edmonton": ["West Edm Mall", "UAlberta", "Southgate"],
    "Banff": ["Train Station", "Transit Hub"],
    "Red Deer": ["College", "Bower Place"]
  }
};

const generateMockRides = (): Ride[] => {
    const rides: Ride[] = [];
    const drivers = [
        { id: 'd1', firstName: 'Jean', lastName: 'Tremblay', avatar: 'https://i.pravatar.cc/150?u=jean', rating: 4.8 },
        { id: 'd2', firstName: 'Sarah', lastName: 'Connor', avatar: 'https://i.pravatar.cc/150?u=sarah', rating: 4.9 },
        { id: 'd3', firstName: 'Mike', lastName: 'Ross', avatar: 'https://i.pravatar.cc/150?u=mike', rating: 4.7 },
        { id: 'd4', firstName: 'Amelie', lastName: 'Poulain', avatar: 'https://i.pravatar.cc/150?u=amelie', rating: 5.0 },
        { id: 'd5', firstName: 'David', lastName: 'Beck', avatar: 'https://i.pravatar.cc/150?u=david', rating: 4.6 }
    ];

    const provinceKeys = Object.keys(CITIES_AND_SPOTS);

    for (let i = 0; i < 35; i++) { 
        const originProv = provinceKeys[Math.floor(Math.random() * provinceKeys.length)];
        const originCities = Object.keys(CITIES_AND_SPOTS[originProv]);
        const originCity = originCities[Math.floor(Math.random() * originCities.length)];

        let destProv = originProv;
        if (Math.random() > 0.8) {
             destProv = provinceKeys[Math.floor(Math.random() * provinceKeys.length)];
        }
        
        const destCities = Object.keys(CITIES_AND_SPOTS[destProv]);
        let destCity = destCities[Math.floor(Math.random() * destCities.length)];

        let attempts = 0;
        while ((originCity === destCity && originProv === destProv) && attempts < 10) {
             destCity = destCities[Math.floor(Math.random() * destCities.length)];
             attempts++;
        }

        const driver = drivers[Math.floor(Math.random() * drivers.length)];
        
        const date = new Date();
        date.setDate(date.getDate() + Math.floor(Math.random() * 7));
        date.setHours(7 + Math.floor(Math.random() * 14), [0, 15, 30, 45][Math.floor(Math.random() * 4)], 0, 0);
        
        const arrival = new Date(date.getTime() + (2 + Math.random() * 4) * 3600000);

        rides.push({
            id: `mock-${i}-${Date.now()}`,
            driver: { ...MOCK_USER_TEMPLATE, ...driver, role: 'driver', id: driver.id } as UserType,
            origin: `${originCity}, ${originProv}`,
            destination: `${destCity}, ${destProv}`,
            price: 25 + Math.floor(Math.random() * 60),
            seatsAvailable: 1 + Math.floor(Math.random() * 3),
            totalSeats: 4,
            departureTime: date,
            arrivalTime: arrival,
            stops: [],
            currency: 'CAD',
            luggage: { small: 1, medium: 1, large: 0 },
            distanceKm: 250,
            features: { instantBook: Math.random() > 0.3, music: true, pets: false, smoking: false, wifi: Math.random() > 0.5, winterTires: true }
        });
    }
    return rides.sort((a,b) => a.departureTime.getTime() - b.departureTime.getTime());
};

const generateMockPendingDriver = (): UserType => {
    // A placeholder image for docs
    const placeholderDoc = "https://placehold.co/600x400/e2e8f0/475569?text=Document+Preview";
    
    return {
        id: 'mock-pending-driver-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '514-555-0199',
        role: 'driver',
        driverStatus: 'pending',
        isVerified: false,
        avatar: 'https://i.pravatar.cc/150?u=john',
        documentsUploaded: { license: true, insurance: true, photo: true },
        documentsData: {
            license: placeholderDoc,
            insurance: placeholderDoc,
            photo: 'https://i.pravatar.cc/150?u=john' // Selfie
        },
        rating: 0,
        totalRides: 0,
        vehicle: {
            make: 'Honda',
            model: 'Civic',
            year: '2022',
            color: 'Silver',
            plate: 'H32 KP9'
        }
    };
};

// --- Shared Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = true, disabled = false }: any) => {
  const baseStyle = "py-4 px-6 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none shadow-md";
  const variants: any = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-green-600 text-white hover:bg-green-700",
    outline: "border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
};

const Header = ({ title, subtitle, rightAction }: any) => (
  <div className="flex justify-between items-center mb-6 text-slate-900 px-1">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm font-medium text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {rightAction}
  </div>
);

const LocationInput = ({ label, city, setCity, spot, setSpot, province, setProvince, type = 'origin' }: any) => {
    const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    
    const spotsAvailable = province && city && CITIES_AND_SPOTS[province]?.[city];

    const handleCityChange = (val: string) => {
        setCity(val);
        setSpot('');
        if (province && CITIES_AND_SPOTS[province]) {
            const cities = Object.keys(CITIES_AND_SPOTS[province]);
            const filtered = cities.filter(c => c.toLowerCase().includes(val.toLowerCase()));
            setCitySuggestions(filtered);
            setShowCitySuggestions(true);
        }
    };

    const handleCitySelect = (val: string) => {
        setCity(val);
        setShowCitySuggestions(false);
    };

    const handleSpotSelect = (val: string) => {
        setSpot(val);
    };

    return (
        <div className="flex gap-4">
             {/* Timeline Visual */}
             <div className="flex flex-col items-center pt-2">
                 <div className={`w-3 h-3 rounded-full ${type === 'origin' ? 'bg-indigo-600 ring-4 ring-indigo-50' : 'bg-pink-600 ring-4 ring-pink-50'}`} />
                 {type === 'origin' && <div className="w-0.5 flex-1 bg-slate-200 min-h-[50px] my-1 rounded-full"></div>}
             </div>

             <div className="flex-1 pb-4">
                 <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</label>
                 
                 <div className="bg-slate-50 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-white focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                    <div className="flex items-center">
                        <div className="relative w-[30%] min-w-[90px] border-r border-slate-200">
                             <select
                                value={province}
                                onChange={(e) => { setProvince(e.target.value); setCity(''); setSpot(''); }}
                                className="w-full h-14 bg-transparent appearance-none outline-none font-bold text-slate-600 text-xs px-4 cursor-pointer"
                             >
                                {Object.keys(CITIES_AND_SPOTS).map(p => (
                                    <option key={p} value={p}>{PROVINCE_NAMES[p]}</option>
                                ))}
                             </select>
                             <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>

                        <div className="relative flex-1">
                            <input
                                value={city}
                                onChange={(e) => handleCityChange(e.target.value)}
                                placeholder={type === 'origin' ? "Departure City" : "Arrival City"}
                                className="w-full h-14 bg-transparent outline-none font-bold text-slate-900 text-sm px-4 placeholder:text-slate-300"
                                onFocus={() => { if(province) handleCityChange(city); }}
                            />
                             {showCitySuggestions && citySuggestions.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl mt-2 z-50 max-h-60 overflow-y-auto border border-slate-100 p-2">
                                    {citySuggestions.map(s => (
                                        <button key={s} onClick={() => handleCitySelect(s)} className="w-full text-left p-3 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-700 flex items-center gap-3 transition-colors">
                                            <MapPin size={14} className="text-slate-300"/>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                 </div>

                 {city && spotsAvailable && spotsAvailable.length > 0 && (
                    <div className="mt-2 animate-float-in">
                        <div className="relative flex items-center">
                            <div className="absolute left-3 text-slate-400"><NavIcon size={14} /></div>
                            <select
                                value={spot}
                                onChange={(e) => handleSpotSelect(e.target.value)}
                                className="w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-xl appearance-none outline-none font-medium text-slate-600 text-xs cursor-pointer hover:border-indigo-300 transition-colors"
                            >
                                <option value="" disabled>Specific meeting spot...</option>
                                {spotsAvailable.map((s: string) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-3 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                 )}
             </div>
        </div>
    );
};

const RideCard = ({ ride, onClick, t, lang, isPast = false }: any) => {
  const startTime = ride.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = ride.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rideDate = ride.departureTime.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isBooked = ride.bookedSeats && ride.bookedSeats > 0;
  const isFull = ride.seatsAvailable === 0;

  return (
    <div onClick={onClick} className={`bg-white rounded-2xl p-0 shadow-sm hover:shadow-md mb-4 active:scale-[0.99] transition-all cursor-pointer border border-slate-100 overflow-hidden ${isPast ? 'opacity-75 grayscale-[0.3]' : ''}`}>
      {/* Top Banner for Date/Status */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
         <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{rideDate}</span>
         <div className="flex gap-2">
            {isBooked && !isPast && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Booked</span>}
            {isFull && !isPast && !isBooked && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Full</span>}
            {isPast && <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Completed</span>}
         </div>
      </div>

      <div className="p-5 flex items-stretch">
          {/* Times and Line */}
          <div className="flex flex-col justify-between items-center mr-4 py-1">
              <div className="text-sm font-bold text-slate-900">{startTime}</div>
              <div className="w-0.5 flex-1 bg-slate-100 my-1 relative">
                 {/* Decor dots */}
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-300"></div>
              </div>
              <div className="text-sm font-bold text-slate-400">{endTime}</div>
          </div>

          {/* Locations */}
          <div className="flex-1 flex flex-col justify-between py-1 space-y-4">
              <div className="text-base font-bold text-slate-800 leading-tight">{ride.origin}</div>
              <div className="text-base font-bold text-slate-800 leading-tight">{ride.destination}</div>
          </div>

          {/* Price */}
          <div className="flex flex-col justify-between items-end pl-4 border-l border-slate-50">
              <div className="text-xl font-extrabold text-indigo-600">${ride.price}</div>
              <div className="flex flex-col items-end">
                   <div className="w-8 h-8 rounded-full bg-slate-100 mb-1 overflow-hidden">
                       <img src={ride.driver.avatar || 'https://i.pravatar.cc/150'} className="w-full h-full object-cover" />
                   </div>
                   <div className="flex items-center text-[10px] font-bold text-slate-400 gap-0.5">
                       {ride.driver.rating} <Star size={8} className="fill-yellow-400 text-yellow-400"/>
                   </div>
              </div>
          </div>
      </div>
      
      {/* Footer Info */}
      <div className="px-5 py-3 border-t border-slate-50 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
             <span className={`flex items-center gap-1 ${isFull ? 'text-red-500 font-bold' : ''}`}><Users size={12}/> {ride.seatsAvailable} seats left</span>
             {ride.features.instantBook && <span className="flex items-center gap-1 text-green-600"><Zap size={12}/> Instant</span>}
          </div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
              {ride.driver.firstName}
              {ride.driver.isVerified && <CheckCircle2 size={12} className="text-blue-500" />}
          </div>
      </div>
    </div>
  );
};

const LuggageCounter = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
    <div className="flex items-center justify-between p-3">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <div className="flex items-center gap-3">
            <button onClick={() => onChange(Math.max(0, value - 1))} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50">-</button>
            <span className="font-bold text-sm min-w-[12px] text-center">{value}</span>
            <button onClick={() => onChange(value + 1)} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center font-bold text-slate-500 hover:bg-slate-50">+</button>
        </div>
    </div>
);

// --- Auth & Onboarding Views ---

const AuthView = ({ onLogin, lang, setLang }: any) => {
  const t = translations[lang];
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>('passenger');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const handleAuth = (e: React.FormEvent) => {
      e.preventDefault();
      if (email === 'admin@alloride.com' && password === 'admin') {
          onLogin({ ...MOCK_USER_TEMPLATE, id: 'admin', role: 'admin', firstName: 'Admin', lastName: 'User' });
          return;
      }
      try {
        const storedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
        const existingUser = storedUsers.find((u: UserType) => u.email === email);

        if (isLogin) {
            if (existingUser) { onLogin(existingUser); } 
            else { alert("User not found. Please sign up first."); setIsLogin(false); }
        } else {
            if (existingUser) { alert("User already exists. Logging in."); onLogin(existingUser); return; }
            const newUser: UserType = {
                ...MOCK_USER_TEMPLATE, id: `u-${Date.now()}`, role, email, firstName, lastName, phone,
                avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
                driverStatus: role === 'driver' ? 'new' : undefined,
                isVerified: role === 'passenger'
            };
            if (role === 'driver') {
                newUser.isVerified = false;
                newUser.documentsUploaded = { license: false, insurance: false, photo: false };
            }
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([...storedUsers, newUser]));
            onLogin(newUser);
        }
      } catch (err) {
        // Fallback if storage fails
        console.error("Auth storage error", err);
        const newUser: UserType = {
            ...MOCK_USER_TEMPLATE, id: `u-${Date.now()}`, role, email, firstName, lastName, phone,
            avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
            driverStatus: role === 'driver' ? 'new' : undefined,
            isVerified: role === 'passenger'
        };
        onLogin(newUser);
      }
  };

  return (
    <div className="min-h-full bg-slate-900 flex flex-col items-center justify-center p-6 relative">
       <div className="absolute top-6 right-6 z-50 flex gap-2">
           <button onClick={() => setLang('en')} className="text-white text-xs font-bold opacity-80 hover:opacity-100">EN</button>
           <button onClick={() => setLang('fr')} className="text-white text-xs font-bold opacity-80 hover:opacity-100">FR</button>
       </div>
       <div className="w-full max-w-md">
          <div className="flex justify-center mb-8"><Logo size={120} /></div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem]">
             <div className="flex bg-black/30 p-1 rounded-xl mb-6">
                <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>{t.logIn}</button>
                <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>{t.signUp}</button>
             </div>
             
             <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                   <>
                       <div className="grid grid-cols-2 gap-3 mb-2">
                          <button type="button" onClick={() => setRole('passenger')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${role === 'passenger' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                             <User size={20} /><span className="text-xs font-bold">{t.passenger}</span>
                          </button>
                          <button type="button" onClick={() => setRole('driver')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${role === 'driver' ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                             <Car size={20} /><span className="text-xs font-bold">{t.driver}</span>
                          </button>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                           <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t.firstName} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl w-full focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" required />
                           <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t.lastName} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl w-full focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" required />
                       </div>
                       <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.phone} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl w-full focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" required />
                   </>
                )}
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} className="bg-black/20 border border-white/10 text-white p-4 rounded-xl w-full focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" required />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} className="bg-black/20 border border-white/10 text-white p-4 rounded-xl w-full focus:border-indigo-500 outline-none transition-colors placeholder:text-white/30" required />
                <Button type="submit" className="w-full mt-4 !bg-indigo-600 hover:!bg-indigo-500 !border-none !text-white !py-4 !shadow-indigo-500/20">{isLogin ? t.logIn : t.createAccount}</Button>
             </form>
          </div>
       </div>
    </div>
  );
};

const DriverOnboarding = ({ user, updateUser, onComplete, lang }: any) => {
    const t = translations[lang];
    const [step, setStep] = useState(1);
    const [docs, setDocs] = useState<any>({ license: null, insurance: null, photo: null });
    const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', plate: '' });

    const handleFile = async (e: any, key: string) => {
        if (e.target.files?.[0]) {
            try {
                const b64 = await compressImage(e.target.files[0]);
                setDocs({ ...docs, [key]: b64 });
            } catch (err) { alert("Image error"); }
        }
    };

    const finish = () => {
        const updated = {
            ...user,
            vehicle,
            avatar: docs.photo || user.avatar,
            driverStatus: 'pending',
            documentsData: docs
        };
        updateUser(updated);
        
        // Update user in storage
        const users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
        const updatedUsers = users.map((u: UserType) => u.id === user.id ? updated : u);
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updatedUsers));
        
        onComplete();
    };

    return (
        <div className="p-6 pt-12 bg-slate-50 h-full overflow-y-auto pb-32">
            <Header title={t.driverSetup} subtitle={`Step ${step}/2`} />
            {step === 1 ? (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Car size={20} className="text-indigo-600"/> Vehicle Info</h3>
                        <div className="space-y-3">
                            <input placeholder="Make (e.g. Toyota)" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="w-full p-4 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all font-bold" />
                            <input placeholder="Model (e.g. Camry)" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="w-full p-4 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all font-bold" />
                            <div className="flex gap-4">
                                <input placeholder="Year" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="w-full p-4 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all font-bold" />
                                <input placeholder="Plate Number" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="w-full p-4 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 rounded-xl outline-none transition-all font-bold" />
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => setStep(2)} disabled={!vehicle.make || !vehicle.model} className="mt-4">Next Step <ArrowRight size={18}/></Button>
                </div>
            ) : (
                <div className="space-y-6">
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><FileText size={20} className="text-indigo-600"/> Required Documents</h3>
                        <div className="space-y-3">
                            {['license', 'insurance', 'photo'].map(key => (
                                <div key={key} className={`p-4 rounded-xl border-2 border-dashed flex justify-between items-center relative transition-all ${docs[key] ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${docs[key] ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {docs[key] ? <CheckCircle2 size={20}/> : <Camera size={20}/>}
                                        </div>
                                        <span className="capitalize font-bold text-slate-700">{key === 'photo' ? 'Profile Selfie' : key}</span>
                                    </div>
                                    <input type="file" onChange={e => handleFile(e, key)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <Button onClick={finish} disabled={!docs.license || !docs.insurance || !docs.photo} className="mt-4">{t.submit}</Button>
                </div>
            )}
        </div>
    );
};

// --- Main Views ---

const HomeView = ({ user, allRides, bookedRides, setDetailRide, setView, lang }: any) => {
    const t = translations[lang];
    const now = new Date().getTime();
    
    // Filter out past rides for Search. Sort by date.
    const upcomingRides = allRides
        .filter((r: Ride) => r.departureTime.getTime() > now && r.seatsAvailable > 0)
        .sort((a: Ride, b: Ride) => a.departureTime.getTime() - b.departureTime.getTime());
        
    const myHistory = user.role === 'driver' ? allRides.filter((r: Ride) => r.driver.id === user.id) : [];

    return (
        <div className="h-full pb-32 overflow-y-auto bg-slate-50">
             <div className="bg-white p-6 pb-4 sticky top-0 z-10 border-b border-slate-100/50 backdrop-blur-md bg-white/90">
                 <div className="flex justify-between items-center mb-4">
                     <div>
                         <h1 className="text-2xl font-extrabold text-slate-900">{t.goodMorning},</h1>
                         <p className="text-slate-500 font-medium">{user.firstName}</p>
                     </div>
                     <img onClick={() => setView('profile')} src={user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}`} className="w-10 h-10 rounded-full border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity" />
                 </div>
                 
                 {user.role === 'passenger' && (
                     <div className="relative group" onClick={() => setView('search')}>
                         <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                             <Search className="text-indigo-500" size={20}/>
                         </div>
                         <div className="w-full bg-slate-100 text-slate-500 font-bold py-4 pl-12 rounded-2xl cursor-pointer group-hover:bg-slate-200 transition-colors shadow-inner">
                             {t.whereTo}
                         </div>
                     </div>
                 )}

                 {user.role === 'driver' && (
                     <div className="flex gap-3">
                         <div className="flex-1 bg-slate-900 text-white p-4 rounded-2xl shadow-lg shadow-slate-900/20">
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Earnings</div>
                             <div className="text-2xl font-extrabold">${myHistory.reduce((acc:number, r:Ride) => acc + (r.price * (r.totalSeats - r.seatsAvailable)), 0)}</div>
                         </div>
                          <div className={`flex-1 p-4 rounded-2xl border-2 flex flex-col justify-center items-center font-bold text-xs gap-1 ${user.driverStatus === 'pending' ? 'border-yellow-100 bg-yellow-50 text-yellow-700' : 'border-green-100 bg-green-50 text-green-700'}`}>
                             {user.driverStatus === 'pending' ? <Clock size={20}/> : <CheckCircle2 size={20}/>}
                             {user.driverStatus === 'pending' ? 'Pending' : 'Active'}
                         </div>
                     </div>
                 )}
             </div>

             <div className="px-4 py-6">
                 {user.role === 'passenger' && bookedRides.length > 0 && (
                     <div className="mb-8">
                         <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="font-extrabold text-lg text-slate-900">{t.yourTickets}</h2>
                         </div>
                         {bookedRides.map((r: Ride) => (
                             <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />
                         ))}
                     </div>
                 )}

                 <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="font-extrabold text-lg text-slate-900">{user.role === 'driver' ? t.activeTrips : t.featuredRides}</h2>
                 </div>
                 
                 {user.role === 'driver' ? (
                     myHistory.length > 0 ? myHistory.map((r: Ride) => <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />) : (
                         <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                             <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300"><Car size={24}/></div>
                             <p className="text-slate-400 font-bold text-sm">No trips posted yet.</p>
                             <button onClick={() => setView('post')} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">Post your first trip</button>
                         </div>
                     )
                 ) : (
                     <div className="space-y-4">
                        {upcomingRides.map((r: Ride) => <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />)}
                     </div>
                 )}
             </div>
        </div>
    );
};

const PostRideView = ({ user, onPublish, setView, lang, refreshUser }: any) => {
    const t = translations[lang];
    const [form, setForm] = useState({ price: 45, seats: 3, date: toLocalISOString(new Date()), time: '09:00', luggage: { small: 1, medium: 1, large: 0 } });
    
    const [originProv, setOriginProv] = useState('QC');
    const [originCity, setOriginCity] = useState('');
    const [originSpot, setOriginSpot] = useState('');

    const [destProv, setDestProv] = useState('QC');
    const [destCity, setDestCity] = useState('');
    const [destSpot, setDestSpot] = useState('');

    if (user.driverStatus !== 'approved') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Shield size={40} className="text-red-500" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{t.verificationRequired}</h2>
                <p className="text-slate-500 mb-8 max-w-[260px] mx-auto font-medium">Drivers must be approved by our team before posting trips.</p>
                <div className="space-y-3 w-full">
                    <Button onClick={refreshUser} className="w-full flex items-center justify-center gap-2"><RefreshCw size={18}/> Check Status</Button>
                    <Button onClick={() => setView('home')} variant="secondary">{t.backToHome}</Button>
                </div>
            </div>
        );
    }

    const handleSubmit = () => {
        if (!originCity || !destCity) {
            alert("Please select both origin and destination cities.");
            return;
        }

        const departure = new Date(`${form.date}T${form.time}`);
        const arrival = new Date(departure.getTime() + 10800000); 
        
        const originStr = originSpot ? `${originCity} (${originSpot}), ${originProv}` : `${originCity}, ${originProv}`;
        const destStr = destSpot ? `${destCity} (${destSpot}), ${destProv}` : `${destCity}, ${destProv}`;

        const newRide: Ride = {
            id: `ride-${Date.now()}`,
            driver: user,
            origin: originStr,
            destination: destStr,
            price: Number(form.price),
            seatsAvailable: Number(form.seats),
            totalSeats: Number(form.seats),
            departureTime: departure,
            arrivalTime: arrival,
            stops: [], currency: 'CAD', luggage: {small:1, medium:1, large:0}, distanceKm: 250,
            features: { instantBook: true, wifi: false, music: true, pets: false, smoking: false, winterTires: true }
        };
        onPublish(newRide);
        setView('home');
    };

    return (
        <div className="h-full bg-slate-50 flex flex-col">
            <div className="px-6 pt-12 pb-4">
                 <Header title={t.postRide} subtitle="Let's fill those empty seats" />
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6 relative overflow-hidden mb-4">
                    <LocationInput 
                        type="origin"
                        label="Pick-up" 
                        province={originProv} setProvince={setOriginProv}
                        city={originCity} setCity={setOriginCity}
                        spot={originSpot} setSpot={setOriginSpot}
                    />

                    <div className="w-full h-px bg-slate-100"></div>

                    <LocationInput 
                        type="destination"
                        label="Drop-off" 
                        province={destProv} setProvince={setDestProv}
                        city={destCity} setCity={setDestCity}
                        spot={destSpot} setSpot={setDestSpot}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                     <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors">
                         <div className="text-slate-400 text-[10px] font-bold uppercase mb-2 flex items-center gap-1"><Calendar size={12}/> Date</div>
                         <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-transparent font-bold text-sm outline-none text-slate-900 cursor-pointer" />
                     </div>
                     <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 transition-colors">
                         <div className="text-slate-400 text-[10px] font-bold uppercase mb-2 flex items-center gap-1"><Clock size={12}/> Time</div>
                         <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full bg-transparent font-bold text-sm outline-none text-slate-900 cursor-pointer" />
                     </div>
                </div>
                
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-4 flex items-center justify-between">
                     <div>
                         <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1"><DollarSign size={12}/> Price per seat</div>
                         <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="bg-transparent font-extrabold text-2xl outline-none text-indigo-600 w-24" />
                     </div>
                     <div className="h-10 w-px bg-slate-100 mx-4"></div>
                     <div className="flex-1">
                         <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1"><Users size={12}/> Seats</div>
                         <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1">
                             <button onClick={() => setForm(f => ({...f, seats: Math.max(1, f.seats - 1)}))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-slate-500 hover:text-indigo-600 transition-colors">-</button>
                             <span className="font-bold text-lg text-slate-900">{form.seats}</span>
                             <button onClick={() => setForm(f => ({...f, seats: Math.min(6, f.seats + 1)}))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center font-bold text-slate-500 hover:text-indigo-600 transition-colors">+</button>
                         </div>
                     </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Briefcase size={14}/> Luggage</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        <LuggageCounter label={t.small} value={form.luggage.small} onChange={(v) => setForm({...form, luggage: {...form.luggage, small: v}})} />
                        <LuggageCounter label={t.medium} value={form.luggage.medium} onChange={(v) => setForm({...form, luggage: {...form.luggage, medium: v}})} />
                        <LuggageCounter label={t.large} value={form.luggage.large} onChange={(v) => setForm({...form, luggage: {...form.luggage, large: v}})} />
                    </div>
                </div>

                <div className="mt-8 mb-8">
                     <Button onClick={handleSubmit} className="shadow-xl shadow-indigo-200 !py-4 !text-base">
                        {t.publishRide}
                        <ArrowRight size={20} />
                     </Button>
                </div>
            </div>
        </div>
    );
};

const SearchView = ({ allRides, setDetailRide, setView, lang }: any) => {
    const t = translations[lang];
    const [fromQuery, setFromQuery] = useState('');
    const [toQuery, setToQuery] = useState('');
    const [dateQuery, setDateQuery] = useState('');
    
    // Default to a future search if no date selected, otherwise filter by date
    const filtered = allRides.filter((r: Ride) => {
        const matchFrom = !fromQuery || r.origin.toLowerCase().includes(fromQuery.toLowerCase());
        const matchTo = !toQuery || r.destination.toLowerCase().includes(toQuery.toLowerCase());
        
        let matchDate = true;
        if (dateQuery) {
            const rDate = toLocalISOString(r.departureTime);
            matchDate = rDate === dateQuery;
        } else {
            // If no date, only show future rides
            matchDate = r.departureTime.getTime() > Date.now();
        }
        
        return matchFrom && matchTo && matchDate && r.seatsAvailable > 0;
    });

    return (
        <div className="h-full bg-slate-50 p-6 pt-12 pb-32 overflow-y-auto no-scrollbar">
            <h1 className="text-2xl font-extrabold mb-6 text-slate-900">{t.searchRides}</h1>
            
            <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 mb-8 space-y-4">
                {/* Inputs */}
                <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3 border border-transparent focus-within:bg-white focus-within:border-indigo-500 transition-all">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                        </div>
                        <input 
                            value={fromQuery}
                            onChange={(e) => setFromQuery(e.target.value)}
                            placeholder="Leaving from..." 
                            className="bg-transparent outline-none font-bold text-slate-900 w-full text-sm placeholder:text-slate-400"
                        />
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-3 border border-transparent focus-within:bg-white focus-within:border-indigo-500 transition-all">
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                            <MapPin size={14} className="fill-pink-600"/>
                        </div>
                        <input 
                            value={toQuery}
                            onChange={(e) => setToQuery(e.target.value)}
                            placeholder="Going to..." 
                            className="bg-transparent outline-none font-bold text-slate-900 w-full text-sm placeholder:text-slate-400"
                        />
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <div className="flex-1 bg-slate-50 p-3 rounded-2xl flex items-center gap-2 border border-transparent focus-within:bg-white focus-within:border-indigo-500 transition-all cursor-pointer relative">
                        <Calendar size={16} className="text-slate-400 ml-1"/>
                        <input 
                            type="date"
                            value={dateQuery}
                            onChange={(e) => setDateQuery(e.target.value)}
                            className="bg-transparent outline-none font-bold text-slate-900 w-full text-xs cursor-pointer z-10"
                        />
                    </div>
                    <button className="bg-slate-900 text-white w-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
                        <Search size={20} />
                    </button>
                </div>
            </div>
            
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-bold text-slate-900">{filtered.length} rides found</h3>
                {dateQuery && <button onClick={() => setDateQuery('')} className="text-xs font-bold text-indigo-600">Clear Date</button>}
            </div>

            <div className="space-y-4">
                {filtered.map((r: Ride) => (
                    <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-12 opacity-60">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <Search size={32}/>
                        </div>
                        <p className="font-bold text-slate-500">No rides found</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">Try changing your dates or removing location filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const RideDetailView = ({ ride, user, onBook, onDelete, setView, lang }: any) => {
    if(!ride) return null;
    const t = translations[lang];
    const [safety, setSafety] = useState('');
    useEffect(() => {
        generateRideSafetyBrief(ride.origin, ride.destination).then(setSafety);
    }, [ride]);

    return (
        <div className="h-full bg-slate-50 flex flex-col overflow-y-auto pb-32 no-scrollbar">
             <div className="relative h-72 shrink-0">
                 <img src={getStaticMapUrl(ride.destination)} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-slate-900/90"></div>
                 <button onClick={() => setView('home')} className="absolute top-6 left-6 bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors"><ChevronLeft size={24}/></button>
                 <div className="absolute bottom-0 left-0 w-full p-6 text-white">
                     <h1 className="text-4xl font-extrabold mb-2 leading-tight">{ride.destination.split(',')[0]}</h1>
                     <div className="flex items-center gap-4 text-sm font-bold opacity-90">
                         <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2"><Calendar size={14}/> {getDisplayDate(toLocalISOString(ride.departureTime), t, lang)}</span>
                         <span className="flex items-center gap-1"><Users size={14}/> {ride.seatsAvailable} seats</span>
                     </div>
                 </div>
             </div>
             
             <div className="p-6 space-y-6 -mt-6 relative z-10 rounded-t-3xl bg-slate-50">
                 {safety && (
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-xs font-medium text-indigo-900 flex gap-3 items-start">
                         <ShieldAlert className="shrink-0 text-indigo-600 mt-0.5" size={16} />
                         <span className="leading-relaxed">{safety}</span>
                     </div>
                 )}
                 
                 <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                     <div className="relative">
                         <img src={ride.driver.avatar} className="w-14 h-14 rounded-full border-2 border-slate-100" />
                         <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                             <div className="bg-green-500 w-3 h-3 rounded-full border-2 border-white"></div>
                         </div>
                     </div>
                     <div className="flex-1">
                         <div className="font-bold text-lg text-slate-900">{ride.driver.firstName}</div>
                         <div className="text-xs text-slate-500 font-bold flex items-center gap-1 mt-0.5"><Star size={12} className="text-yellow-400 fill-yellow-400"/> {ride.driver.rating} • {ride.driver.totalRides} rides</div>
                     </div>
                     <div className="text-right">
                         <div className="text-2xl font-extrabold text-indigo-600">${ride.price}</div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase">per seat</div>
                     </div>
                 </div>

                 <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex gap-5">
                     <div className="flex flex-col items-center pt-2">
                         <div className="w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-indigo-50"></div>
                         <div className="w-0.5 flex-1 bg-slate-100 my-1"></div>
                         <div className="w-3 h-3 rounded-full bg-pink-600 ring-4 ring-pink-50"></div>
                     </div>
                     <div className="space-y-8 flex-1 py-1">
                         <div>
                             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t.origin}</div>
                             <div className="font-bold text-lg text-slate-900 leading-tight">{ride.origin}</div>
                         </div>
                         <div>
                             <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t.destination}</div>
                             <div className="font-bold text-lg text-slate-900 leading-tight">{ride.destination}</div>
                         </div>
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                     <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center gap-2">
                         <Briefcase className="text-slate-300" size={24}/>
                         <span className="text-xs font-bold text-slate-600">Max Luggage</span>
                         <span className="text-xs font-medium text-slate-400">Medium Size</span>
                     </div>
                     <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center gap-2">
                         <Zap className="text-green-500" size={24}/>
                         <span className="text-xs font-bold text-slate-600">Instant Book</span>
                         <span className="text-xs font-medium text-slate-400">Enabled</span>
                     </div>
                 </div>
                 
                 <div className="pt-4">
                     {user.id === ride.driver.id ? (
                          <Button variant="danger" className="!py-4" onClick={() => onDelete(ride.id)}>{t.cancelTrip}</Button>
                     ) : (
                          <Button className="!py-4 shadow-xl shadow-indigo-200" onClick={() => onBook(ride)}>{t.bookSeat}</Button>
                     )}
                 </div>
             </div>
        </div>
    );
};

const WalletView = ({lang}: any) => {
    const t = translations[lang];
    return (
        <div className="p-6 pt-12 pb-32 h-full bg-slate-50 overflow-y-auto no-scrollbar">
            <h1 className="text-2xl font-extrabold mb-6 text-slate-900">{t.wallet}</h1>
            <div className="bg-slate-900 text-white p-8 rounded-[2rem] mb-8 shadow-2xl shadow-slate-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[60px] opacity-20"></div>
                <div className="relative z-10">
                    <div className="text-white/60 text-sm font-bold uppercase tracking-wider mb-2">{t.totalBalance}</div>
                    <div className="text-5xl font-extrabold tracking-tight">$128.50</div>
                </div>
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-4 px-1">{t.recentActivity}</h3>
            <div className="space-y-3">
                 <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                     <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                             <ArrowRight size={18} className="-rotate-45"/>
                         </div>
                         <div>
                             <div className="font-bold text-slate-900">Ride Payout</div>
                             <div className="text-xs text-slate-400 font-bold">Today, 2:30 PM</div>
                         </div>
                     </div>
                     <div className="font-bold text-green-600 text-lg">+$45.00</div>
                 </div>
            </div>
        </div>
    )
};

const ProfileView = ({ user, onLogout, lang, setLang, switchToAdmin }: any) => {
    const t = translations[lang];
    const [activeTab, setActiveTab] = useState<'menu' | 'edit' | 'notifications' | 'help'>('menu');

    if (activeTab === 'edit') {
        return (
            <div className="p-6 pt-12 h-full bg-slate-50 overflow-y-auto">
                <button onClick={() => setActiveTab('menu')} className="flex items-center gap-2 font-bold text-slate-500 mb-6 hover:text-indigo-600"><ChevronLeft size={20}/> Back</button>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Edit Profile</h1>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">Avatar</label>
                        <div className="flex items-center gap-4 mt-2">
                             <img src={user.avatar} className="w-16 h-16 rounded-full border border-slate-200" />
                             <button className="text-indigo-600 text-sm font-bold bg-indigo-50 px-4 py-2 rounded-xl">Change Photo</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                        <input defaultValue={`${user.firstName} ${user.lastName}`} className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold border-transparent border focus:bg-white focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                        <input defaultValue={user.email} className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold border-transparent border focus:bg-white focus:border-indigo-500 outline-none" />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                        <input defaultValue={user.phone} className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold border-transparent border focus:bg-white focus:border-indigo-500 outline-none" />
                    </div>
                    <Button className="mt-4">Save Changes</Button>
                </div>
            </div>
        );
    }

    if (activeTab === 'notifications') {
        return (
            <div className="p-6 pt-12 h-full bg-slate-50 overflow-y-auto">
                <button onClick={() => setActiveTab('menu')} className="flex items-center gap-2 font-bold text-slate-500 mb-6 hover:text-indigo-600"><ChevronLeft size={20}/> Back</button>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Notifications</h1>
                <div className="space-y-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 mt-1">
                                <Bell size={14} />
                            </div>
                            <div>
                                <div className="font-bold text-sm text-slate-900">Ride Reminder</div>
                                <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">Your ride to Montreal is coming up tomorrow at 9:00 AM. Don't be late!</div>
                                <div className="text-[10px] font-bold text-slate-300 mt-2">2 hours ago</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (activeTab === 'help') {
        return (
             <div className="p-6 pt-12 h-full bg-slate-50 overflow-y-auto">
                <button onClick={() => setActiveTab('menu')} className="flex items-center gap-2 font-bold text-slate-500 mb-6 hover:text-indigo-600"><ChevronLeft size={20}/> Back</button>
                <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Help & Support</h1>
                <div className="space-y-3">
                     <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center cursor-pointer hover:border-indigo-200">
                         <span className="font-bold text-slate-700">FAQ</span>
                         <ChevronLeft size={16} className="rotate-180 text-slate-300"/>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center cursor-pointer hover:border-indigo-200">
                         <span className="font-bold text-slate-700">Contact Support</span>
                         <ChevronLeft size={16} className="rotate-180 text-slate-300"/>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center cursor-pointer hover:border-indigo-200">
                         <span className="font-bold text-slate-700">Safety Center</span>
                         <ChevronLeft size={16} className="rotate-180 text-slate-300"/>
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 pt-12 pb-32 h-full bg-slate-50 overflow-y-auto no-scrollbar">
            <div className="flex flex-col items-center mb-10">
                <div className="relative">
                    <img src={user.avatar} className="w-28 h-28 rounded-full border-4 border-white shadow-xl mb-4 object-cover" />
                    {user.isVerified && <div className="absolute bottom-4 right-0 bg-blue-500 text-white p-1.5 rounded-full border-4 border-white"><CheckCircle2 size={16}/></div>}
                </div>
                <h2 className="text-2xl font-extrabold text-slate-900">{user.firstName} {user.lastName}</h2>
                <div className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold mt-2 uppercase tracking-wide">{user.role}</div>
            </div>
            
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 mb-6 flex">
                 <button onClick={() => setLang('en')} className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${lang === 'en' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
                 <button onClick={() => setLang('fr')} className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all ${lang === 'fr' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Français</button>
            </div>
            
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden mb-6">
                 <button onClick={() => setActiveTab('edit')} className="w-full p-5 flex items-center justify-between border-b border-slate-50 hover:bg-slate-50 transition-colors">
                     <span className="font-bold text-slate-700">Edit Profile</span>
                     <ChevronDown className="-rotate-90 text-slate-300" size={16}/>
                 </button>
                 <button onClick={() => setActiveTab('notifications')} className="w-full p-5 flex items-center justify-between border-b border-slate-50 hover:bg-slate-50 transition-colors">
                     <span className="font-bold text-slate-700">Notifications</span>
                     <ChevronDown className="-rotate-90 text-slate-300" size={16}/>
                 </button>
                 <button onClick={() => setActiveTab('help')} className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                     <span className="font-bold text-slate-700">Help & Support</span>
                     <ChevronDown className="-rotate-90 text-slate-300" size={16}/>
                 </button>
            </div>

            {/* ADMIN ACCESS BUTTON */}
            <div className="mb-6">
                <button 
                    onClick={switchToAdmin}
                    className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold flex items-center justify-between shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <Lock size={20} />
                        <span>Admin Dashboard Access</span>
                    </div>
                    <ArrowRight size={20} />
                </button>
            </div>

            <Button variant="danger" onClick={onLogout} className="w-full flex items-center justify-center gap-2 !py-4"><LogOut size={18}/> {t.signOut}</Button>
            
            <p className="text-center text-xs font-bold text-slate-300 mt-8">Version 1.2.0</p>
        </div>
    )
};

const AdminView = ({ lang, allUsers, rides, onVerifyDriver, refreshData }: any) => {
    const t = translations[lang];
    const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'routes'>('drivers'); // Default to drivers to fix user issue faster
    
    // Derived state
    const pendingDrivers = useMemo(() => allUsers.filter((u: UserType) => u.driverStatus === 'pending'), [allUsers]);
    const upcomingRides = useMemo(() => rides.filter((r: Ride) => new Date(r.departureTime) > new Date()).sort((a:Ride,b:Ride)=> a.departureTime.getTime() - b.departureTime.getTime()), [rides]);
    const pastRides = useMemo(() => rides.filter((r: Ride) => new Date(r.departureTime) <= new Date()), [rides]);
    
    const [selectedDriver, setSelectedDriver] = useState<UserType | null>(null);

    return (
        <div className="p-6 pt-12 pb-32 h-full bg-slate-50 overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-extrabold text-slate-900">{t.adminDashboard}</h1>
                <button onClick={refreshData} className="p-2 bg-white border border-slate-200 rounded-full shadow-sm text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors">
                    <RefreshCw size={20}/>
                </button>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm mb-6">
                <button onClick={() => setActiveTab('overview')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}>Overview</button>
                <button onClick={() => setActiveTab('drivers')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'drivers' ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}>
                    Drivers {pendingDrivers.length > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] ml-1">{pendingDrivers.length}</span>}
                </button>
                <button onClick={() => setActiveTab('routes')} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'routes' ? 'bg-slate-900 text-white shadow' : 'text-slate-500'}`}>Routes</button>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6 animate-float-in">
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Earnings</h3>
                            <div className="text-4xl font-extrabold">$12,450.00</div>
                            <div className="flex items-center gap-2 mt-4 text-xs font-bold text-green-400 bg-green-400/10 w-fit px-2 py-1 rounded-lg">
                                <TrendingUp size={14}/> +12% this week
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-30"></div>
                    </div>

                    <LeaderboardChart />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Total Users</div>
                            <div className="text-2xl font-extrabold text-slate-900">{allUsers.length}</div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Total Routes</div>
                            <div className="text-2xl font-extrabold text-slate-900">{rides.length}</div>
                        </div>
                         <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">Pending Drivers</div>
                            <div className="text-2xl font-extrabold text-amber-500">{pendingDrivers.length}</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'drivers' && (
                <div className="space-y-4 animate-float-in">
                     {selectedDriver ? (
                         <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg">
                             <button onClick={() => setSelectedDriver(null)} className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"><ChevronLeft size={16}/> Back to list</button>
                             
                             <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-50">
                                 <img src={selectedDriver.avatar} className="w-16 h-16 rounded-full border-2 border-slate-100 object-cover"/>
                                 <div>
                                     <div className="text-xl font-extrabold text-slate-900">{selectedDriver.firstName} {selectedDriver.lastName}</div>
                                     <div className="text-xs font-bold text-slate-400">{selectedDriver.email}</div>
                                     <div className="text-xs font-bold text-slate-400">{selectedDriver.phone}</div>
                                 </div>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Vehicle</div>
                                    <div className="font-bold text-slate-800 text-sm">{selectedDriver.vehicle?.year} {selectedDriver.vehicle?.make}</div>
                                    <div className="text-xs text-slate-500 font-medium">{selectedDriver.vehicle?.model} • {selectedDriver.vehicle?.plate}</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</div>
                                    <div className="font-bold text-amber-600 text-sm uppercase flex items-center gap-1"><Clock size={14}/> Pending</div>
                                </div>
                             </div>

                             <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><FileText size={16} className="text-indigo-500"/> Submitted Documents</h3>
                             <div className="space-y-4 mb-8">
                                 {selectedDriver.documentsData?.license ? (
                                     <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                         <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500 flex justify-between items-center">
                                             <span>Driver's License</span>
                                             <div className="flex items-center gap-2">
                                                 <a href={selectedDriver.documentsData.license} download={`license-${selectedDriver.id}.jpg`} className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors" title="Download">
                                                     <Download size={14}/>
                                                 </a>
                                                 <CheckCircle2 size={14} className="text-green-500"/>
                                             </div>
                                         </div>
                                         <img src={selectedDriver.documentsData.license} className="w-full h-48 object-cover bg-slate-100" />
                                     </div>
                                 ) : <div className="p-4 bg-red-50 text-red-500 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2"><XCircle size={16}/> Missing License</div>}
                                 
                                  {selectedDriver.documentsData?.insurance ? (
                                     <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                         <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500 flex justify-between items-center">
                                             <span>Insurance Policy</span>
                                             <div className="flex items-center gap-2">
                                                 <a href={selectedDriver.documentsData.insurance} download={`insurance-${selectedDriver.id}.jpg`} className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors" title="Download">
                                                     <Download size={14}/>
                                                 </a>
                                                 <CheckCircle2 size={14} className="text-green-500"/>
                                             </div>
                                         </div>
                                         <img src={selectedDriver.documentsData.insurance} className="w-full h-48 object-cover bg-slate-100" />
                                     </div>
                                 ) : <div className="p-4 bg-red-50 text-red-500 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2"><XCircle size={16}/> Missing Insurance</div>}
                                 
                                  {selectedDriver.documentsData?.photo ? (
                                     <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                         <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500 flex justify-between items-center">
                                             <span>Verification Selfie</span>
                                              <div className="flex items-center gap-2">
                                                 <a href={selectedDriver.documentsData.photo} download={`photo-${selectedDriver.id}.jpg`} className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors" title="Download">
                                                     <Download size={14}/>
                                                 </a>
                                                 <CheckCircle2 size={14} className="text-green-500"/>
                                             </div>
                                         </div>
                                         <img src={selectedDriver.documentsData.photo} className="w-full h-48 object-cover bg-slate-100" />
                                     </div>
                                 ) : <div className="p-4 bg-red-50 text-red-500 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2"><XCircle size={16}/> Missing Photo</div>}
                             </div>

                             <div className="flex gap-3 pt-4 border-t border-slate-100">
                                 <Button variant="danger" className="flex-1" onClick={() => { onVerifyDriver(selectedDriver.id, false); setSelectedDriver(null); }}>
                                     <X size={18}/> Reject
                                 </Button>
                                 <Button variant="success" className="flex-1" onClick={() => { onVerifyDriver(selectedDriver.id, true); setSelectedDriver(null); }}>
                                     <Check size={18}/> Approve
                                 </Button>
                             </div>
                         </div>
                     ) : (
                        <>
                             {pendingDrivers.length === 0 && (
                                 <div className="text-center py-20 bg-white rounded-[2rem] border border-dashed border-slate-200">
                                     <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                         <CheckCircle2 size={32}/>
                                     </div>
                                     <p className="font-bold text-slate-400">All caught up!</p>
                                     <p className="text-xs text-slate-400 mt-1">No pending applications</p>
                                 </div>
                             )}
                             {pendingDrivers.map(driver => (
                                 <div key={driver.id} onClick={() => setSelectedDriver(driver)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500/20 transition-all">
                                     <div className="flex items-center gap-4">
                                         <div className="relative">
                                             <img src={driver.avatar} className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover"/>
                                             <div className="absolute -bottom-1 -right-1 bg-amber-500 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">1</div>
                                         </div>
                                         <div>
                                             <div className="font-bold text-slate-900 text-lg">{driver.firstName} {driver.lastName}</div>
                                             <div className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md w-fit mt-1">Review Needed</div>
                                         </div>
                                     </div>
                                     <div className="bg-slate-50 p-2 rounded-full text-slate-400">
                                        <ChevronLeft className="rotate-180" size={20}/>
                                     </div>
                                 </div>
                             ))}
                        </>
                     )}
                </div>
            )}

            {activeTab === 'routes' && (
                <div className="space-y-6 animate-float-in">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Routes ({upcomingRides.length})</h3>
                        </div>
                        {upcomingRides.length === 0 ? <p className="text-sm text-slate-400 italic pl-4">No upcoming rides scheduled.</p> : 
                            upcomingRides.map(ride => (
                                <div key={ride.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-3">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Calendar size={12}/> {new Date(ride.departureTime).toLocaleDateString()}</span>
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Scheduled</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="font-bold text-slate-900 text-sm">{ride.origin.split(',')[0]}</div>
                                        <div className="h-px bg-slate-200 flex-1 relative">
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 p-1 rounded-full"><ArrowRight size={10} className="text-slate-400"/></div>
                                        </div>
                                        <div className="font-bold text-slate-900 text-sm">{ride.destination.split(',')[0]}</div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-50 pt-2">
                                         <div className="flex items-center gap-2">
                                             <img src={ride.driver.avatar} className="w-6 h-6 rounded-full border border-slate-100"/>
                                             <span className="text-xs font-bold text-slate-600">{ride.driver.firstName}</span>
                                         </div>
                                         <span className="text-indigo-600 font-extrabold text-sm">${ride.price}</span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Past History ({pastRides.length})</h3>
                        </div>
                        {pastRides.map(ride => (
                             <div key={ride.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-3 opacity-60 hover:opacity-100 transition-opacity">
                                 <div className="flex justify-between items-start mb-2">
                                     <div className="text-xs font-bold text-slate-500">{new Date(ride.departureTime).toLocaleDateString()}</div>
                                     <div className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Completed</div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <div className="font-bold text-slate-700 text-sm">{ride.origin.split(',')[0]}</div>
                                     <ArrowRight size={12} className="text-slate-300"/>
                                     <div className="font-bold text-slate-700 text-sm">{ride.destination.split(',')[0]}</div>
                                 </div>
                             </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
};

export const App = () => {
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<UserType | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [rides, setRides] = useState<Ride[]>([]);
  const [detailRide, setDetailRide] = useState<Ride | null>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Function to load users from storage, ensuring fresh data
  const loadUsers = () => {
      const storedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      
      // MOCK INJECTION: Check if we need to inject a pending driver
      const hasPending = storedUsers.some((u:UserType) => u.driverStatus === 'pending');
      if (!hasPending) {
          const mockPending = generateMockPendingDriver();
          const updatedUsers = [...storedUsers, mockPending];
          setAllUsers(updatedUsers);
      } else {
          setAllUsers(storedUsers);
      }
  };

  // Initialize Data
  useEffect(() => {
    // Load Rides
    const loadedRides = localStorage.getItem(STORAGE_KEY_RIDES);
    if (loadedRides) {
       const parsed = JSON.parse(loadedRides).map((r: any) => ({
           ...r,
           departureTime: new Date(r.departureTime),
           arrivalTime: new Date(r.arrivalTime)
       }));
       setRides(parsed);
    } else {
       setRides(generateMockRides());
    }
    
    loadUsers();
  }, []);

  const handleLogin = (u: UserType) => {
      setUser(u);
      setView('home');
      loadUsers();
  };

  const handlePublish = (ride: Ride) => {
      const newRides = [...rides, ride];
      setRides(newRides);
      localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(newRides));
  };
  
  const handleBook = (ride: Ride) => {
      setBookingSuccess(true);
      setTimeout(() => {
          setBookingSuccess(false);
          setView('home');
      }, 3000);
  };

  const handleDeleteRide = (id: string) => {
      const newRides = rides.filter(r => r.id !== id);
      setRides(newRides);
      localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(newRides));
      setView('home');
  };

  const handleVerifyDriver = (userId: string, isApproved: boolean) => {
      const updatedUsers = allUsers.map(u => {
          if (u.id === userId) {
              return { ...u, driverStatus: isApproved ? 'approved' : 'rejected', isVerified: isApproved };
          }
          return u;
      });
      setAllUsers(updatedUsers as UserType[]);
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updatedUsers));
      
      // Update local user state immediately if it matches
      if (user && user.id === userId) {
          setUser({ ...user, driverStatus: isApproved ? 'approved' : 'rejected', isVerified: isApproved });
      }
      
      alert(`Driver ${isApproved ? 'Approved' : 'Rejected'}`);
  };

  const handleRefreshUser = () => {
      if(!user) return;
      const storedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      const updatedSelf = storedUsers.find((u:UserType) => u.id === user.id);
      if(updatedSelf) setUser(updatedSelf);
  };

  // Helper to switch role for demo/admin purposes
  const handleSwitchToAdmin = () => {
      setView('admin');
  };

  if (!user) {
      return <AuthView onLogin={handleLogin} lang={lang} setLang={setLang} />;
  }

  if (user.role === 'driver' && user.driverStatus === 'new') {
      return <DriverOnboarding user={user} updateUser={setUser} onComplete={() => setView('home')} lang={lang} />;
  }

  return (
    <div className="h-screen w-full bg-slate-900 flex justify-center overflow-hidden">
        <div className="w-full max-w-md bg-slate-50 relative shadow-2xl h-full flex flex-col">
            <div className="flex-1 overflow-hidden relative">
                {view === 'home' && <HomeView user={user} allRides={rides} bookedRides={[]} setDetailRide={setDetailRide} setView={setView} lang={lang} />}
                {view === 'search' && <SearchView allRides={rides} setDetailRide={setDetailRide} setView={setView} lang={lang} />}
                {view === 'post' && <PostRideView user={user} onPublish={handlePublish} setView={setView} lang={lang} refreshUser={handleRefreshUser} />}
                {view === 'wallet' && <WalletView lang={lang} />}
                {view === 'profile' && <ProfileView user={user} onLogout={() => setUser(null)} lang={lang} setLang={setLang} switchToAdmin={handleSwitchToAdmin} />}
                {view === 'ride-detail' && <RideDetailView ride={detailRide} user={user} onBook={handleBook} onDelete={handleDeleteRide} setView={setView} lang={lang} />}
                {view === 'admin' && <AdminView lang={lang} allUsers={allUsers} rides={rides} onVerifyDriver={handleVerifyDriver} refreshData={loadUsers} />}
                
                {/* Booking Success Overlay */}
                {bookingSuccess && (
                    <div className="absolute inset-0 z-50 bg-indigo-600 flex flex-col items-center justify-center text-white animate-fade-in">
                        <div className="bg-white/20 p-6 rounded-full mb-6 animate-bounce">
                            <Ticket size={48} className="text-white"/>
                        </div>
                        <h2 className="text-3xl font-extrabold mb-2">You're Booked!</h2>
                        <p className="text-white/80 font-medium">Pack your bags, you're going places.</p>
                    </div>
                )}
            </div>
            <Navigation currentView={view} setView={setView} lang={lang} userRole={user.role} />
        </div>
    </div>
  );
};
