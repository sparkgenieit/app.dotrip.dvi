'use client';
import { useSearchParams } from 'next/navigation';
import BookingForm from '../../components/BookingForm';

export default function BookingPage() {
  const searchParams = useSearchParams();
  const vehicleId = parseInt(searchParams.get('vehicleId') || '0', 10);

  return (
    <div className="max-w-xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Book Your Ride</h1>
      <BookingForm vehicleId={vehicleId} />
    </div>
  );
}
