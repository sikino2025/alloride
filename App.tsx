import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Filter, Star, CheckCircle2, Music, Zap, Info, Share2, ScanFace, DollarSign, Upload, FileText, ChevronDown, Snowflake, Dog, Cigarette, Car, Clock, Check, Shield, XCircle, Eye, Lock, Mail, Key, Camera, CreditCard, Briefcase, Phone, Smartphone, ChevronLeft, Globe, MessageSquare, ThumbsUp, Download, Navigation as NavigationIcon, Map, Plus } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { generateRideSafetyBrief, optimizeRideDescription, resolvePickupLocation, getStaticMapUrl } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities (Keep existing) ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

const getDisplayDate = (dateStr: string, t: any) => {
  if (!dateStr) return t.today;
  const today = toLocalISOString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toLocalISOString(tomorrowDate);
  if (dateStr === today) return t.today;
  if (dateStr === tomorrow) return t.tomorrow;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
};

// --- Data & Mocks ---
const CITIES = [
  "Montreal, QC", "Quebec City, QC", "Laval, QC", "Gatineau, QC", "Sherbrooke, QC", "Trois-Rivières, QC",
  "Toronto, ON", "Ottawa, ON", "Mississauga, ON", "Kingston, ON",
  "Vancouver, BC", "Calgary, AB", "Edmonton, AB"
].sort();

// Amigo-style predefined meeting points
const MEETING_POINTS: Record<string, { name: string, address: string }[]> = {
  "Montreal, QC": [
    { name: "Berri-UQAM Metro", address: "Berri-UQAM Metro Station, Montreal, QC" },
    { name: "Namur Metro", address: "Namur Metro Station, Jean-Talon St W, Montreal, QC" },
    { name: "Radisson Metro", address: "Radisson Metro Station, Sherbrooke St E, Montreal, QC" },
    { name: "Fairview Pointe-Claire", address: "Fairview Pointe-Claire, Trans-Canada Hwy, Pointe-Claire, QC" },
    { name: "Côte-Vertu Metro", address: "Côte-Vertu Metro Station, Saint-Laurent, QC" },
    { name: "Longueuil Metro", address: "Terminus Longueuil, Place Charles-Le Moyne, Longueuil, QC" }
  ],
  "Quebec City, QC": [
    { name: "Sainte-Foy Bus Terminal", address: "Gare d'autocars de Sainte-Foy, Quebec City, QC" },
    { name: "Place Laurier", address: "Laurier Québec, Boulevard Laurier, Quebec City, QC" },
    { name: "Gare du Palais", address: "Gare du Palais, Rue de la Gare, Quebec City, QC" }
  ],
  "Ottawa, ON": [
    { name: "Rideau Centre", address: "CF Rideau Centre, Rideau St, Ottawa, ON" },
    { name: "Bayshore Shopping Centre", address: "Bayshore Shopping Centre, Ottawa, ON" },
    { name: "St. Laurent Centre", address: "St. Laurent Shopping Centre, St. Laurent Blvd, Ottawa, ON" },
    { name: "Place d'Orléans", address: "Place d'Orléans, Place d'Orleans Dr, Orléans, ON" }
  ],
  "Toronto, ON": [
    { name: "Union Station", address: "Union Station, Front St W, Toronto, ON" },
    { name: "Yorkdale Mall", address: "Yorkdale Shopping Centre, Dufferin St, Toronto, ON" },
    { name: "Scarborough Town Centre", address: "Scarborough Town Centre, Borough Dr, Scarborough, ON" }
  ],
  "Sherbrooke, QC": [
    { name: "Carrefour de l'Estrie", address: "Carrefour de l'Estrie, Boulevard de Portland, Sherbrooke, QC" },
    { name: "Université de Sherbrooke", address: "Université de Sherbrooke, Boulevard de l'Université, Sherbrooke, QC" }
  ],
  "Trois-Rivières, QC": [
    { name: "Centre Les Rivières", address: "Centre Les Rivières, Boulevard des Forges, Trois-Rivières, QC" },
    { name: "Terminus Trois-Rivières", address: "Terminus d'autobus de Trois-Rivières, Trois-Rivières, QC" }
  ]
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
  
  for (let i = 0; i < 50; i++) {
     // Pick a random city
     const originCity = getRandom(Object.keys(MEETING_POINTS));
     // Pick a random spot in that city if available, else just city name
     const originSpot = MEETING_POINTS[originCity] ? getRandom(MEETING_POINTS[originCity]) : { name: "City Center", address: originCity };
     
     let destCity = getRandom(Object.keys(MEETING_POINTS));
     while (destCity === originCity) destCity = getRandom(Object.keys(MEETING_POINTS)); 
     const destSpot = MEETING_POINTS[destCity] ? getRandom(MEETING_POINTS[destCity]) : { name: "City Center", address: destCity };

     const date = new Date(now);
     date.setDate(date.getDate() + Math.floor(Math.random() * 5));
     date.setHours(Math.floor(Math.random() * 14) + 6, 0, 0, 0);
     const driver = getRandom(DRIVERS);
     
     // Construct the "Amigo style" location string: "City - Spot Name"
     // This ensures search works (city name present) and details are visible
     const originStr = `${originCity.split(',')[0]} - ${originSpot.name}`;
     const destStr = `${destCity.split(',')[0]} - ${destSpot.name}`;

     rides.push({
        id: `r${idCounter++}`,
        driver: { ...MOCK_USER_TEMPLATE, firstName: driver.name.split(' ')[0], lastName: driver.name.split(' ')[1], avatar: driver.avatar, rating: driver.rating, totalRides: driver.rides, isVerified: driver.verified, role: 'driver', vehicle: { make: ["Toyota", "Honda", "Tesla", "Hyundai"][Math.floor(Math.random()*4)], model: ["RAV4", "Civic", "Model 3", "Tucson"][Math.floor(Math.random()*4)], year: "2022", color: ["White", "Black", "Grey", "Blue"][Math.floor(Math.random()*4)], plate: `${String.fromCharCode(65+Math.random()*26)}${Math.floor(Math.random()*999)} ${String.fromCharCode(65+Math.random()*26)}${String.fromCharCode(65+Math.random()*26)}` } },
        origin: originStr, // Visual string
        destination: destStr, // Visual string
        stops: [], 
        departureTime: new Date(date), 
        arrivalTime: new Date(date.getTime() + 3600000 * (Math.random() * 4 + 1)), 
        price: Math.floor(Math.random() * 60) + 30, 
        currency: 'CAD', 
        seatsAvailable: Math.floor(Math.random() * 3) + 1, 
        luggage: { small: 2, medium: 1, large: 0 },
        features: { instantBook: Math.random() > 0.5, wifi: Math.random() > 0.5, music: true, pets: Math.random() > 0.8, smoking: false, winterTires: true }, 
        distanceKm: Math.floor(Math.random() * 400) + 50, 
        // Important: We embed the precise addresses in the description for the detail view to parse if needed, 
        // though the visual string usually carries enough info for humans.
        // But for the "Map Pin" feature, we'll try to use the part after the hyphen.
        description: `Leaving exactly from ${originSpot.name}. Dropping off at ${destSpot.name}. Flexible with luggage.`
     });
  }
  return rides.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
};

