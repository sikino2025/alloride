
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Filter, Star, CheckCircle2, Music, Zap, Info, Share2, ScanFace, DollarSign, Upload, FileText, ChevronDown, Snowflake, Dog, Cigarette, Car, Clock, Check, Shield, XCircle, Eye, Lock, Mail, Key, Camera, CreditCard, Briefcase, Phone, Smartphone, ChevronLeft, Globe, MessageSquare, ThumbsUp, Download, Navigation as NavigationIcon, Map, Plus, Trash2, AlertCircle, LogOut, History, TrendingUp } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { generateRideSafetyBrief, optimizeRideDescription, resolvePickupLocation, getStaticMapUrl } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

// COMPRESSION UTILITY: Aggressive compression to ensure images fit in LocalStorage
// Fixed: Improved error handling to avoid "[object Object]" errors
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            if (!event.target?.result) {
                reject(new Error("File is empty or unreadable"));
                return;
            }
            img.src = event.target.result as string;
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    // Aggressive reduction to 500px to ensure ~50KB size
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
                        // 0.5 quality JPEG is good enough for verification docs
                        resolve(canvas.toDataURL('image/jpeg', 0.5));
                    } else {
                        reject(new Error("Canvas context failed"));
                    }
                } catch (e) {
                    reject(e instanceof Error ? e : new Error("Compression failed"));
                }
            };
            img.onerror = () => reject(new Error("Invalid image format. Please upload a valid JPG or PNG."));
        };
        reader.onerror = () => reject(new Error("Failed to read file from device."));
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

// --- Data & Mocks ---
const PROVINCES = [
    { code: "QC", name: "Quebec" },
    { code: "ON", name: "Ontario" },
    { code: "BC", name: "British Columbia" },
    { code: "AB", name: "Alberta" },
    { code: "MB", name: "Manitoba" },
    { code: "SK", name: "Saskatchewan" },
    { code: "NS", name: "Nova Scotia" },
    { code: "NB", name: "New Brunswick" },
    { code: "PE", name: "Prince Edward Island" },
    { code: "NL", name: "Newfoundland and Labrador" },
    { code: "YT", name: "Yukon" },
    { code: "NT", name: "Northwest Territories" },
    { code: "NU", name: "Nunavut" }
];

// Expanded City and Spot Data for Canada
const CITIES_AND_SPOTS: Record<string, Record<string, string[]>> = {
  "QC": {
    "Montréal": ["Berri-UQAM Metro", "Namur Metro", "Radisson Metro", "Fairview Pointe-Claire", "Côte-Vertu Metro", "Longueuil Metro", "Centre-ville - Carré Dorchester", "Trudeau Airport (YUL)"],
    "Québec": ["Terminus Sainte-Foy", "Place Laurier", "Gare du Palais", "Université Laval", "Les Galeries de la Capitale"],
    "Sherbrooke": ["Carrefour de l'Estrie", "Université de Sherbrooke", "Terminus Sherbrooke"],
    "Trois-Rivières": ["Centre Les Rivières", "Terminus Trois-Rivières", "UQTR"],
    "Gatineau": ["Les Promenades Gatineau", "Place du Portage", "Cegep de l'Outaouais"],
    "Laval": ["Métro Montmorency", "Carrefour Laval"],
  },
  "ON": {
    "Toronto": ["Union Station", "Yorkdale Mall", "Scarborough Town Centre", "Pearson Airport (YYZ)", "Don Mills Station", "Finch Station"],
    "Ottawa": ["Rideau Centre", "Bayshore Shopping Centre", "St. Laurent Centre", "Tunney's Pasture", "Place d'Orléans", "Ottawa Train Station"],
    "Mississauga": ["Square One", "Port Credit GO", "Dixie Outlet Mall"],
    "London": ["Western University", "Masonville Place", "White Oaks Mall"],
    "Kingston": ["Queen's University", "Cataraqui Centre", "Kingston Bus Terminal"],
    "Hamilton": ["McMaster University", "Hamilton GO Centre", "Lime Ridge Mall"],
    "Windsor": ["University of Windsor", "Devonshire Mall"]
  },
  "BC": {
    "Vancouver": ["Pacific Central Station", "Waterfront Station", "UBC Bus Loop", "Metrotown", "YVR Airport", "Tsawwassen Ferry Terminal"],
    "Victoria": ["Mayfair Shopping Centre", "UVic Bus Loop", "Downtown Victoria", "Swartz Bay Ferry"],
    "Kelowna": ["Orchard Park Mall", "UBCO Exchange"],
    "Kamloops": ["Aberdeen Mall", "TRU Exchange"],
    "Whistler": ["Gateway Loop", "Creekside"]
  },
  "AB": {
    "Calgary": ["Calgary Tower", "Chinook Centre", "University of Calgary", "Brentwood Station", "YYC Airport"],
    "Edmonton": ["West Edmonton Mall", "Southgate Centre", "University of Alberta", "Downtown Library"],
    "Red Deer": ["Bower Place", "Red Deer College"],
    "Banff": ["Banff Train Station", "Downtown"]
  },
  "MB": {
    "Winnipeg": ["Polo Park", "University of Manitoba", "St. Vital Centre", "YWG Airport"],
    "Brandon": ["Shoppers Mall", "Brandon University"]
  },
  "SK": {
    "Saskatoon": ["Midtown Plaza", "University of Saskatchewan", "Lawson Heights"],
    "Regina": ["Cornwall Centre", "University of Regina", "Southland Mall"]
  },
  "NS": {
    "Halifax": ["Halifax Shopping Centre", "Dalhousie University", "Scotia Square", "Dartmouth Crossing"],
    "Sydney": ["Mayflower Mall", "CBU"]
  },
  "NB": {
    "Moncton": ["Champlain Place", "Université de Moncton"],
    "Fredericton": ["Regent Mall", "UNB"],
    "Saint John": ["McAllister Place", "Uptown"]
  },
  "PE": {
    "Charlottetown": ["Confederation Centre", "UPEI", "Charlottetown Mall"]
  },
  "NL": {
    "St. John's": ["Avalon Mall", "MUN", "Downtown"]
  }
};

const DRIVERS = [
  { name: "Sarah Chénier", avatar: "https://i.pravatar.cc/150?u=sarah", rating: 4.9, rides: 320, verified: true },
  { name: "Mike Ross", avatar: "https://i.pravatar.cc/150?u=mike", rating: 4.7, rides: 89, verified: true },
  { name: "David Kim", avatar: "https://i.pravatar.cc/150?u=david", rating: 4.8, rides: 150, verified: true },
  { name: "Jessica Tremblay", avatar: "https://i.pravatar.cc/150?u=jessica", rating: 5.0, rides: 42, verified: true },
];

const getRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const MOCK_USER_TEMPLATE: UserType = {
  id: 'u1', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com', phone: '514-555-0199', role: 'passenger', avatar: 'https://i.pravatar.cc/150?u=alex', isVerified: true, driverStatus: 'approved', documentsUploaded: { license: true, insurance: true, photo: true }, rating: 4.9, totalRides: 142,
  vehicle: { make: "Toyota", model: "RAV4", year: "2023", color: "Midnight Black", plate: "K29 4F2" }
};

