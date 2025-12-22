
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Star, CheckCircle2, Zap, Car, Clock, Shield, ShieldAlert, Camera, Plus, LogOut, ChevronLeft, RefreshCw, ChevronDown, Map, Navigation as NavIcon, DollarSign, Users, Briefcase, MessageSquare } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { getStaticMapUrl, generateRideSafetyBrief } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Safe Data Loading ---
// We use a new key to ensure we don't crash reading old incompatible localstorage data
const STORAGE_KEY_RIDES = 'alloride_rides_v15_poparide_style'; 
const STORAGE_KEY_USERS = 'alloride_users_v5';

const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
};

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
    "Montreal": ["Berri-UQAM", "Radisson", "YUL Airport", "Côte-Vertu"],
    "Quebec City": ["Gare du Palais", "Sainte-Foy", "Université Laval"],
    "Sherbrooke": ["Université de Sherbrooke", "Carrefour de l'Estrie"],
    "Gatineau": ["Promenades", "Place du Portage"],
    "Trois-Rivieres": ["Gare d'autocars", "UQTR"],
  },
  "ON": {
    "Toronto": ["Union Station", "YYZ Airport", "Yorkdale"],
    "Ottawa": ["Rideau Centre", "Train Station"],
    "Kingston": ["Queens", "Bus Terminal"],
  },
  "BC": { "Vancouver": ["Pacific Central"], "Victoria": ["Mayfair"] },
  "AB": { "Calgary": ["UCalgary"], "Edmonton": ["West Edm Mall"] }
};

const generateMockRides = (): Ride[] => {
    // Generate clean mock data
    return Array.from({ length: 15 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + Math.floor(Math.random() * 5));
        date.setHours(8 + Math.floor(Math.random() * 12), 0, 0, 0);
        return {
            id: `mock-${i}`,
            driver: { ...MOCK_USER_TEMPLATE, id: `d${i}`, firstName: ['Sarah', 'Mike', 'Jessica', 'David', 'Emma'][i%5], avatar: `https://i.pravatar.cc/150?u=${i}`, rating: 4.8 + (Math.random()*0.2) },
            origin: "Montreal, QC",
            destination: ["Quebec City, QC", "Ottawa, ON", "Toronto, ON", "Sherbrooke, QC"][i%4],
            price: 25 + Math.floor(Math.random() * 40),
            seatsAvailable: 1 + Math.floor(Math.random() * 3),
            totalSeats: 4,
            departureTime: date,
            arrivalTime: new Date(date.getTime() + 3 * 3600000),
            stops: [], currency: 'CAD', luggage: {small:1, medium:1, large:0}, distanceKm: 250,
            features: { instantBook: Math.random() > 0.5, music: true, pets: false, smoking: false, wifi: true, winterTires: true }
        } as Ride;
    }).sort((a,b) => a.departureTime.getTime() - b.departureTime.getTime());
};

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = true, disabled = false }: any) => {
  const variants: any = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 shadow-lg",
    secondary: "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`py-3.5 px-6 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: any) => (
  <div className="mb-4">
    {label && <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>}
    <input {...props} className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-3.5 outline-none font-semibold text-slate-900 transition-all placeholder:text-slate-400" />
  </div>
);

