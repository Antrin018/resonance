import { NextResponse } from "next/server";
import { Buffer } from "buffer";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "13b49f0f9a0f409a839d649518c508d1";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? "2b0471eefe294256b1d68597663a360c";

type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error("Spotify token error:", errorBody);
    throw new Error("Failed to obtain Spotify access token");
  }

  const tokenData = await tokenResponse.json();
  const expiresInMs = (tokenData.expires_in ?? 3600) * 1000;
  cachedToken = {
    value: tokenData.access_token,
    expiresAt: now + expiresInMs - 60 * 1000, // Refresh a minute early
  };

  return cachedToken.value;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = searchParams.get("limit") ?? "10";

  if (!query) {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken();

    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/search?${new URLSearchParams({
        q: query,
        type: "track",
        limit,
      }).toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!spotifyResponse.ok) {
      const errorBody = await spotifyResponse.text();
      console.error("Spotify search error:", errorBody);
      return NextResponse.json({ error: "Spotify search failed" }, { status: 500 });
    }

    const data = await spotifyResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Spotify search exception:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

