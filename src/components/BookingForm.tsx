'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';

// --- Helpers ---
// Safe JSON parse (handles empty 201/204 responses)
async function safeJson<T = any>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

// "2025-05-05" + "07:00" -> ISO string
function toISO(date: string, time: string) {
  const d = new Date(`${date}T${time || '00:00'}:00`);
  return d.toISOString();
}

// Lookup: "Kolkata, West Bengal" -> city.id
async function getCityIdByLabel(label: string): Promise<number | null> {
  const [name, state] = label.split(',').map(s => s.trim());
  const res = await fetchWithRefresh('/cities');
  if (!res.ok) return null;
  const list = await res.json();
  const found = list.find((c: any) =>
    c.name?.toLowerCase() === (name || '').toLowerCase() &&
    c.state?.toLowerCase() === (state || '').toLowerCase()
  );
  return found?.id ?? null;
}

// Lookup: "Sedan" -> vehicleType.id
async function getVehicleTypeIdByName(name: string): Promise<number | null> {
  const res = await fetchWithRefresh('/vehicle-types');
  if (!res.ok) return null;
  const list = await res.json();
  const found = list.find((v: any) => v.name?.toLowerCase() === name.toLowerCase());
  return found?.id ?? null;
}

// Lookup: "AIRPORT" -> tripType.id (API first, fallback map)
async function getTripTypeId(label: string): Promise<number | null> {
  try {
    const r = await fetchWithRefresh('/trip-types');
    if (r.ok) {
      const list = await r.json();
      const found = list.find((t: any) => (t.name || t.label)?.toLowerCase() === label.toLowerCase());
      if (found?.id) return found.id;
    }
  } catch {}
  const fallback: Record<string, number> = { 'ONE WAY': 1, 'ROUND TRIP': 2, 'LOCAL': 3, 'AIRPORT': 4 };
  return fallback[label.toUpperCase()] ?? null;
}

type AddressType = 'HOME' | 'OFFICE' | 'OTHER' | 'PICKUP' | 'DROP';
interface AddressLite {
  id: number;
  type: AddressType;
  address?: string | null;
  city?: string | null;
  pinCode?: string | null;
  createdAt: string; // ISO string
}
interface CheckPhoneResponse {
  exists: boolean;
  user?: { id: number; name: string; phone: string };
  addresses?: AddressLite[];
}

// Keep only the newest address per type
function latestPerType(addresses: AddressLite[] = []): AddressLite[] {
  const sorted = [...addresses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const seen = new Set<AddressType>();
  const out: AddressLite[] = [];
  for (const a of sorted) {
    if (!seen.has(a.type)) {
      out.push(a);
      seen.add(a.type);
    }
  }
  return out;
}

// Call backend: POST /users/check-phone
async function fetchUserByPhone(phone: string): Promise<CheckPhoneResponse> {
  try {
    const res = await fetchWithRefresh('/users/check-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) return { exists: false };

    const data = await res.json().catch(() => null) || {};
    const rawAddresses: AddressLite[] = data.addresses ?? data.user?.addressBooks ?? [];
    const deduped = latestPerType(rawAddresses);

    return {
      exists: Boolean(data?.exists),
      user: data?.user
        ? {
            id: Number(data.user.id),
            name: String(data.user.name ?? ''),
            phone: String(data.user.phone ?? ''),
          }
        : undefined,
      addresses: deduped,
    };
  } catch (e) {
    console.error('check-phone failed:', e);
    return { exists: false };
  }
}

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
    // Resolve IDs required by backend
    const tripLabel = (tripTypeLabel || '').toUpperCase();
    const [fromCityId, toCityId, vehicleTypeId, tripTypeId] = await Promise.all([
      getCityIdByLabel(from),
      getCityIdByLabel(to),
      getVehicleTypeIdByName(car),
      getTripTypeId(tripLabel),
    ]);

    if (!fromCityId || !toCityId || !vehicleTypeId || !tripTypeId) {
      setError('Could not resolve city/vehicle/trip type. Please revise your selection.');
      setSubmitting(false);
      return;
    }

    // Parse fare safely (strip any non-digits just in case)
    const fareNum = Number(String(fare || 0).replace(/[^\d.]/g, '') || 0);

    // Flat DTO expected by backend
    const payload = {
      phone,                                   // string
      pickupLocation,                          // string
      dropoffLocation: to,                     // string
      pickupDateTime: toISO(date, time),       // ISO 8601
      fromCityId,                              // number
      toCityId,                                // number
      tripTypeId,                              // number
      vehicleTypeId,                           // number
      fare: fareNum,                           // number
      // NOTE: name/email are not in the backend DTO; omitted on purpose
    };

    const res = await fetchWithRefresh('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Show nice validation errors from Nest (message: string[])
      const txt = await res.text().catch(() => '');
      try {
        const body = JSON.parse(txt);
        if (Array.isArray(body?.message)) {
          setError(body.message.join(' • '));
        } else if (typeof body?.error === 'string') {
          setError(`${body.error}${body?.statusCode ? ` (${body.statusCode})` : ''}`);
        } else {
          setError(`Create booking failed (${res.status})`);
        }
      } catch {
        setError(`Create booking failed (${res.status}) ${txt}`);
      }
      setSubmitting(false);
      return;
    }

    // Extract created booking id from JSON or headers
    const data = await safeJson<{ id?: number }>(res);
    let createdId = data?.id ?? null;

    if (!createdId) {
      const loc = res.headers.get('Location') || res.headers.get('location') || '';
      const last = Number(loc.split('/').pop());
      if (Number.isFinite(last)) createdId = last;
    }
    if (!createdId) {
      const hdr = res.headers.get('x-booking-id');
      const num = hdr ? Number(hdr) : NaN;
      if (Number.isFinite(num)) createdId = num;
    }

    // Store a fallback so confirmation can recover even without ?id=
    if (createdId) {
      try { sessionStorage.setItem('lastBookingId', String(createdId)); } catch {}
      router.push(`/booking-confirmation?id=${createdId}`);
    } else {
      console.warn('Booking created but no id was returned.');
      router.push('/booking-confirmation');
    }
  } catch (err: any) {
    console.error(err);
    setError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setSubmitting(false);
  }
}

async function handlePhoneBlur() {
  const digits = phone.trim();
  if (!/^\d{7,15}$/.test(digits)) return; // soft guard

  const { exists, user, addresses } = await fetchUserByPhone(digits);
  if (!exists || !user) return;

  // Prefill name if empty
  if (!name && user.name) setName(user.name);

  // Prefill pickup from latest PICKUP address if available
  const pickup = addresses?.find(a => a.type === 'PICKUP');
  if (!pickupLocation && pickup?.address) {
    setPickupLocation(pickup.address);
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
                          <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handlePhoneBlur} // ← fetch /users/check-phone and prefill
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
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