const RideCard = ({ ride, onClick }: any) => {
    const time = ride.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = ride.departureTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    
    return (
        <div onClick={onClick} className="bg-white p-5 rounded-2xl mb-4 border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] active:scale-[0.98] transition-all cursor-pointer">
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4 items-center">
                    <div className="flex flex-col items-center">
                        <span className="text-lg font-extrabold text-slate-900">{time}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{date}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                            <span className="font-bold text-slate-700 text-sm">{ride.origin.split(',')[0]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span className="font-bold text-slate-900 text-sm">{ride.destination.split(',')[0]}</span>
                        </div>
                    </div>
                </div>
                <div className="text-xl font-extrabold text-indigo-600">${ride.price}</div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                    <img src={ride.driver.avatar} className="w-6 h-6 rounded-full border border-slate-100" />
                    <span className="text-xs font-bold text-slate-600">{ride.driver.firstName}</span>
                    <div className="flex items-center text-[10px] font-bold text-slate-400 gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded">
                        <Star size={8} className="fill-yellow-400 text-yellow-400"/> {ride.driver.rating.toFixed(1)}
                    </div>
                </div>
                {ride.features.instantBook && <Zap size={14} className="text-green-500 fill-green-500" />}
            </div>
        </div>
    );
};

const SearchBar = ({ onClick }: any) => (
    <div onClick={onClick} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 cursor-pointer mb-6 group hover:border-indigo-300 transition-colors">
        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <Search size={20} strokeWidth={3} />
        </div>
        <div>
            <div className="text-slate-900 font-extrabold text-lg">Find a ride</div>
            <div className="text-slate-400 text-xs font-medium">Where do you want to go?</div>
        </div>
    </div>
);

// --- Views ---

const HomeView = ({ user, rides, setDetailRide, setView }: any) => (
    <div className="p-6 pb-32">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900">Good morning, <br/><span className="text-indigo-600">{user.firstName}</span></h1>
            <div onClick={() => setView('profile')} className="w-12 h-12 rounded-full border-2 border-white shadow-md overflow-hidden cursor-pointer">
                <img src={user.avatar} className="w-full h-full object-cover" />
            </div>
        </div>

        {user.role === 'passenger' && <SearchBar onClick={() => setView('search')} />}

        <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold text-slate-900">Available Trips</h2>
            <button className="text-xs font-bold text-indigo-600">Filter</button>
        </div>

        <div className="space-y-1">
            {rides.map((r: Ride) => (
                <RideCard key={r.id} ride={r} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />
            ))}
        </div>
    </div>
);

const SearchAndFilterView = ({ rides, setDetailRide, setView }: any) => {
    const [q, setQ] = useState('');
    const filtered = rides.filter((r: Ride) => r.destination.toLowerCase().includes(q.toLowerCase()) || r.origin.toLowerCase().includes(q.toLowerCase()));
    
    return (
        <div className="p-6 h-full flex flex-col pb-32">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setView('home')} className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm"><ChevronLeft size={20}/></button>
                <div className="flex-1 bg-white h-12 rounded-xl border border-slate-200 flex items-center px-4 focus-within:border-indigo-500 transition-colors shadow-sm">
                    <Search size={18} className="text-slate-400 mr-3"/>
                    <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="City, airport, or station..." className="flex-1 outline-none font-bold text-slate-900 placeholder:text-slate-300" />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar">
                {filtered.length === 0 ? (
                    <div className="text-center mt-20 opacity-40">
                        <Map size={48} className="mx-auto mb-4"/>
                        <p className="font-bold">No results found</p>
                    </div>
                ) : (
                    filtered.map((r: Ride) => <RideCard key={r.id} ride={r} onClick={() => { setDetailRide(r); setView('ride-detail'); }} />)
                )}
            </div>
        </div>
    );
};

const RideDetailView = ({ ride, onBack, user }: any) => {
    if(!ride) return null;
    const [safety, setSafety] = useState('');
    useEffect(() => { generateRideSafetyBrief(ride.origin, ride.destination).then(setSafety); }, [ride]);

    return (
        <div className="h-full bg-white flex flex-col pb-24 overflow-y-auto no-scrollbar">
            <div className="relative h-64 bg-slate-900 shrink-0">
                <img src={getStaticMapUrl(ride.destination)} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                <button onClick={onBack} className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white"><ChevronLeft/></button>
                <div className="absolute bottom-6 left-6 right-6 text-white">
                    <div className="text-3xl font-extrabold mb-1">${ride.price}</div>
                    <div className="text-sm font-medium opacity-80 flex items-center gap-2"><Users size={14}/> {ride.seatsAvailable} seats available</div>
                </div>
            </div>
            
            <div className="p-6 -mt-4 bg-white rounded-t-3xl relative flex-1">
                {safety && (
                     <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-xs font-medium text-indigo-900 flex gap-3 items-start mb-6">
                         <ShieldAlert className="shrink-0 text-indigo-600 mt-0.5" size={14} />
                         <span>{safety}</span>
                     </div>
                 )}
                 
                 <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-3">
                         <img src={ride.driver.avatar} className="w-12 h-12 rounded-full" />
                         <div>
                             <div className="font-bold text-slate-900">{ride.driver.firstName}</div>
                             <div className="text-xs font-bold text-slate-400 flex items-center gap-1"><Star size={10} className="fill-yellow-400 text-yellow-400"/> {ride.driver.rating.toFixed(1)}</div>
                         </div>
                     </div>
                     <div className="flex gap-2">
                        {ride.features.instantBook && <div className="p-2 rounded-full bg-green-50 text-green-600"><Zap size={18} fill="currentColor"/></div>}
                        <div className="p-2 rounded-full bg-slate-50 text-slate-400"><MessageSquare size={18}/></div>
                     </div>
                 </div>

                 <div className="relative pl-6 space-y-8 mb-8">
                     <div className="absolute left-1.5 top-2 bottom-6 w-0.5 bg-slate-100"></div>
                     <div className="relative">
                         <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div>
                         <div className="text-xs font-bold text-slate-400 uppercase mb-1">Pick up</div>
                         <div className="font-bold text-lg text-slate-900">{ride.origin}</div>
                     </div>
                     <div className="relative">
                         <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-white border-2 border-indigo-600"></div>
                         <div className="text-xs font-bold text-slate-400 uppercase mb-1">Drop off</div>
                         <div className="font-bold text-lg text-slate-900">{ride.destination}</div>
                     </div>
                 </div>
                 
                 <Button onClick={() => alert("Booking Simulated")} className="shadow-xl shadow-indigo-200">Book Ride</Button>
            </div>
        </div>
    );
};

