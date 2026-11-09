// Runs once when the server starts: the website's migrations and the first administrator.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("@/db/bootstrap");
  await bootstrap();
}
