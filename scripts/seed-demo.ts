import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const env = z.object({ NEXT_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SERVICE_ROLE_KEY: z.string().min(20) }).parse(process.env);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function insertIfMissing(table: string, rows: { id: string; [key: string]: unknown }[]) {
  // Stable UUIDs + ignoreDuplicates preserve any edits made to demo records on repeat runs.
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function seedDemo() {
  await insertIfMissing('customers', [
    { id: 'de000000-0000-4000-8000-000000000001', name: 'Amelia Carter', kind: 'individual', email: 'amelia@example.com', phone: '+44 7700 900101', nationality: 'British', lead_status: 'quoted', tags: ['family','Sri Lanka'], notes: 'Interested in wildlife and a relaxed coastal stay.' },
    { id: 'de000000-0000-4000-8000-000000000002', name: 'Northern Trails Ltd', kind: 'company', company_name: 'Northern Trails Ltd', email: 'groups@example.com', phone: '+44 7700 900102', lead_status: 'contacted', tags: ['corporate','group'], notes: 'Planning an incentive trip for eight travelers.' },
  ]);
  await insertIfMissing('suppliers', [
    { id: 'de000000-0000-4000-8000-000000000011', name: 'Ceylon Garden Lodge', kind: 'hotel', email: 'reservations@example.com', contact_name: 'Nimali Perera', payment_terms: '30% deposit, balance 14 days before arrival' },
    { id: 'de000000-0000-4000-8000-000000000012', name: 'Island Journey Transport', kind: 'transport', email: 'transport@example.com', contact_name: 'Dilan Silva', payment_terms: 'Payment within 7 days of departure' },
  ]);
  await insertIfMissing('services', [
    { id: 'de000000-0000-4000-8000-000000000021', supplier_id: 'de000000-0000-4000-8000-000000000011', name: 'Garden lodge double room / night', category: 'hotel', currency: 'USD', cost_minor: 9500, selling_minor: 12500, tax_rate: 0 },
    { id: 'de000000-0000-4000-8000-000000000022', supplier_id: 'de000000-0000-4000-8000-000000000012', name: 'Private vehicle and driver / day', category: 'transport', currency: 'USD', cost_minor: 7000, selling_minor: 9500, tax_rate: 0 },
  ]);
  await insertIfMissing('itineraries', [{
    id: 'de000000-0000-4000-8000-000000000031', customer_id: 'de000000-0000-4000-8000-000000000001', title: 'Sri Lanka Discovery', destination: 'Sri Lanka',
    start_date: '2027-02-12', end_date: '2027-02-14', traveler_count: 2, currency: 'USD', summary: 'Culture, wildlife and warm island hospitality.',
    inclusions: 'Private transport, accommodation and breakfast', exclusions: 'International flights and personal expenses',
  }]);
  await insertIfMissing('itinerary_days', [
    { id: 'de000000-0000-4000-8000-000000000041', itinerary_id: 'de000000-0000-4000-8000-000000000031', day_number: 1, date: '2027-02-12', title: 'Arrival and Sigiriya', description: 'Meet your driver and transfer to Sigiriya.', accommodation: 'Ceylon Garden Lodge', meals: 'Breakfast' },
    { id: 'de000000-0000-4000-8000-000000000042', itinerary_id: 'de000000-0000-4000-8000-000000000031', day_number: 2, date: '2027-02-13', title: 'Rock fortress and safari', description: 'Visit Sigiriya and enjoy an afternoon wildlife safari.', accommodation: 'Ceylon Garden Lodge', meals: 'Breakfast' },
    { id: 'de000000-0000-4000-8000-000000000043', itinerary_id: 'de000000-0000-4000-8000-000000000031', day_number: 3, date: '2027-02-14', title: 'Colombo and departure', description: 'Explore Colombo before your airport transfer.', meals: 'Breakfast' },
  ]);
  await insertIfMissing('activities', [{ id: 'de000000-0000-4000-8000-000000000051', customer_id: 'de000000-0000-4000-8000-000000000001', kind: 'note', summary: 'Discovery call completed. Requested a private cultural itinerary.' }]);
  console.log('Demo customers, suppliers, services and itinerary seeded. Run seed:admin for your environment-configured demo login.');
}

seedDemo().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo seeding failed');
  process.exitCode = 1;
});
