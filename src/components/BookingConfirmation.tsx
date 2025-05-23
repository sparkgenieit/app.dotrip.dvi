// components/BookingConfirmation.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

interface BookingDetails {
  id: number;
  userId: number;
  pickupDateTime: string;
  fare: number;
  pickupAddress: string;
  dropAddress: string;
  // any other booking fields
}

interface UserDetails {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

export default function BookingConfirmation({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // 1️⃣ fetch booking
        const res = await fetchWithRefresh(`/bookings/${bookingId}`);
        if (!res.ok) throw new Error('Failed to fetch booking');
        const b: BookingDetails = await res.json();
        setBooking(b);

        // 2️⃣ fetch user details
        const uRes = await fetchWithRefresh(`/users/${b.userId}`);
        if (!uRes.ok) throw new Error('Failed to fetch user');
        const u: UserDetails = await uRes.json();
        setUser(u);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookingId]);

  if (loading) return <p className="p-4 text-center">Loading booking…</p>;
  if (error) return <p className="p-4 text-center text-red-500">{error}</p>;
  if (!booking || !user)
    return <p className="p-4 text-center">No booking found.</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold text-green-600">Booking Confirmed!</h1>
        <p className="text-sm text-gray-500">
          Reference: <strong>{booking.id}</strong>
        </p>

        {/* User details */}
        <div className="text-left space-y-1">
          <p>
            <span className="font-semibold">Name:</span> {user.name}
          </p>
          <p>
            <span className="font-semibold">Email:</span> {user.email}
          </p>
          {user.phone && (
            <p>
              <span className="font-semibold">Mobile:</span> {user.phone}
            </p>
          )}
         
        </div>

        {/* Addresses from booking */}
        <div className="text-left space-y-2">
          <p>
            <span className="font-semibold">Pickup Address:</span>{' '}
            {booking.pickupAddress}
          </p>
          <p>
            <span className="font-semibold">Drop Address:</span>{' '}
            {booking.dropAddress}
          </p>
        </div>

        {/* Booking specifics */}
        <div className="text-left space-y-1">
          <p>
            <span className="font-semibold">Date & Time:</span>{' '}
            {new Date(booking.pickupDateTime).toLocaleString()}
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
