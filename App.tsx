import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Filter, Star, CheckCircle2, Music, Zap, Info, Share2, ScanFace, DollarSign, Upload, FileText, ChevronDown, Snowflake, Dog, Cigarette, Car, Clock, Check, Shield, XCircle, Eye, Lock, Mail, Key, Camera, CreditCard, Briefcase, Phone, Smartphone, ChevronLeft, Globe, MessageSquare, ThumbsUp } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { generateRideSafetyBrief, optimizeRideDescription } from './services/geminiService';
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
const CITIES = ["Montreal, QC", "Quebec City, QC", "Laval, QC", "Gatineau, QC", "Ottawa, ON", "Toronto, ON", "Mississauga, ON", "Hamilton, ON", "London, ON", "Kingston, ON"];
const DRIVERS = [
  { name: "Sarah Chénier", avatar: "https://i.pravatar.cc/150?u=sarah", rating: 4.9, rides: 320, verified: true },
  { name: "Mike Ross", avatar: "https://i.pravatar.cc/150?u=mike", rating: 4.7, rides: 89, verified: true },
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
  for (let i = 0; i < 15; i++) {
     const origin = getRandom(CITIES);
     let dest = getRandom(CITIES);
     while (dest === origin) dest = getRandom(CITIES); 
     const date = new Date(now);
     date.setDate(date.getDate() + Math.floor(Math.random() * 5));
     date.setHours(Math.floor(Math.random() * 14) + 6, 0, 0, 0);
     const driver = getRandom(DRIVERS);
     rides.push({
        id: `r${idCounter++}`,
        driver: { ...MOCK_USER_TEMPLATE, firstName: driver.name.split(' ')[0], lastName: driver.name.split(' ')[1], avatar: driver.avatar, rating: driver.rating, totalRides: driver.rides, isVerified: driver.verified, role: 'driver', vehicle: { make: ["Toyota", "Honda", "Tesla", "Hyundai"][Math.floor(Math.random()*4)], model: ["RAV4", "Civic", "Model 3", "Tucson"][Math.floor(Math.random()*4)], year: "2022", color: ["White", "Black", "Grey", "Blue"][Math.floor(Math.random()*4)], plate: `${String.fromCharCode(65+Math.random()*26)}${Math.floor(Math.random()*999)} ${String.fromCharCode(65+Math.random()*26)}${String.fromCharCode(65+Math.random()*26)}` } },
        origin: origin, destination: dest, stops: [], departureTime: new Date(date), arrivalTime: new Date(date.getTime() + 3600000 * 3), price: 45, currency: 'CAD', seatsAvailable: Math.floor(Math.random() * 3) + 1, luggage: { small: 2, medium: 1, large: 0 },
        features: { instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true }, distanceKm: 250, description: `Heading to ${dest.split(',')[0]} for the weekend. I can pick you up at the main metro station or downtown. Flexible with stops.`
     });
  }
  return rides.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
};

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
  
  // Check if it's a "New" ride (created/mocked as very recent)
  const isNew = ride.id.toString().startsWith('ride-');

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
             <div>
               <div className="text-lg font-bold text-slate-900 leading-none">{startTime}</div>
               <div className="text-sm text-slate-500 font-medium mt-1 truncate max-w-[150px]">{ride.origin.split(',')[0]}</div>
             </div>
             <div className="text-right">
                <span className="text-lg font-bold text-slate-900">${ride.price}</span>
             </div>
           </div>
           <div className="flex justify-between items-end">
             <div>
               <div className="text-lg font-bold text-slate-900 leading-none">{endTime}</div>
               <div className="text-sm text-slate-500 font-medium mt-1 truncate max-w-[150px]">{ride.destination.split(',')[0]}</div>
             </div>
             <div className="text-xs text-slate-400 font-medium">{duration}h</div>
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

