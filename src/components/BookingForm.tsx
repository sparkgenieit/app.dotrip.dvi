'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

export default function BookingForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // user inputs
  const [pickupLocation, setPickupLocation] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // derived from query
  const from = sp.get('from_city_name') || '—';
  const to = sp.get('to_city_name') || '—';
  const date = sp.get('pickup_date') || '—';
  const time = sp.get('pickup_time') || '—';
  const car = sp.get('car') || '—';
  const fare = sp.get('fare') || '—';
  const tripTypeLabel = sp.get('trip_type_label') || 'Trip';

  // basic “required” check
  const canSubmit = pickupLocation.trim() && name.trim() && email.trim() && phone.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      // Normally: call your API to create the booking
      const payload = {
        user: { name, email, phone, pickupLocation },
        trip: { from, to, date, time, car, fare, tripTypeLabel },
      };
      // example:
      // await fetchWithRefresh('/bookings', { method: 'POST', body: JSON.stringify(payload) })

      console.log('BOOKING SUBMIT', payload);
      router.push('/booking-confirmation');
    } catch (err: any) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // rough email/phone hints (optional soft validation)
  useEffect(() => {
    if (email && !/^\S+@\S+\.\S+$/.test(email)) setError('Please enter a valid email address.');
    else if (phone && !/^\d{7,15}$/.test(phone)) setError('Phone should be 7–15 digits.');
    else setError(null);
  }, [email, phone]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 md:grid-cols-12">
      {/* Left: Form */}
      <div className="md:col-span-7">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Enter your details</h1>
          <p className="mt-1 text-gray-600">We’ll use this to confirm your ride.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Pickup Location</label>
              <input
                type="text"
                placeholder="e.g., Hitech City Metro Gate 1"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white shadow ${
                  canSubmit && !submitting
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-green-400 cursor-not-allowed"
                }`}
              >
                {submitting ? "Booking…" : "Confirm Booking"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right: Sticky Summary */}
      <aside className="md:col-span-5">
        <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Trip</span>
              <span className="font-medium">{tripTypeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span>Route</span>
              <span className="font-medium">{from} → {to}</span>
            </div>
            <div className="flex justify-between">
              <span>Pickup</span>
              <span className="font-medium">{date} {time !== "—" ? `• ${time}` : ""}</span>
            </div>
            <div className="flex justify-between">
              <span>Vehicle</span>
              <span className="font-medium">{car}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-gray-600">Estimated Fare</span>
              <span className="text-xl font-bold text-blue-600">₹{fare}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Final fare may vary based on tolls, parking, and waiting time.
          </p>
        </div>
      </aside>
    </div>
  );
}
