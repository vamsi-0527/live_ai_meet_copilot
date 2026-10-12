"use server";

import { cookies } from "next/headers";

export async function saveApiKey(key: string) {
  // Store as an HttpOnly secure cookie
  // Max-age: 30 days
  cookies().set("groqApiKey", key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function removeApiKey() {
  cookies().delete("groqApiKey");
}