const RateModal = ({ isOpen, onClose, driverName }: { isOpen: boolean, onClose: (rating: number, comment: string) => void, driverName: string }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto" onClick={() => onClose(0, "")}></div>
            <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 pointer-events-auto transform transition-all shadow-2xl relative">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500 shadow-sm">
                        <Star size={32} fill="currentColor" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Rate {driverName}</h2>
                    <p className="text-slate-500 font-medium">How was your ride?</p>
                </div>
                
                <div className="flex justify-center gap-3 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setRating(star)} className="focus:outline-none transform active:scale-90 transition-transform">
                            <Star size={36} className={`${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                        </button>
                    ))}
                </div>

                <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a review (optional)..."
                    className="w-full bg-slate-50 rounded-2xl p-4 mb-6 font-medium text-sm outline-none resize-none h-24"
                />

                <Button onClick={() => onClose(rating, comment)} disabled={rating === 0}>Submit Review</Button>
            </div>
        </div>
    );
};


// --- Views ---

const AuthView = ({ onLogin, lang, setLang }: { onLogin: (user: UserType) => void, lang: Language, setLang: (l: Language) => void }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [role, setRole] = useState<UserRole>('passenger');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const t = translations[lang];
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: UserType = {
      ...MOCK_USER_TEMPLATE,
      id: `u-${Date.now()}`,
      firstName: firstName || "New", lastName: lastName || "User", email, phone, role,
      avatar: '', 
      isVerified: false, driverStatus: role === 'driver' ? 'new' : undefined,
      documentsUploaded: { license: false, insurance: false, photo: false }, totalRides: 0, rating: 5.0
    };
    onLogin(newUser);
  };

  return (
    <div className="min-h-full w-full flex flex-col items-center p-6 bg-slate-50 relative overflow-x-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="absolute top-6 right-6 z-20 flex bg-white/50 backdrop-blur-md rounded-full p-1 shadow-sm border border-white/20">
         <button onClick={() => setLang('en')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${lang === 'en' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>EN</button>
         <button onClick={() => setLang('fr')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${lang === 'fr' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>FR</button>
      </div>

      <div className="w-full max-w-sm relative z-10 my-auto pt-20 pb-12">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6 animate-float">
             <Logo size={100} />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">alloride</h1>
          <p className="text-slate-500 font-medium">{t.joinJourney}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-100 border border-white">
          <div className="flex mb-8 bg-slate-100 p-1.5 rounded-2xl">
             <button onClick={() => setIsSignUp(true)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.signUp}</button>
             <button onClick={() => setIsSignUp(false)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t.logIn}</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
             {isSignUp && (
               <>
                 <div className="grid grid-cols-2 gap-3 mb-2">
                    <div onClick={() => setRole('passenger')} className={`cursor-pointer p-4 border-2 rounded-2xl text-center transition-all ${role === 'passenger' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
                       <User className="mx-auto mb-2" size={24} />
                       <span className="text-xs font-bold uppercase tracking-wider">{t.passenger}</span>
                    </div>
                    <div onClick={() => setRole('driver')} className={`cursor-pointer p-4 border-2 rounded-2xl text-center transition-all ${role === 'driver' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
                       <Car className="mx-auto mb-2" size={24} />
                       <span className="text-xs font-bold uppercase tracking-wider">{t.driver}</span>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                   <div className="p-4 bg-slate-50 rounded-2xl focus-within:ring-2 ring-primary/20 transition-all">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.firstName}</label>
                      <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300" />
                   </div>
                   <div className="p-4 bg-slate-50 rounded-2xl focus-within:ring-2 ring-primary/20 transition-all">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.lastName}</label>
                      <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300" />
                   </div>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl focus-within:ring-2 ring-primary/20 transition-all">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.phone}</label>
                    <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300" />
                 </div>
               </>
             )}

             <div className="p-4 bg-slate-50 rounded-2xl focus-within:ring-2 ring-primary/20 transition-all">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.email}</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300" />
             </div>

             <div className="p-4 bg-slate-50 rounded-2xl focus-within:ring-2 ring-primary/20 transition-all">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{t.password}</label>
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300" />
             </div>

             <Button type="submit" className="mt-6 w-full">{isSignUp ? t.createAccount : t.welcomeBack}</Button>
          </form>
        </div>
      </div>
    </div>
  );
};

const HomeView = ({ setView, setDetailRide, lang, setLang, user, allRides, bookedRides, onRateRide }: { setView: any, setDetailRide: any, lang: Language, setLang: any, user: UserType, allRides: Ride[], bookedRides: Ride[], onRateRide: (ride: Ride) => void }) => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => toLocalISOString(new Date()));
  const [passengers, setPassengers] = useState(1);
  const [filteredRides, setFilteredRides] = useState<Ride[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState({ instant: false, bestPrice: false, winterTires: false });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  const myRides = useMemo(() => {
     if (user.role === 'driver') {
        return allRides.filter(r => r.driver.id === user.id);
     }
     return [];
  }, [allRides, user]);

  const displayRides = useMemo(() => {
    if (hasSearched) return filteredRides;
    // Sort logic: Newest IDs (which are timestamps for new posts) come first.
    // For existing mock data, we rely on the fact that new posts use "ride-{timestamp}" format
    const sorted = [...allRides].sort((a, b) => {
        // Simple heuristic: if ID starts with 'ride-', it's newer than 'rX'
        const aNew = a.id.toString().startsWith('ride-');
        const bNew = b.id.toString().startsWith('ride-');
        if (aNew && !bNew) return -1;
        if (!aNew && bNew) return 1;
        if (aNew && bNew) return Number(b.id.split('-')[1]) - Number(a.id.split('-')[1]);
        return a.departureTime.getTime() - b.departureTime.getTime();
    }).filter(r => r.driver.id !== user.id);

    return showAll ? sorted : sorted.slice(0, 10); // Show 10 by default to catch new ones
  }, [hasSearched, filteredRides, allRides, user.id, showAll]);

  const applySearch = () => {
    setHasSearched(true);
    const results = allRides.filter(ride => {
       const clean = (str: string) => str.toLowerCase().replace(/,/g, '').trim();
       const matchOrigin = !origin || clean(ride.origin).includes(clean(origin));
       const matchDest = !destination || clean(ride.destination).includes(clean(destination));
       const matchSeats = ride.seatsAvailable >= passengers;
       const rideDateStr = toLocalISOString(ride.departureTime);
       const matchDate = !date || rideDateStr === date;
       return matchOrigin && matchDest && matchSeats && matchDate;
    });
    if (filters.bestPrice) results.sort((a, b) => a.price - b.price);
    else results.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
    setFilteredRides(results);
  };

  return (
    <div className="pb-32 min-h-full bg-slate-50">
      <div className="bg-slate-900 pb-20 pt-12 px-6 rounded-b-[3rem] relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-primary/30 rounded-full blur-[80px] -mr-16 -mt-16"></div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/20 rounded-full blur-[80px] -ml-16 -mb-16"></div>
         <div className="relative z-10 flex justify-between items-start mb-8">
            <div className="flex items-center gap-3 text-white">
               <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md"><Logo size={24} /></div>
               <div><h1 className="text-xl font-bold">{t.goodMorning}, {user.firstName}</h1><p className="text-white/60 text-xs font-medium">{t.whereTo}</p></div>
            </div>
            <div onClick={() => setView('profile')} className="cursor-pointer">
              {user.avatar ? <img src={user.avatar} className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg object-cover" alt="profile" /> : <div className="w-10 h-10 rounded-full border-2 border-white/20 shadow-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-white font-bold text-sm">{user.firstName[0]}{user.lastName[0]}</div>}
            </div>
         </div>
      </div>
      <div className="px-6 -mt-16 relative z-20">
         <div className="bg-white rounded-[2rem] p-4 shadow-card border border-white/50">
            <div className="bg-slate-50 rounded-2xl p-1 space-y-1 mb-3">
               <div className="flex items-center px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-slate-900 mr-3"></div><input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t.leavingFrom} className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300" />
               </div>
               <div className="flex items-center px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-secondary mr-3"></div><input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t.goingTo} className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300" />
               </div>
            </div>
            <div className="flex gap-2 mb-3">
               <div onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.focus()} className="flex-1 bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors"><Calendar size={18} className="text-slate-400" /><span className="text-sm font-bold text-slate-700">{getDisplayDate(date, t)}</span><input ref={dateInputRef} type="date" value={date} min={toLocalISOString(new Date())} onChange={(e) => setDate(e.target.value)} className="hidden" /></div>
               <div onClick={() => setPassengers(prev => prev < 4 ? prev + 1 : 1)} className="w-20 bg-slate-50 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors"><User size={18} className="text-slate-400" /><span className="text-sm font-bold text-slate-700">{passengers}</span></div>
            </div>
            <Button onClick={applySearch} className="w-full shadow-xl shadow-indigo-500/20">{t.searchRides}</Button>
         </div>
      </div>
      
      {/* Driver View: Your Trips */}
      {!hasSearched && user.role === 'driver' && myRides.length > 0 && (
         <div className="px-6 mt-8"><Header title="Your Trips" subtitle="Upcoming drives" />
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
               {myRides.map(ride => (
                  <div key={ride.id} className="min-w-[280px] bg-slate-900 rounded-3xl p-5 text-white relative overflow-hidden"><div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10"></div><div className="relative z-10"><div className="flex justify-between items-start mb-4"><span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold">LIVE</span><span className="text-2xl font-bold">${ride.price}</span></div><div className="space-y-1 mb-4"><div className="font-bold text-lg">{ride.origin.split(',')[0]}</div><div className="w-0.5 h-4 bg-white/20 ml-1"></div><div className="font-bold text-lg text-secondary">{ride.destination.split(',')[0]}</div></div><div className="flex items-center gap-2 text-white/50 text-xs font-medium"><Clock size={12}/> {new Date(ride.departureTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}<span>•</span><User size={12}/> {ride.seatsAvailable} seats left</div></div></div>
               ))}
            </div>
         </div>
      )}

      {/* Passenger View: Booked Trips */}
      {!hasSearched && user.role === 'passenger' && bookedRides.length > 0 && (
          <div className="px-6 mt-8">
              <Header title="My Bookings" subtitle="Upcoming & Past" />
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                  {bookedRides.map(ride => (
                      <div key={ride.id} className="min-w-[280px] bg-white rounded-3xl p-5 shadow-card border border-slate-100 relative overflow-hidden">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-2">
                                  <img src={ride.driver.avatar} className="w-8 h-8 rounded-full" />
                                  <span className="text-xs font-bold text-slate-600">{ride.driver.firstName}</span>
                              </div>
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold uppercase">Booked</span>
                          </div>
                          <div className="space-y-1 mb-4">
                              <div className="font-bold text-lg text-slate-900">{ride.origin.split(',')[0]}</div>
                              <div className="w-0.5 h-4 bg-slate-200 ml-1"></div>
                              <div className="font-bold text-lg text-secondary">{ride.destination.split(',')[0]}</div>
                          </div>
                          <Button variant="secondary" className="py-2 text-xs" onClick={() => onRateRide(ride)}>Complete & Rate</Button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="px-6 mt-8">
         <Header 
            title={hasSearched ? t.searchResults : t.featuredRides} 
            subtitle={hasSearched ? `${filteredRides.length} rides available` : "All posted trips"} 
            rightAction={!hasSearched && !showAll && <button onClick={() => setShowAll(true)} className="text-primary font-bold text-sm">{t.viewAll}</button>} 
         />
         {displayRides.length > 0 ? (
             <>
             {displayRides.map(ride => (<RideCard key={ride.id} ride={ride} onClick={() => { setDetailRide(ride); setView('ride-detail'); }} t={t} />))}
             {!showAll && !hasSearched && <button onClick={() => setShowAll(true)} className="w-full py-4 text-center text-slate-400 text-sm font-bold bg-white rounded-2xl shadow-sm border border-slate-100 mb-8">View All Available Trips</button>}
             </>
         ) : (<div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><Search size={24}/></div><p className="text-slate-500 font-medium px-6">{t.noRidesFound}</p><button onClick={() => {setOrigin(''); setDestination(''); setHasSearched(false);}} className="mt-4 text-primary text-sm font-bold">Clear Search</button></div>)}
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
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => toLocalISOString(new Date()));
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(45);
  const [seats, setSeats] = useState(3);
  const [luggage, setLuggage] = useState({ small: 2, medium: 1, large: 0 });
  const [loadingAI, setLoadingAI] = useState(false);

  const handleVehicleSubmit = (e: React.FormEvent) => { e.preventDefault(); setOnboardingStep(2); };
  const triggerUpload = (type: string) => { setCurrentUploadType(type); fileInputRef.current?.click(); };
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(URL.createObjectURL(e.target.files[0]));
      setUploadedDocs(prev => ({ ...prev, photo: true }));
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0 && currentUploadType) {
        setTimeout(() => setUploadedDocs(prev => ({...prev, [currentUploadType]: true})), 500);
     }
  };
  const submitForApproval = () => {
    updateUser({ ...user, isVerified: false, driverStatus: 'pending', avatar: profilePhoto || user.avatar, vehicle, documentsUploaded: { ...user.documentsUploaded, license: true, insurance: true, photo: true } });
    alert("Submitted for approval.");
  };
  const handlePublish = () => {
     const departure = new Date(`${date}T${time || '08:00'}`);
     onPublish({ id: `ride-${Date.now()}`, driver: user, origin, destination, stops: [], departureTime: departure, arrivalTime: new Date(departure.getTime() + 10800000), price, currency: 'CAD', seatsAvailable: seats, luggage, features: { instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true }, distanceKm: 300, description });
     alert("Published! Passengers can now see your trip."); setView('home');
  };
  const handleAI = async () => { if (!origin || !destination) return; setLoadingAI(true); const text = await optimizeRideDescription(origin, destination, []); setDescription(text); setLoadingAI(false); }

  if (needsOnboarding) {
     if (user.driverStatus === 'pending') {
        return (<div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50"><div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-glow text-amber-500 animate-pulse"><Clock size={48} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">{t.reviewInProgress}</h2><p className="text-center text-slate-500 mb-8 max-w-xs">{t.verifyingDocs}</p><Button variant="outline" onClick={() => setView('home')}>{t.backToHome}</Button></div>);
     }
     return (
        <div className="h-full bg-slate-50 pb-32 overflow-y-auto px-6 pt-12">
           <Header title={t.driverSetup} subtitle={t.letsGetRoad} />
           <div className="flex gap-2 mb-8">
              {[1, 2, 3].map(step => (<div key={step} className={`h-1.5 flex-1 rounded-full transition-colors ${onboardingStep >= step ? 'bg-primary' : 'bg-slate-200'}`}></div>))}
           </div>
           {onboardingStep === 1 && (<form onSubmit={handleVehicleSubmit} className="space-y-4 bg-white p-6 rounded-[2rem] shadow-card"><h3 className="font-bold text-lg mb-4">{t.vehicleDetails}</h3><div className="grid grid-cols-2 gap-4"><input required placeholder="Make" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /><input required placeholder="Model" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /></div><div className="grid grid-cols-2 gap-4"><input required placeholder="Year" type="number" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /><input required placeholder="Color" value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm" /></div><input required placeholder="License Plate" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="p-4 bg-slate-50 rounded-xl outline-none font-bold text-sm text-center tracking-widest uppercase border border-slate-200" /><Button type="submit" className="mt-4">{t.takeSelfie} (Next)</Button></form>)}
           {onboardingStep === 2 && (<div className="bg-white p-6 rounded-[2rem] shadow-card text-center"><h3 className="font-bold text-lg mb-6">{t.takeSelfie}</h3><input type="file" ref={photoInputRef} className="hidden" accept="image/*" capture="user" onChange={handlePhotoUpload} /><div onClick={() => photoInputRef.current?.click()} className="w-48 h-48 mx-auto rounded-full bg-slate-50 border-4 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden relative">{profilePhoto ? <img src={profilePhoto} className="w-full h-full object-cover" /> : <div className="text-slate-400"><Camera size={40} className="mx-auto mb-2"/><span className="text-xs font-bold uppercase">{t.tapCamera}</span></div>}</div><div className="mt-8 flex gap-4"><Button variant="secondary" onClick={() => setOnboardingStep(1)}>{t.back}</Button><Button disabled={!profilePhoto} onClick={() => setOnboardingStep(3)}>{t.nextDocs}</Button></div></div>)}
           {onboardingStep === 3 && (<div className="bg-white p-6 rounded-[2rem] shadow-card"><h3 className="font-bold text-lg mb-6">Upload Documents</h3><input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileChange} /><div className="space-y-4">{[{id: 'license', label: t.uploadLicense, icon: CreditCard}, {id: 'insurance', label: t.uploadInsurance, icon: Shield}].map((item) => (<div key={item.id} onClick={() => triggerUpload(item.id)} className={`p-4 rounded-xl flex justify-between items-center cursor-pointer border-2 transition-all ${uploadedDocs[item.id] ? 'border-green-500 bg-green-50' : 'border-slate-100 hover:border-slate-300'}`}><div className="flex items-center gap-4"><div className={`p-2 rounded-lg ${uploadedDocs[item.id] ? 'bg-green-200 text-green-700' : 'bg-slate-100 text-slate-500'}`}><item.icon size={20}/></div><span className="font-bold text-slate-700">{item.label}</span></div>{uploadedDocs[item.id] && <CheckCircle2 size={20} className="text-green-500"/>}</div>))}</div><div className="mt-8 flex gap-4"><Button variant="secondary" onClick={() => setOnboardingStep(2)}>{t.back}</Button><Button disabled={!uploadedDocs.license || !uploadedDocs.insurance} onClick={submitForApproval}>{t.submit}</Button></div></div>)}
        </div>
     );
  }
  return (
    <div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-extrabold text-slate-900">{t.postRide}</h1><button onClick={() => setView('home')} className="p-2 bg-white rounded-full shadow-sm text-slate-400"><XCircle size={24}/></button></div>
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-card space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl"><div className="w-3 h-3 rounded-full bg-slate-900"></div><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t.origin} className="bg-transparent font-bold w-full outline-none" /></div>
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl"><div className="w-3 h-3 rounded-full bg-secondary"></div><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t.destination} className="bg-transparent font-bold w-full outline-none" /></div>
        </div>
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
            <button onClick={handleAI} disabled={loadingAI || !origin} className="absolute bottom-6 right-6 bg-white shadow-md px-3 py-1.5 rounded-lg text-xs font-bold text-primary flex items-center gap-1 border border-slate-100"><Zap size={12} fill="currentColor"/> {loadingAI ? 'Thinking...' : 'AI Write'}</button>
        </div>
        
        <Button onClick={handlePublish} className="w-full shadow-2xl shadow-indigo-500/30">{t.publishRide}</Button>
      </div>
    </div>
  );
}

const WalletView = ({ lang }: { lang: Language }) => {
   const t = translations[lang];
   return (
      <div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full">
         <Header title={t.myWallet} />
         <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/40 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/30 rounded-full -ml-10 -mb-10 blur-3xl"></div>
            <div className="relative z-10">
               <p className="text-white/60 font-medium mb-2 text-sm uppercase tracking-widest">{t.totalBalance}</p>
               <h2 className="text-6xl font-bold mb-4 tracking-tighter">$1,240<span className="text-3xl text-white/40">.50</span></h2>
            </div>
         </div>
         <h3 className="font-bold text-slate-900 mb-4 text-lg">{t.recentActivity}</h3>
         <div className="space-y-4">
            {[1,2,3,4].map(i => (
               <div key={i} className="flex items-center justify-between bg-white p-5 rounded-3xl shadow-card border border-slate-50">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${i % 2 === 0 ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-600'}`}>
                        {i % 2 === 0 ? <DollarSign size={24} /> : <Car size={24} />}
                     </div>
                     <div>
                        <p className="font-bold text-slate-900">{i % 2 === 0 ? 'Top Up' : 'Ride Payment'}</p>
                        <p className="text-xs text-slate-400 font-bold mt-1">10:23 AM</p>
                     </div>
                  </div>
                  <span className={`font-bold ${i % 2 === 0 ? 'text-green-600' : 'text-slate-900'}`}>{i % 2 === 0 ? '+' : '-'}$45.00</span>
               </div>
            ))}
         </div>
      </div>
   );
};