const generateMockRides = (): Ride[] => {
  const rides: Ride[] = [];
  let idCounter = 1;
  const now = new Date();
  
  // Flatten all available cities and spots into a single list to pick from
  const allLocations: {city: string, prov: string, spot: string}[] = [];
  Object.entries(CITIES_AND_SPOTS).forEach(([prov, cities]) => {
      Object.entries(cities).forEach(([city, spots]) => {
          spots.forEach(spot => {
              allLocations.push({ city, prov, spot });
          });
      });
  });

  // Generate 60 diverse rides
  for (let i = 0; i < 60; i++) {
     const origin = getRandom(allLocations);
     let dest = getRandom(allLocations);
     // Ensure different city for origin and destination
     while (dest.city === origin.city) dest = getRandom(allLocations); 

     const date = new Date(now);
     // Schedule for next 7 days to ensure visibility
     date.setDate(date.getDate() + Math.floor(Math.random() * 7)); 
     date.setHours(Math.floor(Math.random() * 14) + 6, Math.random() > 0.5 ? 30 : 0, 0, 0); 
     
     // If date is in the past (e.g. today but earlier hour), move to tomorrow
     if (date.getTime() < now.getTime()) {
         date.setDate(date.getDate() + 1);
     }
     
     const driver = getRandom(DRIVERS);
     const originStr = `${origin.city}, ${origin.prov} - ${origin.spot}`;
     const destStr = `${dest.city}, ${dest.prov} - ${dest.spot}`;

     const totalSeats = Math.floor(Math.random() * 3) + 3; 
     // Ensure at least 1 seat available so it shows up in search
     const seatsAvailable = Math.floor(Math.random() * totalSeats) + 1;

     rides.push({
        id: `r${idCounter++}`,
        driver: { ...MOCK_USER_TEMPLATE, firstName: driver.name.split(' ')[0], lastName: driver.name.split(' ')[1], avatar: driver.avatar, rating: driver.rating, totalRides: driver.rides, isVerified: driver.verified, role: 'driver', vehicle: { make: ["Toyota", "Honda", "Tesla", "Hyundai"][Math.floor(Math.random()*4)], model: ["RAV4", "Civic", "Model 3", "Tucson"][Math.floor(Math.random()*4)], year: "2022", color: ["White", "Black", "Grey", "Blue"][Math.floor(Math.random()*4)], plate: `${String.fromCharCode(65+Math.random()*26)}${Math.floor(Math.random()*999)} ${String.fromCharCode(65+Math.random()*26)}${String.fromCharCode(65+Math.random()*26)}` } },
        origin: originStr,
        destination: destStr,
        stops: [], 
        departureTime: new Date(date), 
        arrivalTime: new Date(date.getTime() + 10800000), // 3 hours later
        price: Math.floor(Math.random() * 60) + 30, 
        currency: 'CAD', 
        seatsAvailable: seatsAvailable, 
        totalSeats: totalSeats,
        luggage: { small: 2, medium: 1, large: 0 }, 
        features: { instantBook: Math.random() > 0.5, wifi: Math.random() > 0.5, music: true, pets: Math.random() > 0.8, smoking: false, winterTires: true }, 
        distanceKm: 300, 
        description: `Leaving exactly from ${origin.spot}. Dropping off at ${dest.spot}. Flexible with luggage.`
     });
  }
  return rides.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
};

// BUMPED VERSION TO V4 TO FORCE REFRESH OF RIDES
const STORAGE_KEY_RIDES = 'alloride_rides_data_v4'; 
// BUMPED VERSION TO V2 TO FORCE CLEAN DRIVER SLATE
const STORAGE_KEY_PENDING_DRIVERS = 'alloride_pending_drivers_v2';

const loadRidesFromStorage = (): Ride[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RIDES);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((r: any) => ({
        ...r,
        departureTime: new Date(r.departureTime),
        arrivalTime: new Date(r.arrivalTime),
      }));
    }
  } catch (e) {
    console.error("Failed to load rides", e);
  }
  return generateMockRides();
};

const saveRidesToStorage = (rides: Ride[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(rides));
  } catch (e) {
    console.error("Failed to save rides", e);
  }
};

// --- Shared Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = true, disabled = false, type = "button" }: any) => {
  const baseStyle = "py-4 px-6 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none shadow-lg";
  const variants: any = {
    primary: "bg-gradient-to-r from-primary to-primaryDark text-white shadow-indigo-500/30 hover:shadow-indigo-500/40",
    secondary: "bg-white text-slate-800 border border-slate-100 shadow-slate-200/50 hover:bg-slate-50",
    outline: "border-2 border-slate-200 text-slate-600 bg-transparent shadow-none hover:border-primary hover:text-primary",
    ghost: "text-slate-500 hover:bg-slate-50 shadow-none",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 shadow-none"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
};

const Header = ({ title, subtitle, rightAction, light = false }: { title: string, subtitle?: string, rightAction?: React.ReactNode, light?: boolean }) => (
  <div className={`flex justify-between items-center mb-6 ${light ? 'text-white' : 'text-slate-900'}`}>
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className={`text-sm font-medium ${light ? 'text-white/80' : 'text-slate-500'}`}>{subtitle}</p>}
    </div>
    {rightAction}
  </div>
);

