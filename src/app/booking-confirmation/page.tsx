// app/booking-confirmation/[id]/page.tsx
'use client';
import { useSearchParams } from 'next/navigation';
import BookingConfirmation from '../../components/BookingConfirmation';
export default function Page() {
          const searchParams = useSearchParams();
     const bookingId = parseInt(searchParams.get('id') || '0');



  return <BookingConfirmation bookingId={bookingId} />;
}
