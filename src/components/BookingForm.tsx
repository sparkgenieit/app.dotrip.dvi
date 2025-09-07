'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';


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
// user inputs
const [pickupLocation, setPickupLocation] = useState('');
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');

// --- Places Autocomplete (Pickup) ---
const [pickupSuggestions, setPickupSuggestions] = useState<
  { description: string; place_id: string }[]
>([]);
const pickupController = useRef<AbortController | null>(null);
const pickupSession = useRef(uuidv4());

// call backend proxy: GET /places/autocomplete?input=...&sessiontoken=...
async function fetchPickupSuggestions(input: string, fromCityName: string) {
  pickupController.current?.abort();
  pickupController.current = new AbortController();
  try {
    const res = await fetchWithRefresh(
      `/places/autocomplete?input=${encodeURIComponent(
        `${fromCityName} ${input}`.trim()
      )}&sessiontoken=${pickupSession.current}`,
      {
        signal: pickupController.current.signal as any,
        // headers not required here; fetchWithRefresh handles auth if needed
      }
    );
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    const data = await res.json();
    // expect: array like [{ description, place_id }, ...]
    setPickupSuggestions(Array.isArray(data) ? data : []);
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.error('pickup autocomplete failed:', err);
    }
    setPickupSuggestions([]);
  }
}


  // OTP state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);          // seconds remaining for resend
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const otpVerifiedRef = useRef(false);
  // store booking payload until OTP verified
  const [pendingPayload, setPendingPayload] = useState<any | null>(null);


  // derived from query
  const from = sp.get('from_city_name') || '—';
  const to = sp.get('to_city_name') || '—';
  const date = sp.get('pickup_date') || '—';
  const time = sp.get('pickup_time') || '—';
  const car = sp.get('car') || '—';
  const fare = sp.get('fare') || '—';
  const tripTypeLabel = sp.get('trip_type_label') || 'Trip';
  const returnDate = sp.get('return_date') || '';
  const isRoundTrip = (tripTypeLabel || '').toUpperCase() === 'ROUND TRIP';
  const returnTime = sp.get('return_time') || '';

  // ---- OTP endpoints (adjust to your backend if different) ----
const OTP_SEND_URL = '/auth/otp/send';
const OTP_VERIFY_URL = '/auth/otp/verify';

// Send OTP to phone
async function sendOtp(toPhone: string) {
  // Testing mode: no backend call — just open the modal
  setShowOtpModal(true);
  setOtp('');
  setOtpVerified(false);
  otpVerifiedRef.current = false;  // <-- reset the guard ref
  setOtpRequestId('mock');
  setOtpTimer(60);                  // resend cooldown
  setOtpSending(false);
  setError(null);
}

// Verify OTP; on success proceed with booking
async function verifyOtpAndBook() {
  if (!phone || !otp) return;
  setOtpVerifying(true);
  setError(null);

  try {
    // ✅ Testing mode: only "1234" is accepted
    if (otp.trim() !== '1234') {
      throw new Error('Invalid OTP. Use 1234 for testing.');
    }

    // Mark verified BEFORE creating booking to avoid any race
    otpVerifiedRef.current = true;
    setOtpVerified(true);
    setShowOtpModal(false);

    // Build payload and create booking
    const payload = await buildPayload();
    if (!payload) return;
    await createBooking(payload);
  } catch (e: any) {
    setError(e?.message || 'OTP verification failed');
  } finally {
    setOtpVerifying(false);
  }
}

// Final guard: do not create a booking unless OTP is verified.
// If someone calls this by mistake, we open the OTP modal instead.
async function createBooking(payload: any) {
  if (!otpVerified && !otpVerifiedRef.current) {
    setPendingPayload(payload);
    setShowOtpModal(true);
    return;
  }

  const res = await fetchWithRefresh('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
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
    return;
  }

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

  if (createdId) {
    try { sessionStorage.setItem('lastBookingId', String(createdId)); } catch {}
    router.push(`/booking-confirmation?id=${createdId}`);
  } else {
    console.warn('Booking created but no id was returned.');
    router.push('/booking-confirmation');
  }
}

  // basic “required” check
  const canSubmit = pickupLocation.trim() && name.trim() && email.trim() && phone.trim();

  // ADD — normalize "H:mm" → "HH:mm"
