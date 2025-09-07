// REPLACE FILE: components/BookingConfirmation.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

// Safely parse JSON even when the body is empty (201/204)
async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

// ---- formatting helpers for date-only and time-only columns ----
const pad2 = (n: number) => String(n).padStart(2, '0');
const isoDateToYMD = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '';
const isoTimeToHHmm = (iso?: string | null) => {
  if (!iso) return '';
  // Prisma TIME is represented as 1970-01-01T..Z — use UTC to avoid TZ drift
  const d = new Date(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};
const formatINR = (n: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n || 0));

// ---- API types matching your new backend response ----
type Address = { address?: string | null } | null;

type BookingApi = {
  id: number;
  userId: number;
  fare: number;

  // NEW split fields
  pickupDate?: string | null;  // @db.Date -> ISO midnight
  pickupTime?: string | null;  // @db.Time(0) -> 1970-01-01T..

  returnDate?: string | null;
  returnTime?: string | null;

  // nested relations
  pickupAddress?: Address;
  dropAddress?: Address;

  // optional extras if your API includes them
  fromCity?: { name: string; state?: string | null } | null;
  toCity?: { name: string; state?: string | null } | null;
};

type UserDetails = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
};

export default function BookingConfirmation({ bookingId }: { bookingId?: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefer prop -> ?id / ?bookingId -> sessionStorage('lastBookingId')
  const queryIdRaw = searchParams.get('id') || searchParams.get('bookingId');
  const queryId = queryIdRaw ? Number(queryIdRaw) : NaN;

  let effectiveId: number | null =
    typeof bookingId === 'number' && bookingId > 0
      ? bookingId
      : (Number.isFinite(queryId) && queryId > 0 ? queryId : null);

  if (!effectiveId && typeof window !== 'undefined') {
    const last = Number(window.sessionStorage?.getItem('lastBookingId') || '');
    if (Number.isFinite(last) && last > 0) effectiveId = last;
  }

  const [booking, setBooking] = useState<BookingApi | null>(null);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!effectiveId) {
          setError('Missing booking id');
          return;
        }
        // 1) fetch booking
        const res = await fetchWithRefresh(`/bookings/${effectiveId}`);
        if (!res.ok) {
          const msg = await res.text().catch(() => '');
          throw new Error(`Failed to fetch booking (${res.status}) ${msg}`);
        }
        const b = await safeJson<BookingApi>(res);
        if (!b) {
          setError('No booking details returned by server');
          return;
        }
        setBooking(b);

        // 2) fetch user (best effort)
        try {
          const uRes = await fetchWithRefresh(`/users/${b.userId}`);
          if (uRes.ok) {
            const u = await safeJson<UserDetails>(uRes);
            if (u) setUser(u);
          }
        } catch { /* ignore */ }
      } catch (err: any) {
        setError(err?.message || 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveId]);

  if (loading) return <p className="p-4 text-center">Loading booking…</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;
  if (!booking) return <p className="p-4 text-center">No booking found.</p>;

  // prepare fields for view
  const pickupAddr = booking.pickupAddress?.address || '—';
  const dropAddr = booking.dropAddress?.address || '—';

  const dateStr = isoDateToYMD(booking.pickupDate);
  const timeStr = isoTimeToHHmm(booking.pickupTime);
  const dateTimeLabel = dateStr ? (timeStr ? `${dateStr} • ${timeStr}` : dateStr) : '—';

  const retDateStr = isoDateToYMD(booking.returnDate);
  const retTimeStr = isoTimeToHHmm(booking.returnTime);
  const returnLabel = retDateStr ? (retTimeStr ? `${retDateStr} • ${retTimeStr}` : retDateStr) : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-green-600">Booking Confirmed!</h1>
        <p className="text-sm text-gray-500">
          Reference: <strong>{booking.id}</strong>
        </p>

        {user && (
          <div className="text-left space-y-1">
            <p><span className="font-semibold">Name:</span> {user.name}</p>
            <p><span className="font-semibold">Email:</span> {user.email}</p>
            {user.phone && <p><span className="font-semibold">Mobile:</span> {user.phone}</p>}
          </div>
        )}

        <div className="text-left space-y-2">
          <p>
            <span className="font-semibold">Pickup Address:</span>{' '}
            <span className="text-gray-700">{pickupAddr}</span>
          </p>
          <p>
            <span className="font-semibold">Drop Address:</span>{' '}
            <span className="text-gray-700">{dropAddr}</span>
          </p>
        </div>

        <div className="text-left space-y-1">
          <p>
            <span className="font-semibold">Date &amp; Time:</span>{' '}
            <span className="text-gray-700">{dateTimeLabel}</span>
          </p>

          {!!returnLabel && (
            <p>
              <span className="font-semibold">Return:</span>{' '}
              <span className="text-gray-700">{returnLabel}</span>
            </p>
          )}

          <p>
            <span className="font-semibold">Fare:</span>{' '}
            <span className="text-gray-700">{formatINR(booking.fare)}</span>
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
