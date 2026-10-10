export default function AccessRequired() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">
        Workspace access is not enabled
      </h1>
      <p>
        Login is scheduled for the final implementation phase. Use npm run dev
        to open the local consultant workspace. Hosted business data remains
        protected.
      </p>
    </main>
  );
}