const LeaderboardView = ({ lang }: { lang: Language }) => { const t = translations[lang]; return (<div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full"><Header title={t.driverLeaderboard} /><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-white p-6 rounded-[2rem] shadow-card border border-slate-50"><div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4"><Star size={20} fill="currentColor" /></div><p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">{t.ranking}</p><p className="text-4xl font-extrabold text-slate-900">#42</p></div><div className="bg-white p-6 rounded-[2rem] shadow-card border border-slate-50"><div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4"><Zap size={20} fill="currentColor" /></div><p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">{t.points}</p><p className="text-4xl font-extrabold text-slate-900">8.4k</p></div></div><LeaderboardChart /><div className="mt-8 space-y-4"><h3 className="font-bold text-slate-900 text-lg">{t.topDrivers}</h3>{[1, 2, 3].map((i) => (<div key={i} className="flex items-center justify-between bg-white p-5 rounded-3xl shadow-card border border-slate-50"><div className="flex items-center gap-4"><span className={`font-black text-xl w-8 text-center ${i === 1 ? 'text-yellow-500' : 'text-slate-300'}`}>{i}</span><img src={`https://i.pravatar.cc/150?img=${i + 10}`} className="w-12 h-12 rounded-full border-2 border-slate-50" alt="user" /><div><p className="font-bold text-slate-900">Alex Johnson</p><p className="text-xs text-slate-500 font-bold mt-1">320 rides</p></div></div><div className="text-right"><span className="font-bold text-slate-900">12k</span><span className="text-[10px] font-bold text-slate-400 block uppercase">Pts</span></div></div>))}</div></div>)};

const RideDetailView = ({ ride, onBack, lang, onBook }: { ride: Ride, onBack: () => void, lang: Language, onBook: (ride: Ride) => void }) => {
  const [safetyTip, setSafetyTip] = useState<string>("Loading route info...");
  const t = translations[lang];
  useEffect(() => { generateRideSafetyBrief(ride.origin, ride.destination).then(setSafetyTip); }, [ride]);
  return (
    <div className="min-h-full bg-white pb-32">
      <div className="relative h-72">
        <img src={`https://picsum.photos/800/600?random=${ride.id}`} className="w-full h-full object-cover" alt="Map" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-white"></div>
        <button onClick={onBack} className="absolute top-12 left-6 bg-white/20 backdrop-blur-md p-3 rounded-full text-white hover:bg-white/30 transition-colors"><ChevronLeft size={24} /></button>
      </div>
      <div className="px-6 relative -top-12">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-50">
           <div className="flex justify-between items-start mb-6">
              <div>
                 <h1 className="text-3xl font-extrabold text-slate-900 mb-1">${ride.price}</h1>
                 <p className="text-slate-400 font-bold text-xs uppercase tracking-wide">Total Price</p>
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
                    <p className="text-slate-500 font-medium mt-1">{ride.origin}</p>
                 </div>
              </div>
              <div className="flex gap-6 relative z-10">
                 <div className="w-4 h-4 rounded-full bg-secondary ring-4 ring-white mt-1"></div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-none">{ride.arrivalTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</h3>
                    <p className="text-slate-500 font-medium mt-1">{ride.destination}</p>
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

           {/* Description */}
           {ride.description && (
             <div className="mt-6">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Info size={16} className="text-slate-400"/> Pickup & Details</h3>
                <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">{ride.description}</p>
                </div>
             </div>
           )}

           <Button onClick={() => onBook(ride)} className="mt-8 w-full shadow-2xl shadow-indigo-500/30">Book This Ride</Button>
        </div>
      </div>
    </div>
  );
};

// AdminView
const AdminView = ({ setView, pendingDrivers, approveDriver, rejectDriver, liveRoutes }: { setView: any, pendingDrivers: UserType[], approveDriver: (id: string) => void, rejectDriver: (id: string) => void, liveRoutes: Ride[] }) => {
   const [unlocked, setUnlocked] = useState(false);
   const [password, setPassword] = useState('');
   const [tab, setTab] = useState<'drivers' | 'routes'>('drivers');
   const handleUnlock = () => { if (password === '1977') setUnlocked(true); else alert("Incorrect PIN"); }
   
   if (!unlocked) return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-900 text-white pb-32">
         <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-md"><Lock size={40} className="opacity-80"/></div>
         <h2 className="text-2xl font-bold mb-2">Admin Portal</h2>
         <p className="text-white/50 mb-8 font-medium">Restricted Access</p>
         <input type="password" autoFocus placeholder="Enter PIN" value={password} onChange={(e) => setPassword(e.target.value)} className="w-64 text-center text-3xl tracking-[0.5em] bg-transparent border-b-2 border-white/20 py-4 mb-8 outline-none font-bold placeholder:tracking-normal placeholder:text-xl placeholder:font-normal placeholder:text-white/20 focus:border-white transition-colors"/>
         <div className="flex flex-col w-full max-w-xs gap-4">
            <Button onClick={handleUnlock}>Unlock Dashboard</Button>
         </div>
      </div>
   );

   return (
      <div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full">
         <Header title="Admin Dashboard" />
         
         <div className="flex bg-white p-1.5 rounded-2xl shadow-card mb-8 border border-slate-100">
            <button onClick={() => setTab('drivers')} className={`flex-1 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${tab === 'drivers' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
               <User size={18} /> Approvals {pendingDrivers.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full h-4 flex items-center justify-center">{pendingDrivers.length}</span>}
            </button>
            <button onClick={() => setTab('routes')} className={`flex-1 py-3 font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${tab === 'routes' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
               <MapPin size={18} /> Live Routes
            </button>
         </div>

         {tab === 'drivers' ? (
            pendingDrivers.length === 0 ? (
               <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><CheckCircle2 size={32}/></div>
                  <p className="text-slate-400 font-bold">All caught up!</p>
                  <p className="text-xs text-slate-400 mt-1">No pending driver applications.</p>
               </div>
            ) : (
               pendingDrivers.map((d: UserType) => (
                  <div key={d.id} className="bg-white p-6 rounded-[2rem] shadow-card mb-4 border border-slate-50 relative overflow-hidden">
                     <div className="flex items-center gap-4 mb-6">
                        {d.avatar ? <img src={d.avatar} className="w-14 h-14 rounded-full object-cover border-4 border-slate-50" /> : <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center font-bold text-xl text-slate-400">{d.firstName[0]}</div>}
                        <div>
                           <h3 className="font-bold text-xl text-slate-900">{d.firstName} {d.lastName}</h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold bg-amber-100 text-amber-600 px-2.5 py-0.5 rounded-lg border border-amber-200 uppercase tracking-wide">Pending Review</span>
                              <span className="text-xs font-bold text-slate-400">{d.vehicle?.make} {d.vehicle?.model}</span>
                           </div>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-3 gap-2 mb-6">
                        {[
                           { label: 'License', done: d.documentsUploaded.license },
                           { label: 'Insurance', done: d.documentsUploaded.insurance },
                           { label: 'Photo', done: d.documentsUploaded.photo }
                        ].map(doc => (
                           <div key={doc.label} className={`p-2 rounded-xl text-center border ${doc.done ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                              <div className={`mx-auto w-6 h-6 rounded-full flex items-center justify-center mb-1 ${doc.done ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                 {doc.done ? <Check size={14} strokeWidth={3} /> : <XCircle size={14} />}
                              </div>
                              <p className={`text-[10px] font-bold uppercase ${doc.done ? 'text-green-700' : 'text-slate-400'}`}>{doc.label}</p>
                           </div>
                        ))}
                     </div>

                     <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 py-3 text-xs border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600" onClick={() => rejectDriver(d.id)}>Reject</Button>
                        <Button onClick={() => approveDriver(d.id)} className="flex-1 py-3 text-xs bg-green-500 shadow-green-500/20">Approve Driver</Button>
                     </div>
                  </div>
               ))
            )
         ) : (
            <div className="space-y-3">
               {liveRoutes.length === 0 ? <p className="text-center text-slate-400 py-8">No active routes.</p> : liveRoutes.map((r: Ride) => (
                  <div key={r.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-between group cursor-pointer hover:border-primary/20 transition-all">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="font-bold text-slate-900">{r.origin.split(',')[0]}</span>
                           <ArrowRight size={14} className="text-slate-300" />
                           <span className="font-bold text-slate-900">{r.destination.split(',')[0]}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                           <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                           {r.driver.firstName} • {r.seatsAvailable} seats
                        </div>
                     </div>
                     <span className="text-lg font-bold text-slate-900">${r.price}</span>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
};

// Legal View
const LegalView = ({ onBack, lang }: { onBack: () => void, lang: Language }) => {
  const t = translations[lang];
  return (
    <div className="pb-32 px-6 pt-12 bg-slate-50 min-h-full">
        <Header title={t.legalPrivacy} rightAction={<button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-slate-400"><XCircle size={24}/></button>} />
        <div className="bg-white p-6 rounded-[2rem] shadow-card space-y-8">
            <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                    <Shield size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">{t.termsOfService}</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{t.legalText1}</p>
            </section>
             <section>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                    <Eye size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">{t.privacyPolicy}</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">{t.legalText2}</p>
            </section>
            
            <div className="pt-4 border-t border-slate-100">
              <Button onClick={onBack} variant="secondary">{t.back}</Button>
            </div>
        </div>
    </div>
  );
};

// --- Main App Logic ---

const App: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [currentView, setView] = useState<ViewState>('home');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [bookedRides, setBookedRides] = useState<Ride[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<UserType[]>([]);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [rideToRate, setRideToRate] = useState<Ride | null>(null);

  useEffect(() => { setAllRides(generateMockRides()); }, []);

  const updateUser = (updatedUser: UserType) => {
     setUser(updatedUser);
     if (updatedUser.driverStatus === 'pending' && user?.driverStatus !== 'pending') setPendingDrivers(prev => [...prev, updatedUser]);
  };
  
  // Logic: Prepend the new ride to the array so it is physically first
  const publishRide = (newRide: Ride) => setAllRides(prev => [newRide, ...prev]);
  
  const approveDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     if (user && user.id === id) { setUser({ ...user, isVerified: true, driverStatus: 'approved' }); alert("Approved!"); } else alert("Driver Approved.");
  };
  const rejectDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     if (user && user.id === id) { setUser({ ...user, isVerified: false, driverStatus: 'rejected' }); alert("Application Rejected."); } else alert("Driver Rejected.");
  };

  const handleBookRide = (ride: Ride) => {
      setBookedRides(prev => [ride, ...prev]);
      alert("Ride booked successfully! It is now in your bookings.");
      setView('home');
      setSelectedRide(null);
  };

  const handleRateRide = (ride: Ride) => {
      setRideToRate(ride);
      setRatingModalOpen(true);
  };

  const submitRating = (rating: number, comment: string) => {
      // In a real app, this would send data to backend
      alert(`Rating submitted for ${rideToRate?.driver.firstName}: ${rating} Stars.\nComment: "${comment}"`);
      setRatingModalOpen(false);
      // Remove from booked rides (simulation of "Completed")
      if (rideToRate) {
          setBookedRides(prev => prev.filter(r => r.id !== rideToRate.id));
      }
      setRideToRate(null);
  };

  if (!user) return <AuthView onLogin={(u) => { setUser(u); setView(u.role === 'driver' ? 'post' : 'home'); }} lang={lang} setLang={setLang} />;

  const renderView = () => {
    switch(currentView) {
      case 'home': case 'search': return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} />;
      case 'post': return <PostRideView setView={setView} lang={lang} user={user} updateUser={updateUser} onPublish={publishRide} />;
      case 'ride-detail': return selectedRide ? <RideDetailView ride={selectedRide} onBack={() => setView('home')} lang={lang} onBook={handleBookRide} /> : <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} />;
      case 'wallet': return <WalletView lang={lang} />;
      case 'leaderboard': return <LeaderboardView lang={lang} />;
      case 'admin': return <AdminView setView={setView} pendingDrivers={pendingDrivers} approveDriver={approveDriver} rejectDriver={rejectDriver} liveRoutes={allRides.filter(r => r.driver.id !== user.id)} />;
      case 'legal': return <LegalView onBack={() => setView('profile')} lang={lang} />;
      case 'profile': {
        const t = translations[lang];
        return (
          <div className="pt-20 px-6 space-y-6 pb-32">
            <Header title={t.profile} rightAction={<button onClick={() => setUser(null)} className="text-red-500 font-bold text-sm">{t.signOut}</button>} />
            <div className="bg-white p-6 rounded-[2rem] shadow-card text-center relative overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-50 object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-slate-50 bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-500 flex items-center justify-center text-3xl font-bold shadow-inner">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
              )}
              <h2 className="text-2xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
              <p className="text-slate-400 font-medium mb-4 capitalize">{user.role}</p>
              {user.isVerified && <div className="inline-flex items-center gap-2 bg-green-50 text-green-600 px-4 py-2 rounded-xl font-bold text-sm"><CheckCircle2 size={16}/> {t.driverVerified}</div>}
              {user.driverStatus === 'pending' && <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-600 px-4 py-2 rounded-xl font-bold text-sm mt-2"><Clock size={16}/> {t.verificationRequired}</div>}
            </div>
            
            <div className="bg-white p-2 rounded-[2rem] shadow-card space-y-1">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 font-bold text-slate-700">
                  <Globe className="text-slate-400"/> {t.language}
                </div>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button onClick={() => setLang('en')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${lang === 'en' ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>EN</button>
                  <button onClick={() => setLang('fr')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${lang === 'fr' ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>FR</button>
                </div>
              </div>
               <button onClick={() => setView('legal')} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors text-slate-700 font-bold">
                  <span className="flex items-center gap-3"><FileText className="text-slate-400"/> {t.legalPrivacy}</span>
                  <ArrowRight size={16} className="text-slate-300" />
               </button>
            </div>
          </div>
        );
      }
      default: return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} bookedRides={bookedRides} onRateRide={handleRateRide} />;
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 text-slate-900 overflow-hidden flex flex-col font-sans">
       <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
         {renderView()}
       </div>
       {user && currentView !== 'ride-detail' && <Navigation currentView={currentView} setView={setView} lang={lang} />}
       <RateModal 
          isOpen={ratingModalOpen} 
          onClose={submitRating} 
          driverName={rideToRate?.driver.firstName || "Driver"} 
       />
    </div>
  );
};

export default App;