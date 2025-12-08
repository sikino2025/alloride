
import React, { useState, useEffect, useMemo } from 'react';
import { Navigation } from './components/Navigation';
import { ViewState, Ride, User as UserType, UserRole } from './types';
import { translations, Language } from './utils/translations';
import { MapPin, Calendar, ArrowRight, User, Search, Star, CheckCircle2, Zap, Upload, FileText, Car, Clock, Shield, XCircle, Camera, Phone, MessageSquare, Plus, Trash2, AlertCircle, LogOut, Download, MoreHorizontal, ChevronLeft } from 'lucide-react';
import { LeaderboardChart } from './components/LeaderboardChart';
import { getStaticMapUrl } from './services/geminiService';
import { Logo } from './components/Logo';

// --- Utilities ---
const toLocalISOString = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
  return adjustedDate.toISOString().split('T')[0];
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
const STORAGE_KEY_RIDES = 'alloride_rides_v5'; 
const STORAGE_KEY_PENDING_DRIVERS = 'alloride_drivers_v3';

const MOCK_USER_TEMPLATE: UserType = {
  id: 'u1', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.com', phone: '514-555-0199', role: 'passenger', avatar: 'https://i.pravatar.cc/150?u=alex', isVerified: true, driverStatus: 'approved', documentsUploaded: { license: true, insurance: true, photo: true }, rating: 4.9, totalRides: 142,
  vehicle: { make: "Toyota", model: "RAV4", year: "2023", color: "Midnight Black", plate: "K29 4F2" }
};

const CITIES_AND_SPOTS: Record<string, Record<string, string[]>> = {
  "QC": {
    "Montréal": ["Berri-UQAM", "Côte-Vertu", "Radisson", "Trudeau Airport"],
    "Québec": ["Ste-Foy", "Gare du Palais"],
    "Gatineau": ["Promenades", "Portage"]
  },
  "ON": {
    "Toronto": ["Union Station", "Yorkdale", "Pearson Airport"],
    "Ottawa": ["Rideau", "Bayshore", "Train Station"]
  }
};

// --- Shared Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', fullWidth = true, disabled = false }: any) => {
  const baseStyle = "py-4 px-6 rounded-2xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none shadow-lg";
  const variants: any = {
    primary: "bg-gradient-to-r from-primary to-primaryDark text-white shadow-indigo-500/30",
    secondary: "bg-white text-slate-800 border border-slate-100 shadow-slate-200/50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
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
      
      const newUser: UserType = {
          ...MOCK_USER_TEMPLATE,
          id: `u-${Date.now()}`,
          role,
          email,
          firstName: isLogin ? 'Alex' : firstName,
          lastName: isLogin ? 'Rivera' : lastName,
          phone: isLogin ? '555-0199' : phone,
          avatar: isLogin ? 'https://i.pravatar.cc/150?u=alex' : '',
          driverStatus: role === 'driver' ? 'new' : undefined,
          isVerified: role === 'passenger'
      };
      
      if (role === 'driver') {
          newUser.isVerified = false;
          newUser.documentsUploaded = { license: false, insurance: false, photo: false };
      }
      onLogin(newUser);
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
        
        // Save to pending storage
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_PENDING_DRIVERS) || '[]');
        localStorage.setItem(STORAGE_KEY_PENDING_DRIVERS, JSON.stringify([...existing.filter((u:any) => u.id !== user.id), updated]));
        
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