// --- Storage Utils ---
const STORAGE_KEY_RIDES = 'alloride_rides_data_v1';

const loadRidesFromStorage = (): Ride[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RIDES);
    if (saved) {
      const parsed = JSON.parse(saved);
      // We must map strings back to Date objects
      return parsed.map((r: any) => ({
        ...r,
        departureTime: new Date(r.departureTime),
        arrivalTime: new Date(r.arrivalTime),
      }));
    }
  } catch (e) {
    console.error("Failed to load rides from storage", e);
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

// --- Helpers ---
const getAddressFromLocationString = (locStr: string): string | null => {
  if (!locStr.includes(' - ')) return null;
  const [cityNameShort, spotName] = locStr.split(' - ');
  // Find full city key
  const cityKey = Object.keys(MEETING_POINTS).find(k => k.startsWith(cityNameShort));
  if (cityKey && MEETING_POINTS[cityKey]) {
    const spot = MEETING_POINTS[cityKey].find(p => p.name === spotName);
    if (spot) return spot.address;
  }
  return null;
}

// --- Components ---

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

const RideCard: React.FC<{ ride: Ride; onClick: () => void; t: any }> = ({ ride, onClick, t }) => {
  const startTime = ride.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = ride.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const duration = Math.round((ride.arrivalTime.getTime() - ride.departureTime.getTime()) / 3600000 * 10) / 10;
  const rideDate = ride.departureTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  
  const isNew = ride.id.toString().startsWith('ride-');

  // Split logic to clean up the card display if using the new "City - Spot" format
  const formatLocation = (loc: string) => {
    if (loc.includes(' - ')) {
        const [city, spot] = loc.split(' - ');
        return { city, spot };
    }
    return { city: loc.split(',')[0], spot: '' };
  };

  const origin = formatLocation(ride.origin);
  const dest = formatLocation(ride.destination);

  return (
    <div onClick={onClick} className="bg-white rounded-3xl p-5 shadow-card mb-5 active:scale-[0.99] transition-transform cursor-pointer border border-slate-100 relative overflow-hidden group">
      {/* Decorative gradient blob */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors"></div>
      
      {/* Date Tag */}
      <div className="flex justify-between items-center mb-4 relative z-10">
        <div className="flex items-center gap-2">
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{rideDate}</span>
            {isNew && <span className="bg-red-500 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">New</span>}
        </div>
        {ride.features.instantBook && <span className="text-amber-500 flex items-center gap-1 text-[10px] font-bold"><Zap size={12} fill="currentColor"/> Instant</span>}
      </div>

      <div className="flex gap-4 mb-4 relative z-10">
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="w-3 h-3 rounded-full bg-slate-900 ring-4 ring-slate-100"></div>
          <div className="w-0.5 h-10 bg-slate-200 border-l border-dashed border-slate-300"></div>
          <div className="w-3 h-3 rounded-full bg-secondary ring-4 ring-pink-50"></div>
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
          <img src={ride.driver.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm" alt="driver" />
          <div className="text-xs">
            <div className="font-bold text-slate-900">{ride.driver.firstName}</div>
            <div className="flex items-center gap-1 text-slate-400">
               <Star size={10} className="text-yellow-400 fill-yellow-400" /> {ride.driver.rating}
            </div>
          </div>
        </div>
        <div className={`text-xs font-bold px-3 py-1.5 rounded-xl ${ride.seatsAvailable === 1 ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-600'}`}>
           {ride.seatsAvailable} seats left
        </div>
      </div>
    </div>
  );
};

// --- Views (Specific Updates) ---

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
  const [email, setEmail] = useState('alex@example.com');
  
  const handleAuth = (e: React.FormEvent) => {
      e.preventDefault();
      // Mock login
      const mockUser: UserType = {
          ...MOCK_USER_TEMPLATE,
          id: `u-${Date.now()}`,
          role: role,
          firstName: isLogin ? 'Alex' : 'New User',
          driverStatus: role === 'driver' ? 'new' : undefined 
      };
      if (role === 'driver') {
          mockUser.isVerified = false;
          mockUser.documentsUploaded = { license: false, insurance: false, photo: false };
      }
      onLogin(mockUser);
  };

  return (
    <div className="min-h-full bg-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
       <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center"></div>
       <div className="relative z-10 w-full max-w-md">
          <div className="flex justify-center mb-8"><Logo size={120} /></div>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl">
             <h2 className="text-3xl font-extrabold text-white text-center mb-2">{isLogin ? t.welcomeBack : t.joinJourney}</h2>
             <div className="flex bg-black/20 p-1 rounded-xl mb-6">
                <button onClick={() => setIsLogin(true)} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>{t.logIn}</button>
                <button onClick={() => setIsLogin(false)} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/60 hover:text-white'}`}>{t.signUp}</button>
             </div>
             <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                   <div className="flex gap-2 mb-4">
                      <button type="button" onClick={() => setRole('passenger')} className={`flex-1 py-2 rounded-lg border-2 font-bold text-xs ${role === 'passenger' ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-white/40'}`}>{t.passenger}</button>
                      <button type="button" onClick={() => setRole('driver')} className={`flex-1 py-2 rounded-lg border-2 font-bold text-xs ${role === 'driver' ? 'border-primary bg-primary/20 text-white' : 'border-white/10 text-white/40'}`}>{t.driver}</button>
                   </div>
                )}
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} className="w-full bg-black/20 border border-white/10 text-white placeholder-white/40 p-4 rounded-xl outline-none focus:border-white/40 transition-colors font-medium" />
                <input type="password" placeholder={t.password} className="w-full bg-black/20 border border-white/10 text-white placeholder-white/40 p-4 rounded-xl outline-none focus:border-white/40 transition-colors font-medium" />
                <Button type="submit" variant="primary" className="w-full mt-4">{isLogin ? t.logIn : t.createAccount}</Button>
             </form>
             <div className="mt-6 text-center">
                 <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="text-white/40 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest">{lang === 'en' ? 'Français' : 'English'}</button>
             </div>
          </div>
       </div>
    </div>
  );
};

