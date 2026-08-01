export async function GET() {
  return Response.json({
    status: "ok",
    service: "savemarks",
    version: 1,
    time: new Date().toISOString(),
  });
}
