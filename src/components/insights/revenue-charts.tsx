"use client";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export default function RevenueCharts({
  monthly,
  destinations,
  currency,
  exponent,
}: {
  monthly: { month: string; revenue_minor: string }[];
  destinations: { destination: string; bookings: number }[];
  currency: string;
  exponent: number;
}) {
  const revenue = monthly.map((row) => ({
    month: row.month,
    revenue: Number(row.revenue_minor) / 10 ** exponent,
  }));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="work-panel">
        <h2>Issued revenue</h2>
        <p className="text-sm text-muted-foreground">
          Last six months, after issued credits, in {currency}.
        </p>
        <div
          className="mt-5 h-64"
          role="img"
          aria-label={`Monthly issued revenue in ${currency}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                dataKey="revenue"
                fill="#087363"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="work-panel">
        <h2>Top destinations</h2>
        <p className="text-sm text-muted-foreground">
          Bookings excluding cancellations.
        </p>
        {destinations.length ? (
          <div
            className="mt-5 h-64"
            role="img"
            aria-label="Bookings by destination"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={destinations} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="destination"
                  width={105}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar
                  isAnimationActive={false}
                  dataKey="bookings"
                  fill="#407e9b"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-sm text-muted-foreground">
            Create a booking to see which destinations your travelers choose.
          </p>
        )}
      </section>
    </div>
  );
}