const RideCard: React.FC<{ ride: Ride; onClick: () => void; t: any; lang: string; isPast?: boolean; adminMode?: boolean }> = ({ ride, onClick, t, lang, isPast = false, adminMode = false }) => {
  const startTime = ride.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = ride.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const duration = Math.round((ride.arrivalTime.getTime() - ride.departureTime.getTime()) / 3600000 * 10) / 10;
  
  const rideDate = ride.departureTime.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  const isNew = ride.id.toString().startsWith('ride-');
  const now = new Date();
  const isActive = ride.departureTime < now && ride.arrivalTime > now;

  const parseLoc = (s: string) => {
    if (s.includes(' - ')) {
        const [cityProv, spot] = s.split(' - ');
        return { city: cityProv, spot };
    }
    return { city: s, spot: '' };
  };
  
  const origin = parseLoc(ride.origin);
  const dest = parseLoc(ride.destination);

  return (
    <div onClick={onClick} className={`bg-white rounded-3xl p-5 shadow-card mb-5 active:scale-[0.99] transition-transform cursor-pointer border relative overflow-hidden group ${isPast ? 'opacity-70 border-slate-100 grayscale-[0.5]' : 'border-slate-100'} ${adminMode ? 'border-l-4 border-l-indigo-500' : ''}`}>
      {!isPast && <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors"></div>}
      
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPast ? 'bg-slate-200 text-slate-500' : (isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600')}`}>
              {isActive ? t.inProgress : (isPast ? t.completed : rideDate)}
            </span>
            {isNew && !isPast && !isActive && <span className="bg-red-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">{t.new}</span>}
        </div>
        {ride.features.instantBook && !isPast && <span className="text-amber-500 flex items-center gap-1 text-[10px] font-bold"><Zap size={12} fill="currentColor"/> {t.instantBook}</span>}
      </div>

      <div className="flex gap-4 mb-4 relative z-10">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className={`w-3 h-3 rounded-full ring-4 ${isPast ? 'bg-slate-400 ring-slate-100' : (isActive ? 'bg-green-500 ring-green-100' : 'bg-slate-900 ring-slate-100')}`}></div>
          <div className="w-0.5 h-10 bg-slate-200 border-l border-dashed border-slate-300"></div>
          <div className={`w-3 h-3 rounded-full ring-4 ${isPast ? 'bg-slate-400 ring-slate-100' : 'bg-secondary ring-pink-50'}`}></div>
        </div>
        <div className="flex-1 space-y-3">
           <div className="flex justify-between items-start">
             <div className="overflow-hidden">
               <div className="text-lg font-bold text-slate-900 leading-none">{startTime}</div>
               <div className="text-sm text-slate-500 font-bold mt-1 truncate">{origin.city}</div>
               {origin.spot && <div className="text-xs text-slate-400 font-medium truncate">{origin.spot}</div>}
             </div>
             <div className="text-right whitespace-nowrap">
                <span className="text-lg font-bold text-slate-900">${ride.price}</span>
             </div>
           </div>
           <div className="flex justify-between items-end">
             <div className="overflow-hidden">
               <div className="text-lg font-bold text-slate-900 leading-none">{endTime}</div>
               <div className="text-sm text-slate-500 font-bold mt-1 truncate">{dest.city}</div>
               {dest.spot && <div className="text-xs text-slate-400 font-medium truncate">{dest.spot}</div>}
             </div>
             <div className="text-xs text-slate-400 font-medium whitespace-nowrap">{duration}h</div>
           </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-50 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <img src={ride.driver.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm grayscale-0 object-cover" alt="driver" />
          <div className="text-xs">
            <div className="font-bold text-slate-900">{ride.driver.firstName}</div>
            <div className="flex items-center gap-1 text-slate-400">
               <Star size={10} className="text-yellow-400 fill-yellow-400" /> {ride.driver.rating}
            </div>
          </div>
        </div>
        <div className={`text-xs font-bold px-3 py-1.5 rounded-xl ${isPast ? 'bg-slate-100 text-slate-400' : (ride.seatsAvailable === 1 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600')}`}>
           {ride.seatsAvailable} {t.seatsLeft}
        </div>
      </div>
    </div>
  );
};

// --- View Components ---

const AuthView = ({ onLogin, lang, setLang }: any) => {
  const t = translations[lang];
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<UserRole>('passenger');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleAuth = (e: React.FormEvent) => {
      e.preventDefault();
      
      // Admin bypass for demo
      if (email === 'admin@alloride.com' && password === 'admin') {
          onLogin({ ...MOCK_USER_TEMPLATE, id: 'admin', role: 'admin', firstName: 'Admin', lastName: 'User' });
          return;
      }

      if (!isLogin) {
        if (!firstName.trim()) { alert(`${t.firstName} is required.`); return; }
        if (!lastName.trim()) { alert(`${t.lastName} is required.`); return; }
        if (!phone.trim()) { alert(`${t.phone} is required.`); return; }
        if (!email.trim() || !password.trim()) { alert(t.fillAllFields); return; }
      }
      
      const mockUser: UserType = {
          ...MOCK_USER_TEMPLATE,
          id: `u-${Date.now()}`,
          role: role,
          firstName: isLogin ? 'Alex' : firstName,
          lastName: isLogin ? 'Rivera' : lastName,
          phone: isLogin ? '514-555-0199' : phone,
          email: email,
          // Only set a mock avatar for login, not for signup
          avatar: isLogin ? 'https://i.pravatar.cc/150?u=alex' : '', 
          driverStatus: role === 'driver' ? 'new' : undefined,
          isVerified: role === 'passenger' 
      };
      
      if (role === 'driver') {
          mockUser.isVerified = false;
          mockUser.documentsUploaded = { license: false, insurance: false, photo: false };
          mockUser.documentsData = { license: '', insurance: '', photo: '' };
      }
      onLogin(mockUser);
  };

  return (
    <div className="min-h-full bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
       <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center"></div>
       <div className="absolute top-6 right-6 z-50">
          <div className="bg-white/10 backdrop-blur-md p-1 rounded-lg border border-white/20 flex gap-1">
             <button onClick={() => setLang('en')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${lang === 'en' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}>EN</button>
             <button onClick={() => setLang('fr')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${lang === 'fr' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}>FR</button>
          </div>
       </div>
       <div className="relative z-10 w-full max-w-md">
          <div className="flex justify-center mb-6"><Logo size={100} /></div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl">
             <div className="flex bg-black/30 p-1.5 rounded-xl mb-6">
                <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>{t.logIn}</button>
                <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>{t.signUp}</button>
             </div>
             <h2 className="text-2xl font-extrabold text-white text-center mb-6">{isLogin ? t.welcomeBack : t.joinJourney}</h2>
             <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                   <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300 fade-in">
                       <div className="grid grid-cols-2 gap-3 mb-4">
                          <button type="button" onClick={() => setRole('passenger')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'passenger' ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                             <User size={24} /><span className="font-bold text-sm">{t.passenger}</span>
                          </button>
                          <button type="button" onClick={() => setRole('driver')} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'driver' ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-white/40 hover:bg-white/5'}`}>
                             <Car size={24} /><span className="font-bold text-sm">{t.driver}</span>
                          </button>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-xs font-bold text-white/60 ml-2 mb-1 block">{t.firstName} <span className="text-red-400">*</span></label>
                            <div className="relative"><User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/><input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-black/20 border border-white/10 text-white p-3 pl-9 rounded-xl outline-none focus:border-white/40 font-bold text-sm" required placeholder="Alex" /></div>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-white/60 ml-2 mb-1 block">{t.lastName} <span className="text-red-400">*</span></label>
                            <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-black/20 border border-white/10 text-white p-3 rounded-xl outline-none focus:border-white/40 font-bold text-sm" required placeholder="Rivera" />
                         </div>
                       </div>
                       <div>
                            <label className="text-xs font-bold text-white/60 ml-2 mb-1 block">{t.phone} <span className="text-red-400">*</span></label>
                            <div className="relative"><Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"/><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black/20 border border-white/10 text-white p-3 pl-9 rounded-xl outline-none focus:border-white/40 font-bold text-sm" required type="tel" placeholder="555-0123" /></div>
                       </div>
                   </div>
                )}
                <div className="space-y-4">
                    <div>{!isLogin && <label className="text-xs font-bold text-white/60 ml-2 mb-1 block">{t.email} <span className="text-red-400">*</span></label>}<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} className="w-full bg-black/20 border border-white/10 text-white placeholder-white/40 p-4 rounded-xl outline-none focus:border-white/40 transition-colors font-medium" required /></div>
                    <div>{!isLogin && <label className="text-xs font-bold text-white/60 ml-2 mb-1 block">{t.password} <span className="text-red-400">*</span></label>}<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} className="w-full bg-black/20 border border-white/10 text-white placeholder-white/40 p-4 rounded-xl outline-none focus:border-white/40 transition-colors font-medium" required /></div>
                </div>
                <Button type="submit" variant="primary" className="w-full mt-6 py-4 text-lg shadow-indigo-500/50">{isLogin ? t.logIn : (role === 'driver' ? t.signUpDriver : t.createAccount)}</Button>
             </form>
          </div>
       </div>
    </div>
  );
};

const DriverOnboarding = ({ user, updateUser, onComplete, lang }: any) => {
  const t = translations[lang];
  const [step, setStep] = useState(1);
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', color: '', plate: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [docs, setDocs] = useState<any>({ license: null, insurance: null });

  const handleFileChange = async (e: any, field: string) => {
      const file = e.target.files?.[0];
      if(file) {
          try {
              // Use compressImage instead of fileToBase64 to avoid quota limits
              const base64 = await compressImage(file);
              if (field === 'photo') {
                  setPhoto(base64);
              } else {
                  setDocs((prev: any) => ({ ...prev, [field]: base64 }));
              }
          } catch(err: any) {
              console.error("Error reading file", err);
              // Handle error gracefully
              alert(`Failed to process image: ${err.message || 'Unknown error'}. Please try a valid image file.`);
          }
      }
  };

  const handleNext = () => setStep(s => s + 1);

  const handleSubmit = () => {
      // Create the updated user object with actual base64 data
      const updatedUser = {
          ...user,
          vehicle,
          avatar: photo || user.avatar, // Set the profile avatar to the uploaded selfie
          documentsUploaded: { license: !!docs.license, insurance: !!docs.insurance, photo: !!photo },
          documentsData: { 
              license: docs.license, 
              insurance: docs.insurance, 
              photo: photo 
          },
          driverStatus: 'pending', // Set to pending so Admin can approve
          isVerified: false
      };
      
      updateUser(updatedUser);

      // PERSIST PENDING DRIVER TO STORAGE
      try {
          const stored = localStorage.getItem(STORAGE_KEY_PENDING_DRIVERS);
          const pending = stored ? JSON.parse(stored) : [];
          // Remove if exists to avoid duplicates, then add
          const filtered = pending.filter((u: UserType) => u.id !== updatedUser.id);
          filtered.push(updatedUser);
          localStorage.setItem(STORAGE_KEY_PENDING_DRIVERS, JSON.stringify(filtered));
          alert("Documents Saved Successfully!");
      } catch (e) {
          console.error("Failed to persist driver", e);
          alert("Storage Limit Warning: Your browser storage is full. Please try again with smaller images.");
      }
      
      onComplete();
  };

  return (
      <div className="h-full bg-slate-50 pt-12 px-6 pb-32 overflow-y-auto">
          <Header title={t.driverSetup} subtitle={`Step ${step}/3`} />
          <div className="flex gap-2 mb-8">
              <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-slate-200'}`}></div>
              <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`}></div>
              <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-slate-200'}`}></div>
          </div>

          {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">{t.vehicleDetails}</h3>
                  <input placeholder="Make (e.g. Toyota)" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold outline-none focus:border-primary" />
                  <input placeholder="Model (e.g. Camry)" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold outline-none focus:border-primary" />
                  <div className="flex gap-4">
                       <input placeholder="Year" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold outline-none focus:border-primary" />
                       <input placeholder="Color" value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold outline-none focus:border-primary" />
                  </div>
                  <input placeholder="License Plate" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="w-full p-4 bg-white border border-slate-100 rounded-xl font-bold outline-none focus:border-primary" />
                  <Button onClick={handleNext} disabled={!vehicle.make || !vehicle.model} className="mt-8">Next</Button>
              </div>
          )}

          {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                   <h3 className="text-xl font-bold text-slate-900">{t.takeSelfie}</h3>
                   <div className="flex justify-center">
                       <div className="w-40 h-40 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-xl relative">
                           {photo ? <img src={photo} className="w-full h-full object-cover" /> : <Camera size={64} className="text-slate-400" />}
                           <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'photo')} className="absolute inset-0 opacity-0 cursor-pointer" />
                       </div>
                   </div>
                   <div className="text-center text-sm text-slate-500 font-medium">Tap the circle to upload a clear photo of your face.</div>
                   <Button onClick={handleNext} disabled={!photo} className="mt-8">Next</Button>
              </div>
          )}

          {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-xl font-bold text-slate-900">{t.uploadLicense} & {t.uploadInsurance}</h3>
                  <div className="bg-white p-4 rounded-xl border border-dashed border-slate-300 relative">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500"><FileText size={24}/></div>
                          <div className="flex-1">
                              <div className="font-bold text-slate-900">{t.uploadLicense}</div>
                              <div className="text-xs text-slate-500">{docs.license ? "File selected" : "Tap to upload"}</div>
                          </div>
                          {docs.license && <CheckCircle2 size={20} className="text-green-500" />}
                      </div>
                      <input type="file" onChange={(e) => handleFileChange(e, 'license')} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-dashed border-slate-300 relative">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center text-pink-500"><FileText size={24}/></div>
                          <div className="flex-1">
                              <div className="font-bold text-slate-900">{t.uploadInsurance}</div>
                              <div className="text-xs text-slate-500">{docs.insurance ? "File selected" : "Tap to upload"}</div>
                          </div>
                          {docs.insurance && <CheckCircle2 size={20} className="text-green-500" />}
                      </div>
                       <input type="file" onChange={(e) => handleFileChange(e, 'insurance')} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <Button onClick={handleSubmit} disabled={!docs.license || !docs.insurance} className="mt-8">{t.submit}</Button>
              </div>
          )}
      </div>
  );
};