const HomeView = ({ setView, setDetailRide, lang, user, allRides, bookedRides, onRateRide, setSelectedSeats }: any) => {
  const t = translations[lang];
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  
  // Filter rides
  const filteredRides = allRides.filter((r: Ride) => {
     if (searchFrom && !r.origin.toLowerCase().includes(searchFrom.toLowerCase())) return false;
     if (searchTo && !r.destination.toLowerCase().includes(searchTo.toLowerCase())) return false;
     return true;
  });

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
                   <img src={user.avatar} onClick={() => setView('profile')} className="w-12 h-12 rounded-full border-2 border-white/20 cursor-pointer hover:scale-105 transition-transform" />
               </div>
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
           </div>
       </div>
       
       <div className="px-6 -mt-12 relative z-10">
           {/* Booked Rides Section */}
           {bookedRides.length > 0 && (
               <div className="mb-8">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 ml-2">Your Tickets</h2>
                  <div className="space-y-4">
                     {bookedRides.map((ride: Ride) => (
                         <div key={ride.id} className="bg-white p-6 rounded-[2rem] shadow-card border border-slate-100 relative overflow-hidden">
                             <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">CONFIRMED</div>
                             <div className="flex justify-between items-center mb-4">
                                 <div className="text-2xl font-bold text-slate-900">{ride.departureTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                 <div className="flex -space-x-2">
                                     <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold border-2 border-white">{ride.seatsAvailable}</div>
                                 </div>
                             </div>
                             <div className="flex gap-4 items-center">
                                 <div className="flex-1">
                                    <div className="text-sm font-bold text-slate-500">{ride.origin.split(',')[0]}</div>
                                    <div className="h-4 border-l-2 border-dashed border-slate-200 ml-1 my-1"></div>
                                    <div className="text-sm font-bold text-slate-900">{ride.destination.split(',')[0]}</div>
                                 </div>
                                 <button onClick={() => onRateRide(ride)} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-yellow-500 transition-colors"><Star size={20}/></button>
                             </div>
                         </div>
                     ))}
                  </div>
               </div>
           )}

           <div className="flex justify-between items-end mb-4 px-2">
               <h2 className="text-lg font-bold text-slate-900">{t.featuredRides}</h2>
               <button className="text-xs font-bold text-primary">{t.viewAll}</button>
           </div>
           
           <div className="space-y-0">
              {filteredRides.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                      <Search size={48} className="mx-auto mb-4 opacity-20"/>
                      <p>{t.noRidesFound}</p>
                  </div>
              ) : (
                  filteredRides.map((ride: Ride) => (
                      <RideCard key={ride.id} ride={ride} t={t} onClick={() => { setDetailRide(ride); setView('ride-detail'); setSelectedSeats(1); }} />
                  ))
              )}
           </div>
       </div>
    </div>
  );
};

