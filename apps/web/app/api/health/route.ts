export async function GET() {
  return Response.json({
    status: "ok",
    service: "savemarks",
    milestone: "extraction-spike",
    time: new Date().toISOString(),
  });
}