const HomeView = ({ setView, setDetailRide, lang, user, allRides, bookedRides, onRateRide, setSelectedSeats }: any) => {
  const t = translations[lang];
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [historyTab, setHistoryTab] = useState<'upcoming' | 'past'>('upcoming');
  
  const now = new Date().getTime();

  // IMPORTANT: Filter logic for Passenger Dashboard (Find a Ride)
  // Logic: Show rides where arrival time is in the future.
  const filteredSearchRides = useMemo(() => {
     return allRides.filter((r: Ride) => {
        // If trip is completed (arrival time < now), do not show in search
        if (r.arrivalTime.getTime() < now) return false;
        
        const clean = (s: string) => s.toLowerCase();
        if (searchFrom && !clean(r.origin).includes(clean(searchFrom))) return false;
        if (searchTo && !clean(r.destination).includes(clean(searchTo))) return false;
        return true;
     }).sort((a: Ride, b: Ride) => a.departureTime.getTime() - b.departureTime.getTime());
  }, [allRides, searchFrom, searchTo, now]);

  const myRides = useMemo(() => {
      if (user.role !== 'driver') return { upcoming: [], past: [] };
      const mine = allRides.filter((r: Ride) => r.driver.id === user.id);
      return {
          upcoming: mine.filter((r: Ride) => r.arrivalTime.getTime() > now).sort((a: Ride, b: Ride) => a.departureTime.getTime() - b.departureTime.getTime()),
          past: mine.filter((r: Ride) => r.arrivalTime.getTime() <= now).sort((a: Ride, b: Ride) => b.departureTime.getTime() - a.departureTime.getTime()) 
      };
  }, [allRides, user, now]);

  return (
    <div className="pb-32">
       <div className="bg-slate-900 text-white p-6 pb-24 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-[100px] opacity-40 translate-x-1/2 -translate-y-1/2"></div>
           <div className="relative z-10">
               <div className="flex justify-between items-center mb-8">
                   <div>
                       <h1 className="text-3xl font-extrabold">{t.goodMorning}, {user.firstName}</h1>
                       <p className="text-white/60 font-medium">{t.whereTo}</p>
                   </div>
                   {user.avatar ? (
                      <img src={user.avatar} onClick={() => setView('profile')} className="w-12 h-12 rounded-full border-2 border-white/20 cursor-pointer hover:scale-105 transition-transform object-cover" />
                   ) : (
                      <div onClick={() => setView('profile')} className="w-12 h-12 rounded-full border-2 border-white/20 cursor-pointer hover:scale-105 transition-transform bg-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                         {user.firstName[0]}{user.lastName[0]}
                      </div>
                   )}
               </div>
               
               {user.role === 'passenger' ? (
                   <div className="bg-white/10 backdrop-blur-md p-2 rounded-[2rem] border border-white/10 flex flex-col gap-2">
                       <div className="relative">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                           <input value={searchFrom} onChange={e => setSearchFrom(e.target.value)} placeholder={t.leavingFrom} className="w-full bg-black/20 text-white placeholder-white/40 p-4 pl-12 rounded-2xl outline-none font-bold" />
                       </div>
                       <div className="relative">
                           <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                           <input value={searchTo} onChange={e => setSearchTo(e.target.value)} placeholder={t.goingTo} className="w-full bg-black/20 text-white placeholder-white/40 p-4 pl-12 rounded-2xl outline-none font-bold" />
                       </div>
                       <Button onClick={() => setView('search')} className="rounded-xl mt-2">{t.searchRides}</Button>
                   </div>
               ) : (
                   <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/10">
                       <button onClick={() => setHistoryTab('upcoming')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${historyTab === 'upcoming' ? 'bg-white text-slate-900 shadow-md' : 'text-white/60 hover:text-white'}`}>{t.activeTrips}</button>
                       <button onClick={() => setHistoryTab('past')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${historyTab === 'past' ? 'bg-white text-slate-900 shadow-md' : 'text-white/60 hover:text-white'}`}>{t.history}</button>
                   </div>
               )}
           </div>
       </div>
       
       <div className="px-6 -mt-12 relative z-10">
           {user.role === 'passenger' && (
               <>
                   {bookedRides.length > 0 && (
                       <div className="mb-8">
                          <h2 className="text-lg font-bold text-slate-900 mb-4 ml-2">{t.yourTickets}</h2>
                          <div className="space-y-4">
                             {bookedRides.map((ride: Ride) => (
                                 <RideCard key={ride.id} ride={ride} t={t} lang={lang} onClick={() => { setDetailRide(ride); setView('ride-detail'); }} />
                             ))}
                          </div>
                       </div>
                   )}

                   <div className="flex justify-between items-end mb-4 px-2">
                       <h2 className="text-lg font-bold text-slate-900">{t.featuredRides}</h2>
                   </div>
                   
                   <div className="space-y-0">
                      {filteredSearchRides.length === 0 ? (
                          <div className="text-center py-12 text-slate-400">
                              <Search size={48} className="mx-auto mb-4 opacity-20"/>
                              <p>{t.noRidesFound}</p>
                          </div>
                      ) : (
                          filteredSearchRides.map((ride: Ride) => (
                              <RideCard key={ride.id} ride={ride} t={t} lang={lang} onClick={() => { setDetailRide(ride); setView('ride-detail'); setSelectedSeats(1); }} />
                          ))
                      )}
                   </div>
               </>
           )}

           {user.role === 'driver' && (
               <div className="space-y-4">
                   {historyTab === 'upcoming' ? (
                       myRides.upcoming.length > 0 ? (
                           <>
                             {myRides.upcoming.map((ride: Ride) => (
                               <RideCard key={ride.id} ride={ride} t={t} lang={lang} onClick={() => { setDetailRide(ride); setView('ride-detail'); }} />
                             ))}
                           </>
                       ) : (
                           <div className="text-center py-12 text-slate-400">
                               <Car size={48} className="mx-auto mb-4 opacity-20"/>
                               <p>{t.noRidesFound}</p>
                           </div>
                       )
                   ) : (
                       myRides.past.length > 0 ? myRides.past.map((ride: Ride) => (
                           <RideCard key={ride.id} ride={ride} t={t} lang={lang} isPast={true} onClick={() => { setDetailRide(ride); setView('ride-detail'); }} />
                       )) : (
                           <div className="text-center py-12 text-slate-400">
                               <Clock size={48} className="mx-auto mb-4 opacity-20"/>
                               <p>{t.noRidesFound}</p>
                           </div>
                       )
                   )}
               </div>
           )}
       </div>
    </div>
  );
};