const WalletView = ({ lang }: any) => {
  const t = translations[lang];
  const transactions = [
    { id: 't1', amount: -45.00, date: '2023-10-24', type: 'debit', description: 'Ride to Montreal' },
    { id: 't2', amount: 120.50, date: '2023-10-20', type: 'credit', description: 'Weekly Payout' },
    { id: 't3', amount: -32.00, date: '2023-10-18', type: 'debit', description: 'Ride to Ottawa' },
  ];
  return (
    <div className="pt-20 px-6 h-full pb-32">
       <Header title={t.wallet} subtitle={t.myWallet} />
       <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-[2.5rem] shadow-2xl mb-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full translate-x-12 -translate-y-12"></div>
           <p className="text-white/60 font-medium mb-2">{t.totalBalance}</p>
           <h2 className="text-5xl font-extrabold mb-8">$1,240.50</h2>
           <div className="flex gap-4">
               <button className="flex-1 bg-white text-slate-900 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2"><Plus size={16}/> Top Up</button>
               <button className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold text-sm hover:bg-white/20 transition-colors flex items-center justify-center gap-2"><ArrowRight size={16}/> Withdraw</button>
           </div>
       </div>
       <h3 className="font-bold text-slate-900 mb-4 text-lg">{t.recentActivity}</h3>
       <div className="space-y-4">
          {transactions.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-xl ${tx.type === 'credit' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                         {tx.type === 'credit' ? <ArrowRight className="rotate-45" size={20}/> : <ArrowRight className="-rotate-45" size={20}/>}
                     </div>
                     <div>
                         <div className="font-bold text-slate-900">{tx.description}</div>
                         <div className="text-xs text-slate-400 font-bold">{tx.date}</div>
                     </div>
                 </div>
                 <div className={`font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'}`}>
                     {tx.type === 'credit' ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                 </div>
              </div>
          ))}
       </div>
    </div>
  );
};

const LeaderboardView = ({ lang }: any) => {
  const t = translations[lang];
  return (
      <div className="pt-20 px-6 pb-32">
          <Header title={t.driverLeaderboard} subtitle={t.topDrivers} />
          <div className="mb-8">
             <LeaderboardChart />
          </div>
          <div className="space-y-4">
              {DRIVERS.map((d, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex items-center gap-4">
                      <div className="font-bold text-slate-300 w-6 text-center">#{i+1}</div>
                      <img src={d.avatar} className="w-12 h-12 rounded-full" />
                      <div className="flex-1">
                          <div className="font-bold text-slate-900">{d.name}</div>
                          <div className="text-xs text-slate-500 font-bold">{d.rides} rides</div>
                      </div>
                      <div className="text-amber-500 font-bold flex items-center gap-1"><Star size={14} fill="currentColor"/> {d.rating}</div>
                  </div>
              ))}
          </div>
      </div>
  );
};

