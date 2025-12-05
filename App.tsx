import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Filter, Star, CheckCircle2, Music, Zap, Info, Share2, ScanFace, DollarSign, Upload, FileText, ChevronDown, Snowflake, Dog, Cigarette, Car, Clock, Check, Shield, XCircle, CheckCircle, Eye, Lock, Mail, Key, Camera, CreditCard, Briefcase, Phone, Smartphone } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { generateRideSafetyBrief, optimizeRideDescription } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities ---

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
  "Montreal, QC", "Quebec City, QC", "Laval, QC", "Gatineau, QC", "Ottawa, ON", 
  "Toronto, ON", "Mississauga, ON", "Hamilton, ON", "London, ON", "Kingston, ON"
];

const DRIVERS = [
  { name: "Sarah Chénier", avatar: "https://i.pravatar.cc/150?u=sarah", rating: 4.9, rides: 320, verified: true },
  { name: "Mike Ross", avatar: "https://i.pravatar.cc/150?u=mike", rating: 4.7, rides: 89, verified: true },
];

const getRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const MOCK_USER_TEMPLATE: UserType = {
  id: 'u1',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex@example.com',
  phone: '514-555-0199',
  role: 'passenger',
  avatar: 'https://i.pravatar.cc/150?u=alex',
  isVerified: true,
  driverStatus: 'approved',
  documentsUploaded: { license: true, insurance: true, photo: true },
  rating: 4.9,
  totalRides: 142
};

