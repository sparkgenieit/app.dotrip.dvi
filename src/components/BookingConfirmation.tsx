// components/BookingConfirmation.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

// Safely parse JSON even when the body is empty (201/204)
async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();        // body can be read only once
  if (!text) return null;               // empty body -> null
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;                        // invalid JSON -> null
  }
}

interface BookingDetails {
  id: number;
  userId: number;
  pickupDateTime: string;
  fare: number;
  pickupLocation: string;   // align with backend DTO
  dropoffLocation: string;  // align with backend DTO
  // any other booking fields
}


interface UserDetails {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
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
    : (Number.isFinite(queryId) && queryId > 0 ? queryId : null);

// session fallback (in case backend returned no JSON body)
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

      // 1) fetch booking (safe JSON)
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

      // 2) fetch user (best-effort, safe JSON, do not block UI)
      try {
        const uRes = await fetchWithRefresh(`/users/${b.userId}`);
        if (uRes.ok) {
          const u = await safeJson<UserDetails>(uRes);
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
if (!booking)
  return <p className="p-4 text-center">No booking found.</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-green-600">Booking Confirmed!</h1>
        <p className="text-sm text-gray-500">
          Reference: <strong>{booking.id}</strong>
        </p>

{/* User details (optional) */}
{user && (
  <div className="text-left space-y-1">
    <p><span className="font-semibold">Name:</span> {user.name}</p>
    <p><span className="font-semibold">Email:</span> {user.email}</p>
    {user.phone && (<p><span className="font-semibold">Mobile:</span> {user.phone}</p>)}
  </div>
)}


{/* Addresses from booking */}
<div className="text-left space-y-2">
  <p>
    <span className="font-semibold">Pickup Address:</span>{' '}
    {booking.pickupLocation}
  </p>
  <p>
    <span className="font-semibold">Drop Address:</span>{' '}
    {booking.dropoffLocation}
  </p>
</div>


        {/* Booking specifics */}
        <div className="text-left space-y-1">
          <p>
            <span className="font-semibold">Date & Time:</span>{' '}
            {booking.pickupDateTime ? new Date(booking.pickupDateTime).toLocaleString() : '—'}
          </p>
          <p>
            <span className="font-semibold">Fare:</span> ₹{booking.fare}
          </p>
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