const AdminView = ({ setView, pendingDrivers, approveDriver, rejectDriver, liveRoutes }: any) => {
  return (
      <div className="pt-20 px-6 pb-32">
          <Header title="Admin Dashboard" subtitle="Manage Drivers & Routes" />
          
          <div className="bg-white p-6 rounded-[2rem] shadow-card mb-8">
             <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Shield size={20} className="text-indigo-600"/> Pending Approvals</h3>
             {pendingDrivers.length === 0 ? <div className="text-slate-400 text-sm font-medium py-4 text-center">No pending applications</div> : (
                 <div className="space-y-4">
                     {pendingDrivers.map((d: UserType) => (
                         <div key={d.id} className="border border-slate-100 rounded-xl p-4">
                             <div className="flex items-center gap-3 mb-3">
                                 <img src={d.avatar} className="w-10 h-10 rounded-full" />
                                 <div>
                                     <div className="font-bold text-slate-900">{d.firstName} {d.lastName}</div>
                                     <div className="text-xs text-slate-500">License: {d.vehicle?.plate}</div>
                                 </div>
                             </div>
                             <div className="flex gap-2">
                                 <Button variant="primary" onClick={() => approveDriver(d.id)} className="py-2 text-xs h-auto">Approve</Button>
                                 <Button variant="danger" onClick={() => rejectDriver(d.id)} className="py-2 text-xs h-auto">Reject</Button>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-card">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Map size={20} className="text-green-600"/> Live Routes</h3>
              <div className="space-y-4">
                  {liveRoutes.slice(0, 5).map((r: Ride) => (
                      <div key={r.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                          <div>
                              <div className="font-bold text-slate-900">{r.origin.split(',')[0]} → {r.destination.split(',')[0]}</div>
                              <div className="text-slate-400 text-xs">{r.driver.firstName} • {r.seatsAvailable} seats left</div>
                          </div>
                          <div className="font-bold text-green-600">${r.price}</div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );
};

const LegalView = ({ onBack, lang }: any) => {
  const t = translations[lang];
  return (
      <div className="pt-20 px-6 pb-32">
          <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 font-bold"><ChevronLeft size={20} /> {t.back}</button>
          <Header title={t.legalPrivacy} />
          <div className="bg-white p-6 rounded-[2rem] shadow-card space-y-6">
              <section>
                  <h3 className="font-bold text-slate-900 mb-2">{t.termsOfService}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{t.legalText1}</p>
              </section>
              <section>
                  <h3 className="font-bold text-slate-900 mb-2">{t.privacyPolicy}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{t.legalText2}</p>
              </section>
              <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400">
                  Version 1.2.0 • Build 20231024
              </div>
          </div>
      </div>
  );
};

const PostRideView = ({ setView, lang, user, updateUser, onPublish }: { setView: any, lang: Language, user: UserType, updateUser: (u: UserType) => void, onPublish: (ride: Ride) => void }) => {
  const t = translations[lang];
  const needsOnboarding = user.role === 'driver' && (!user.isVerified || user.driverStatus !== 'approved');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', color: '', plate: '' });
  const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: boolean }>({ license: false, insurance: false, photo: false });
  const [docUrls, setDocUrls] = useState<{ [key: string]: string }>({}); 
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<string | null>(null);
  
  // Amigo-style Location States
  const [originCity, setOriginCity] = useState("");
  const [originSpot, setOriginSpot] = useState<{name: string, address: string} | null>(null);
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationSpot, setDestinationSpot] = useState<{name: string, address: string} | null>(null);

  const [date, setDate] = useState(() => toLocalISOString(new Date()));
  const getNextHourTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const [time, setTime] = useState(getNextHourTime());
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(45);
  const [seats, setSeats] = useState(3);
  const [luggage, setLuggage] = useState({ small: 2, medium: 1, large: 0 });
  const [loadingAI, setLoadingAI] = useState(false);

  const handleVehicleSubmit = (e: React.FormEvent) => { e.preventDefault(); setOnboardingStep(2); };
  const triggerUpload = (type: string) => { setCurrentUploadType(type); fileInputRef.current?.click(); };
  
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setProfilePhoto(url);
      setUploadedDocs(prev => ({ ...prev, photo: true }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0 && currentUploadType) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        setDocUrls(prev => ({ ...prev, [currentUploadType]: url }));
        setTimeout(() => setUploadedDocs(prev => ({...prev, [currentUploadType]: true})), 500);
     }
  };

  const submitForApproval = () => {
    updateUser({ 
        ...user, 
        isVerified: false, 
        driverStatus: 'pending', 
        avatar: profilePhoto || user.avatar, 
        vehicle, 
        documentsUploaded: { ...user.documentsUploaded, license: true, insurance: true, photo: true },
        documentUrls: { license: docUrls.license, insurance: docUrls.insurance, photo: profilePhoto || undefined }
    });
    alert("Submitted for approval.");
  };

  const handlePublish = () => {
     if (!originCity || !originSpot || !destinationCity || !destinationSpot) {
        alert("Please select city and meeting point for both origin and destination.");
        return;
     }
     const departure = new Date(`${date}T${time || '08:00'}`);
     const originStr = `${originCity.split(',')[0]} - ${originSpot.name}`;
     const destStr = `${destinationCity.split(',')[0]} - ${destinationSpot.name}`;

     onPublish({ 
         id: `ride-${Date.now()}`, 
         driver: user, 
         origin: originStr, 
         destination: destStr, 
         stops: [], 
         departureTime: departure, 
         arrivalTime: new Date(departure.getTime() + 10800000), 
         price, 
         currency: 'CAD', 
         seatsAvailable: seats, 
         luggage, 
         features: { instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true }, 
         distanceKm: 300, 
         description: description || `Leaving from ${originSpot.name}. Dropping off at ${destinationSpot.name}.`
     });
     alert("Published! Passengers can now see your trip."); setView('home');
  };

  const handleAI = async () => { 
      if (!originCity || !destinationCity) return; 
      setLoadingAI(true); 
      const text = await optimizeRideDescription(originCity, destinationCity, []); 
      setDescription(text); 
      setLoadingAI(false); 
  }

  // Reuse Auth View Onboarding if needed
  if (needsOnboarding) {
    if (user.driverStatus === 'pending') {
       return (<div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-glow text-amber-500 animate-pulse"><Clock size={48} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">{t.reviewInProgress}</h2><p className="text-center text-slate-500 mb-8 max-w-xs">{t.verifyingDocs}</p><Button variant="outline" onClick={() => setView('home')}>{t.backToHome}</Button></div>);
    }
    // ... Simplified onboarding (copy from previous if needed, but keeping it brief for this response) ...
    // For now assuming user is approved or we skip to publishing for demo.
    // If not, revert to full onboarding code.
    return (
        <div className="h-full bg-slate-50 pb-32 overflow-y-auto px-6 pt-12">
           <Header title={t.driverSetup} subtitle={t.letsGetRoad} />
           <div className="flex gap-2 mb-8">{[1, 2, 3].map(step => (<div key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${onboardingStep >= step ? 'bg-primary' : 'bg-slate-200'}`}></div>))}</div>
           {onboardingStep === 1 && (<form onSubmit={handleVehicleSubmit} className="space-y-4 bg-white p-6 rounded-[2rem] shadow-card"><h3 className="font-bold text-lg mb-4">{t.vehicleDetails}</h3><div className="grid grid-cols-2 gap-4"><input required placeholder="Make" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /><input required placeholder="Model" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /></div><div className="grid grid-cols-2 gap-4"><input required placeholder="Year" type="number" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /><input required placeholder="Color" value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /></div><input required placeholder="License Plate" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm text-center tracking-widest uppercase border border-slate-200" /><Button type="submit" className="mt-4">{t.takeSelfie} (Next)</Button></form>)}
           {onboardingStep === 2 && (<div className="bg-white p-6 rounded-[2rem] shadow-card text-center"><h3 className="font-bold text-lg mb-6">{t.takeSelfie}</h3><input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="user" onChange={handlePhotoUpload} /><div onClick={() => photoInputRef.current?.click()} className="w-48 h-48 mx-auto rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden relative">{profilePhoto ? <img src={profilePhoto} className="w-full h-full object-cover" /> : <div className="text-slate-400"><Camera size={40} className="mx-auto mb-2"/><span className="text-xs font-bold uppercase">{t.tapCamera}</span></div>}</div><div className="mt-8 flex gap-4"><Button variant="secondary" onClick={() => setOnboardingStep(1)}>{t.back}</Button><Button disabled={!profilePhoto} onClick={() => setOnboardingStep(3)}>{t.nextDocs}</Button></div></div>)}
           {onboardingStep === 3 && (<div className="bg-white p-6 rounded-[2rem] shadow-card"><h3 className="font-bold text-lg mb-6">Upload Documents</h3><input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileChange} /><div className="space-y-4">{[{id: 'license', label: t.uploadLicense, icon: CreditCard}, {id: 'insurance', label: t.uploadInsurance, icon: Shield}].map((item) => (<div key={item.id} onClick={() => triggerUpload(item.id)} className={`p-4 rounded-xl flex justify-between items-center cursor-pointer border-2 transition-all ${uploadedDocs[item.id] ? 'border-green-500 bg-green-50' : 'border-slate-100 hover:border-slate-300'}`}><div className="flex items-center gap-4"><div className={`p-2 rounded-lg ${uploadedDocs[item.id] ? 'bg-green-200 text-green-700' : 'bg-slate-100 text-slate-500'}`}><item.icon size={20}/></div><span className="font-bold text-slate-700">{item.label}</span></div>{uploadedDocs[item.id] && <CheckCircle2 size={20} className="text-green-500"/>}</div>))}</div><div className="mt-8 flex gap-4"><Button variant="secondary" onClick={() => setOnboardingStep(2)}>{t.back}</Button><Button disabled={!uploadedDocs.license || !uploadedDocs.insurance} onClick={submitForApproval}>{t.submit}</Button></div></div>)}
        </div>
    );
  }

  const LocationSelector = ({ label, city, setCity, spot, setSpot, colorClass }: any) => {
      const hasPoints = city && MEETING_POINTS[city];
      return (
        <div className="bg-white p-4 rounded-[2rem] shadow-card">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            
            <div className="space-y-3">
                <div className="relative">
                  <select 
                      value={city} 
                      onChange={(e) => { setCity(e.target.value); setSpot(null); }}
                      className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm appearance-none border-r-[16px] border-transparent"
                  >
                      <option value="">Select Region / City...</option>
                      {Object.keys(MEETING_POINTS).sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>

                <div className="relative">
                     <select 
                        value={spot?.name || ""} 
                        onChange={(e) => {
                            const selected = MEETING_POINTS[city]?.find(p => p.name === e.target.value);
                            setSpot(selected || null);
                        }}
                        disabled={!city}
                        className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm appearance-none border-r-[16px] border-transparent disabled:opacity-50 disabled:bg-slate-100"
                    >
                        <option value="">Select Meeting Point...</option>
                        {hasPoints && MEETING_POINTS[city].map((p: any) => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
                
                {spot && (
                    <div className="h-32 w-full rounded-xl overflow-hidden relative mt-2 border border-slate-100">
                        <img src={getStaticMapUrl(spot.address)} className="w-full h-full object-cover" alt="preview" />
                        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-1">
                          <MapPin size={10} /> {spot.address}
                        </div>
                    </div>
                )}
            </div>
        </div>
      );
  };

  return (
    <div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-extrabold text-slate-900">{t.postRide}</h1><button onClick={() => setView('home')} className="p-2 bg-white rounded-full shadow-sm text-slate-400"><XCircle size={24}/></button></div>
      <div className="space-y-4">
        
        <LocationSelector 
            label={t.origin} 
            city={originCity} setCity={setOriginCity} 
            spot={originSpot} setSpot={setOriginSpot} 
            colorClass="bg-slate-900" 
        />
        
        <LocationSelector 
            label={t.destination} 
            city={destinationCity} setCity={setDestinationCity} 
            spot={destinationSpot} setSpot={setDestinationSpot} 
            colorClass="bg-secondary" 
        />

        <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-[2rem] shadow-card"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full font-bold bg-transparent outline-none" /></div>
            <div className="bg-white p-4 rounded-[2rem] shadow-card"><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full font-bold bg-transparent outline-none" /></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-card">
            <div className="flex justify-between items-center mb-4"><span className="font-bold text-slate-900">{t.perSeat}</span><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-20 text-right font-bold text-xl bg-slate-50 rounded-lg p-2 outline-none" /></div>
            <div className="flex justify-between items-center"><span className="font-bold text-slate-900">Available Seats</span><div className="flex items-center gap-4"><button onClick={() => setSeats(Math.max(1, seats-1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button><span className="font-bold text-xl">{seats}</span><button onClick={() => setSeats(Math.min(7, seats+1))} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button></div></div>
        </div>
        
        {/* Luggage Section */}
        <div className="bg-white p-6 rounded-[2rem] shadow-card">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Briefcase size={16} /> {t.luggage}</h3>
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">{t.small}</span>
                  <div className="flex items-center gap-3"><button onClick={() => setLuggage({...luggage, small: Math.max(0, luggage.small-1)})} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button><span className="font-bold w-4 text-center">{luggage.small}</span><button onClick={() => setLuggage({...luggage, small: luggage.small+1})} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button></div>
              </div>
              <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">{t.medium}</span>
                  <div className="flex items-center gap-3"><button onClick={() => setLuggage({...luggage, medium: Math.max(0, luggage.medium-1)})} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button><span className="font-bold w-4 text-center">{luggage.medium}</span><button onClick={() => setLuggage({...luggage, medium: luggage.medium+1})} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button></div>
              </div>
              <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">{t.large}</span>
                  <div className="flex items-center gap-3"><button onClick={() => setLuggage({...luggage, large: Math.max(0, luggage.large-1)})} className="w-8 h-8 rounded-full bg-slate-100 font-bold">-</button><span className="font-bold w-4 text-center">{luggage.large}</span><button onClick={() => setLuggage({...luggage, large: luggage.large+1})} className="w-8 h-8 rounded-full bg-slate-100 font-bold">+</button></div>
              </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-card relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">{t.description}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 bg-slate-50 rounded-xl p-4 font-medium outline-none resize-none" placeholder={t.describeRide} />
            <button onClick={handleAI} disabled={loadingAI || !originCity} className="absolute bottom-6 right-6 bg-white shadow-md px-3 py-1.5 rounded-lg text-xs font-bold text-primary flex items-center gap-1 border border-slate-100"><Zap size={12} fill="currentColor"/> {loadingAI ? 'Thinking...' : 'AI Write'}</button>
        </div>
        
        <Button onClick={handlePublish} className="w-full shadow-2xl shadow-indigo-500/30">{t.publishRide}</Button>
      </div>
    </div>
  );
}

const RideDetailView = ({ ride, onBack, lang, onBook, initialSeats }: { ride: Ride, onBack: () => void, lang: Language, onBook: (ride: Ride, seats: number) => void, initialSeats: number }) => {
  const [safetyTip, setSafetyTip] = useState<string>("Loading route info...");
  const [seatsToBook, setSeatsToBook] = useState(initialSeats);
  const [locationInfo, setLocationInfo] = useState<{ address: string, uri: string } | null>(null);
  const t = translations[lang];

  useEffect(() => { 
    generateRideSafetyBrief(ride.origin, ride.destination).then(setSafetyTip); 
    
    // Resolve location
    const resolveLoc = async () => {
      // Check if it's a structured "City - Spot" location
      const exactAddress = getAddressFromLocationString(ride.origin);
      if (exactAddress) {
          setLocationInfo({ 
             address: exactAddress, 
             uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(exactAddress)}` 
          });
          return;
      }

      // Fallback to AI extraction if not structured
      if (ride.description) {
         const result = await resolvePickupLocation(ride.description, ride.origin);
         setLocationInfo(result);
      } else {
         setLocationInfo({ 
             address: ride.origin, 
             uri: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ride.origin)}` 
         });
      }
    };
    resolveLoc();
  }, [ride]);
  
  useEffect(() => {
    if (seatsToBook > ride.seatsAvailable) {
        setSeatsToBook(ride.seatsAvailable);
    }
  }, [ride.seatsAvailable]);

  // Parsing visual strings for display
  const originParts = ride.origin.split(' - ');
  const destParts = ride.destination.split(' - ');
  const originDisplay = originParts.length > 1 ? originParts[1] : ride.origin;
  const destDisplay = destParts.length > 1 ? destParts[1] : ride.destination;
  const originSub = originParts.length > 1 ? originParts[0] : '';
  const destSub = destParts.length > 1 ? destParts[0] : '';

  return (
    <div className="min-h-full bg-white pb-32">
      <div className="relative h-72 group">
        {locationInfo ? (
            <img 
                src={getStaticMapUrl(locationInfo.address)} 
                className="w-full h-full object-cover transition-opacity duration-500" 
                alt="Map" 
            />
        ) : (
            <img src={`https://picsum.photos/800/600?random=${ride.id}`} className="w-full h-full object-cover" alt="Map" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-white"></div>
        <button onClick={onBack} className="absolute top-12 left-6 bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors z-20"><ChevronLeft size={24} /></button>
        
        {/* Get Directions Button Overlay */}
        {locationInfo && (
            <a 
                href={locationInfo.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-16 right-6 z-20 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-white transition-colors text-slate-900"
            >
                <NavigationIcon size={14} className="text-primary fill-primary" /> Get Directions
            </a>
        )}
      </div>
      <div className="px-6 relative -top-12">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-50">
           <div className="flex justify-between items-start mb-6">
              <div>
                 <h1 className="text-3xl font-extrabold text-slate-900 mb-1">${ride.price * seatsToBook}</h1>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-wide">Total for {seatsToBook} seat{seatsToBook > 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                 <div className="flex items-center gap-2 justify-end mb-1">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="font-bold text-slate-900">{ride.seatsAvailable} seats</span>
                 </div>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-wide">Available</p>
              </div>
           </div>
           
           <div className="space-y-6 relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100"></div>
              <div className="flex gap-6 relative z-10">
                 <div className="w-4 h-4 rounded-full bg-slate-900 ring-4 ring-white mt-1"></div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-none">{ride.departureTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</h3>
                    <p className="text-slate-700 font-bold mt-1">{originDisplay}</p>
                    {originSub && <p className="text-slate-400 text-xs font-medium">{originSub}</p>}
                 </div>
              </div>
              <div className="flex gap-6 relative z-10">
                 <div className="w-4 h-4 rounded-full bg-secondary ring-4 ring-white mt-1"></div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-none">{ride.arrivalTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</h3>
                    <p className="text-slate-700 font-bold mt-1">{destDisplay}</p>
                    {destSub && <p className="text-slate-400 text-xs font-medium">{destSub}</p>}
                 </div>
              </div>
           </div>

           <div className="mt-8 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
              <img src={ride.driver.avatar} className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                 <div className="font-bold text-slate-900">{ride.driver.firstName} {ride.driver.lastName}</div>
                 <div className="text-xs font-bold text-slate-500 flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/> {ride.driver.rating}</div>
              </div>
              <div className="flex gap-2">
                 <a href={`sms:${ride.driver.phone}`} className="p-3 bg-white rounded-xl shadow-sm text-blue-500 hover:bg-blue-50 transition-colors"><MessageSquare size={20}/></a>
                 <a href={`tel:${ride.driver.phone}`} className="p-3 bg-white rounded-xl shadow-sm text-green-500 hover:bg-green-50 transition-colors"><Phone size={20}/></a>
              </div>
           </div>
           
           {/* Vehicle Info */}
           <div className="mt-4 bg-slate-50 p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-400"><Car size={20}/></div>
                 <div>
                    <p className="font-bold text-slate-900 text-sm">{ride.driver.vehicle?.color} {ride.driver.vehicle?.make} {ride.driver.vehicle?.model}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded-md inline-block mt-1 shadow-sm border border-slate-100">{ride.driver.vehicle?.plate}</p>
                 </div>
              </div>
              <div className="h-px bg-slate-200"></div>
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <Briefcase size={18} className="text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">Luggage</span>
                 </div>
                 <div className="flex gap-3 text-xs font-bold text-slate-500">
                    {ride.luggage.small > 0 && <span>{ride.luggage.small} Small</span>}
                    {ride.luggage.medium > 0 && <span>{ride.luggage.medium} Med</span>}
                    {ride.luggage.large > 0 && <span>{ride.luggage.large} Large</span>}
                    {ride.luggage.small === 0 && ride.luggage.medium === 0 && ride.luggage.large === 0 && <span>No Luggage</span>}
                 </div>
              </div>
           </div>
            
            {/* Seat Selector */}
            <div className="mt-4 bg-slate-50 p-5 rounded-2xl flex justify-between items-center">
                <span className="font-bold text-slate-900">Seats to Book</span>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSeatsToBook(Math.max(1, seatsToBook - 1))} 
                        className="w-8 h-8 rounded-full bg-white shadow-sm font-bold text-slate-600 disabled:opacity-50"
                        disabled={seatsToBook <= 1}
                    >-</button>
                    <span className="font-bold text-xl">{seatsToBook}</span>
                    <button 
                        onClick={() => setSeatsToBook(Math.min(ride.seatsAvailable, seatsToBook + 1))} 
                        className="w-8 h-8 rounded-full bg-white shadow-sm font-bold text-slate-600 disabled:opacity-50"
                        disabled={seatsToBook >= ride.seatsAvailable}
                    >+</button>
                </div>
            </div>

           {/* Description */}
           {ride.description && (
             <div className="mt-6">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Info size={16} className="text-slate-400"/> Pickup & Details</h3>
                <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-slate-600 text-sm leading-relaxed font-medium mb-3">
                        {ride.description}
                    </p>
                    
                    {locationInfo && locationInfo.address && (
                        <div className="mt-4 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl animate-pulse-once">
                             <h4 className="text-indigo-900 font-bold flex items-center gap-2 text-sm mb-1">
                                <Zap size={16} className="text-indigo-600 fill-indigo-600"/> 
                                Exact Meeting Point
                             </h4>
                             <p className="text-indigo-800 text-sm font-medium">{locationInfo.address}</p>
                             <p className="text-xs text-indigo-400 mt-1">Confirmed with Google Maps</p>
                        </div>
                    )}
                </div>
             </div>
           )}

           <Button onClick={() => onBook(ride, seatsToBook)} className="mt-8 w-full shadow-2xl shadow-indigo-500/30">
               Book {seatsToBook} Seat{seatsToBook > 1 ? 's' : ''}
           </Button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
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
     if (updatedUser.driverStatus === 'pending' && user?.driverStatus !== 'pending') setPendingDrivers(prev => [...prev, updatedUser]);
  };
  const publishRide = (newRide: Ride) => { setAllRides(prev => [newRide, ...prev]); };
  const approveDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     if (user && user.id === id) { setUser({ ...user, isVerified: true, driverStatus: 'approved' }); alert("Approved!"); } else alert("Driver Approved.");
  };
  const rejectDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     if (user && user.id === id) { setUser({ ...user, isVerified: false, driverStatus: 'rejected' }); alert("Application Rejected."); } else alert("Driver Rejected.");
  };
  const handleBookRide = (ride: Ride, seats: number) => {
      const rideBooking = { ...ride, bookedSeats: seats };
      setBookedRides(prev => [rideBooking, ...prev]);
      setAllRides(prev => prev.map(r => {
        if (r.id === ride.id) return { ...r, seatsAvailable: Math.max(0, r.seatsAvailable - seats) };
        return r;
      }));
      alert(`Successfully booked ${seats} seat(s)!`);
      setView('home');
      setSelectedRide(null);
  };
  const handleRateRide = (ride: Ride) => { setRideToRate(ride); setRatingModalOpen(true); };
  const submitRating = (rating: number, comment: string) => {
      alert(`Rating submitted for ${rideToRate?.driver.firstName}: ${rating} Stars.\nComment: "${comment}"`);
      setRatingModalOpen(false);
      if (rideToRate) setBookedRides(prev => prev.filter(r => r.id !== rideToRate.id));
      setRideToRate(null);
  };

  if (!user) return <AuthView onLogin={(u: UserType) => { setUser(u); setView(u.role === 'driver' ? 'post' : 'home'); }} lang={lang} setLang={setLang} />;
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
      case 'admin': return <AdminView setView={setView} pendingDrivers={pendingDrivers} approveDriver={approveDriver} rejectDriver={rejectDriver} liveRoutes={activeAdminRoutes} />;
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
              <div className="flex items-center justify-between p-4"><div className="flex items-center gap-3 font-bold text-slate-700"><Globe className="text-slate-400"/> {t.language}</div><div className="flex bg-slate-100 rounded-lg p-1"><button onClick={() => setLang('en')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${lang === 'en' ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>EN</button><button onClick={() => setLang('fr')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${lang === 'fr' ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>FR</button></div></div>
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

export default App;