// --- Main App Logic ---

export const App = () => {
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<UserType | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [detailRide, setDetailRide] = useState<Ride | null>(null);

  useEffect(() => {
    // Robust data loading with fallback
    try {
        const stored = localStorage.getItem(STORAGE_KEY_RIDES);
        if (stored) {
            setRides(JSON.parse(stored).map((r: any) => ({...r, departureTime: new Date(r.departureTime), arrivalTime: new Date(r.arrivalTime)})));
        } else {
            setRides(generateMockRides());
        }
    } catch(e) {
        console.error("Data corruption detected, resetting", e);
        setRides(generateMockRides());
    }
  }, []);

  if (!user) {
      // Simple Mock Auth for brevity
      return (
          <div className="h-screen bg-white flex flex-col items-center justify-center p-8">
              <Logo size={140} className="mb-8" />
              <h1 className="text-2xl font-extrabold mb-2 text-slate-900">Welcome to Alloride</h1>
              <p className="text-slate-500 mb-8 text-center font-medium">The modern way to travel city to city.</p>
              <Button onClick={() => setUser(MOCK_USER_TEMPLATE)} className="w-full mb-3">Log in as Passenger</Button>
              <Button onClick={() => setUser({...MOCK_USER_TEMPLATE, role: 'driver', firstName: 'Driver Dave'})} variant="secondary" className="w-full">Log in as Driver</Button>
          </div>
      );
  }

  return (
    <div className="h-screen w-full bg-slate-50 flex justify-center overflow-hidden font-sans">
        <div className="w-full max-w-md bg-white h-full relative shadow-2xl flex flex-col">
            <div className="flex-1 overflow-hidden relative">
                {view === 'home' && <HomeView user={user} rides={rides} setDetailRide={setDetailRide} setView={setView} />}
                {view === 'search' && <SearchAndFilterView rides={rides} setDetailRide={setDetailRide} setView={setView} />}
                {view === 'ride-detail' && <RideDetailView ride={detailRide} onBack={() => setView('home')} user={user} />}
                {view === 'profile' && <div className="p-8 text-center"><h1 className="text-2xl font-bold mb-4">Profile</h1><Button onClick={() => setUser(null)} variant="danger">Log Out</Button></div>}
                {/* Add other views (Post, Wallet) as needed */}
            </div>
            
            {/* Poparide-style bottom nav */}
            <div className="border-t border-slate-100 bg-white/90 backdrop-blur pb-6 pt-2 px-6 flex justify-between items-center relative z-50">
                 <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-indigo-600' : 'text-slate-300'}`}>
                     <Search size={24} strokeWidth={view === 'home' ? 3 : 2} />
                     <span className="text-[10px] font-bold">Search</span>
                 </button>
                 <button onClick={() => setView('post')} className={`flex flex-col items-center gap-1 ${view === 'post' ? 'text-indigo-600' : 'text-slate-300'}`}>
                     <Plus size={24} strokeWidth={view === 'post' ? 3 : 2} />
                     <span className="text-[10px] font-bold">Post</span>
                 </button>
                 <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 ${view === 'profile' ? 'text-indigo-600' : 'text-slate-300'}`}>
                     <User size={24} strokeWidth={view === 'profile' ? 3 : 2} />
                     <span className="text-[10px] font-bold">Profile</span>
                 </button>
            </div>
        </div>
    </div>
  );
};
