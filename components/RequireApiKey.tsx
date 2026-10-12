"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasApiKey } from '@/lib/apiKey';

interface RequireApiKeyProps {
  children: React.ReactNode;
}

export default function RequireApiKey({ children }: RequireApiKeyProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!hasApiKey()) {
      // Redirect to settings if no API key
      router.push('/settings');
    }
  }, [router]);

  // Prevent hydration mismatch by holding off render until effect is run
  if (!isMounted) return null;

  // If API key exists, render children; otherwise, show nothing (redirect handled in useEffect)
  return hasApiKey() ? children : null;
}