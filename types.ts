export enum RideType {
  CITY_TO_CITY = 'CITY_TO_CITY',
  URBAN = 'URBAN',
}

export type UserRole = 'driver' | 'passenger' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string; // Now mandatory on signup
  isVerified: boolean; 
  documentsUploaded: {
    license: boolean;
    insurance: boolean;
    photo: boolean;
  };
  rating: number;
  totalRides: number;
  // Driver specific
  vehicle?: {
    make: string;
    model: string;
    year: string;
    color: string;
    plate: string;
  };
}

export interface Ride {
  id: string;
  driver: User;
  origin: string;
  destination: string;
  stops: string[]; // Multi-stop routing
  departureTime: Date;
  arrivalTime: Date;
  price: number;
  currency: string;
  seatsAvailable: number;
  features: {
    instantBook: boolean;
    wifi: boolean;
    music: boolean;
    pets: boolean;
    smoking: boolean;
    winterTires: boolean;
  };
  luggage: {
    small: number;
    medium: number;
    large: number;
  };
  distanceKm: number;
  description?: string;
}

export type ViewState = 'auth' | 'home' | 'search' | 'post' | 'wallet' | 'profile' | 'ride-detail' | 'leaderboard' | 'admin';

export interface WalletTransaction {
  id: string;
  amount: number;
  date: string;
  type: 'credit' | 'debit';
  description: string;
}