function toHHmm(t: string) {
  if (!t || typeof t !== 'string') return '';
  const m = t.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return '';
  const hh = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${hh}:${m[2]}`;
}

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  await onConfirmClick();
}

async function buildPayload(): Promise<any | null> {
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
    return null;
  }

  // Parse fare safely
  const fareNum = Number(String(fare || 0).replace(/[^\d.]/g, '') || 0);

  // Validate pickup date/time for the new DTO
  const pickupDateISO = String(date);            // expected "YYYY-MM-DD"
  const pickupTimeHHmm = toHHmm(String(time));   // normalize "H:mm" -> "HH:mm"

  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDateISO)) {
    setError('pickupDate must be YYYY-MM-DD');
    return null;
  }
  if (!/^[0-2]\d:[0-5]\d$/.test(pickupTimeHHmm)) {
    setError('pickupTime must be HH:mm');
    return null;
  }

  // Optional return parts for round trip
  const returnTimeHHmm = returnTime ? toHHmm(String(returnTime)) : '';

  if (isRoundTrip && returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
    setError('returnDate must be YYYY-MM-DD');
    return null;
  }
  if (isRoundTrip && returnTime && !/^[0-2]\d:[0-5]\d$/.test(returnTimeHHmm)) {
    setError('returnTime must be HH:mm');
    return null;
  }

  // Send split fields as your new backend expects
  return {
    phone,
    pickupLocation,
    dropoffLocation: to,

    // NEW: split fields
    pickupDate: pickupDateISO,       // "YYYY-MM-DD"
    pickupTime: pickupTimeHHmm,      // "HH:mm"
    ...(isRoundTrip && returnDate ? { returnDate } : {}),
    ...(isRoundTrip && returnTimeHHmm ? { returnTime: returnTimeHHmm } : {}),

    fromCityId,
    toCityId,
    tripTypeId,
    vehicleTypeId,
    fare: fareNum,

    // ensure required by DTO
    numPersons: 1,
    numVehicles: 1,
  };
}

async function onConfirmClick() {
  if (!pickupLocation.trim() || !name.trim() || !email.trim() || !phone.trim()) {
    setError('Please fill all required fields.');
    return;
  }
  if (!/^\d{7,15}$/.test(phone.trim())) {
    setError('Enter a valid phone number to receive OTP.');
    return;
  }
  setError(null);
  await sendOtp(phone); // opens modal immediately; booking happens after verify
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

  // Debounce pickup autocomplete calls
useEffect(() => {
  const ctrl = pickupController.current;
  const val = pickupLocation.trim();

  // need a little input and a from-city to bias results
  if (val.length < 2) {
    setPickupSuggestions([]);
    return;
  }

  const fromCityName = (from || '').replace('—', '').trim();
  if (!fromCityName) {
    // still allow without from-city context
  }

  const t = setTimeout(() => {
    fetchPickupSuggestions(val, fromCityName);
  }, 300);

  return () => {
    clearTimeout(t);
    ctrl?.abort();
  };
}, [pickupLocation, from]);

  // Reset OTP state when phone changes
useEffect(() => {
  setOtpVerified(false);
  setOtp('');
  setOtpRequestId(null);
}, [phone]);

  // OTP resend countdown tick
  useEffect(() => {
    if (!showOtpModal || otpTimer <= 0) return;
    const id = setTimeout(() => setOtpTimer((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [showOtpModal, otpTimer]);

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
            <div className="relative">
  <label className="mb-1 block text-sm font-medium text-gray-700">Pickup Location</label>
  <input
    type="text"
    placeholder="e.g., Hitech City Metro Gate 1"
    value={pickupLocation}
    onChange={(e) => setPickupLocation(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Escape') setPickupSuggestions([]);
    }}
    onBlur={() => {
      // small delay so a click on a suggestion still registers
      setTimeout(() => setPickupSuggestions([]), 150);
    }}
    autoComplete="off"
    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
  />

  {pickupSuggestions.length > 0 && (
    <ul
      role="listbox"
      className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg"
    >
      {pickupSuggestions.map((s) => (
        <li
          key={s.place_id}
          role="option"
          tabIndex={0}
          onMouseDown={(e) => e.preventDefault()} // keep focus on input
          onClick={() => {
            setPickupLocation(s.description);
            setPickupSuggestions([]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPickupLocation(s.description);
              setPickupSuggestions([]);
            }
          }}
          className="cursor-pointer px-3 py-2 hover:bg-gray-100"
        >
          {s.description}
        </li>
      ))}
    </ul>
  )}
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
              type="button"
              onClick={onConfirmClick}
              disabled={!canSubmit || submitting}
              className={`rounded-lg px-5 py-2 text-sm font-semibold text-white shadow ${
                canSubmit && !submitting
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-green-400 cursor-not-allowed"
              }`}
            >
              Confirm Booking
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
            {isRoundTrip && (returnDate || returnTime) && (
                <div className="flex justify-between">
                  <span>Return</span>
                  <span className="font-medium">
                    {returnDate}{returnTime ? ` • ${toHHmm(returnTime)}` : ''}
                  </span>
                </div>
              )}

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
      {showOtpModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">OTP sent to {phone}</h3>
              <button
                onClick={() => setShowOtpModal(false)}
                className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter OTP sent to your number"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="mb-3 text-xs text-gray-500">
              Testing mode: use <b>1234</b> as the OTP.
            </p>


            <button
                type="button"
                onClick={verifyOtpAndBook}
                disabled={!otp || otpVerifying}
                className={`mb-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white shadow ${
                  !otp || otpVerifying ? 'cursor-not-allowed bg-orange-300' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
              {otpVerifying ? 'Verifying…' : 'Verify OTP'}
            </button>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <button
                onClick={() => otpTimer === 0 && sendOtp(phone)}
                disabled={otpTimer > 0 || otpSending}
                className={`underline ${otpTimer > 0 ? 'cursor-not-allowed text-gray-400 no-underline' : ''}`}
              >
                {otpTimer > 0 ? `Resend OTP in 00:${String(otpTimer).padStart(2, '0')}` : (otpSending ? 'Sending…' : 'Resend OTP')}
              </button>
              <span>Valid for 15 minutes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
