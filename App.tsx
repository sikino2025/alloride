import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Filter, Star, CheckCircle2, Music, Zap, Info, Share2, ScanFace, DollarSign, Upload, FileText, ChevronDown, Snowflake, Dog, Cigarette, Car, Clock, Check, Shield, XCircle, Eye, Lock, Mail, Key, Camera, CreditCard, Briefcase, Phone, Smartphone, ChevronLeft, Globe, MessageSquare, ThumbsUp, Download, Navigation as NavigationIcon, Map, Plus } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { generateRideSafetyBrief, optimizeRideDescription, resolvePickupLocation, getStaticMapUrl } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
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
  // Force French locale for FR, otherwise EN
  return dateObj.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
};

// --- Data & Mocks ---
const PROVINCES = [
    { code: "QC", name: "Quebec" },
    { code: "ON", name: "Ontario" },
    { code: "BC", name: "British Columbia" },
    { code: "AB", name: "Alberta" },
    { code: "MB", name: "Manitoba" },
    { code: "NB", name: "New Brunswick" },
    { code: "NL", name: "Newfoundland and Labrador" },
    { code: "NS", name: "Nova Scotia" },
    { code: "PE", name: "Prince Edward Island" },
    { code: "SK", name: "Saskatchewan" },
    { code: "NT", name: "Northwest Territories" },
    { code: "NU", name: "Nunavut" },
    { code: "YT", name: "Yukon" }
];