const PostRideView = ({ user, onPublish, setView, lang }: any) => {
    const t = translations[lang];
    const [form, setForm] = useState({ origin: 'Montreal, QC', destination: 'Quebec, QC', price: 45, seats: 3, date: toLocalISOString(new Date()), time: '09:00' });

    // STRICT APPROVAL CHECK
    if (user.driverStatus !== 'approved') {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                    <Shield size={40} className="text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.verificationRequired}</h2>
                <p className="text-slate-500 mb-8">You must be approved by an administrator before posting trips.</p>
                <Button onClick={() => setView('home')} variant="secondary">{t.backToHome}</Button>
            </div>
        );
    }

    const handleSubmit = () => {
        const departure = new Date(`${form.date}T${form.time}`);
        const arrival = new Date(departure.getTime() + 10800000); // +3h
        const newRide: Ride = {
            id: `ride-${Date.now()}`,
            driver: user,
            origin: form.origin,
            destination: form.destination,
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
        <div className="h-full bg-slate-50 p-6 pt-12 pb-32 overflow-y-auto">
            <Header title={t.postRide} />
            <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
                <input value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Origin" />
                <input value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Destination" />
                <div className="flex gap-4">
                    <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold" />
                    <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl font-bold" />
                </div>
                <div className="flex gap-4">
                    <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Price $" />
                    <input type="number" value={form.seats} onChange={e => setForm({...form, seats: Number(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-xl font-bold" placeholder="Seats" />
                </div>
            </div>
            <Button onClick={handleSubmit} className="mt-6">{t.publishRide}</Button>
        </div>
    );
};

const RideDetailView = ({ ride, user, onBack, onBook, bookedRides, lang }: any) => {
    const t = translations[lang];
    const isDriver = user.id === ride.driver.id;
    const isBooked = bookedRides.some((r: Ride) => r.id === ride.id);
    const isPast = new Date().getTime() > new Date(ride.arrivalTime).getTime();
    const [rating, setRating] = useState(0);

    return (
        <div className="h-full bg-slate-50 pb-32 overflow-y-auto relative">
            <div className="h-64 bg-slate-900 relative">
                <img src={getStaticMapUrl(ride.origin)} className="w-full h-full object-cover opacity-50" />
                <button onClick={onBack} className="absolute top-6 left-6 bg-white rounded-full p-2 z-10"><ChevronLeft/></button>
            </div>
            <div className="px-6 -mt-12 relative z-10">
                <div className="bg-white rounded-[2.5rem] p-6 shadow-card mb-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">${ride.price}</h1>
                            <div className="text-slate-400 font-bold text-sm">{ride.departureTime.toLocaleDateString()}</div>
                        </div>
                        {isBooked && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-xl font-bold text-xs">BOOKED</span>}
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-6">
                        <img src={ride.driver.avatar} className="w-12 h-12 rounded-full bg-slate-200 object-cover" />
                        <div>
                            <div className="font-bold">{ride.driver.firstName}</div>
                            <div className="text-xs text-slate-500 font-bold flex items-center gap-1"><Star size={10} className="fill-yellow-400 text-yellow-400"/> {ride.driver.rating}</div>
                        </div>
                    </div>

                    {!isDriver && !isBooked && !isPast && (
                        <Button onClick={() => onBook(ride)}>{t.bookSeat}</Button>
                    )}

                    {isBooked && !isPast && (
                        <div className="grid grid-cols-2 gap-3">
                            <button className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm"><Phone size={16}/> Call</button>
                            <button className="flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-bold text-sm"><MessageSquare size={16}/> Text</button>
                        </div>
                    )}

                    {isBooked && isPast && (
                        <div className="bg-slate-50 p-6 rounded-2xl text-center">
                            <h3 className="font-bold mb-4">Rate your trip</h3>
                            <div className="flex justify-center gap-2 mb-4">
                                {[1,2,3,4,5].map(s => (
                                    <Star key={s} size={32} onClick={() => setRating(s)} className={`${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                                ))}
                            </div>
                            <Button disabled={rating === 0} onClick={() => alert("Rated!")}>Submit</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdminView = ({ setView, onVerify }: any) => {
    const [pending, setPending] = useState<any[]>([]);
    
    useEffect(() => {
        const p = JSON.parse(localStorage.getItem(STORAGE_KEY_PENDING_DRIVERS) || '[]');
        setPending(p);
    }, []);

    const handleApprove = (driver: any) => {
        onVerify(driver.id);
        const newPending = pending.filter(d => d.id !== driver.id);
        setPending(newPending);
        localStorage.setItem(STORAGE_KEY_PENDING_DRIVERS, JSON.stringify(newPending));
    };

    return (
        <div className="h-full bg-slate-50 p-6 pt-12">
            <Header title="Admin Dashboard" subtitle="Approve Drivers" />
            {pending.length === 0 ? <p className="text-slate-400 text-center mt-10">No pending approvals.</p> : (
                <div className="space-y-4">
                    {pending.map(d => (
                        <div key={d.id} className="bg-white p-4 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <img src={d.avatar} className="w-12 h-12 rounded-full object-cover bg-slate-200"/>
                                <div className="font-bold">{d.firstName} {d.lastName}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {['license', 'insurance', 'photo'].map(k => (
                                    <div key={k} className="h-16 bg-slate-100 rounded-lg overflow-hidden border">
                                        {d.documentsData[k] ? <img src={d.documentsData[k]} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-xs">No Doc</div>}
                                    </div>
                                ))}
                            </div>
                            <Button onClick={() => handleApprove(d)} className="py-2 text-sm">Approve Driver</Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN APP EXPORT ---
export const App = () => {
    const [view, setView] = useState<ViewState>('auth');
    const [user, setUser] = useState<UserType | null>(null);
    const [lang, setLang] = useState<Language>('en');
    const [allRides, setAllRides] = useState<Ride[]>([]);
    const [bookedRides, setBookedRides] = useState<Ride[]>([]);
    const [detailRide, setDetailRide] = useState<Ride|null>(null);

    // Initial Load
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY_RIDES);
        if (stored) {
             setAllRides(JSON.parse(stored).map((r:any) => ({...r, departureTime: new Date(r.departureTime), arrivalTime: new Date(r.arrivalTime)})));
        } else {
             // Mock data logic removed for brevity, normally goes here
        }
    }, []);

    const handleLogin = (u: UserType) => {
        setUser(u);
        setView(u.role === 'admin' ? 'admin' : 'home');
    };

    const handlePublish = (ride: Ride) => {
        const updated = [...allRides, ride];
        setAllRides(updated);
        localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(updated));
    };

    const handleBook = (ride: Ride) => {
        const updatedRides = allRides.map(r => r.id === ride.id ? {...r, seatsAvailable: r.seatsAvailable - 1} : r);
        setAllRides(updatedRides);
        localStorage.setItem(STORAGE_KEY_RIDES, JSON.stringify(updatedRides));
        
        const booking = {...ride, seatsAvailable: ride.seatsAvailable - 1, bookedSeats: 1};
        setBookedRides([...bookedRides, booking]);
        setDetailRide(booking);
        alert("Booked!");
    };

    const handleAdminVerify = (driverId: string) => {
        alert("Driver Verified! They can now post trips.");
        // In a real app, you would update the specific user record in a database
        // Here we just alert. If the current user was that driver, we'd update state.
    };

    if (view === 'auth') return <AuthView onLogin={handleLogin} lang={lang} setLang={setLang} />;
    if (!user) return null;
    if (user.role === 'driver' && user.driverStatus === 'new') return <DriverOnboarding user={user} updateUser={setUser} onComplete={() => setView('home')} lang={lang} />;

    return (
        <div className="h-full w-full">
            {view === 'home' && <HomeView user={user} allRides={allRides} bookedRides={bookedRides} setDetailRide={setDetailRide} setView={setView} lang={lang} />}
            {view === 'ride-detail' && detailRide && <RideDetailView ride={detailRide} user={user} onBack={() => setView('home')} onBook={handleBook} bookedRides={bookedRides} lang={lang} />}
            {view === 'post' && <PostRideView user={user} onPublish={handlePublish} setView={setView} lang={lang} />}
            {view === 'admin' && <AdminView setView={setView} onVerify={handleAdminVerify} />}
            
            {view !== 'ride-detail' && view !== 'auth' && (
                <Navigation currentView={view} setView={setView} lang={lang} userRole={user.role} />
            )}
        </div>
    );
};
