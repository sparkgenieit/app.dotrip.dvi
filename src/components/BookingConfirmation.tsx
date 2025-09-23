// components/BookingConfirmation.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

// Safely parse JSON even when the body is empty (201/204)
async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text(); // body can be read only once
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface CityLite {
  id: number;
  name: string;
  state?: string | null;
}

interface AddressLite {
  id: number;
  type: 'PICKUP' | 'DROP' | string;
  address?: string | null;
  city?: string | null;
  pinCode?: string | null;
  createdAt: string;
}

interface BookingDetails {
  id: number;
  userId: number;

  // new (from your API)
  pickupDate?: string | null;   // e.g. "2025-05-05T00:00:00.000Z"
  pickupTime?: string | null;   // e.g. "1970-01-01T07:00:00.000Z"
  returnDate?: string | null;
  returnTime?: string | null;

  fare: number;

  // old (kept as fallback)
  pickupLocation?: string;
  dropoffLocation?: string;

  pickupAddress?: AddressLite | null;
  dropAddress?: AddressLite | null;

  fromCity?: CityLite | null;
  toCity?: CityLite | null;

  vehicleType?: { id: number; name: string } | null;
  TripType?: { id: number; label: string } | null;
}

interface UserDetails {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

/**
 * Combine pickupDate (date-only ISO) with pickupTime (time-only ISO like 1970-01-01T07:00:00Z)
 * and return a *local* Date. We read hours/minutes from the time using UTC to avoid TZ drift.
 */
function combineDateAndTime(pickupDate?: string | null, pickupTime?: string | null): Date | null {
  if (!pickupDate || !pickupTime) return null;

  const d = new Date(pickupDate);
  if (isNaN(d.getTime())) return null;

  const t = new Date(pickupTime);
  if (isNaN(t.getTime())) return null;

  // interpret time as "clock time" (07:00) regardless of timezone
  const hours = t.getUTCHours();
  const minutes = t.getUTCMinutes();

  const result = new Date(d);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export default function BookingConfirmation({ bookingId }: { bookingId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefer prop -> ?id -> ?bookingId -> sessionStorage('lastBookingId')
  const queryIdRaw = searchParams.get('id') || searchParams.get('bookingId');
  const queryId = queryIdRaw ? Number(queryIdRaw) : NaN;

  let effectiveId: number | null =
    typeof bookingId === 'number' && bookingId > 0
      ? bookingId
      : Number.isFinite(queryId) && queryId > 0
      ? queryId
      : null;

  if (!effectiveId && typeof window !== 'undefined') {
    const last = Number(window.sessionStorage?.getItem('lastBookingId') || '');
    if (Number.isFinite(last) && last > 0) effectiveId = last;
  }

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        if (!effectiveId) {
          setError('Missing booking id');
          return;
        }

        // 1) booking
        const res = await fetchWithRefresh(`/bookings/${effectiveId}`);
        if (!res.ok) {
          const msg = await res.text().catch(() => '');
          throw new Error(`Failed to fetch booking (${res.status}) ${msg}`);
        }
        const b = await safeJson<BookingDetails>(res);
        if (!b) {
          setError('No booking details returned by server');
          return;
        }
        setBooking(b);

        // 2) user (/users/me)
        try {
          const meRes = await fetchWithRefresh('/users/me');
          if (meRes.ok) {
            const u = await safeJson<UserDetails>(meRes);
            if (u) setUser(u);
          }
        } catch (e) {
          console.warn('User fetch skipped:', e);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [effectiveId]);

  if (loading) return <p className="p-4 text-center">Loading booking…</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;
  if (!booking) return <p className="p-4 text-center">No booking found.</p>;

  // Addresses: prefer nested pickup/drop addresses from booking, else old fields
  const pickupAddress =
    booking.pickupAddress?.address ??
    booking.pickupLocation ??
    '';

  const dropAddress =
    booking.dropAddress?.address ??
    booking.dropoffLocation ??
    '';

  // Date/Time display
  let dateTimeDisplay = '—';
  const combined = combineDateAndTime(booking.pickupDate ?? null, booking.pickupTime ?? null);
  if (combined) {
    dateTimeDisplay = combined.toLocaleString();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-green-600">Booking Confirmed!</h1>
        <p className="text-sm text-gray-500">
          Reference: <strong>{booking.id}</strong>
        </p>

        {/* User details */}
        {user && (
          <div className="text-left space-y-1">
            <p><span className="font-semibold">Name:</span> {user.name}</p>
            <p><span className="font-semibold">Email:</span> {user.email}</p>
            {user.phone && (<p><span className="font-semibold">Mobile:</span> {user.phone}</p>)}
          </div>
        )}

        {/* Booking addresses */}
        <div className="text-left space-y-2">
          <p><span className="font-semibold">Pickup Address:</span> {pickupAddress}</p>
          <p><span className="font-semibold">Drop Address:</span> {dropAddress}</p>
        </div>

        {/* Booking specifics */}
        <div className="text-left space-y-1">
          <p><span className="font-semibold">Date & Time:</span> {dateTimeDisplay}</p>
          <p><span className="font-semibold">Fare:</span> ₹{booking.fare}</p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
