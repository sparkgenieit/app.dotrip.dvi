'use client';
import { useSearchParams } from 'next/navigation';
import BookingForm from '../../components/BookingForm';

export default function BookingPage() {
  const searchParams = useSearchParams();
  const vehicleId = parseInt(searchParams.get('vehicleId') || '0', 10);

  return (
    
      <BookingForm />
   
  );
}
