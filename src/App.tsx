
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Star, CheckCircle2, Zap, Upload, FileText, Car, Clock, Shield, XCircle, Camera, Phone, MessageSquare, Plus, Trash2, AlertCircle, LogOut, Download, MoreHorizontal, ChevronLeft, RefreshCw, ChevronDown, Map, Navigation as NavIcon, DollarSign, Users, ShieldAlert } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { getStaticMapUrl, generateRideSafetyBrief } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const downloadBase64 = (base64: string, filename: string) => {
  const link = document.createElement('a');
  link.href = base64;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Aggressive Image Compression
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
                const MAX_WIDTH = 500;
                const MAX_HEIGHT = 500;
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
                    resolve(canvas.toDataURL('image/jpeg', 0.5));
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
const STORAGE_KEY_RIDES = 'alloride_rides_v9'; 
const STORAGE_KEY_USERS = 'alloride_users_v1';

const MOCK_USER_TEMPLATE: UserType = {
  id: 'u1', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com', phone: '514-555-0199', role: 'passenger', avatar: 'https://i.pravatar.cc/150?u=alex', isVerified: true, driverStatus: 'approved', documentsUploaded: { license: true, insurance: true, photo: true }, rating: 4.9, totalRides: 142,
  vehicle: { make: "Toyota", model: "RAV4", year: "2023", color: "Midnight Black", plate: "K29 4F2" }
};

const PROVINCE_NAMES: Record<string, string> = {
    "AB": "Alberta", "BC": "British Columbia", "MB": "Manitoba", "NB": "New Brunswick", 
    "NL": "Newfoundland", "NS": "Nova Scotia", "NT": "Northwest Territories", "NU": "Nunavut",
    "ON": "Ontario", "PE": "Prince Edward Island", "QC": "Quebec", "SK": "Saskatchewan", "YT": "Yukon"
};

// Extended City and Spot Data for all Canadian Provinces
const CITIES_AND_SPOTS: Record<string, Record<string, string[]>> = {
  "QC": {
    "Montreal": ["Berri-UQAM Metro", "Radisson Metro", "Trudeau Airport (YUL)", "Côte-Vertu Metro", "Namur Metro", "McGill University", "Concordia University", "Complexe Desjardins"],
    "Quebec City": ["Gare du Palais", "Sainte-Foy Bus Terminal", "Université Laval", "Old Quebec", "Les Galeries de la Capitale", "Gare de Sainte-Foy"],
    "Sherbrooke": ["Université de Sherbrooke", "Carrefour de l'Estrie", "Terminus Sherbrooke", "Bishop's University"],
    "Gatineau": ["Promenades Gatineau", "Place du Portage", "Museum of History", "Cegep de l'Outaouais"],
    "Trois-Rivieres": ["Gare d'autocars", "UQTR", "Centre Les Rivières"],
    "Laval": ["Montmorency Metro", "Carrefour Laval", "Centropolis"],
    "Longueuil": ["Longueuil Metro", "Place Longueuil", "Cégep Édouard-Montpetit"]
  },
  "ON": {
    "Toronto": ["Union Station", "Pearson Airport (YYZ)", "Yorkdale Mall", "Scarborough Town Centre", "CN Tower", "Fairview Mall", "Kipling Station"],
    "Ottawa": ["Rideau Centre", "Ottawa Train Station", "Bayshore Shopping Centre", "Kanata Centrum", "Parliament Hill", "University of Ottawa"],
    "Kingston": ["Queens University", "Kingston Bus Terminal", "Division St. Carpool Lot"],
    "Mississauga": ["Square One", "Port Credit GO", "Heartland Town Centre"],
    "London": ["Western University", "Masonville Place", "White Oaks Mall"],
    "Hamilton": ["McMaster University", "Hamilton GO Centre", "Lime Ridge Mall"],
    "Windsor": ["University of Windsor", "Devonshire Mall"]
  },
  "BC": {
    "Vancouver": ["Pacific Central Station", "UBC Bus Loop", "Waterfront Station", "YVR Airport", "Commercial-Broadway"],
    "Victoria": ["Mayfair Shopping Centre", "UVic Bus Exchange", "Swartz Bay Ferry"],
    "Kelowna": ["UBCO Exchange", "Orchard Park Mall"],
    "Kamloops": ["TRU Exchange", "Aberdeen Mall"],
    "Whistler": ["Gateway Loop", "Creekside"]
  },
  "AB": {
    "Calgary": ["University of Calgary", "Chinook Centre", "Calgary Tower", "YYC Airport"],
    "Edmonton": ["West Edmonton Mall", "University of Alberta", "Southgate Centre"],
    "Banff": ["Banff Train Station", "High School Transit Hub"],
    "Red Deer": ["Red Deer College", "Bower Place"]
  },
  "MB": {
    "Winnipeg": ["Polo Park", "University of Manitoba", "The Forks", "YWG Airport"],
    "Brandon": ["Brandon University", "Shoppers Mall"]
  },
  "SK": {
    "Saskatoon": ["University of Saskatchewan", "Midtown Plaza"],
    "Regina": ["University of Regina", "Cornwall Centre"]
  },
  "NS": {
    "Halifax": ["Dalhousie University", "Halifax Shopping Centre", "Scotia Square"],
    "Sydney": ["CBU", "Mayflower Mall"]
  },
  "NB": {
    "Fredericton": ["UNB", "Regent Mall"],
    "Moncton": ["Champlain Place", "Université de Moncton"],
    "Saint John": ["McAllister Place", "UNB Saint John"]
  },
  "NL": {
    "St. John's": ["Memorial University", "Avalon Mall", "YYT Airport"]
  },
  "PE": {
    "Charlottetown": ["UPEI", "Confederation Centre"]
  },
  "YT": {
    "Whitehorse": ["Canada Games Centre", "Erik Nielsen Airport"]
  },
  "NT": {
    "Yellowknife": ["Center Square Mall", "YZF Airport"]
  },
  "NU": {
    "Iqaluit": ["Northmart", "YFB Airport"]
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

// --- Shared Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = true, disabled = false }: any) => {
  const baseStyle = "py-4 px-6 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none shadow-lg";
  const variants: any = {
    primary: "bg-gradient-to-r from-primary to-primaryDark text-white shadow-indigo-500/30",
    secondary: "bg-white text-slate-800 border border-slate-100 shadow-slate-200/50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    outline: "border-2 border-slate-200 text-slate-600 hover:bg-slate-50"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
};

const Header = ({ title, subtitle, rightAction }: any) => (
  <div className="flex justify-between items-center mb-6 text-slate-900">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm font-medium text-slate-500">{subtitle}</p>}
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
        <div className="relative flex gap-4">
             {/* Left Column: Icon & Line */}
             <div className="flex flex-col items-center">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 bg-white ${type === 'origin' ? 'border-indigo-600' : 'border-pink-600'}`}>
                     <div className={`w-3 h-3 rounded-full ${type === 'origin' ? 'bg-indigo-600' : 'bg-pink-600'}`} />
                 </div>
                 {type === 'origin' && <div className="w-0.5 flex-1 bg-slate-200 border-l-2 border-dashed border-slate-300 min-h-[48px] my-1"></div>}
             </div>

             {/* Right Column: Inputs */}
             <div className="flex-1 pb-4">
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
                 
                 <div className="bg-white rounded-2xl border border-slate-200 p-1.5 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-sm">
                    <div className="flex items-center divide-x divide-slate-100">
                        {/* Province Select */}
                        <div className="relative w-[38%] min-w-[110px] group/prov">
                             <select
                                value={province}
                                onChange={(e) => { setProvince(e.target.value); setCity(''); setSpot(''); }}
                                className="w-full h-12 bg-transparent appearance-none outline-none font-bold text-slate-700 text-xs px-3 cursor-pointer"
                             >
                                {Object.keys(CITIES_AND_SPOTS).map(p => (
                                    <option key={p} value={p}>{PROVINCE_NAMES[p]}</option>
                                ))}
                             </select>
                             <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>

                        {/* City Input */}
                        <div className="relative flex-1">
                            <input
                                value={city}
                                onChange={(e) => handleCityChange(e.target.value)}
                                placeholder="City Name"
                                className="w-full h-12 bg-transparent outline-none font-bold text-slate-900 text-base px-4 placeholder:font-medium placeholder:text-slate-300"
                                onFocus={() => { if(province) handleCityChange(city); }}
                            />
                            {/* Suggestions */}
                             {showCitySuggestions && citySuggestions.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-xl mt-4 z-50 max-h-60 overflow-y-auto border border-slate-100 p-2">
                                    {citySuggestions.map(s => (
                                        <button key={s} onClick={() => handleCitySelect(s)} className="w-full text-left p-3 hover:bg-slate-50 rounded-lg text-sm font-bold text-slate-700 flex items-center gap-2 transition-colors">
                                            <MapPin size={16} className="text-slate-300"/>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                 </div>

                 {/* Spot Selector */}
                 {city && spotsAvailable && spotsAvailable.length > 0 && (
                    <div className="mt-3 animate-float-in">
                        <div className="relative group/spot">
                            <div className={`flex items-center bg-white border-2 rounded-xl px-4 py-3 transition-all cursor-pointer ${spot ? 'border-indigo-500 shadow-md shadow-indigo-500/10' : 'border-slate-200 hover:border-slate-300'}`}>
                                <div className={`p-2 rounded-full mr-3 ${spot ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <NavIcon size={18} />
                                </div>
                                <div className="flex-1 relative">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Meeting Spot</label>
                                    <select
                                        value={spot}
                                        onChange={(e) => handleSpotSelect(e.target.value)}
                                        className="w-full h-6 bg-transparent appearance-none outline-none font-bold text-slate-900 text-sm cursor-pointer"
                                    >
                                        <option value="" disabled>Select a specific spot...</option>
                                        {spotsAvailable.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <ChevronDown size={16} className="text-slate-400" />
                            </div>
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
  const duration = Math.round((ride.arrivalTime.getTime() - ride.departureTime.getTime()) / 3600000 * 10) / 10;
  const rideDate = ride.departureTime.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const isBooked = ride.bookedSeats && ride.bookedSeats > 0;

  return (
    <div onClick={onClick} className={`bg-white rounded-3xl p-5 shadow-card mb-4 active:scale-[0.99] transition-transform cursor-pointer border border-slate-100 relative overflow-hidden ${isPast ? 'opacity-75 grayscale-[0.3]' : ''}`}>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPast ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
              {isPast ? t.completed : rideDate}
            </span>
            {isBooked && !isPast && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase">Booked</span>}
        </div>
        {!isPast && <span className="text-indigo-600 font-bold text-lg">${ride.price}</span>}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-3 h-3 rounded-full bg-slate-900"></div>
          <div className="w-0.5 h-10 bg-slate-200 border-l border-dashed border-slate-300"></div>
          <div className="w-3 h-3 rounded-full bg-secondary"></div>
        </div>
        <div className="flex-1 space-y-3">
           <div>
               <div className="text-lg font-bold text-slate-900 leading-none">{startTime}</div>
               <div className="text-sm text-slate-500 font-bold mt-1 truncate">{ride.origin}</div>
           </div>
           <div>
               <div className="text-lg font-bold text-slate-900 leading-none">{endTime}</div>
               <div className="text-sm text-slate-500 font-bold mt-1 truncate">{ride.destination}</div>
           </div>
        </div>
        <div className="text-xs text-slate-400 font-medium whitespace-nowrap self-end">{duration}h</div>
      </div>

      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ride.driver.avatar || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full bg-slate-200 object-cover" />
          <div className="text-xs">
            <div className="font-bold text-slate-900">{ride.driver.firstName}</div>
            <div className="flex items-center gap-1 text-slate-400"><Star size={10} className="fill-yellow-400 text-yellow-400" /> {ride.driver.rating}</div>
          </div>
        </div>
        <div className={`text-xs font-bold px-3 py-1.5 rounded-xl ${ride.seatsAvailable === 0 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600'}`}>
           {ride.seatsAvailable} {t.seatsLeft}
        </div>
      </div>
    </div>
  );
};

// --- Views ---

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
      
      // Admin Backdoor
      if (email === 'admin@alloride.com' && password === 'admin') {
          onLogin({ ...MOCK_USER_TEMPLATE, id: 'admin', role: 'admin', firstName: 'Admin', lastName: 'User' });
          return;
      }
      
      // Load users from storage
      const storedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
      const existingUser = storedUsers.find((u: UserType) => u.email === email);

      if (isLogin) {
          if (existingUser) {
              onLogin(existingUser);
          } else {
              alert("User not found. Please sign up first.");
              setIsLogin(false);
          }
      } else {
          // Sign Up
          if (existingUser) {
              alert("User already exists. Logging in.");
              onLogin(existingUser);
              return;
          }

          const newUser: UserType = {
              ...MOCK_USER_TEMPLATE,
              id: `u-${Date.now()}`,
              role,
              email,
              firstName: firstName,
              lastName: lastName,
              phone: phone,
              avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
              driverStatus: role === 'driver' ? 'new' : undefined,
              isVerified: role === 'passenger'
          };
          
          if (role === 'driver') {
              newUser.isVerified = false;
              newUser.documentsUploaded = { license: false, insurance: false, photo: false };
          }
          
          // Save new user
          localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([...storedUsers, newUser]));
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
                <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm ${isLogin ? 'bg-white text-slate-900' : 'text-white/60'}`}>{t.logIn}</button>
                <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm ${!isLogin ? 'bg-white text-slate-900' : 'text-white/60'}`}>{t.signUp}</button>
             </div>
             
             <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                   <>
                       <div className="grid grid-cols-2 gap-3 mb-2">
                          <button type="button" onClick={() => setRole('passenger')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 ${role === 'passenger' ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-white/40'}`}>
                             <User size={20} /><span className="text-xs font-bold">{t.passenger}</span>
                          </button>
                          <button type="button" onClick={() => setRole('driver')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 ${role === 'driver' ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-white/40'}`}>
                             <Car size={20} /><span className="text-xs font-bold">{t.driver}</span>
                          </button>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                           <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={t.firstName} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl w-full" required />
                           <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={t.lastName} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl w-full" required />
                       </div>
                       <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.phone} className="bg-black/20 border border-white/10 text-white p-3 rounded-xl w-full" required />
                   </>
                )}
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} className="bg-black/20 border border-white/10 text-white p-4 rounded-xl w-full" required />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} className="bg-black/20 border border-white/10 text-white p-4 rounded-xl w-full" required />
                <Button type="submit" className="w-full mt-4">{isLogin ? t.logIn : t.createAccount}</Button>
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
            avatar: docs.photo, // Set avatar to selfie
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
                    <h3 className="font-bold">Vehicle Info</h3>
                    <input placeholder="Make" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="w-full p-4 bg-white rounded-xl" />
                    <input placeholder="Model" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="w-full p-4 bg-white rounded-xl" />
                    <div className="flex gap-4">
                         <input placeholder="Year" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="w-full p-4 bg-white rounded-xl" />
                         <input placeholder="Plate" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="w-full p-4 bg-white rounded-xl" />
                    </div>
                    <Button onClick={() => setStep(2)} disabled={!vehicle.make || !vehicle.model} className="mt-4">Next</Button>
                </div>
            ) : (
                <div className="space-y-6">
                    <h3 className="font-bold">Documents</h3>
                    {['license', 'insurance', 'photo'].map(key => (
                        <div key={key} className="bg-white p-4 rounded-xl border border-dashed flex justify-between items-center relative">
                            <span className="capitalize font-bold text-slate-700">{key === 'photo' ? 'Selfie' : key}</span>
                            {docs[key] ? <CheckCircle2 className="text-green-500"/> : <Upload className="text-slate-300"/>}
                            <input type="file" onChange={e => handleFile(e, key)} className="absolute inset-0 opacity-0" />
                        </div>
                    ))}
                    <Button onClick={finish} disabled={!docs.license || !docs.insurance || !docs.photo} className="mt-4">{t.submit}</Button>
                </div>
            )}
        </div>
    );
};

