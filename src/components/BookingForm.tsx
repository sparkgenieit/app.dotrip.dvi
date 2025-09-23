'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchWithRefresh } from '../utils/auth';
import { v4 as uuidv4 } from 'uuid';


// --- Helpers ---

// === ADD: token helpers ===
const AUTH_TOKEN_KEY = 'access_token';

function setAuthToken(token: string) {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
  try { sessionStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

// normalize phone to digits only (server expects your OTP format)
function normalizePhone(raw: string) {
  return String(raw || '').replace(/\D/g, '');
}

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
const verifiedPhoneRef = useRef<string | null>(null);

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

// === WITH: real endpoints (adjust if your backend paths differ) ===
// === REPLACE THESE LINES ===
// const OTP_SEND_URL = '/auth/otp/send';
// const OTP_VERIFY_URL = '/auth/otp/verify';
async function prefillFromMe() {
  try {
    const res = await fetchWithRefresh('/users/me');
    if (!res.ok) return;
    const me = await res.json().catch(() => null);
    if (!me) return;

    if (me.name) setName(String(me.name));
    if (me.email) setEmail(String(me.email));
if (me.phone) {
  setPhone(prev => (prev ? prev : String(me.phone)));
}
    // ✅ prefill pickup from the latest non-empty PICKUP address
    if (Array.isArray(me.addressBooks)) {
      const sorted = [...me.addressBooks]
        .filter(a => a.type === 'PICKUP' && a.address && a.address.trim()) // only valid pickups
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (!pickupLocation && sorted.length > 0) {
        setPickupLocation(sorted[0].address!);
      }
    }
  } catch (e) {
    console.error('prefillFromMe failed:', e);
  }
}

// === WITH: real endpoints (adjust if your backend paths differ) ===
const OTP_SEND_PATH = `/auth/send-otp`;
const OTP_VERIFY_PATH = `/auth/verify-otp`;

async function sendOtp(toPhone: string) {
  const phoneDigits = normalizePhone(toPhone);
  setOtpSending(true);
  setError(null);
  try {
    const res = await fetchWithRefresh(OTP_SEND_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: phoneDigits }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `Failed to send OTP (${res.status})`);
    }

    setShowOtpModal(true);
    setOtp('');
    setOtpVerified(false);
    otpVerifiedRef.current = false;
    setOtpRequestId('server');
    setOtpTimer(60);
  } catch (e: any) {
    setError(e?.message || 'Could not send OTP. Please try again.');
  } finally {
    setOtpSending(false);
  }
}

// Verify OTP; on success proceed with booking
// === REPLACE ENTIRE verifyOtpAndBook() WITH: ===
async function verifyOtpAndBook() {
  const phoneDigits = normalizePhone(phone);
  if (!phoneDigits || !otp) return;
  setOtpVerifying(true);
  setError(null);

  try {
    const res = await fetchWithRefresh('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: phoneDigits, otp: otp.trim() }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `OTP verification failed (${res.status})`);
    }

    const data = await res.json().catch(() => ({}));
    const token = data?.access_token || data?.accessToken || data?.token;
    if (!token) throw new Error('No access_token returned by /auth/verify-otp');
    setAuthToken(token);
    verifiedPhoneRef.current = normalizePhone(phone);  // ✅ save the verified phone
    otpVerifiedRef.current = true;
    setOtpVerified(true);
    setShowOtpModal(false);
    await prefillFromMe();
    setError(null);
  } catch (e: any) {
    setError(e?.message || 'OTP verification failed');
  } finally {
    setOtpVerifying(false);
  }
}




// Final guard: do not create a booking unless OTP is verified.
// If someone calls this by mistake, we open the OTP modal instead.
// === REPLACE ENTIRE createBooking() WITH: ===
async function createBooking(payload: any) {
  const token = getAuthToken();
  if (!token) {
    // no token and not verified → open OTP
    if (!otpVerified && !otpVerifiedRef.current) {
      setPendingPayload(payload);
      setShowOtpModal(true);
      return;
    }
    setError('Session expired. Please verify OTP again.');
    return;
  }
console.log('Creating booking with payload:', token, payload);
  const res = await fetchWithRefresh('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // Authorization is added by fetchWithRefresh if token exists
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

  // Expect date like "YYYY-MM-DD" and time like "HH:mm"
  const dateStr = String(date || '').trim();          // e.g. "2025-05-05"
  const timeStr = String(time || '').trim();          // e.g. "07:00"

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    setError('pickupDate must be YYYY-MM-DD');
    return null;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
    setError('pickupTime must be HH:mm');
    return null;
  }

  // Parse fare safely
  const fareNum = Number(String(fare || 0).replace(/[^\d.]/g, '') || 0);

  // Round-trip validation (optional returnDate / returnTime)
  const rtDate = String(returnDate || '').trim();
  if (tripLabel === 'ROUND TRIP' && !/^\d{4}-\d{2}-\d{2}$/.test(rtDate)) {
    setError('Please select a valid return date for a round trip.');
    return null;
  }

  // ✅ Send the fields that the server DTO expects
  return {
    phone,                              // ignored for RIDER; used for ADMIN/VENDOR
    pickupLocation,
    dropoffLocation: to,

    pickupDate: dateStr,                // <-- date-only
    pickupTime: timeStr,                // <-- HH:mm

    ...(tripLabel === 'ROUND TRIP' && rtDate ? { returnDate: rtDate } : {}),

    fromCityId,
    toCityId,
    tripTypeId,
    vehicleTypeId,
    fare: fareNum,
    numPersons: 4,
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

  const token = getAuthToken();
  if (token) {
    // already authenticated → create booking directly
    const payload = await buildPayload();
    if (!payload) return;
    await createBooking(payload);
    return;
  }

  // no token → require OTP
  await sendOtp(phone);
}




async function handlePhoneBlur() {
  const digits = phone.trim();

  // Basic validation: must be 7–15 digits
  if (!/^\d{7,15}$/.test(digits)) return;

  // Skip if OTP already verified or token exists
  if (otpVerified || getAuthToken()) return;

  try {
    // Trigger OTP send immediately
    await sendOtp(digits);
  } catch (e) {
    console.error('Auto OTP send failed on blur:', e);
  }
}

useEffect(() => {
  const token = getAuthToken();
  if (token) {
    // already logged in from an earlier step/session
    prefillFromMe();
  }
}, []);


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
            {isRoundTrip && returnDate && (
              <div className="flex justify-between">
                <span>Return</span>
                <span className="font-medium">{returnDate}</span>
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