const WalletView = ({ lang }: any) => {
  const t = translations[lang];
  return (<div className="pt-20 px-6 h-full pb-32"><Header title={t.wallet} subtitle={t.myWallet} /><div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-[2.5rem] shadow-2xl mb-8 relative overflow-hidden"><div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full translate-x-12 -translate-y-12"></div><p className="text-white/60 font-medium mb-2">{t.totalBalance}</p><h2 className="text-5xl font-extrabold mb-8">$1,240.50</h2><div className="flex gap-4"><button className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><Plus size={16}/> Top Up</button><button className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-colors flex items-center justify-center gap-2"><ArrowRight size={16}/> Withdraw</button></div></div></div>);
};

const LeaderboardView = ({ lang }: any) => {
  const t = translations[lang];
  return (<div className="pt-20 px-6 pb-32"><Header title={t.driverLeaderboard} subtitle={t.topDrivers} /><LeaderboardChart /><div className="space-y-4 mt-6">{DRIVERS.map((d, i) => (<div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center gap-4"><div className="font-bold text-slate-300 w-6 text-center">#{i+1}</div><img src={d.avatar} className="w-12 h-12 rounded-full" /><div className="flex-1"><div className="font-bold text-slate-900">{d.name}</div><div className="text-xs text-slate-500 font-bold">{d.rides} rides</div></div><div className="text-amber-500 font-bold flex items-center gap-1"><Star size={14} fill="currentColor"/> {d.rating}</div></div>))}</div></div>);
};

const DocumentReviewModal = ({ isOpen, onClose, driver, onVerified, t }: any) => {
    const [downloaded, setDownloaded] = useState<Record<string, boolean>>({ license: false, insurance: false, photo: false });
    useEffect(() => { setDownloaded({ license: false, insurance: false, photo: false }); }, [driver?.id, isOpen]);
    if (!isOpen || !driver) return null;
    
    const handleDownload = (type: string) => {
        let fileUrl = '';
        let fileName = `${driver.firstName}_${driver.lastName}_${type}.jpg`;
        
        // Use the actual base64 data if available
        if (driver.documentsData && driver.documentsData[type]) {
             fileUrl = driver.documentsData[type];
        } else {
             // Fallbacks for demo data users
             if (type === 'photo' && driver.avatar && !driver.avatar.includes('pravatar')) fileUrl = driver.avatar;
        }
        
        if (!fileUrl) {
            alert("No document found to download.");
            return;
        }
        
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName; 
        link.target = '_blank'; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDownloaded(prev => ({ ...prev, [type]: true }));
    };

    const allDownloaded = downloaded.license && downloaded.insurance && downloaded.photo;
    
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex flex-col p-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-6 text-white"><h2 className="text-2xl font-bold">{t.reviewDocs}</h2><button onClick={onClose} className="p-2 bg-white/10 rounded-full"><XCircle/></button></div>
            <div className="flex-1 overflow-y-auto space-y-6">
                {['license', 'insurance', 'photo'].map(type => {
                     // STRICT MODE: ONLY SHOW REAL UPLOADED DATA
                     const realDocData = driver.documentsData && driver.documentsData[type];
                     
                     // If real data exists, use it.
                     let imgSrc = realDocData;
                     
                     // Allow avatar fallback ONLY for photo if it is a real data URI
                     if (!imgSrc && type === 'photo' && driver.avatar && !driver.avatar.includes('pravatar')) {
                         imgSrc = driver.avatar;
                     }
                     
                     return (
                         <div key={type} className="bg-white rounded-2xl p-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 uppercase">{type}</h3>
                                {imgSrc && (
                                    <button className={`font-bold text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${downloaded[type] ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`} onClick={() => handleDownload(type)}>
                                        <Download size={12}/> {downloaded[type] ? 'Downloaded' : 'Download Required'}
                                    </button>
                                )}
                            </div>
                            <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden relative">
                                {imgSrc ? (
                                    <img src={imgSrc} className="h-full w-full object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <AlertCircle size={24} className="mb-2 opacity-50"/>
                                        <span className="text-sm italic font-medium">
                                            No Document Uploaded
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                     );
                })}
            </div>
            <div className="mt-6 pt-4 border-t border-white/10"><Button onClick={() => { onVerified(); onClose(); }} disabled={!allDownloaded} variant="primary" className={`shadow-2xl shadow-indigo-500/50 ${!allDownloaded ? 'opacity-50 grayscale' : ''}`}><CheckCircle2 size={20}/> {t.confirmVerified}</Button></div>
        </div>
    );
};

const AdminView = ({ setView, pendingDrivers, approveDriver, rejectDriver, allRides, lang, setDetailRide }: any) => {
  const t = translations[lang];
  const [reviewingDriver, setReviewingDriver] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'past'>('active');
  
  const now = new Date().getTime();
  
  // Categorize Rides
  const activeRoutes = useMemo(() => allRides.filter((r: Ride) => r.departureTime.getTime() < now && r.arrivalTime.getTime() > now), [allRides, now]);
  const upcomingRoutes = useMemo(() => allRides.filter((r: Ride) => r.departureTime.getTime() > now), [allRides, now]);
  const pastRoutes = useMemo(() => allRides.filter((r: Ride) => r.arrivalTime.getTime() < now).sort((a: Ride, b: Ride) => b.departureTime.getTime() - a.departureTime.getTime()), [allRides, now]);

  const displayedRoutes = activeTab === 'active' ? activeRoutes : (activeTab === 'upcoming' ? upcomingRoutes : pastRoutes);

  return (
      <div className="pt-20 px-6 pb-32">
          <Header title={t.adminDashboard} subtitle={t.manageDrivers} />
          
          <div className="bg-white p-6 rounded-[2rem] shadow-card mb-8">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Shield size={20} className="text-indigo-600"/> {t.pendingApprovals} ({pendingDrivers.length})</h3>
             {pendingDrivers.length === 0 ? (
                 <div className="text-slate-400 text-center py-4 text-sm">{t.noPending}</div>
             ) : (
                 pendingDrivers.map((d: UserType) => (
                     <div key={d.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 mb-2">
                         <div className="flex items-center gap-3 mb-3">
                             {/* STRICT: Only show avatar if real base64 or valid URL */}
                             {d.avatar && !d.avatar.includes('placehold') ? (
                                <img src={d.avatar} className="w-10 h-10 rounded-full bg-slate-100 object-cover" />
                             ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold">{d.firstName[0]}</div>
                             )}
                             <div className="font-bold text-slate-900">{d.firstName} {d.lastName}</div>
                         </div>
                         <div className="flex gap-2"><Button onClick={() => setReviewingDriver(d)} className="py-2 text-xs flex-1" variant="secondary">{t.reviewDocs}</Button><Button onClick={() => approveDriver(d.id)} className="py-2 text-xs flex-1" variant="primary">{t.approve}</Button><Button onClick={() => rejectDriver(d.id)} className="py-2 text-xs flex-1" variant="danger">{t.reject}</Button></div>
                     </div>
                 ))
             )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-card">
              <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2"><Map size={20} className="text-secondary"/> Trip Management</h3>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                  <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Active ({activeRoutes.length})</button>
                  <button onClick={() => setActiveTab('upcoming')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'upcoming' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Upcoming ({upcomingRoutes.length})</button>
                  <button onClick={() => setActiveTab('past')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'past' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>History ({pastRoutes.length})</button>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {displayedRoutes.length === 0 ? (
                      <div className="text-slate-400 text-center py-8 text-sm">No trips in this category.</div>
                  ) : (
                      displayedRoutes.map((r: Ride) => (
                          <div key={r.id} onClick={() => { setDetailRide(r); setView('ride-detail'); }} className="border-l-4 border-indigo-500 pl-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors rounded-r-xl">
                              <div className="flex justify-between items-start mb-1">
                                  <div className="font-bold text-slate-900 text-sm">{r.origin.split(',')[0]} <ArrowRight size={12} className="inline text-slate-400"/> {r.destination.split(',')[0]}</div>
                                  <div className="text-xs text-slate-400 font-bold">{r.departureTime.toLocaleDateString()}</div>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <img src={r.driver.avatar || 'https://i.pravatar.cc/150'} className="w-6 h-6 rounded-full object-cover"/>
                                      <span className="font-medium">{r.driver.firstName} {r.driver.lastName}</span>
                                  </div>
                                  <span className="text-xs font-bold text-indigo-600">${r.price}</span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          <DocumentReviewModal isOpen={!!reviewingDriver} driver={reviewingDriver} onClose={() => setReviewingDriver(null)} onVerified={() => {}} t={t} />
      </div>
  );
};

const LegalView = ({ onBack, lang }: any) => {
    const t = translations[lang];
    return (<div className="pt-20 px-6 pb-32"><button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 font-bold"><ChevronLeft size={20} /> {t.back}</button><Header title={t.legalPrivacy} /><div className="bg-white p-6 rounded-[2rem] shadow-card space-y-6"><section><h3 className="font-bold text-slate-900 mb-2">{t.termsOfService}</h3><p className="text-slate-500 text-sm leading-relaxed">{t.legalText1}</p></section><section><h3 className="font-bold text-slate-900 mb-2">{t.privacyPolicy}</h3><p className="text-slate-500 text-sm leading-relaxed">{t.legalText2}</p></section></div></div>);
};

// --- Autocomplete & Location Selector ---
const AutocompleteInput = ({ value, onChange, placeholder, items = [], disabled = false }: any) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const filteredItems = useMemo(() => {
        if (!value) return items;
        return items.filter((item: string) => item.toLowerCase().includes(value.toLowerCase()));
    }, [value, items]);

    return (
        <div className="relative w-full">
            <input 
                value={value} 
                onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm placeholder-slate-400"
            />
            {showSuggestions && filteredItems.length > 0 && !disabled && (
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-48 overflow-y-auto z-[60]">
                    {filteredItems.map((item: string) => (
                        <div key={item} onClick={() => { onChange(item); setShowSuggestions(false); }} className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700">{item}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const LocationSelector = ({ label, prov, setProv, city, setCity, spot, setSpot, address, setAddress, colorClass }: any) => {
    const cityList = useMemo(() => CITIES_AND_SPOTS[prov] ? Object.keys(CITIES_AND_SPOTS[prov]) : [], [prov]);
    const spotList = useMemo(() => {
        if (!prov || !city) return [];
        // Approximate city matching
        const cityKey = Object.keys(CITIES_AND_SPOTS[prov] || {}).find(k => k.toLowerCase() === city.toLowerCase());
        return cityKey ? CITIES_AND_SPOTS[prov][cityKey] : [];
    }, [prov, city]);

    return (
      <div className="relative pl-6 border-l-2 border-slate-200 ml-3 pb-6 last:pb-0">
          <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${colorClass}`}></div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</h3>
          <div className="space-y-3">
              <div className="flex gap-2">
                  <select value={prov} onChange={e => { setProv(e.target.value); setCity(''); setSpot(''); }} className="w-24 p-4 bg-slate-50 rounded-xl font-bold text-slate-900 text-sm outline-none">
                      {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
                  </select>
                  <AutocompleteInput value={city} onChange={setCity} placeholder="City (e.g. Montreal)" items={cityList} />
              </div>
              <AutocompleteInput value={spot} onChange={setSpot} placeholder="Pickup Location (e.g. Metro)" items={spotList} disabled={!city} />
          </div>
      </div>
    );
};

const PostRideView = ({ setView, lang, user, updateUser, onPublish }: any) => {
  const t = translations[lang];
  const [originProv, setOriginProv] = useState("QC");
  const [originCity, setOriginCity] = useState("");
  const [originSpot, setOriginSpot] = useState("");
  const [originAddress, setOriginAddress] = useState("");

  const [destProv, setDestProv] = useState("QC");
  const [destCity, setDestCity] = useState("");
  const [destSpot, setDestSpot] = useState("");
  const [destAddress, setDestAddress] = useState("");

  const [date, setDate] = useState(() => toLocalISOString(new Date()));
  const [time, setTime] = useState("08:00");
  const [price, setPrice] = useState(45);
  const [seats, setSeats] = useState(3);
  const [description, setDescription] = useState("");
  
  const handlePublish = () => {
     if (!originCity || !originSpot || !destCity || !destSpot) { alert("Please fill location details."); return; }
     
     const departure = new Date(`${date}T${time}`);
     const arrival = new Date(departure.getTime() + 10800000); // Mock 3 hour duration
     
     const originStr = `${originCity}, ${originProv} - ${originSpot}`;
     const destStr = `${destCity}, ${destProv} - ${destSpot}`;

     const newRide = { 
         id: `ride-${Date.now()}`, 
         driver: user, 
         origin: originStr, 
         destination: destStr, 
         stops: [], 
         departureTime: departure, 
         arrivalTime: arrival, 
         price, 
         currency: 'CAD', 
         seatsAvailable: seats, 
         totalSeats: seats, 
         luggage: { small: 2, medium: 1, large: 0 }, 
         features: { instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true }, 
         distanceKm: 300, 
         description: description || `Exact pickup: ${originSpot}.`
     };

     onPublish(newRide);
     // Immediately switch to home view, filtering logic there will pick it up if it's in the future
     setView('home');
  };

  return (
    <div className="h-full bg-slate-50 pb-32 overflow-y-auto px-6 pt-12">
        <Header title={t.postRide} />
        <div className="bg-white p-6 rounded-[2rem] shadow-card mb-6">
            <LocationSelector label={t.origin} prov={originProv} setProv={setOriginProv} city={originCity} setCity={setOriginCity} spot={originSpot} setSpot={setOriginSpot} address={originAddress} setAddress={setOriginAddress} colorClass="bg-slate-900" />
            <LocationSelector label={t.destination} prov={destProv} setProv={setDestProv} city={destCity} setCity={setDestCity} spot={destSpot} setSpot={setDestSpot} address={destAddress} setAddress={setDestAddress} colorClass="bg-secondary" />
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-card space-y-4 mb-6">
            <div className="flex gap-4">
                <div className="flex-1"><label className="text-xs font-bold text-slate-400 mb-2 block">{t.today}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm" /></div>
                <div className="flex-1"><label className="text-xs font-bold text-slate-400 mb-2 block">Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm" /></div>
            </div>
            <div className="flex gap-4">
                 <div className="flex-1"><label className="text-xs font-bold text-slate-400 mb-2 block">Price ($)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm" /></div>
                 <div className="flex-1"><label className="text-xs font-bold text-slate-400 mb-2 block">{t.seats}</label><input type="number" value={seats} onChange={e => setSeats(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm" /></div>
            </div>
            <textarea placeholder={t.describeRide} value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm h-24 resize-none" />
        </div>
        <Button onClick={handlePublish}>{t.publishRide}</Button>
    </div>
  );
};

const RideDetailView = ({ ride, onBack, onBook, onCancelBooking, onDeleteRide, user, selectedSeats, setSelectedSeats, lang }: any) => {
  const t = translations[lang];
  const isDriver = user.id === ride.driver.id;
  const isBooked = user.role === 'passenger' && ride.bookedSeats; 
  const isPast = new Date(ride.arrivalTime).getTime() < Date.now();
  const mapUrl = getStaticMapUrl(ride.origin);
  
  const canCancelBooking = useMemo(() => {
     if (!isBooked || isPast) return false;
     const hoursUntilDeparture = (new Date(ride.departureTime).getTime() - Date.now()) / (1000 * 60 * 60);
     return hoursUntilDeparture > 24;
  }, [ride, isBooked, isPast]);

  const canDeleteRide = useMemo(() => {
     if (!isDriver || isPast) return false;
     return ride.seatsAvailable === ride.totalSeats;
  }, [ride, isDriver, isPast]);

  return (
    <div className="h-full bg-slate-50 relative overflow-y-auto pb-32">
        <div className="h-72 w-full relative">
            <img src={mapUrl} className="w-full h-full object-cover grayscale-[0.2]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-slate-50"></div>
            <button onClick={onBack} className="absolute top-6 left-6 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-900 z-10"><ChevronLeft size={20}/></button>
        </div>
        <div className="px-6 -mt-20 relative z-10">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-card mb-6">
                <div className="flex justify-between items-start mb-6">
                   <div>
                       <h1 className="text-2xl font-extrabold text-slate-900 mb-1">${ride.price} <span className="text-sm text-slate-400 font-medium">{t.perSeat}</span></h1>
                       <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                           <Calendar size={14}/> {getDisplayDate(toLocalISOString(ride.departureTime), t, lang)}
                       </div>
                   </div>
                   <div className="bg-indigo-50 px-3 py-1.5 rounded-xl text-indigo-600 font-bold text-xs flex items-center gap-1">
                      <Zap size={12} fill="currentColor"/> {t.instantBook}
                   </div>
                </div>
                {/* Route */}
                <div className="flex gap-4 mb-8">
                    <div className="flex flex-col items-center pt-1">
                        <div className="w-3 h-3 bg-slate-900 rounded-full"></div>
                        <div className="w-0.5 h-12 bg-slate-200 border-l border-dashed border-slate-300"></div>
                        <div className="w-3 h-3 bg-secondary rounded-full"></div>
                    </div>
                    <div className="flex-1 space-y-6">
                        <div>
                            <div className="text-lg font-bold text-slate-900">{ride.departureTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                            <div className="text-slate-500 text-sm font-medium">{ride.origin}</div>
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-900">{ride.arrivalTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                            <div className="text-slate-500 text-sm font-medium">{ride.destination}</div>
                        </div>
                    </div>
                </div>
                {/* Driver */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-6">
                    <img src={ride.driver.avatar} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1">
                        <div className="font-bold text-slate-900">{ride.driver.firstName}</div>
                        <div className="text-xs text-slate-500 font-bold flex items-center gap-1"><Star size={10} className="text-amber-500 fill-amber-500"/> {ride.driver.rating} • {ride.driver.vehicle?.model}</div>
                    </div>
                    {ride.driver.isVerified && <Shield size={20} className="text-indigo-500" />}
                </div>

                {/* Actions */}
                {!isDriver && !isBooked && !isPast && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                             <span className="font-bold text-slate-600">{t.seatsToBook}</span>
                             <div className="flex items-center gap-4">
                                 <button onClick={() => setSelectedSeats(Math.max(1, selectedSeats - 1))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-slate-900">-</button>
                                 <span className="font-extrabold text-lg w-4 text-center">{selectedSeats}</span>
                                 <button onClick={() => setSelectedSeats(Math.min(ride.seatsAvailable, selectedSeats + 1))} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-slate-900">+</button>
                             </div>
                        </div>
                        <Button onClick={onBook}>{t.bookSeat}</Button>
                    </div>
                )}
                
                {/* Passenger Cancellation */}
                {!isDriver && isBooked && !isPast && (
                    <div className="space-y-2">
                         <div className="bg-green-50 text-green-700 p-4 rounded-xl text-center font-bold text-sm mb-2">{t.bookingCancelled} (Status: Booked)</div>
                         {canCancelBooking ? (
                             <>
                                <p className="text-xs text-slate-400 text-center">{t.passengerCancelPolicy}</p>
                                <Button variant="danger" onClick={onCancelBooking}>{t.cancelBooking}</Button>
                             </>
                         ) : (
                             <Button disabled variant="secondary">{t.cannotCancelLate}</Button>
                         )}
                    </div>
                )}

                {/* Driver Deletion */}
                {isDriver && !isPast && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                        {canDeleteRide ? (
                            <Button variant="danger" onClick={onDeleteRide}><Trash2 size={16}/> {t.cancelTrip}</Button>
                        ) : (
                            <div className="text-center">
                                <p className="text-xs text-red-400 font-bold mb-2">{t.cannotDeleteBooked}</p>
                                <Button disabled variant="secondary">{t.cancelTrip}</Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

const SearchView = ({ setView, lang }: any) => {
    const t = translations[lang];
    return <div className="pt-20 px-6"><Header title={t.search} /><p className="text-slate-400 text-center mt-10">Advanced Search Coming Soon...</p></div>
};

const ProfileView = ({ user, lang, onLogout }: any) => {
    const t = translations[lang];
    return (
        <div className="pt-20 px-6 pb-32">
            <Header title={t.profile} />
            <div className="bg-white p-6 rounded-[2rem] shadow-card text-center mb-6">
                {user.avatar ? (
                    <img src={user.avatar} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" />
                ) : (
                    <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl">
                        {user.firstName[0]}{user.lastName[0]}
                    </div>
                )}
                <h2 className="text-xl font-bold">{user.firstName} {user.lastName}</h2>
                <div className="text-slate-400 text-sm font-bold mb-4">{user.email}</div>
                <div className="flex justify-center gap-2 mb-4">
                    {user.isVerified && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Shield size={12}/> Verified</span>}
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold capitalize">{user.role}</span>
                </div>
            </div>
            <Button variant="danger" onClick={onLogout} className="mt-8">
                <LogOut size={20} /> {t.signOut}
            </Button>
        </div>
    );
};

// --- MAIN APP ---

export const App = () => {
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<UserType | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [bookedRides, setBookedRides] = useState<Ride[]>([]);
  
  // Selection State
  const [detailRide, setDetailRide] = useState<Ride | null>(null);
  const [selectedSeats, setSelectedSeats] = useState(1);
  
  // Admin State - Initialize directly from localStorage to prevent overwriting
  const [pendingDrivers, setPendingDrivers] = useState<UserType[]>(() => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_PENDING_DRIVERS);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Init drivers error", e);
        return [];
    }
  });

  useEffect(() => {
     // Clean up old versions to free space to prevent QuotaExceededError
     try {
         localStorage.removeItem('alloride_rides_data_v2'); 
         localStorage.removeItem('alloride_pending_drivers_v1');
         localStorage.removeItem('alloride_rides_data_v3');
     } catch(e) { console.error("Cleanup error", e); }
     
     setAllRides(loadRidesFromStorage());
     
     // Only add dummy data if absolutely empty to avoid empty state confusion, but prioritize storage
     if (pendingDrivers.length === 0) {
        setPendingDrivers([
            { ...MOCK_USER_TEMPLATE, id: 'd2', firstName: 'James', lastName: 'Bond', driverStatus: 'pending', vehicle: { make: 'Aston Martin', model: 'DB5', year: '1964', color: 'Silver', plate: '007' } }
        ]);
     }
  }, []);

  const handleLogin = (loggedInUser: UserType) => {
      setUser(loggedInUser);
      if (loggedInUser.role === 'admin') {
          // Refresh from storage on login to ensure we have the absolute latest
          try {
            const stored = localStorage.getItem(STORAGE_KEY_PENDING_DRIVERS);
            if (stored) {
                setPendingDrivers(JSON.parse(stored));
            }
          } catch(e) { console.error("Error loading drivers", e); }
          setView('admin');
      } else {
          setView('home');
      }
  };

  const handleLogout = () => {
      setUser(null);
      setView('auth');
  };

  const handleBook = () => {
      if (!detailRide || !user) return;
      const booking = { ...detailRide, bookedSeats: selectedSeats };
      setBookedRides([...bookedRides, booking]);
      const updatedRides = allRides.map(r => r.id === detailRide.id ? { ...r, seatsAvailable: r.seatsAvailable - selectedSeats } : r);
      setAllRides(updatedRides);
      saveRidesToStorage(updatedRides);
      alert("Booking Confirmed!");
      setView('home');
  };

  const handleCancelBooking = () => {
      if (!detailRide || !user) return;
      setBookedRides(bookedRides.filter(r => r.id !== detailRide.id));
      const seatsToRestore = bookedRides.find(r => r.id === detailRide.id)?.bookedSeats || 1;
      const updatedRides = allRides.map(r => r.id === detailRide.id ? { ...r, seatsAvailable: r.seatsAvailable + seatsToRestore } : r);
      setAllRides(updatedRides);
      saveRidesToStorage(updatedRides);
      alert(translations[lang].bookingCancelled);
      setView('home');
  };

  const handleDeleteRide = () => {
      if (!detailRide || !user) return;
      const updatedRides = allRides.filter(r => r.id !== detailRide.id);
      setAllRides(updatedRides);
      saveRidesToStorage(updatedRides);
      alert(translations[lang].tripDeleted);
      setView('home');
  };

  // Ensure new rides are immediately added to state and storage for global visibility
  const handlePublish = (newRide: Ride) => {
      const updated = [...allRides, newRide];
      setAllRides(updated);
      saveRidesToStorage(updated);
  };
  
  const approveDriver = (id: string) => {
      const updatedPending = pendingDrivers.filter(d => d.id !== id);
      setPendingDrivers(updatedPending);
      // Persist the removal from pending list
      localStorage.setItem(STORAGE_KEY_PENDING_DRIVERS, JSON.stringify(updatedPending));
      alert("Driver Approved");
  };

  if (view === 'auth') return <AuthView onLogin={handleLogin} lang={lang} setLang={setLang} />;
  if (!user) return null;

  if (user.role === 'driver' && user.driverStatus === 'new') {
      return <DriverOnboarding user={user} updateUser={setUser} onComplete={() => setView('home')} lang={lang} />;
  }

  return (
    <div className="h-full bg-slate-50 text-slate-900 font-sans">
        {view === 'home' && <HomeView setView={setView} setDetailRide={setDetailRide} lang={lang} user={user} allRides={allRides} bookedRides={bookedRides} setSelectedSeats={setSelectedSeats} />}
        {view === 'post' && <PostRideView setView={setView} lang={lang} user={user} updateUser={setUser} onPublish={handlePublish} />}
        {view === 'ride-detail' && detailRide && <RideDetailView ride={detailRide} onBack={() => setView('home')} onBook={handleBook} onCancelBooking={handleCancelBooking} onDeleteRide={handleDeleteRide} user={user} selectedSeats={selectedSeats} setSelectedSeats={setSelectedSeats} lang={lang} />}
        {view === 'search' && <SearchView setView={setView} lang={lang} />}
        {view === 'wallet' && <WalletView lang={lang} />}
        {view === 'profile' && <ProfileView user={user} lang={lang} onLogout={handleLogout} />}
        {view === 'leaderboard' && <LeaderboardView lang={lang} />}
        {view === 'admin' && <AdminView setView={setView} pendingDrivers={pendingDrivers} approveDriver={approveDriver} rejectDriver={() => {}} allRides={allRides} lang={lang} setDetailRide={(r: Ride) => { setDetailRide(r); setView('ride-detail'); }} />}
        {view === 'legal' && <LegalView onBack={() => setView('home')} lang={lang} />}
        
        {view !== 'ride-detail' && view !== 'post' && view !== 'legal' && (
            <Navigation currentView={view} setView={setView} lang={lang} userRole={user.role} />
        )}
    </div>
  );
};