const HomeView = ({ user, allRides, bookedRides, setDetailRide, setView, lang }: any) => {
    const t = translations[lang];
    const now = new Date().getTime();
    
    // Filter out past rides for Search
    const upcomingRides = allRides.filter((r: Ride) => r.departureTime.getTime() > now && r.seatsAvailable > 0);
    const myHistory = user.role === 'driver' ? allRides.filter((r: Ride) => r.driver.id === user.id) : [];

    return (
        <div className="h-full pb-32 overflow-y-auto bg-slate-50">
             <div className="bg-slate-900 p-6 pb-20 rounded-b-[2.5rem] mb-6">
                 <div className="flex justify-between items-center text-white mb-6">
                     <div>
                         <h1 className="text-2xl font-bold">{t.goodMorning}</h1>
                         <p className="opacity-60">{user.firstName}</p>
                     </div>
                     <img onClick={() => setView('profile')} src={user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}`} className="w-10 h-10 rounded-full border border-white/20" />
                 </div>
                 
                 {user.role === 'passenger' && (
                     <div className="bg-white/10 backdrop-blur p-4 rounded-2xl border border-white/10">
                         <div className="flex items-center gap-3 bg-black/20 p-3 rounded-xl mb-2">
                             <Search className="text-white/50" size={18}/>
                             <input placeholder={t.whereTo} className="bg-transparent text-white font-bold w-full outline-none placeholder-white/40" />
                         </div>
                         <Button onClick={() => setView('search')} className="py-3 text-sm">{t.searchRides}</Button>
                     </div>
                 )}

                 {user.role === 'driver' && (
                     <div className="bg-white/10 backdrop-blur p-4 rounded-2xl border border-white/10 text-center">
                         <div className="text-3xl font-bold text-white mb-1">${myHistory.reduce((acc:number, r:Ride) => acc + (r.price * (r.totalSeats - r.seatsAvailable)), 0)}</div>
                         <div className="text-xs text-white/60 font-bold uppercase tracking-widest mb-4">Total Earnings</div>
                         
                         {user.driverStatus === 'pending' ? (
                             <div className="bg-yellow-500/20 text-yellow-200 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                 <Clock size={14}/> Verification in Progress
                             </div>
                         ) : (
                             <div className="bg-green-500/20 text-green-300 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                                 <CheckCircle2 size={14}/> Account Active
                             </div>
                         )}
                     </div>
                 )}
             </div>

             <div className="px-6">
                 {user.role === 'passenger' && bookedRides.length > 0 && (
                     <div className="mb-6">
                         <h2 className="font-bold text-slate-900 mb-4">{t.yourTickets}</h2>
                         {bookedRides.map((r: Ride) => (
                             <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />
                         ))}
                     </div>
                 )}

                 <h2 className="font-bold text-slate-900 mb-4">{user.role === 'driver' ? t.activeTrips : t.featuredRides}</h2>
                 {user.role === 'driver' ? (
                     myHistory.length > 0 ? myHistory.map((r: Ride) => <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />) : <div className="text-slate-400 text-center text-sm py-10">No trips posted yet.</div>
                 ) : (
                     upcomingRides.map((r: Ride) => <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />)
                 )}
             </div>
        </div>
    );
};

const PostRideView = ({ user, onPublish, setView, lang, refreshUser }: any) => {
    const t = translations[lang];
    const [form, setForm] = useState({ price: 45, seats: 3, date: toLocalISOString(new Date()), time: '09:00' });
    
    // Origin state
    const [originProv, setOriginProv] = useState('QC');
    const [originCity, setOriginCity] = useState('');
    const [originSpot, setOriginSpot] = useState('');

    // Dest state
    const [destProv, setDestProv] = useState('QC');
    const [destCity, setDestCity] = useState('');
    const [destSpot, setDestSpot] = useState('');

    // STRICT APPROVAL CHECK
    if (user.driverStatus !== 'approved') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                    <Shield size={40} className="text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.verificationRequired}</h2>
                <p className="text-slate-500 mb-8">You must be approved by an administrator before posting trips.</p>
                <div className="space-y-3 w-full">
                    <Button onClick={refreshUser} className="w-full flex items-center justify-center gap-2"><RefreshCw size={18}/> Check Approval Status</Button>
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
        const arrival = new Date(departure.getTime() + 10800000); // +3h approx
        
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
                 <Header title={t.postRide} subtitle="Build your journey" />
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 pb-32">
                {/* Trip Builder Card */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-card border border-slate-100 space-y-8 relative overflow-hidden">
                    {/* Decorative Background Blur */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

                    {/* Origin Input */}
                    <LocationInput 
                        type="origin"
                        label="Origin" 
                        province={originProv} setProvince={setOriginProv}
                        city={originCity} setCity={setOriginCity}
                        spot={originSpot} setSpot={setOriginSpot}
                    />

                    {/* Destination Input */}
                    <LocationInput 
                        type="destination"
                        label="Destination" 
                        province={destProv} setProvince={setDestProv}
                        city={destCity} setCity={setDestCity}
                        spot={destSpot} setSpot={setDestSpot}
                    />
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                     <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                         <div className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-1"><Calendar size={12}/> Date</div>
                         <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full bg-transparent font-bold text-sm outline-none text-slate-900" />
                     </div>
                     <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                         <div className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-1"><Clock size={12}/> Time</div>
                         <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full bg-transparent font-bold text-sm outline-none text-slate-900" />
                     </div>
                     <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                         <div className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-1"><DollarSign size={12}/> Price</div>
                         <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="w-full bg-transparent font-bold text-xl outline-none text-indigo-600" />
                     </div>
                     <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                         <div className="text-slate-400 text-xs font-bold uppercase mb-2 flex items-center gap-1"><Users size={12}/> Seats</div>
                         <div className="flex items-center gap-3">
                             <button onClick={() => setForm(f => ({...f, seats: Math.max(1, f.seats - 1)}))} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">-</button>
                             <span className="font-bold text-xl text-slate-900">{form.seats}</span>
                             <button onClick={() => setForm(f => ({...f, seats: Math.min(6, f.seats + 1)}))} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">+</button>
                         </div>
                     </div>
                </div>

                <div className="mt-8">
                     <Button onClick={handleSubmit} className="shadow-xl shadow-indigo-200">
                        {t.publishRide}
                        <ArrowRight size={18} />
                     </Button>
                </div>
            </div>
        </div>
    );
};

const SearchView = ({ allRides, setDetailRide, setView, lang }: any) => {
    const t = translations[lang];
    const [search, setSearch] = useState('');
    const filtered = allRides.filter((r: Ride) => 
        r.destination.toLowerCase().includes(search.toLowerCase()) || 
        r.origin.toLowerCase().includes(search.toLowerCase())
    );
    return (
        <div className="h-full bg-slate-50 p-6 pt-12 pb-32 overflow-y-auto">
            <h1 className="text-2xl font-bold mb-4">{t.searchRides}</h1>
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-2 mb-6">
                <Search className="text-slate-400" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search city..." className="w-full outline-none font-bold text-slate-700" />
            </div>
            {filtered.map((r: Ride) => (
                <RideCard key={r.id} ride={r} t={t} lang={lang} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />
            ))}
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
        <div className="h-full bg-slate-50 flex flex-col overflow-y-auto pb-32">
             <div className="relative h-64 shrink-0">
                 <img src={getStaticMapUrl(ride.destination)} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                 <button onClick={() => setView('home')} className="absolute top-6 left-6 bg-white/20 backdrop-blur p-2 rounded-full text-white"><ChevronLeft/></button>
                 <div className="absolute bottom-6 left-6 text-white">
                     <h1 className="text-3xl font-bold">{ride.destination.split(',')[0]}</h1>
                     <p className="opacity-80 flex items-center gap-2"><Calendar size={14}/> {getDisplayDate(toLocalISOString(ride.departureTime), t, lang)}</p>
                 </div>
             </div>
             <div className="p-6 space-y-6">
                 {safety && (
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-800 flex gap-3">
                         <ShieldAlert className="shrink-0 text-indigo-600" size={16} />
                         {safety}
                     </div>
                 )}
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                     <img src={ride.driver.avatar} className="w-12 h-12 rounded-full" />
                     <div className="flex-1">
                         <div className="font-bold text-slate-900">{ride.driver.firstName}</div>
                         <div className="text-xs text-slate-500 flex items-center gap-1"><Star size={10} className="text-yellow-400 fill-yellow-400"/> {ride.driver.rating}</div>
                     </div>
                     <div className="text-xl font-bold text-indigo-600">${ride.price}</div>
                 </div>
                 {/* Trip Line */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
                     <div className="flex flex-col items-center pt-2">
                         <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                         <div className="w-0.5 flex-1 bg-slate-200 border-l border-dashed border-slate-300 min-h-[40px]"></div>
                         <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                     </div>
                     <div className="space-y-8 flex-1">
                         <div>
                             <div className="text-xs font-bold text-slate-400 uppercase">{t.origin}</div>
                             <div className="font-bold text-slate-900">{ride.origin}</div>
                         </div>
                         <div>
                             <div className="text-xs font-bold text-slate-400 uppercase">{t.destination}</div>
                             <div className="font-bold text-slate-900">{ride.destination}</div>
                         </div>
                     </div>
                 </div>
                 
                 {user.id === ride.driver.id ? (
                      <Button variant="danger" onClick={() => onDelete(ride.id)}>{t.cancelTrip}</Button>
                 ) : (
                      <Button onClick={() => onBook(ride)}>{t.bookSeat}</Button>
                 )}
             </div>
        </div>
    );
};

const WalletView = ({lang}: any) => {
    const t = translations[lang];
    return (
        <div className="p-6 pt-12 pb-32 h-full bg-slate-50">
            <h1 className="text-2xl font-bold mb-6">{t.wallet}</h1>
            <div className="bg-black text-white p-6 rounded-3xl mb-6 shadow-xl">
                <div className="text-white/60 text-sm font-bold uppercase">{t.totalBalance}</div>
                <div className="text-4xl font-bold mt-2">$128.50</div>
            </div>
            <h3 className="font-bold mb-4">{t.recentActivity}</h3>
            <div className="space-y-3">
                 <div className="bg-white p-4 rounded-xl flex justify-between items-center">
                     <div>
                         <div className="font-bold">Ride Payout</div>
                         <div className="text-xs text-slate-400">Today</div>
                     </div>
                     <div className="font-bold text-green-600">+$45.00</div>
                 </div>
            </div>
        </div>
    )
};

const ProfileView = ({ user, onLogout, lang, setLang }: any) => {
    const t = translations[lang];
    return (
        <div className="p-6 pt-12 pb-32 h-full bg-slate-50">
            <div className="flex flex-col items-center mb-8">
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-white shadow-lg mb-4" />
                <h2 className="text-2xl font-bold">{user.firstName} {user.lastName}</h2>
                <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mt-2 uppercase">{user.role}</div>
            </div>
            <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 mb-6">
                 <button onClick={() => setLang('en')} className={`w-1/2 py-3 rounded-xl font-bold text-sm transition-all ${lang === 'en' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>English</button>
                 <button onClick={() => setLang('fr')} className={`w-1/2 py-3 rounded-xl font-bold text-sm transition-all ${lang === 'fr' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Français</button>
            </div>
            <Button variant="danger" onClick={onLogout} className="w-full flex items-center justify-center gap-2"><LogOut size={18}/> {t.signOut}</Button>
        </div>
    )
};

const AdminView = ({lang}: any) => {
    return (
        <div className="p-6 pt-12 pb-32 h-full bg-slate-50">
            <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
            <LeaderboardChart />
        </div>
    )
};

export const App = () => {
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<UserType | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [rides, setRides] = useState<Ride[]>([]);
  const [detailRide, setDetailRide] = useState<Ride | null>(null);

  // Initialize Data
  useEffect(() => {
    const loadedRides = localStorage.getItem(STORAGE_KEY_RIDES);
    if (loadedRides) {
       // parsing dates
       const parsed = JSON.parse(loadedRides).map((r: any) => ({
           ...r,
           departureTime: new Date(r.departureTime),
           arrivalTime: new Date(r.arrivalTime)
       }));
       setRides(parsed);
    } else {
       setRides(generateMockRides());
    }
    
    // Check for existing user session
    // const storedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
  }, []);

  const handleLogin = (u: UserType) => {
      setUser(u);
      setView('home');
  };

  const handlePublish = (ride: Ride) => {
      const newRides = [...rides, ride];
      setRides(newRides);
      localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(newRides));
  };
  
  const handleBook = (ride: Ride) => {
      alert("Booking confirmed! (Simulation)");
      setView('home');
  };

  const handleDeleteRide = (id: string) => {
      const newRides = rides.filter(r => r.id !== id);
      setRides(newRides);
      localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(newRides));
      setView('home');
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
                {view === 'post' && <PostRideView user={user} onPublish={handlePublish} setView={setView} lang={lang} refreshUser={() => {}} />}
                {view === 'wallet' && <WalletView lang={lang} />}
                {view === 'profile' && <ProfileView user={user} onLogout={() => setUser(null)} lang={lang} setLang={setLang} />}
                {view === 'ride-detail' && <RideDetailView ride={detailRide} user={user} onBook={handleBook} onDelete={handleDeleteRide} setView={setView} lang={lang} />}
                {view === 'admin' && <AdminView lang={lang} />}
            </div>
            <Navigation currentView={view} setView={setView} lang={lang} userRole={user.role} />
        </div>
    </div>
  );
};