// Data structure: Province Code -> City Name -> List of Spots
const CITIES_AND_SPOTS: Record<string, Record<string, string[]>> = {
  "QC": {
    "Montréal": ["Berri-UQAM Metro", "Namur Metro", "Radisson Metro", "Fairview Pointe-Claire", "Côte-Vertu Metro", "Longueuil Metro", "Centre-ville - Carré Dorchester"],
    "Québec": ["Terminus Sainte-Foy", "Place Laurier", "Gare du Palais", "Université Laval"],
    "Sherbrooke": ["Carrefour de l'Estrie", "Université de Sherbrooke", "Terminus Sherbrooke"],
    "Trois-Rivières": ["Centre Les Rivières", "Terminus Trois-Rivières", "UQTR"],
    "Gatineau": ["Les Promenades Gatineau", "Place du Portage", "Cegep de l'Outaouais"],
    "Laval": ["Métro Montmorency", "Carrefour Laval"],
    "Drummondville": ["Promenades Drummondville"],
    "Rimouski": ["Carrefour Rimouski"]
  },
  "ON": {
    "Toronto": ["Union Station", "Yorkdale Mall", "Scarborough Town Centre", "Pearson Airport (YYZ)", "Don Mills Station"],
    "Ottawa": ["Rideau Centre", "Bayshore Shopping Centre", "St. Laurent Centre", "Tunney's Pasture", "Place d'Orléans"],
    "Mississauga": ["Square One", "Port Credit GO", "Dixie Outlet Mall"],
    "London": ["Western University", "Masonville Place", "White Oaks Mall"],
    "Kingston": ["Queen's University", "Cataraqui Centre", "Kingston Bus Terminal"],
  },
  "BC": {
    "Vancouver": ["Pacific Central Station", "Waterfront Station", "UBC Bus Loop", "Metrotown", "YVR Airport"],
    "Victoria": ["Mayfair Shopping Centre", "UVic Bus Loop", "Downtown Victoria"],
    "Kelowna": ["Orchard Park Mall", "UBCO Exchange"],
  },
  "AB": {
    "Calgary": ["Calgary Tower", "Chinook Centre", "University of Calgary", "Brentwood Station"],
    "Edmonton": ["West Edmonton Mall", "Southgate Centre", "University of Alberta"],
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
  
  // Helper to create mock locations
  const cities = [
      { city: "Montréal", prov: "QC", spot: "Berri-UQAM" },
      { city: "Québec", prov: "QC", spot: "Gare du Palais" },
      { city: "Toronto", prov: "ON", spot: "Union Station" },
      { city: "Ottawa", prov: "ON", spot: "Rideau Centre" },
      { city: "Vancouver", prov: "BC", spot: "Pacific Central" },
      { city: "Calgary", prov: "AB", spot: "Calgary Tower" }
  ];

  for (let i = 0; i < 50; i++) {
     const origin = getRandom(cities);
     let dest = getRandom(cities);
     while (dest.city === origin.city) dest = getRandom(cities); 

     const date = new Date(now);
     date.setDate(date.getDate() + Math.floor(Math.random() * 5)); // Next 5 days
     date.setHours(Math.floor(Math.random() * 14) + 6, 0, 0, 0); // 6 AM to 8 PM
     
     const driver = getRandom(DRIVERS);
     // Format: City, Prov - Spot Name
     const originStr = `${origin.city}, ${origin.prov} - ${origin.spot}`;
     const destStr = `${dest.city}, ${dest.prov} - ${dest.spot}`;

     rides.push({
        id: `r${idCounter++}`,
        driver: { ...MOCK_USER_TEMPLATE, firstName: driver.name.split(' ')[0], lastName: driver.name.split(' ')[1], avatar: driver.avatar, rating: driver.rating, totalRides: driver.rides, isVerified: driver.verified, role: 'driver', vehicle: { make: ["Toyota", "Honda", "Tesla", "Hyundai"][Math.floor(Math.random()*4)], model: ["RAV4", "Civic", "Model 3", "Tucson"][Math.floor(Math.random()*4)], year: "2022", color: ["White", "Black", "Grey", "Blue"][Math.floor(Math.random()*4)], plate: `${String.fromCharCode(65+Math.random()*26)}${Math.floor(Math.random()*999)} ${String.fromCharCode(65+Math.random()*26)}${String.fromCharCode(65+Math.random()*26)}` } },
        origin: originStr,
        destination: destStr,
        stops: [], 
        departureTime: new Date(date), 
        arrivalTime: new Date(date.getTime() + 10800000), // +3 hours
        price: Math.floor(Math.random() * 60) + 30, 
        currency: 'CAD', 
        seatsAvailable: Math.floor(Math.random() * 3) + 1, 
        luggage: { small: 2, medium: 1, large: 0 },
        features: { instantBook: Math.random() > 0.5, wifi: Math.random() > 0.5, music: true, pets: Math.random() > 0.8, smoking: false, winterTires: true }, 
        distanceKm: 300, 
        description: `Leaving exactly from ${origin.spot}. Dropping off at ${dest.spot}. Flexible with luggage.`
     });
  }
  return rides.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
};

// --- Storage Utils ---
const STORAGE_KEY_RIDES = 'alloride_rides_data_v2'; 

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

const getAddressFromLocationString = (locStr: string): string | null => {
  if (!locStr) return null;
  if (locStr.includes(' - ')) {
    const parts = locStr.split(' - ');
    const cityProv = parts[0];
    const spot = parts[1];
    return `${spot}, ${cityProv}`; 
  }
  return locStr;
}

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

const RideCard: React.FC<{ ride: Ride; onClick: () => void; t: any; lang: string; isPast?: boolean }> = ({ ride, onClick, t, lang, isPast = false }) => {
  const startTime = ride.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = ride.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const duration = Math.round((ride.arrivalTime.getTime() - ride.departureTime.getTime()) / 3600000 * 10) / 10;
  
  // Localize Date with explicit French support
  const rideDate = ride.departureTime.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  const isNew = ride.id.toString().startsWith('ride-');
  const now = new Date();
  const isActive = ride.departureTime < now && ride.arrivalTime > now;

  // Parse location strings: "City, Prov - Spot"
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
    <div onClick={onClick} className={`bg-white rounded-3xl p-5 shadow-card mb-5 active:scale-[0.99] transition-transform cursor-pointer border relative overflow-hidden group ${isPast ? 'opacity-70 border-slate-100 grayscale-[0.5]' : 'border-slate-100'}`}>
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

const RateModal = ({ isOpen, onClose, driverName }: any) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  if (!isOpen) return null;
  return (
     <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
        <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
           <h3 className="text-xl font-extrabold text-center mb-2">Rate {driverName}</h3>
           <div className="flex justify-center gap-2 mb-6">
              {[1,2,3,4,5].map(star => (
                 <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition-transform active:scale-90">
                    <Star size={32} className={`${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'} transition-colors`} />
                 </button>
              ))}
           </div>
           <textarea placeholder="How was your ride?" className="w-full bg-slate-50 p-4 rounded-xl mb-4 h-24 font-medium outline-none resize-none" value={comment} onChange={e => setComment(e.target.value)} />
           <Button onClick={() => onClose(rating, comment)}>Submit Review</Button>
        </div>
     </div>
  );
};

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
          // IMPORTANT: If signing up, set avatar to empty to allow fallback. If logging in (demo), keep the mock avatar.
          avatar: isLogin ? 'https://i.pravatar.cc/150?u=alex' : '', 
          driverStatus: role === 'driver' ? 'new' : undefined,
          isVerified: role === 'passenger' 
      };
      
      if (role === 'driver') {
          mockUser.isVerified = false;
          mockUser.documentsUploaded = { license: false, insurance: false, photo: false };
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

const HomeView = ({ setView, setDetailRide, lang, user, allRides, bookedRides, onRateRide, setSelectedSeats }: any) => {
  const t = translations[lang];
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [historyTab, setHistoryTab] = useState<'upcoming' | 'past'>('upcoming');
  
  const now = new Date().getTime();

  const filteredSearchRides = useMemo(() => {
     return allRides.filter((r: Ride) => {
        // FILTER: Ride must not have finished yet (arrivalTime > now)
        if (r.arrivalTime.getTime() < now) return false;
        
        const clean = (s: string) => s.toLowerCase();
        if (searchFrom && !clean(r.origin).includes(clean(searchFrom))) return false;
        if (searchTo && !clean(r.destination).includes(clean(searchTo))) return false;
        return true;
     }).sort((a: Ride, b: Ride) => a.departureTime.getTime() - b.departureTime.getTime());
  }, [allRides, searchFrom, searchTo, now]);

  const myRides = useMemo(() => {
      // Driver rides logic
      if (user.role !== 'driver') return { upcoming: [], past: [] };
      const mine = allRides.filter((r: Ride) => r.driver.id === user.id);
      return {
          // ACTIVE/UPCOMING: Ride has not ended yet
          upcoming: mine.filter((r: Ride) => r.arrivalTime.getTime() > now).sort((a: Ride, b: Ride) => a.departureTime.getTime() - b.departureTime.getTime()),
          // PAST: Ride has ended
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
           
           {/* Passenger View Logic */}
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

           {/* Driver View Logic */}
           {user.role === 'driver' && (
               <div className="space-y-4">
                   {historyTab === 'upcoming' ? (
                       myRides.upcoming.length > 0 ? (
                           <>
                             {/* Show "Featured Rides" style for driver's own rides so they see it like a passenger */}
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

// Reuse Wallet, Leaderboard, Admin, Legal from previous...

const WalletView = ({ lang }: any) => {
  const t = translations[lang];
  return (<div className="pt-20 px-6 h-full pb-32"><Header title={t.wallet} subtitle={t.myWallet} /><div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-[2.5rem] shadow-2xl mb-8 relative overflow-hidden"><div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full translate-x-12 -translate-y-12"></div><p className="text-white/60 font-medium mb-2">{t.totalBalance}</p><h2 className="text-5xl font-extrabold mb-8">$1,240.50</h2><div className="flex gap-4"><button className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><Plus size={16}/> Top Up</button><button className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-colors flex items-center justify-center gap-2"><ArrowRight size={16}/> Withdraw</button></div></div></div>);
};

const LeaderboardView = ({ lang }: any) => {
  const t = translations[lang];
  return (<div className="pt-20 px-6 pb-32"><Header title={t.driverLeaderboard} subtitle={t.topDrivers} /><LeaderboardChart /><div className="space-y-4 mt-6">{DRIVERS.map((d, i) => (<div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center gap-4"><div className="font-bold text-slate-300 w-6 text-center">#{i+1}</div><img src={d.avatar} className="w-12 h-12 rounded-full" /><div className="flex-1"><div className="font-bold text-slate-900">{d.name}</div><div className="text-xs text-slate-500 font-bold">{d.rides} rides</div></div><div className="text-amber-500 font-bold flex items-center gap-1"><Star size={14} fill="currentColor"/> {d.rating}</div></div>))}</div></div>);
};

// --- Admin Components ---
const DocumentReviewModal = ({ isOpen, onClose, driver, onVerified, t }: any) => {
    const [downloaded, setDownloaded] = useState<Record<string, boolean>>({ license: false, insurance: false, photo: false });

    // Reset download state when modal opens for a new driver
    useEffect(() => {
        setDownloaded({ license: false, insurance: false, photo: false });
    }, [driver?.id, isOpen]);

    if (!isOpen || !driver) return null;

    // --- UPDATED DOWNLOAD LOGIC ---
    const handleDownload = (type: string) => {
        let fileUrl = '';
        let fileName = `${driver.firstName}_${driver.lastName}_${type}.jpg`;

        // Check if we have real base64 data
        if (driver.documentsData && driver.documentsData[type]) {
            fileUrl = driver.documentsData[type];
        } else {
             // Fallbacks for mock users
            if (type === 'photo') fileUrl = driver.avatar;
            else if (type === 'license') fileUrl = "https://placehold.co/600x400/e2e8f0/64748b?text=License+Document";
            else if (type === 'insurance') fileUrl = "https://placehold.co/600x400/e2e8f0/64748b?text=Insurance+Document";
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
            <div className="flex justify-between items-center mb-6 text-white">
                <h2 className="text-2xl font-bold">{t.reviewDocs}</h2>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><XCircle/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6">
                <div className="bg-white rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2"><FileText size={18}/> {t.uploadLicense}</h3>
                        {driver.documentsUploaded.license && (
                            <button 
                                className={`font-bold text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${downloaded.license ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                onClick={() => handleDownload('license')}
                            >
                                <Download size={12}/> {downloaded.license ? 'Downloaded' : 'Download Required'}
                            </button>
                        )}
                    </div>
                    <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                        {driver.documentsData?.license ? 
                           <img src={driver.documentsData.license} className="w-full h-full object-cover"/> :
                           (driver.documentsUploaded.license ? <span className="text-slate-400 text-sm">{t.mockDoc}</span> : <span className="text-slate-400 text-sm">{t.noDoc}</span>)
                        }
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2"><Shield size={18}/> {t.uploadInsurance}</h3>
                         {driver.documentsUploaded.insurance && (
                            <button 
                                className={`font-bold text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${downloaded.insurance ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                onClick={() => handleDownload('insurance')}
                            >
                                <Download size={12}/> {downloaded.insurance ? 'Downloaded' : 'Download Required'}
                            </button>
                        )}
                    </div>
                    <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                         {driver.documentsData?.insurance ? 
                           <img src={driver.documentsData.insurance} className="w-full h-full object-cover"/> :
                           (driver.documentsUploaded.insurance ? <span className="text-slate-400 text-sm">{t.mockDoc}</span> : <span className="text-slate-400 text-sm">{t.noDoc}</span>)
                        }
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2"><User size={18}/> {t.uploadPhoto}</h3>
                         {driver.documentsUploaded.photo && (
                            <button 
                                className={`font-bold text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${downloaded.photo ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                onClick={() => handleDownload('photo')}
                            >
                                <Download size={12}/> {downloaded.photo ? 'Downloaded' : 'Download Required'}
                            </button>
                        )}
                    </div>
                    <div className="h-48 bg-slate-100 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200 overflow-hidden">
                        {driver.avatar ? <img src={driver.avatar} className="h-full object-contain rounded-xl"/> : <span className="text-slate-400 text-sm">{t.noPhoto}</span>}
                    </div>
                </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10">
                <Button 
                    onClick={() => { onVerified(); onClose(); }} 
                    disabled={!allDownloaded}
                    variant="primary" 
                    className={`shadow-2xl shadow-indigo-500/50 ${!allDownloaded ? 'opacity-50 grayscale' : ''}`}
                >
                    <CheckCircle2 size={20}/> {t.confirmVerified}
                </Button>
            </div>
        </div>
    );
};

const AdminView = ({ setView, pendingDrivers, approveDriver, rejectDriver, liveRoutes, lang }: any) => {
  const t = translations[lang];
  const [reviewingDriver, setReviewingDriver] = useState<UserType | null>(null);
  const [reviewedDrivers, setReviewedDrivers] = useState<Set<string>>(new Set());

  const handleVerified = () => {
      if (reviewingDriver) {
          setReviewedDrivers(prev => new Set(prev).add(reviewingDriver.id));
      }
  };

  return (
      <div className="pt-20 px-6 pb-32">
          <Header title={t.adminDashboard} subtitle={t.manageDrivers} />
          
          <div className="bg-white p-6 rounded-[2rem] shadow-card mb-8">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Shield size={20} className="text-indigo-600"/> {t.pendingApprovals} ({pendingDrivers.length})</h3>
             {pendingDrivers.length === 0 ? <div className="text-slate-400 text-sm font-medium py-4 text-center">{t.noPending}</div> : (
                 <div className="space-y-4">
                     {pendingDrivers.map((d: UserType) => {
                         const isReviewed = reviewedDrivers.has(d.id);
                         return (
                             <div key={d.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                                 <div className="flex items-center gap-3 mb-3">
                                     <img src={d.avatar || 'https://i.pravatar.cc/150'} className="w-10 h-10 rounded-full bg-slate-100 object-cover" />
                                     <div>
                                         <div className="font-bold text-slate-900">{d.firstName} {d.lastName}</div>
                                         <div className="text-xs text-slate-500">Plate: {d.vehicle?.plate}</div>
                                     </div>
                                     {isReviewed && <div className="ml-auto bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1"><Check size={10}/> Checked</div>}
                                 </div>
                                 <div className="flex flex-col gap-2">
                                     <button 
                                        onClick={() => setReviewingDriver(d)}
                                        className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${isReviewed ? 'bg-slate-200 text-slate-500' : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50'}`}
                                     >
                                        <Eye size={14}/> {isReviewed ? t.reviewAgain : t.reviewDocs}
                                     </button>
                                     <div className="flex gap-2">
                                         <Button 
                                            disabled={!isReviewed} 
                                            variant="primary" 
                                            onClick={() => approveDriver(d.id)} 
                                            className="py-3 text-xs h-auto flex-1"
                                         >
                                            {t.approve}
                                         </Button>
                                         <Button 
                                            variant="danger" 
                                            onClick={() => rejectDriver(d.id)} 
                                            className="py-3 text-xs h-auto flex-1"
                                         >
                                            {t.reject}
                                         </Button>
                                     </div>
                                 </div>
                             </div>
                         );
                     })}
                 </div>
             )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-card">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Map size={20} className="text-green-600"/> {t.liveRoutes}</h3>
              <div className="space-y-4">
                  {liveRoutes.length === 0 ? <div className="text-center text-slate-400 text-sm">{t.noRidesFound}</div> : liveRoutes.slice(0, 10).map((r: Ride) => (
                      <div key={r.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0">
                          <div className="flex items-center gap-3">
                              <img src={r.driver.avatar} className="w-10 h-10 rounded-full bg-slate-100 object-cover border border-slate-200" />
                              <div>
                                  <div className="font-bold text-slate-900">{r.origin.split(' - ')[0]} → {r.destination.split(' - ')[0]}</div>
                                  <div className="text-slate-500 text-xs flex items-center gap-1 font-medium mt-0.5">
                                      {r.driver.firstName} • <Star size={10} className="text-amber-500 fill-amber-500"/> {r.driver.rating}
                                  </div>
                                  <div className="text-slate-400 text-[10px] mt-0.5 font-medium">{new Date(r.departureTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(r.arrivalTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-extrabold text-green-600 text-base">${r.price}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-50 px-2 py-0.5 rounded-full inline-block mt-1">{r.seatsAvailable} {t.seatsLeft}</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
          
          <DocumentReviewModal 
             isOpen={!!reviewingDriver} 
             driver={reviewingDriver} 
             onClose={() => setReviewingDriver(null)}
             onVerified={handleVerified}
             t={t}
          />
      </div>
  );
};

const LegalView = ({ onBack, lang }: any) => {
    const t = translations[lang];
    return (<div className="pt-20 px-6 pb-32"><button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 font-bold"><ChevronLeft size={20} /> {t.back}</button><Header title={t.legalPrivacy} /><div className="bg-white p-6 rounded-[2rem] shadow-card space-y-6"><section><h3 className="font-bold text-slate-900 mb-2">{t.termsOfService}</h3><p className="text-slate-500 text-sm leading-relaxed">{t.legalText1}</p></section><section><h3 className="font-bold text-slate-900 mb-2">{t.privacyPolicy}</h3><p className="text-slate-500 text-sm leading-relaxed">{t.legalText2}</p></section></div></div>);
};

const PostRideView = ({ setView, lang, user, updateUser, onPublish }: { setView: any, lang: Language, user: UserType, updateUser: (u: UserType) => void, onPublish: (ride: Ride) => void }) => {
  const t = translations[lang];
  
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', color: '', plate: '' });
  const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: boolean }>({ license: false, insurance: false, photo: false });
  const [documentsData, setDocumentsData] = useState<{ license?: string, insurance?: string, photo?: string }>({});
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  
  // Updated Post Ride Form State for Flexible Locations
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
  const [luggage, setLuggage] = useState({ small: 2, medium: 1, large: 0 });
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<string | null>(null);

  // --- Onboarding Logic ---
  if (user.driverStatus === 'new' || !user.isVerified) {
      if (user.driverStatus === 'pending') {
         return (<div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-glow text-amber-500 animate-pulse"><Clock size={48} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">{t.reviewInProgress}</h2><p className="text-center text-slate-500 mb-8 max-w-xs">{t.verifyingDocs}</p><Button variant="outline" onClick={() => setView('home')}>{t.backToHome}</Button></div>);
      }
      
      const handleVehicleSubmit = (e: React.FormEvent) => { e.preventDefault(); setOnboardingStep(2); };
      
      const handlePhotoUpload = async (e: any) => { 
          if(e.target.files[0]) { 
              const base64 = await fileToBase64(e.target.files[0]);
              setProfilePhoto(base64); 
              setUploadedDocs(p => ({...p, photo: true}));
              setDocumentsData(p => ({...p, photo: base64}));
          }
      };
      
      const handleDocUpload = (type: string) => { setCurrentUploadType(type); fileInputRef.current?.click(); };
      
      const onFileChange = async (e: any) => { 
          if(e.target.files[0] && currentUploadType) { 
              const base64 = await fileToBase64(e.target.files[0]);
              setUploadedDocs(p => ({...p, [currentUploadType]: true})); 
              setDocumentsData(p => ({...p, [currentUploadType]: base64}));
          }
      };
      
      const submitForApproval = () => {
          updateUser({ 
              ...user, 
              isVerified: false, 
              driverStatus: 'pending', 
              avatar: profilePhoto || user.avatar,
              vehicle: vehicle,
              documentsUploaded: { license: true, insurance: true, photo: true },
              documentsData: documentsData
          });
      };

      return (
        <div className="h-full bg-slate-50 pb-32 overflow-y-auto px-6 pt-12">
           <Header title={t.driverSetup} subtitle={t.letsGetRoad} />
           <div className="flex gap-2 mb-8">{[1, 2, 3].map(step => (<div key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${onboardingStep >= step ? 'bg-primary' : 'bg-slate-200'}`}></div>))}</div>
           
           {onboardingStep === 1 && (
             <form onSubmit={handleVehicleSubmit} className="space-y-4 bg-white p-6 rounded-[2rem] shadow-card">
                <h3 className="font-bold text-lg mb-4">{t.vehicleDetails}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="Make" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input required placeholder="Model" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="Year" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                    <input required placeholder="Color" value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" />
                </div>
                <input required placeholder="License Plate" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm text-center tracking-widest uppercase border border-slate-200" />
                <Button type="submit" className="mt-4">{t.takeSelfie} (Next)</Button>
             </form>
           )}

           {onboardingStep === 2 && (
             <div className="bg-white p-6 rounded-[2rem] shadow-card text-center">
                <h3 className="font-bold text-lg mb-6">{t.takeSelfie}</h3>
                <input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                <div onClick={() => photoInputRef.current?.click()} className="w-48 h-48 mx-auto rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden relative">
                    {profilePhoto ? <img src={profilePhoto} className="w-full h-full object-cover" /> : <Camera size={40} className="text-slate-400"/>}
                </div>
                <Button disabled={!profilePhoto} onClick={() => setOnboardingStep(3)} className="mt-8">{t.nextDocs}</Button>
             </div>
           )}

           {onboardingStep === 3 && (
              <div className="bg-white p-6 rounded-[2rem] shadow-card">
                 <h3 className="font-bold text-lg mb-6">Upload Documents</h3>
                 <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} />
                 <div className="space-y-4">
                     {[{id: 'license', label: t.uploadLicense}, {id: 'insurance', label: t.uploadInsurance}].map((item) => (
                         <div key={item.id} onClick={() => handleDocUpload(item.id)} className={`p-4 rounded-xl flex justify-between items-center cursor-pointer border-2 ${uploadedDocs[item.id] ? 'border-green-500 bg-green-50' : 'border-slate-100'}`}>
                             <span className="font-bold text-slate-700">{item.label}</span>
                             {uploadedDocs[item.id] ? <CheckCircle2 className="text-green-500"/> : <Upload className="text-slate-400"/>}
                         </div>
                     ))}
                 </div>
                 <Button disabled={!uploadedDocs.license || !uploadedDocs.insurance} onClick={submitForApproval} className="mt-8">{t.submit}</Button>
              </div>
           )}
        </div>
      );
  }

  // --- Posting Logic ---
  const handlePublish = () => {
     if (isSubmitting) return; // Prevent double submission
     if (!originCity || !originSpot || !destCity || !destSpot) {
        alert("Please fill in all location details (City and Spot).");
        return;
     }
     setIsSubmitting(true);
     
     const departure = new Date(`${date}T${time}`);
     const arrival = new Date(departure.getTime() + 10800000); 

     const originStr = `${originCity}, ${originProv} - ${originSpot}`;
     const destStr = `${destCity}, ${destProv} - ${destSpot}`;

     onPublish({ 
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
         luggage, 
         features: { instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true }, 
         distanceKm: 300, 
         description: description || `Exact pickup: ${originAddress || originSpot}. Drop-off: ${destAddress || destSpot}.`
     });
     alert("Published! Passengers can now see your trip."); 
     setView('home');
     setIsSubmitting(false);
  };

  // --- NEW Autocomplete Component ---
  const AutocompleteInput = ({ value, onChange, placeholder, items = [], disabled = false }: any) => {
      const [showSuggestions, setShowSuggestions] = useState(false);
      
      const filteredItems = useMemo(() => {
          if (!value) return items;
          const lower = value.toLowerCase();
          return items.filter((item: string) => item.toLowerCase().includes(lower));
      }, [value, items]);

      return (
          <div className="relative w-full">
              <input 
                  value={value} 
                  onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                  placeholder={placeholder}
                  disabled={disabled}
                  className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm placeholder-slate-400"
              />
              {showSuggestions && filteredItems.length > 0 && !disabled && (
                  <div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredItems.map((item: string) => (
                          <div 
                             key={item} 
                             onClick={() => { onChange(item); setShowSuggestions(false); }}
                             className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-700"
                          >
                              {item}
                          </div>
                      ))}
                  </div>
              )}
          </div>
      );
  };

  const LocationSelector = ({ label, prov, setProv, city, setCity, spot, setSpot, address, setAddress, colorClass }: any) => {
      // Get cities for selected province
      const cityList = useMemo(() => {
          return CITIES_AND_SPOTS[prov] ? Object.keys(CITIES_AND_SPOTS[prov]) : [];
      }, [prov]);

      // Get spots for selected city
      const spotList = useMemo(() => {
          if (!prov || !city) return [];
          const provinceData = CITIES_AND_SPOTS[prov];
          // Simple fuzzy match for city key if user typed slightly different
          const cityKey = Object.keys(provinceData).find(k => k.toLowerCase() === city.toLowerCase());
          return cityKey ? provinceData[cityKey] : [];
      }, [prov, city]);

      return (
        <div className="bg-white p-4 rounded-[2rem] shadow-card relative z-0"> 
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <div className="space-y-3">
                <div className="flex gap-2">
                    {/* Province Selector */}
                    <div className="relative w-1/3">
                        <select value={prov} onChange={(e) => { setProv(e.target.value); setCity(""); setSpot(""); }} className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm appearance-none border-r-[8px] border-transparent">
                            {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                    {/* City Input with Autocomplete */}
                    <div className="relative w-2/3">
                        <AutocompleteInput 
                           value={city} 
                           onChange={setCity} 
                           items={cityList} 
                           placeholder={t.origin} // reusing label but it's okay
                        />
                    </div>
                </div>
                
                {/* Specific Spot Input with Autocomplete */}
                <div className="relative">
                     <AutocompleteInput 
                        value={spot}
                        onChange={setSpot}
                        items={spotList}
                        placeholder={city ? `${t.meetingPoint} (${city})` : t.origin}
                        disabled={!city}
                     />
                </div>

                 {/* Specific Address Input */}
                 <div className="relative">
                     <input 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        placeholder="Exact Address (Optional)" 
                        className="w-full p-3 bg-white border border-slate-100 rounded-xl font-medium text-slate-600 outline-none text-xs placeholder-slate-300"
                    />
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-extrabold text-slate-900">{t.postRide}</h1><button onClick={() => setView('home')} className="p-2 bg-white rounded-full shadow-sm text-slate-400"><XCircle size={24}/></button></div>
      <div className="space-y-4">
        <div className="relative z-20">
            <LocationSelector 
                label={t.origin} 
                prov={originProv} setProv={setOriginProv}
                city={originCity} setCity={setOriginCity}
                spot={originSpot} setSpot={setOriginSpot}
                address={originAddress} setAddress={setOriginAddress}
                colorClass="bg-slate-900" 
            />
        </div>
        <div className="relative z-10">
            <LocationSelector 
                label={t.destination} 
                prov={destProv} setProv={setDestProv}
                city={destCity} setCity={setDestCity}
                spot={destSpot} setSpot={setDestSpot}
                address={destAddress} setAddress={setDestAddress}
                colorClass="bg-secondary" 
            />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-[2rem] shadow-card"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full font-bold bg-transparent outline-none" /></div>
            <div className="bg-white p-4 rounded-[2rem] shadow-card"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full font-bold bg-transparent outline-none" /></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-card">
            <div className="flex justify-between items-center mb-4"><span className="font-bold text-slate-900">{t.perSeat}</span><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-20 text-right font-bold text-xl bg-slate-50 rounded-lg p-2 outline-none" /></div>
            <div className="flex justify-between items-center"><span className="font-bold text-slate-900">{t.available}</span><div className="flex items-center gap-4"><button onClick={() => setSeats(Math.max(1, seats-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button><span className="font-bold text-xl">{seats}</span><button onClick={() => setSeats(Math.min(7, seats+1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button></div></div>
        </div>
        
        {/* NEW Luggage Configuration Section */}
        <div className="bg-white p-6 rounded-[2rem] shadow-card">
            <h3 className="font-bold text-slate-900 mb-4">{t.luggageCapacity}</h3>
            <div className="flex gap-4">
                {['small', 'medium', 'large'].map((size) => (
                    <div key={size} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">{t[size as keyof typeof t]}</span>
                        <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                            <button 
                                onClick={() => setLuggage(p => ({...p, [size]: Math.max(0, (p[size as keyof typeof p] || 0) - 1)}))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm font-bold text-slate-600 active:scale-90 transition-transform"
                            >-</button>
                            <span className="font-bold w-4 text-center">{luggage[size as keyof typeof luggage]}</span>
                            <button 
                                onClick={() => setLuggage(p => ({...p, [size]: (p[size as keyof typeof p] || 0) + 1}))}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm font-bold text-slate-600 active:scale-90 transition-transform"
                            >+</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <Button onClick={handlePublish} disabled={isSubmitting} className="w-full shadow-2xl shadow-indigo-500/30">{t.publishRide}</Button>
      </div>
    </div>
  );
}

const RideDetailView = ({ ride, onBack, lang, onBook, initialSeats }: { ride: Ride, onBack: () => void, lang: Language, onBook: (ride: Ride, seats: number) => void, initialSeats: number }) => {
  const [seatsToBook, setSeatsToBook] = useState(initialSeats);
  const [locationInfo, setLocationInfo] = useState<{ address: string, uri: string } | null>(null);
  const t = translations[lang];

  useEffect(() => { 
    // Resolving location for Map
    const exactAddress = getAddressFromLocationString(ride.origin);
    if (exactAddress) {
        setLocationInfo({ 
            address: exactAddress, 
            uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exactAddress)}` // Using Search API for better pinpointing
        });
    } else {
        // Fallback
        setLocationInfo({ 
            address: ride.origin, 
            uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ride.origin)}` 
        });
    }
  }, [ride]);
  
  useEffect(() => { if (seatsToBook > ride.seatsAvailable) setSeatsToBook(ride.seatsAvailable); }, [ride.seatsAvailable]);

  const originParts = ride.origin.split(' - ');
  const destParts = ride.destination.split(' - ');

  return (
    <div className="min-h-full bg-white pb-32">
      <div className="relative h-72 group">
        {locationInfo ? (<img src={getStaticMapUrl(locationInfo.address)} className="w-full h-full object-cover transition-opacity duration-500" alt="Map" />) : (<img src={`https://picsum.photos/800/600?random=${ride.id}`} className="w-full h-full object-cover" alt="Map" />)}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-white"></div>
        <button onClick={onBack} className="absolute top-12 left-6 bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors z-20"><ChevronLeft size={24} /></button>
        {locationInfo && (<a href={locationInfo.uri} target="_blank" rel="noopener noreferrer" className="absolute bottom-16 right-6 z-20 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-white transition-colors text-slate-900 border border-slate-200"><NavigationIcon size={16} className="text-primary fill-primary" /> Get Directions</a>)}
      </div>
      <div className="px-6 relative -top-12">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-50">
           <div className="flex justify-between items-start mb-6">
              <div><h1 className="text-3xl font-extrabold text-slate-900 mb-1">${ride.price * seatsToBook}</h1><p className="text-slate-400 font-bold text-xs uppercase tracking-wide">{t.totalFor} {seatsToBook} {seatsToBook > 1 ? t.seats.toLowerCase() : t.seat.toLowerCase()}</p></div>
              <div className="text-right"><div className="flex items-center gap-2 justify-end mb-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="font-bold text-slate-900">{ride.seatsAvailable} {t.seats.toLowerCase()}</span></div><p className="text-slate-400 font-bold text-xs uppercase tracking-wide">{t.available}</p></div>
           </div>
           <div className="space-y-6 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100"></div>
              <div className="flex gap-6 relative z-10"><div className="w-4 h-4 rounded-full bg-slate-900 ring-4 ring-white mt-1"></div><div><h3 className="text-xl font-bold text-slate-900 leading-none">{ride.departureTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</h3><p className="text-slate-700 font-bold mt-1">{originParts.length > 1 ? originParts[1] : ride.origin}</p>{originParts.length > 1 && <p className="text-slate-400 text-xs font-medium">{originParts[0]}</p>}</div></div>
              <div className="flex gap-6 relative z-10"><div className="w-4 h-4 rounded-full bg-secondary ring-4 ring-white mt-1"></div><div><h3 className="text-xl font-bold text-slate-900 leading-none">{ride.arrivalTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</h3><p className="text-slate-700 font-bold mt-1">{destParts.length > 1 ? destParts[1] : ride.destination}</p>{destParts.length > 1 && <p className="text-slate-400 text-xs font-medium">{destParts[0]}</p>}</div></div>
           </div>
           <div className="mt-8 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl"><img src={ride.driver.avatar} className="w-12 h-12 rounded-full" /><div className="flex-1"><div className="font-bold text-slate-900">{ride.driver.firstName} {ride.driver.lastName}</div><div className="text-xs font-bold text-slate-500 flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/> {ride.driver.rating}</div></div><div className="flex gap-2"><a href={`sms:${ride.driver.phone}`} className="p-3 bg-white rounded-xl shadow-sm text-blue-500 hover:bg-blue-50 transition-colors"><MessageSquare size={20}/></a><a href={`tel:${ride.driver.phone}`} className="p-3 bg-white rounded-xl shadow-sm text-green-500 hover:bg-green-50 transition-colors"><Phone size={20}/></a></div></div>
           <div className="mt-4 bg-slate-50 p-5 rounded-2xl flex justify-between items-center"><span className="font-bold text-slate-900">{t.seatsToBook}</span><div className="flex items-center gap-4"><button onClick={() => setSeatsToBook(Math.max(1, seatsToBook - 1))} className="w-8 h-8 rounded-full bg-white shadow-sm font-bold text-slate-600 disabled:opacity-50" disabled={seatsToBook <= 1}>-</button><span className="font-bold text-xl">{seatsToBook}</span><button onClick={() => setSeatsToBook(Math.min(ride.seatsAvailable, seatsToBook + 1))} className="w-8 h-8 rounded-full bg-white shadow-sm font-bold text-slate-600 disabled:opacity-50" disabled={seatsToBook >= ride.seatsAvailable}>+</button></div></div>
           
           {/* NEW Luggage Display Section */}
           <div className="mt-4 bg-slate-50 p-5 rounded-2xl flex flex-col gap-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm"><Briefcase size={16} /> {t.luggageAllowance}</h4>
                <div className="flex gap-3">
                    {Object.entries(ride.luggage).map(([size, count]) => (
                        <div key={size} className="flex-1 bg-white p-3 rounded-xl shadow-sm text-center border border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{t[size as keyof typeof t]}</div>
                            <div className={`font-extrabold text-xl ${count > 0 ? 'text-slate-900' : 'text-slate-200'}`}>{count}</div>
                        </div>
                    ))}
                </div>
           </div>

           {locationInfo?.address && (
              <div className="mt-6 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                   <h4 className="text-indigo-900 font-bold flex items-center gap-2 text-sm mb-1"><Zap size={16} className="text-indigo-600 fill-indigo-600"/> {t.meetingPoint}</h4>
                   <p className="text-indigo-800 text-sm font-medium">{locationInfo.address}</p>
                   <p className="text-xs text-indigo-400 mt-1">{t.driverSelectedMsg}</p>
              </div>
           )}
           <Button onClick={() => onBook(ride, seatsToBook)} className="mt-8 w-full shadow-2xl shadow-indigo-500/30">{t.book} {seatsToBook} {seatsToBook > 1 ? t.seats.toLowerCase() : t.seat.toLowerCase()}</Button>
        </div>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [currentView, setView] = useState<ViewState>('home');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [allRides, setAllRides] = useState<Ride[]>(() => loadRidesFromStorage());
  const [bookedRides, setBookedRides] = useState<Ride[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<UserType[]>([]);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [rideToRate, setRideToRate] = useState<Ride | null>(null);
  const [selectedSeats, setSelectedSeats] = useState(1);

  useEffect(() => { saveRidesToStorage(allRides); }, [allRides]);

  const updateUser = (updatedUser: UserType) => {
     setUser(updatedUser);
     if (updatedUser.driverStatus === 'pending') {
         // Avoid duplicates in pending list
         setPendingDrivers(prev => {
             if (prev.find(p => p.id === updatedUser.id)) return prev;
             return [...prev, updatedUser];
         });
     }
  };
  const publishRide = (newRide: Ride) => { setAllRides(prev => [newRide, ...prev]); };
  const approveDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     if (user && user.id === id) { setUser({ ...user, isVerified: true, driverStatus: 'approved' }); alert("You are approved! You can now post rides."); } else alert("Driver Approved.");
  };
  const rejectDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     if (user && user.id === id) { setUser({ ...user, isVerified: false, driverStatus: 'rejected' }); alert("Application Rejected."); } else alert("Driver Rejected.");
  };
  
  // FIXED SEAT DEDUCTION LOGIC
  const handleBookRide = (ride: Ride, seats: number) => {
      const seatsNum = Number(seats); // Ensure it's a number
      const rideBooking = { ...ride, bookedSeats: seatsNum };
      setBookedRides(prev => [rideBooking, ...prev]);
      
      // Update the global state (allRides) to reflect fewer seats
      setAllRides(prev => prev.map(r => { 
        if (r.id === ride.id) {
           return { ...r, seatsAvailable: Math.max(0, r.seatsAvailable - seatsNum) }; 
        }
        return r; 
      }));
      
      alert(`Successfully booked ${seatsNum} seat(s)!`);
      setView('home'); 
      setSelectedRide(null);
  };
  
  const handleRateRide = (ride: Ride) => { setRideToRate(ride); setRatingModalOpen(true); };
  const submitRating = (rating: number, comment: string) => { alert(`Rating submitted!`); setRatingModalOpen(false); setRideToRate(null); };

  if (!user) return <AuthView onLogin={(u: UserType) => { setUser(u); setView(u.role === 'driver' ? 'post' : 'home'); }} lang={lang} setLang={setLang} />;
  
  // Admin sees all future rides
  const activeAdminRoutes = allRides.filter(r => r.arrivalTime.getTime() > new Date().getTime());

  const renderView = () => {
    switch(currentView) {
      case 'home': case 'search': return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} setSelectedSeats={setSelectedSeats} />;
      case 'post': 
        if (user.role !== 'driver') { setTimeout(() => setView('home'), 0); return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} setSelectedSeats={setSelectedSeats} />; }
        return <PostRideView setView={setView} lang={lang} user={user} updateUser={updateUser} onPublish={publishRide} />;
      case 'ride-detail': return selectedRide ? <RideDetailView ride={selectedRide} onBack={() => setView('home')} lang={lang} onBook={handleBookRide} initialSeats={selectedSeats} /> : <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} setSelectedSeats={setSelectedSeats} />;
      case 'wallet': return <WalletView lang={lang} />;
      case 'leaderboard': return <LeaderboardView lang={lang} />;
      case 'admin': return <AdminView setView={setView} pendingDrivers={pendingDrivers} approveDriver={approveDriver} rejectDriver={rejectDriver} liveRoutes={activeAdminRoutes} lang={lang} />;
      case 'legal': return <LegalView onBack={() => setView('profile')} lang={lang} />;
      case 'profile': {
        const t = translations[lang];
        return (
          <div className="pt-20 px-6 space-y-6 pb-32">
            <Header title={t.profile} rightAction={<button onClick={() => setUser(null)} className="text-red-500 font-bold text-sm">{t.signOut}</button>} />
            <div className="bg-white p-6 rounded-[2rem] shadow-card text-center relative overflow-hidden">
              {user.avatar ? <img src={user.avatar} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-50 object-cover" /> : <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-50 bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-500 flex items-center justify-center text-3xl font-bold shadow-inner">{user.firstName[0]}{user.lastName[0]}</div>}
              <h2 className="text-2xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
              <p className="text-slate-400 font-medium mb-4 capitalize">{user.role}</p>
              {user.isVerified && <div className="inline-flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-xl font-bold text-sm"><CheckCircle2 size={16}/> {t.driverVerified}</div>}
              {user.driverStatus === 'pending' && <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-xl font-bold text-sm mt-2"><Clock size={16}/> {t.verificationRequired}</div>}
            </div>
            <div className="bg-white p-2 rounded-[2rem] shadow-card space-y-1">
               <button onClick={() => setView('legal')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors text-slate-700 font-bold"><span className="flex items-center gap-3"><FileText className="text-slate-400"/> {t.legalPrivacy}</span><ArrowRight size={16} className="text-slate-300" /></button>
            </div>
          </div>
        );
      }
      default: return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} setSelectedSeats={setSelectedSeats} />;
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 text-slate-900 overflow-hidden flex flex-col font-sans">
       <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
         {renderView()}
       </div>
       {user && currentView !== 'ride-detail' && <Navigation currentView={currentView} setView={setView} lang={lang} userRole={user.role} />}
       <RateModal isOpen={ratingModalOpen} onClose={submitRating} driverName={rideToRate?.driver.firstName || "Driver"} />
    </div>
  );
};