const generateMockRides = (): Ride[] => {
  const rides: Ride[] = [];
  let idCounter = 1;
  const now = new Date();
  
  // Create some initial rides
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
        driver: { 
            ...MOCK_USER_TEMPLATE, 
            firstName: driver.name.split(' ')[0],
            lastName: driver.name.split(' ')[1],
            avatar: driver.avatar, 
            rating: driver.rating, 
            totalRides: driver.rides, 
            isVerified: driver.verified,
            role: 'driver'
        },
        origin: origin,
        destination: dest,
        stops: [],
        departureTime: new Date(date),
        arrivalTime: new Date(date.getTime() + 3600000 * 3),
        price: 45,
        currency: 'CAD',
        seatsAvailable: Math.floor(Math.random() * 3) + 1,
        luggage: { small: 1, medium: 1, large: 0 },
        features: { 
           instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true
        },
        distanceKm: 250,
        description: `Heading to ${dest.split(',')[0]} for work. Smooth driver.`
     });
  }
  return rides.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = true, disabled = false, type = "button" }: any) => {
  const baseStyle = "py-3.5 px-4 rounded-xl font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none";
  const variants: any = {
    primary: "bg-primary text-white shadow-md shadow-indigo-200 hover:bg-indigo-600",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
    ghost: "text-slate-500 hover:bg-slate-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
};

const RideCard = ({ ride, onClick, t }: { ride: Ride, onClick: () => void, t: any }) => {
  const startTime = ride.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = ride.arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const duration = Math.round((ride.arrivalTime.getTime() - ride.departureTime.getTime()) / 3600000 * 10) / 10;
  const rideDate = ride.departureTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div onClick={onClick} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mb-4 active:bg-slate-50 transition-colors cursor-pointer group relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-slate-50 px-3 py-1 rounded-bl-xl border-l border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
        {rideDate}
      </div>
      <div className="flex justify-between items-start mb-3 mt-1">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={ride.driver.avatar} className="w-12 h-12 rounded-full object-cover border border-slate-100" alt="driver" />
            {ride.driver.isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                <CheckCircle2 size={16} className="text-green-500 fill-white" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors">{ride.driver.firstName} {ride.driver.lastName}</h3>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="font-medium">{ride.driver.rating}</span>
              <span>•</span>
              <span>{ride.driver.totalRides} rides</span>
            </div>
          </div>
        </div>
        <div className="text-right mt-6">
          <span className="block text-xl font-bold text-slate-900">${ride.price}</span>
          <span className="text-xs text-slate-400 font-medium">{t.perSeat}</span>
        </div>
      </div>
      <div className="flex gap-4 relative pl-2 py-1">
        <div className="absolute left-[14px] top-2 bottom-2 w-0.5 bg-slate-200"></div>
        <div className="flex flex-col justify-between h-full gap-4 w-full">
           <div className="flex items-start gap-4 relative z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-white border-[3px] border-slate-300 mt-1.5 shrink-0"></div>
              <div>
                 <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900">{startTime}</span>
                    <span className="text-sm text-slate-600">{ride.origin.split(',')[0]}</span>
                 </div>
              </div>
           </div>
           <div className="flex items-start gap-4 relative z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-white border-[3px] border-primary mt-1.5 shrink-0"></div>
              <div>
                 <div className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900">{endTime}</span>
                    <span className="text-sm text-slate-600">{ride.destination.split(',')[0]}</span>
                 </div>
                 <div className="text-xs text-slate-400 mt-0.5">
                    {duration}h • {ride.stops.length > 0 ? `${ride.stops.length} stops` : t.direct}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- Views ---

const AuthView = ({ onLogin }: { onLogin: (user: UserType) => void }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [role, setRole] = useState<UserRole>('passenger');
  
  // Sign Up Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Driver specific upload removed from initial sign up, moved to onboarding
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create new user object
    const newUser: UserType = {
      ...MOCK_USER_TEMPLATE,
      id: `u-${Date.now()}`,
      firstName: firstName || "New",
      lastName: lastName || "User",
      email: email,
      phone: phone,
      role: role,
      avatar: 'https://i.pravatar.cc/150?u=placeholder', // Default placeholder
      isVerified: false, // Drivers need verification
      driverStatus: role === 'driver' ? 'new' : undefined,
      documentsUploaded: { license: false, insurance: false, photo: false },
      totalRides: 0,
      rating: 5.0
    };
    onLogin(newUser);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-50 overflow-y-auto">
      <div className="w-full max-w-sm my-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             <Logo size={80} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">alloride express</h1>
          <p className="text-slate-500">The 2025 Rideshare Experience</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200">
          <div className="flex mb-6 bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setIsSignUp(true)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Sign Up</button>
             <button onClick={() => setIsSignUp(false)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Sign In</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
             {isSignUp && (
               <>
                 <div className="grid grid-cols-2 gap-3 mb-2">
                    <div onClick={() => setRole('passenger')} className={`cursor-pointer p-3 border-2 rounded-xl text-center transition-all ${role === 'passenger' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
                       <User className="mx-auto mb-1" size={20} />
                       <span className="text-xs font-bold uppercase">Passenger</span>
                    </div>
                    <div onClick={() => setRole('driver')} className={`cursor-pointer p-3 border-2 rounded-xl text-center transition-all ${role === 'driver' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 hover:bg-slate-50 text-slate-400'}`}>
                       <Car className="mx-auto mb-1" size={20} />
                       <span className="text-xs font-bold uppercase">Driver</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">First Name</label>
                     <div className="p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50">
                        <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900" />
                     </div>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Last Name</label>
                     <div className="p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50">
                        <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900" />
                     </div>
                   </div>
                 </div>

                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mobile Phone</label>
                   <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50">
                      <Smartphone size={18} className="text-slate-400" />
                      <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900" />
                   </div>
                 </div>
               </>
             )}

             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email</label>
               <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50">
                  <Mail size={18} className="text-slate-400" />
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900" />
               </div>
             </div>

             <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
               <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50">
                  <Key size={18} className="text-slate-400" />
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900" />
               </div>
             </div>

             <Button type="submit" className="mt-4">{isSignUp ? 'Create Account' : 'Welcome Back'}</Button>
             
             {isSignUp && role === 'driver' && (
                <p className="text-xs text-center text-slate-400 mt-2">
                  You will need to upload your license and insurance in the next step.
                </p>
             )}
          </form>
        </div>
      </div>
    </div>
  );
};

const HomeView = ({ setView, setDetailRide, lang, setLang, user, allRides }: { setView: any, setDetailRide: any, lang: Language, setLang: any, user: UserType, allRides: Ride[] }) => {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => toLocalISOString(new Date()));
  const [passengers, setPassengers] = useState(1);
  const [filteredRides, setFilteredRides] = useState<Ride[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({ instant: false, bestPrice: false, winterTires: false });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  // Logic to show "My Rides" or "Featured"
  const myRides = useMemo(() => {
     if (user.role === 'driver') {
        return allRides.filter(r => r.driver.id === user.id);
     }
     return [];
  }, [allRides, user]);

  const displayRides = useMemo(() => {
    if (hasSearched) return filteredRides;
    // Show random mix if not searched
    return allRides.filter(r => r.driver.id !== user.id).sort(() => 0.5 - Math.random()).slice(0, 5);
  }, [hasSearched, filteredRides, allRides, user.id]);

  const applySearch = () => {
    setHasSearched(true);
    const results = allRides.filter(ride => {
       const clean = (str: string) => str.toLowerCase().replace(/,/g, '').trim();
       const matchOrigin = !origin || clean(ride.origin).includes(clean(origin));
       const matchDest = !destination || clean(ride.destination).includes(clean(destination));
       const matchSeats = ride.seatsAvailable >= passengers;
       const rideDateStr = toLocalISOString(ride.departureTime);
       const matchDate = !date || rideDateStr === date;
       const matchInstant = filters.instant ? ride.features.instantBook : true;
       const matchTires = filters.winterTires ? ride.features.winterTires : true;
       return matchOrigin && matchDest && matchSeats && matchDate && matchInstant && matchTires;
    });

    if (filters.bestPrice) results.sort((a, b) => a.price - b.price);
    else results.sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime());
    setFilteredRides(results);
  };

  return (
    <div className="pb-24 bg-slate-50 min-h-full">
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-[2rem] shadow-sm relative z-20">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <div>
               <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t.goodMorning}, {user.firstName}</h1>
               <p className="text-slate-500 text-xs font-medium">{t.whereTo}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-50 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">{lang.toUpperCase()}</button>
             <div className="relative">
                <img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white shadow-md" />
             </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-2 border border-slate-100 shadow-xl shadow-slate-200/50">
           {/* Search Inputs (same as before) */}
           <div className="space-y-0.5">
             <div className="relative flex items-center px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors group">
                <div className="w-8 flex justify-center mr-2"><div className="w-2.5 h-2.5 rounded-full border-[3px] border-slate-300"></div></div>
                <div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{t.origin}</label><input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t.leavingFrom} className="w-full text-slate-900 font-semibold placeholder:text-slate-300 outline-none bg-transparent" /></div>
             </div>
             <div className="relative h-[1px] bg-slate-100 mx-4"><div className="absolute right-4 -top-3 p-1.5 bg-slate-50 rounded-full border border-slate-100 text-slate-400"><ArrowRight size={12} className="rotate-90" /></div></div>
             <div className="relative flex items-center px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors"><div className="w-8 flex justify-center mr-2"><div className="w-2.5 h-2.5 rounded-full border-[3px] border-primary"></div></div><div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{t.destination}</label><input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder={t.goingTo} className="w-full text-slate-900 font-semibold placeholder:text-slate-300 outline-none bg-transparent" /></div></div>
           </div>
           <div className="flex gap-2 p-2 mt-1">
              <div onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.focus()} className="flex-1 bg-slate-50 rounded-xl relative flex items-center gap-2 border border-transparent hover:border-slate-200 group transition-all cursor-pointer"><input ref={dateInputRef} type="date" value={date} min={toLocalISOString(new Date())} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer" /><div className="pl-4 py-2.5 flex items-center gap-2 w-full"><Calendar size={18} className="text-primary group-hover:scale-110 transition-transform" /><span className="text-sm font-medium text-slate-700">{getDisplayDate(date, t)}</span></div></div>
              <div className="w-24 bg-slate-50 rounded-xl px-4 py-2.5 flex items-center gap-2 cursor-pointer border border-transparent hover:border-slate-200 transition-all" onClick={() => setPassengers(prev => prev < 4 ? prev + 1 : 1)}><User size={18} className="text-primary" /><span className="text-sm font-medium text-slate-700">{passengers}</span></div>
           </div>
           <div className="p-2 mt-1"><Button onClick={applySearch}>{t.searchRides}</Button></div>
        </div>
      </div>
      
      {/* My Posted Trips Section for Drivers */}
      {!hasSearched && user.role === 'driver' && myRides.length > 0 && (
         <div className="px-6 mt-4 mb-2">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Your Posted Trips</h2>
            <div className="space-y-3">
               {myRides.map(ride => (
                  <div key={ride.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                     <div className="absolute top-0 right-0 bg-green-50 text-green-600 px-3 py-1 rounded-bl-xl text-[10px] font-bold uppercase">Live</div>
                     <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-900">{ride.origin.split(',')[0]}</span>
                        <ArrowRight size={14} className="text-slate-300" />
                        <span className="font-bold text-slate-900">{ride.destination.split(',')[0]}</span>
                     </div>
                     <p className="text-xs text-slate-500 mb-2">{new Date(ride.departureTime).toLocaleDateString()} at {new Date(ride.departureTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                     <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><User size={12}/> {ride.seatsAvailable} seats left</span>
                        <span className="flex items-center gap-1"><DollarSign size={12}/> ${ride.price}</span>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      )}

      {/* Results */}
      <div className="px-6 mt-6 space-y-2">
        <div className="flex justify-between items-end mb-4 px-1">
          <h2 className="text-lg font-bold text-slate-900">{hasSearched ? (filteredRides.length > 0 ? `${filteredRides.length} ${t.searchResults}` : `0 ${t.searchResults}`) : t.featuredRides}</h2>
          {!hasSearched && <span className="text-primary text-sm font-semibold cursor-pointer">{t.viewAll}</span>}
        </div>
        {displayRides.length > 0 ? (displayRides.map(ride => (<RideCard key={ride.id} ride={ride} onClick={() => { setDetailRide(ride); setView('ride-detail'); }} t={t} />))) : (<div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200"><Search size={24} className="text-slate-300 mx-auto mb-2" /><p className="text-slate-500 font-medium px-6">{t.noRidesFound}</p><button onClick={() => {setOrigin(''); setDestination(''); setHasSearched(false);}} className="mt-4 text-primary text-sm font-bold">Clear Search</button></div>)}
      </div>
    </div>
  );
};

// --- DRIVER ONBOARDING & POST RIDE VIEW ---
const PostRideView = ({ setView, lang, user, updateUser, onPublish }: { setView: any, lang: Language, user: UserType, updateUser: (u: UserType) => void, onPublish: (ride: Ride) => void }) => {
  const t = translations[lang];
  // If user is a driver and not verified, show onboarding steps
  const needsOnboarding = user.role === 'driver' && (!user.isVerified || user.driverStatus !== 'approved');
  
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', color: '', plate: '' });
  const [uploadedDocs, setUploadedDocs] = useState<{ [key: string]: boolean }>({ license: false, insurance: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadType, setCurrentUploadType] = useState<string | null>(null);

  // Post Ride Form States
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => toLocalISOString(new Date()));
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(45);
  const [seats, setSeats] = useState(3);
  const [luggage, setLuggage] = useState({ small: 2, medium: 1, large: 0 });
  const [loadingAI, setLoadingAI] = useState(false);

  // --- Onboarding Handlers ---
  const handleVehicleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     setOnboardingStep(2);
  };

  const triggerUpload = (type: string) => {
    setCurrentUploadType(type);
    if (fileInputRef.current) {
       fileInputRef.current.value = ''; 
       fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0 && currentUploadType) {
        setTimeout(() => {
           setUploadedDocs(prev => ({...prev, [currentUploadType]: true}));
        }, 500);
     }
  };

  const submitForApproval = () => {
    // Send to Admin
    updateUser({
       ...user,
       isVerified: false,
       driverStatus: 'pending',
       vehicle: vehicle,
       documentsUploaded: { ...user.documentsUploaded, license: true, insurance: true }
    });
    alert("Your details have been sent to Admin for approval. You will be notified once verified.");
  };

  const updateLuggage = (size: 'small' | 'medium' | 'large', delta: number) => {
     setLuggage(prev => {
        const newValue = prev[size] + delta;
        if (newValue < 0) return prev;
        return { ...prev, [size]: newValue };
     });
  };

  const handlePublish = () => {
     const departure = new Date(`${date}T${time || '08:00'}`);
     const arrival = new Date(departure.getTime() + 3 * 60 * 60 * 1000); // Mock duration

     const newRide: Ride = {
        id: `ride-${Date.now()}`,
        driver: user,
        origin,
        destination,
        stops: [],
        departureTime: departure,
        arrivalTime: arrival,
        price,
        currency: 'CAD',
        seatsAvailable: seats,
        luggage,
        features: { instantBook: true, wifi: true, music: true, pets: false, smoking: false, winterTires: true },
        distanceKm: 300,
        description
     };

     onPublish(newRide);
     alert("Trip Published Successfully! It is now live.");
     setView('home');
  };

  // --- Post Ride Handlers ---
  const handleAI = async () => { if (!origin || !destination) return; setLoadingAI(true); const text = await optimizeRideDescription(origin, destination, []); setDescription(text); setLoadingAI(false); }

  // 1. DRIVER ONBOARDING WIZARD
  if (needsOnboarding) {
     if (user.driverStatus === 'pending') {
        return (
           <div className="h-full flex flex-col items-center justify-center p-6 bg-white">
              <div className="w-20 h-20 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                 <Clock size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Pending</h2>
              <p className="text-center text-slate-500 mb-6">Our team is reviewing your documents. <br/>This usually takes 1-2 hours.</p>
              <div className="p-4 bg-slate-50 rounded-xl w-full max-w-sm border border-slate-100">
                 <h3 className="font-bold text-sm text-slate-700 mb-2">Submitted Details</h3>
                 <p className="text-xs text-slate-500">Vehicle: {user.vehicle?.make} {user.vehicle?.model}</p>
                 <p className="text-xs text-slate-500">Plate: {user.vehicle?.plate}</p>
              </div>
              <Button variant="outline" className="mt-8" onClick={() => setView('home')}>Go to Home</Button>
           </div>
        );
     }

     return (
        <div className="h-full bg-white pb-24 overflow-y-auto px-6 pt-12">
           <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Driver Setup</h1>
              <div className="flex gap-2 mb-6">
                 <div className={`h-1.5 flex-1 rounded-full ${onboardingStep >= 1 ? 'bg-primary' : 'bg-slate-100'}`}></div>
                 <div className={`h-1.5 flex-1 rounded-full ${onboardingStep >= 2 ? 'bg-primary' : 'bg-slate-100'}`}></div>
                 <div className={`h-1.5 flex-1 rounded-full ${onboardingStep >= 3 ? 'bg-primary' : 'bg-slate-100'}`}></div>
              </div>
           </div>

           {onboardingStep === 1 && (
              <form onSubmit={handleVehicleSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
                       <Car size={32} />
                    </div>
                    <h2 className="text-xl font-bold">Vehicle Details</h2>
                    <p className="text-sm text-slate-500">Tell us about the car you'll be driving.</p>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <input required placeholder="Make (e.g. Honda)" value={vehicle.make} onChange={e => setVehicle({...vehicle, make: e.target.value})} className="p-3 bg-slate-50 rounded-xl outline-none text-sm font-semibold w-full" />
                    <input required placeholder="Model (e.g. Civic)" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} className="p-3 bg-slate-50 rounded-xl outline-none text-sm font-semibold w-full" />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <input required placeholder="Year" type="number" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} className="p-3 bg-slate-50 rounded-xl outline-none text-sm font-semibold w-full" />
                    <input required placeholder="Color" value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} className="p-3 bg-slate-50 rounded-xl outline-none text-sm font-semibold w-full" />
                 </div>
                 <input required placeholder="License Plate" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} className="p-3 bg-slate-50 rounded-xl outline-none text-sm font-semibold w-full border border-slate-200 uppercase tracking-widest text-center" />

                 <Button type="submit" className="mt-6">Next Step</Button>
              </form>
           )}

           {onboardingStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
                 <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-3 text-pink-600">
                       <FileText size={32} />
                    </div>
                    <h2 className="text-xl font-bold">Documents</h2>
                    <p className="text-sm text-slate-500">We need to verify your eligibility.</p>
                 </div>

                 <div className="space-y-3">
                    {[
                       { id: 'license', label: t.uploadLicense, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                       { id: 'insurance', label: t.uploadInsurance, icon: Shield, color: 'text-pink-600', bg: 'bg-pink-50' }
                    ].map((item, i) => {
                       const isUploaded = uploadedDocs[item.id];
                       return (
                          <div key={i} onClick={() => triggerUpload(item.id)} className={`p-4 border rounded-xl flex items-center justify-between transition-all cursor-pointer group ${isUploaded ? 'bg-green-50 border-green-200' : 'border-slate-100 hover:bg-slate-50'}`}>
                             <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isUploaded ? 'bg-green-100 text-green-600' : `${item.bg} ${item.color}`}`}>
                                   {isUploaded ? <Check size={20} /> : <item.icon size={20} />}
                                </div>
                                <span className={`font-bold group-hover:text-slate-900 ${isUploaded ? 'text-green-800' : 'text-slate-700'}`}>{item.label}</span>
                             </div>
                             {isUploaded ? <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">Uploaded</span> : <Upload size={18} className="text-slate-300 group-hover:text-primary" />}
                          </div>
                       );
                    })}
                 </div>

                 <div className="mt-8 flex gap-3">
                    <Button variant="secondary" onClick={() => setOnboardingStep(1)}>Back</Button>
                    <Button disabled={!uploadedDocs.license || !uploadedDocs.insurance} onClick={submitForApproval}>Submit for Approval</Button>
                 </div>
              </div>
           )}
        </div>
     );
  }

  // 2. ACTUAL POST RIDE FORM (Shown only if Verified)
  return (
    <div className="pb-24 px-6 pt-12 bg-slate-50 min-h-full">
      <h1 className="text-2xl font-bold mb-6 text-slate-900">{t.postRide}</h1>
      <div className="space-y-4">
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block ml-1">{t.origin}</label><div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50 transition-colors"><div className="w-2.5 h-2.5 rounded-full border-[3px] border-slate-400"></div><input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Montreal, QC" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400" /></div></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block ml-1">{t.destination}</label><div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-transparent focus-within:border-primary/50 transition-colors"><div className="w-2.5 h-2.5 rounded-full border-[3px] border-primary"></div><input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Toronto, ON" className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400" /></div></div>
         </div>
         <div className="grid grid-cols-2 gap-3"><div className="bg-white p-3 rounded-xl border border-slate-100 relative"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">{t.today}</label><div className="flex items-center gap-2"><Calendar size={18} className="text-primary shrink-0"/><input type="date" value={date} min={toLocalISOString(new Date())} onChange={(e) => setDate(e.target.value)} className="w-full text-sm font-bold text-slate-900 outline-none bg-transparent p-0 border-none focus:ring-0"/></div></div><div className="bg-white p-3 rounded-xl border border-slate-100 relative"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Time</label><div className="flex items-center gap-2"><Clock size={18} className="text-secondary shrink-0"/><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full text-sm font-bold text-slate-900 outline-none bg-transparent p-0 border-none focus:ring-0"/></div></div></div>
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">{t.description}</label><div className="relative"><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl outline-none h-32 resize-none text-sm text-slate-700 placeholder:text-slate-400 border border-transparent focus:border-primary/50" placeholder={t.describeRide} /><button onClick={handleAI} disabled={!origin || !destination || loadingAI} className="absolute bottom-3 right-3 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm border border-slate-100 hover:bg-slate-50 disabled:opacity-50">{loadingAI ? 'Thinking...' : <><Zap size={12} fill="currentColor"/> AI Write</>}</button></div></div>
         
         <div className="grid grid-cols-2 gap-3"><div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between"><div className="flex items-center gap-2 text-slate-600 text-sm font-medium"><DollarSign size={16} /> Price</div><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="font-bold text-slate-900 w-20 text-right outline-none bg-transparent focus:border-b-2 focus:border-primary"/></div><div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between"><div className="flex items-center gap-2 text-slate-600 text-sm font-medium"><User size={16} /> Seats</div><input type="number" min="1" max="7" value={seats} onChange={(e) => setSeats(Number(e.target.value))} className="font-bold text-slate-900 w-16 text-right outline-none bg-transparent focus:border-b-2 focus:border-primary" /></div></div>
         
         {/* Luggage Input */}
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">{t.luggage}</label>
            <div className="flex justify-between gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <div key={size} className="flex-1 bg-slate-50 p-2 rounded-xl flex flex-col items-center justify-center border border-transparent focus-within:border-primary/50">
                   <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">{t[size]}</span>
                   <div className="flex items-center gap-3">
                      <button onClick={() => updateLuggage(size, -1)} className="w-6 h-6 rounded-full bg-white shadow-sm text-slate-400 hover:text-primary flex items-center justify-center font-bold pb-0.5">-</button>
                      <span className="font-bold text-slate-900 w-3 text-center">{luggage[size]}</span>
                      <button onClick={() => updateLuggage(size, 1)} className="w-6 h-6 rounded-full bg-white shadow-sm text-slate-400 hover:text-primary flex items-center justify-center font-bold pb-0.5">+</button>
                   </div>
                </div>
              ))}
            </div>
         </div>

         <div className="pt-4"><Button onClick={handlePublish}>{t.publishRide}</Button></div>
      </div>
    </div>
  );
}

const WalletView = ({ lang }: { lang: Language }) => {
   const t = translations[lang];
   return (<div className="pb-24 px-6 pt-12 bg-slate-50 min-h-full"><div className="flex justify-between items-center mb-8"><h1 className="text-2xl font-bold text-slate-900">{t.myWallet}</h1><button className="p-2 bg-white rounded-full shadow-sm text-slate-600"><Filter size={20} /></button></div><div className="bg-dark rounded-[2rem] p-8 text-white shadow-xl shadow-slate-300 mb-8 relative overflow-hidden"><div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full -mr-16 -mt-16 blur-2xl"></div><div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/20 rounded-full -ml-10 -mb-10 blur-xl"></div><div className="relative z-10"><p className="text-slate-400 font-medium mb-1 text-sm uppercase tracking-widest">{t.totalBalance}</p><h2 className="text-5xl font-bold mb-8 tracking-tight">$1,240<span className="text-2xl text-slate-500">.50</span></h2><div className="flex gap-4"><button className="flex-1 bg-white text-dark py-3.5 rounded-xl font-bold text-sm transition-transform active:scale-95 shadow-lg">Top Up</button><button className="flex-1 bg-slate-800 text-white py-3.5 rounded-xl font-bold text-sm transition-transform active:scale-95 border border-slate-700">Withdraw</button></div></div></div><h3 className="font-bold text-slate-900 mb-4 px-1">{t.recentActivity}</h3><div className="space-y-3">{[1,2,3,4].map(i => (<div key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${i % 2 === 0 ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-600'}`}>{i % 2 === 0 ? <DollarSign size={20} /> : <Car size={20} />}</div><div><p className="font-bold text-slate-900 text-sm">{i % 2 === 0 ? 'Balance Top Up' : 'Ride to Toronto'}</p><p className="text-xs text-slate-400 font-medium">Today, 10:23 AM</p></div></div><span className={`font-bold text-sm ${i % 2 === 0 ? 'text-green-600' : 'text-slate-900'}`}>{i % 2 === 0 ? '+' : '-'}$45.00</span></div>))}</div></div>)
};

const LeaderboardView = ({ lang }: { lang: Language }) => { const t = translations[lang]; return (<div className="pb-24 px-6 pt-12 bg-slate-50 min-h-full"><div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold text-slate-900">{t.driverLeaderboard}</h1><div className="flex items-center gap-1 text-xs font-bold text-primary bg-indigo-50 px-3 py-1 rounded-full cursor-pointer">This Week <ChevronDown size={14} /></div></div><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"><div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3"><Star size={16} fill="currentColor" /></div><p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">{t.ranking}</p><p className="text-3xl font-bold text-slate-900">#42</p><p className="text-green-500 text-xs font-bold mt-1">Top 5%</p></div><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"><div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3"><Zap size={16} fill="currentColor" /></div><p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">{t.points}</p><p className="text-3xl font-bold text-slate-900">8.4k</p><p className="text-indigo-500 text-xs font-bold mt-1">+120 today</p></div></div><LeaderboardChart /><div className="mt-8 space-y-3"><h3 className="font-bold text-slate-900 px-1">{t.topDrivers}</h3>{[1, 2, 3, 4, 5].map((i) => (<div key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><div className="flex items-center gap-4"><span className={`font-bold w-6 text-center text-lg ${i < 4 ? 'text-primary' : 'text-slate-400'}`}>{i}</span><img src={`https://i.pravatar.cc/150?img=${i + 10}`} className="w-10 h-10 rounded-full" alt="user" /><div><p className="font-bold text-slate-900 text-sm">Alex Johnson</p><p className="text-xs text-slate-500 font-medium">320 rides • 4.9 <Star size={10} className="inline -mt-0.5 text-yellow-400 fill-yellow-400"/></p></div></div><div className="text-right"><span className="font-bold text-sm block text-slate-900">12,450</span><span className="text-[10px] font-bold text-slate-400 uppercase">Pts</span></div></div>))}</div></div>)};

const AdminView = ({ setView, pendingDrivers, approveDriver, liveRoutes }: { setView: (view: ViewState) => void, pendingDrivers: UserType[], approveDriver: (id: string) => void, liveRoutes: Ride[] }) => {
   const [unlocked, setUnlocked] = useState(false);
   const [password, setPassword] = useState('');
   const [tab, setTab] = useState<'drivers' | 'routes'>('drivers');

   const handleUnlock = () => {
      if (password === '1977') {
         setUnlocked(true);
      } else {
         alert("Incorrect Password");
      }
   }

   if (!unlocked) {
      return (
         <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-900 text-white">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
               <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Admin Access</h2>
            <p className="text-slate-400 mb-8 text-center text-sm">Please enter your secure pin to access the dashboard.</p>
            <div className="w-full max-w-xs space-y-4">
               <input 
                  type="password" 
                  autoFocus
                  placeholder="PIN" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-center text-2xl tracking-[0.5em] bg-white/5 border border-white/10 rounded-xl py-4 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
               />
               <button onClick={handleUnlock} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-xl transition-colors">
                  Unlock
               </button>
               <button onClick={() => setView('home')} className="w-full text-slate-500 text-sm py-2">
                  Cancel
               </button>
            </div>
         </div>
      )
   }

   const handleApprove = (id: string) => { 
      approveDriver(id);
   };

   return (
      <div className="pb-24 px-6 pt-12 bg-slate-50 min-h-full">
         <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <button onClick={() => setView('profile')} className="p-2 bg-white rounded-full shadow-sm text-slate-600"><XCircle size={20} /></button>
         </div>

         <div className="flex bg-white p-1 rounded-xl border border-slate-200 mb-6">
            <button onClick={() => setTab('drivers')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'drivers' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>Drivers Approval ({pendingDrivers.length})</button>
            <button onClick={() => setTab('routes')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${tab === 'routes' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>Live Routes ({liveRoutes.length})</button>
         </div>

         {tab === 'drivers' ? (
            <div className="space-y-4">
               {pendingDrivers.length === 0 ? (<div className="text-center py-10 text-slate-400">No pending approvals</div>) : (pendingDrivers.map(driver => (
                     <div key={driver.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">{driver.firstName[0]}</div><div><h3 className="font-bold text-slate-900">{driver.firstName} {driver.lastName}</h3><span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase">{driver.driverStatus}</span></div></div>
                           <button className="text-slate-400 hover:text-primary"><Eye size={18} /></button>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg mb-4 text-xs space-y-1 text-slate-600">
                           <p><strong>Vehicle:</strong> {driver.vehicle?.make} {driver.vehicle?.model} ({driver.vehicle?.year})</p>
                           <p><strong>Plate:</strong> {driver.vehicle?.plate}</p>
                        </div>
                        <div className="flex gap-2 text-xs text-slate-500 mb-4"><span className={driver.documentsUploaded.license ? "text-green-600 flex items-center gap-1" : "text-red-500"}><FileText size={12} /> License</span><span className={driver.documentsUploaded.insurance ? "text-green-600 flex items-center gap-1" : "text-red-500"}><Shield size={12} /> Insurance</span></div>
                        <div className="flex gap-3"><Button variant="outline" className="flex-1 py-2 text-xs" onClick={() => alert("Rejected")}>Reject</Button><Button className="flex-1 py-2 text-xs bg-green-600 hover:bg-green-700 shadow-none" onClick={() => handleApprove(driver.id)}>Approve</Button></div>
                     </div>
                  )))}
            </div>
         ) : (
            <div className="space-y-4">
               {liveRoutes.map(ride => (
                  <div key={ride.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                     <div>
                        <div className="flex items-center gap-2 mb-1"><span className="font-bold text-slate-900 text-sm">{ride.origin.split(',')[0]}</span><ArrowRight size={14} className="text-slate-300" /><span className="font-bold text-slate-900 text-sm">{ride.destination.split(',')[0]}</span></div>
                        <p className="text-xs text-slate-500">{ride.driver.firstName} • ${ride.price}</p>
                     </div>
                     <span className="text-green-500 font-bold text-xs bg-green-50 px-3 py-1.5 rounded-lg flex items-center gap-1"><Zap size={10} fill="currentColor"/> Live</span>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
};

// ... RideDetailView (no change needed mostly)

const RideDetailView = ({ ride, onBack, lang }: { ride: Ride, onBack: () => void, lang: Language }) => {
  const [safetyTip, setSafetyTip] = useState<string>("Loading route info...");
  const t = translations[lang];
  useEffect(() => { generateRideSafetyBrief(ride.origin, ride.destination).then(setSafetyTip); }, [ride]);
  return (
    <div className="h-full bg-white pb-24 overflow-y-auto">
      <div className="relative h-56">
        <img src={`https://picsum.photos/800/600?random=${ride.id}`} className="w-full h-full object-cover" alt="Map" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <button onClick={onBack} className="absolute top-12 left-6 bg-white/20 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white/30 transition-colors"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div className="absolute bottom-4 left-6 text-white"><div className="flex items-center gap-2 mb-1 opacity-90"><Calendar size={14} /><span className="text-xs font-bold uppercase tracking-wide">{ride.departureTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div><h1 className="text-2xl font-bold leading-tight">{ride.origin.split(',')[0]} <span className="text-white/60 mx-1">to</span> {ride.destination.split(',')[0]}</h1></div>
      </div>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
           <div className="text-center flex-1 border-r border-slate-200"><p className="text-2xl font-bold text-slate-900">${ride.price}</p><p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">{t.perSeat}</p></div>
           <div className="text-center flex-1 border-r border-slate-200"><p className="text-xl font-bold text-slate-900">{ride.distanceKm}km</p><p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Distance</p></div>
           <div className="text-center flex-1"><p className="text-xl font-bold text-slate-900">{ride.seatsAvailable}</p><p className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">{t.seats}</p></div>
        </div>

        {/* Driver Info */}
        <div className="flex items-center justify-between py-4 border-b border-slate-100 mb-6">
           <div className="flex items-center gap-3">
              <img src={ride.driver.avatar} className="w-12 h-12 rounded-full" alt="Driver" />
              <div>
                 <p className="font-bold text-slate-900">{ride.driver.firstName} {ride.driver.lastName}</p>
                 <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Star size={12} className="text-yellow-400 fill-yellow-400"/>
                    <span>{ride.driver.rating}</span>
                    <span>•</span>
                    <span>{ride.driver.totalRides} rides</span>
                 </div>
              </div>
           </div>
           {ride.driver.isVerified && <div className="text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Shield size={12}/> Verified</div>}
        </div>

        <div className="pt-2 pb-4 space-y-3"><Button className="py-4 text-lg shadow-xl shadow-indigo-200">{t.bookSeat}</Button></div>
      </div>
    </div>
  );
};

// Main App Layout
const App: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [currentView, setView] = useState<ViewState>('home'); // Default view
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [lang, setLang] = useState<Language>('en');

  // GLOBAL STATE
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<UserType[]>([]);

  // Initialize mocks
  useEffect(() => {
     setAllRides(generateMockRides());
  }, []);

  // Helper to update user state from child components
  const updateUser = (updatedUser: UserType) => {
     setUser(updatedUser);
     // If status changed to pending, add to admin list
     if (updatedUser.driverStatus === 'pending' && user?.driverStatus !== 'pending') {
        setPendingDrivers(prev => [...prev, updatedUser]);
     }
  };

  const publishRide = (newRide: Ride) => {
     setAllRides(prev => [newRide, ...prev]);
  };

  const approveDriver = (id: string) => {
     setPendingDrivers(prev => prev.filter(d => d.id !== id));
     // If the currently logged in user is the one being approved (for demo purposes we simulate this notification/update)
     // In a real app, this would happen via backend polling or sockets
     if (user && user.id === id) {
        setUser({ ...user, isVerified: true, driverStatus: 'approved' });
        alert("Congratulations! Your account has been approved.");
     } else {
        alert("Driver Approved.");
     }
  };

  // If no user, show Auth
  if (!user) {
    return <AuthView onLogin={(u) => { 
      setUser(u); 
      // If user is driver, immediately go to 'post' view for onboarding
      if (u.role === 'driver') {
        setView('post');
      } else {
        setView('home');
      }
    }} />;
  }

  const renderView = () => {
    switch(currentView) {
      case 'home': return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} />;
      case 'search': return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} />;
      case 'post': return <PostRideView setView={setView} lang={lang} user={user} updateUser={updateUser} onPublish={publishRide} />;
      case 'ride-detail': return selectedRide ? <RideDetailView ride={selectedRide} onBack={() => setView('home')} lang={lang} /> : <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} />;
      case 'wallet': return <WalletView lang={lang} />;
      case 'leaderboard': return <LeaderboardView lang={lang} />;
      case 'admin': return <AdminView setView={setView} pendingDrivers={pendingDrivers} approveDriver={approveDriver} liveRoutes={allRides.filter(r => r.driver.id !== user.id)} />; // Don't show admin their own mock rides in live view if they were admin
      case 'profile': return (
         <div className="pt-20 px-6 space-y-6 pb-24">
            <div className="text-center">
              <h2 className="font-bold text-2xl mb-6">Profile</h2>
              <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto overflow-hidden mb-4 border-4 border-white shadow-lg">
                 <img src={user.avatar} alt="Me" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{user.firstName} {user.lastName}</h3>
              <p className="text-slate-500 text-sm">{user.phone}</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                 <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wide">{user.role}</span>
                 {user.isVerified && <span className="text-xs font-bold bg-green-50 text-green-600 px-2 py-0.5 rounded-md flex items-center gap-1"><CheckCircle2 size={12}/> Verified</span>}
              </div>
            </div>

            {/* Profile Info based on Role */}
            <div className="space-y-4">
              {user.role === 'driver' && user.vehicle && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3">Vehicle Details</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-50 p-2.5 rounded-full text-primary"><Car size={20} /></div>
                      <div>
                        <p className="font-bold text-slate-900">{user.vehicle.make} {user.vehicle.model}</p>
                        <p className="text-xs text-slate-500">{user.vehicle.plate}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Active</span>
                  </div>
                </div>
              )}

              {user.role === 'passenger' && (
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
                      <p className="text-2xl font-bold text-slate-900">12</p>
                      <p className="text-xs text-slate-500 font-bold uppercase mt-1">Trips Taken</p>
                   </div>
                   <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 text-center">
                      <p className="text-2xl font-bold text-slate-900">4.9</p>
                      <p className="text-xs text-slate-500 font-bold uppercase mt-1">Rating</p>
                   </div>
                </div>
              )}

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left space-y-2">
                 <button className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-700">
                    <span className="font-semibold flex items-center gap-3"><FileText size={18} className="text-slate-400"/> Legal & Privacy</span>
                    <ArrowRight size={16} className="text-slate-400" />
                 </button>
                 <button onClick={() => setUser(null)} className="w-full flex items-center justify-between p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600">
                    <span className="font-semibold flex items-center gap-3"><Lock size={18} className="text-red-400"/> Sign Out</span>
                 </button>
              </div>
            </div>
         </div>
      );
      default: return <HomeView setView={setView} setDetailRide={setSelectedRide} lang={lang} setLang={setLang} user={user} allRides={allRides} />;
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 text-slate-900 overflow-hidden flex flex-col">
       <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
         {renderView()}
       </div>
       {user && currentView !== 'ride-detail' && currentView !== 'admin' && <Navigation currentView={currentView} setView={setView} lang={lang} />}
    </div>
  );
};

export default App;