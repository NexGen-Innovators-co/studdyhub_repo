// src/hooks/useEducationFramework.ts
// Fetches the cascading education framework for a given country code.
// Used in onboarding and education settings.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Country, EducationFramework } from '@/types/Education';

// ─── Session-storage cache helpers ─────────────────────────────
const CACHE_PREFIX = 'studdyhub_edu_framework_';

function getCached(countryCode: string): EducationFramework | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${countryCode}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire after 30 minutes
    if (Date.now() - (parsed._ts ?? 0) > 30 * 60 * 1000) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${countryCode}`);
      return null;
    }
    return parsed.data as EducationFramework;
  } catch {
    return null;
  }
}

function setCache(countryCode: string, data: EducationFramework) {
  try {
    sessionStorage.setItem(
      `${CACHE_PREFIX}${countryCode}`,
      JSON.stringify({ data, _ts: Date.now() })
    );
  } catch {
    // sessionStorage full or unavailable – non-critical
  }
}

// ─── Countries cache ───────────────────────────────────────────
const COUNTRIES_KEY = 'studdyhub_countries';

function getCachedCountries(): Country[] | null {
  try {
    const raw = sessionStorage.getItem(COUNTRIES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._ts ?? 0) > 30 * 60 * 1000) {
      sessionStorage.removeItem(COUNTRIES_KEY);
      return null;
    }
    return parsed.data as Country[];
  } catch {
    return null;
  }
}

function setCachedCountries(data: Country[]) {
  try {
    sessionStorage.setItem(COUNTRIES_KEY, JSON.stringify({ data, _ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

// ─── Hook ──────────────────────────────────────────────────────
export function useEducationFramework(countryCode: string | null) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [framework, setFramework] = useState<EducationFramework | null>(null);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingFramework, setIsLoadingFramework] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch countries on mount
  useEffect(() => {
    let cancelled = false;

    const fetchCountries = async () => {
      // Try cache first
      const cached = getCachedCountries();
      if (cached) {
        setCountries(cached);
        setIsLoadingCountries(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc('get_active_countries');
        if (cancelled) return;

        if (rpcError) {
          setError(rpcError.message);
          setIsLoadingCountries(false);
          return;
        }

        const list = (data as Country[]) ?? [];
        setCountries(list);
        setCachedCountries(list);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load countries');
      } finally {
        if (!cancelled) setIsLoadingCountries(false);
      }
    };

    fetchCountries();
    return () => { cancelled = true; };
  }, []);

  // Fetch framework when country changes
  useEffect(() => {
    if (!countryCode) {
      setFramework(null);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const fetchFramework = async () => {
      // Try cache first
      const cached = getCached(countryCode);
      if (cached) {
        setFramework(cached);
        setIsLoadingFramework(false);
        return;
      }

      setIsLoadingFramework(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_education_framework', {
          p_country_code: countryCode,
        });
        if (cancelled) return;

        if (rpcError) {
          setError(rpcError.message);
          setIsLoadingFramework(false);
          return;
        }

        const fw = data as EducationFramework;
        setFramework(fw);
        if (fw) setCache(countryCode, fw);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'Failed to load education framework');
      } finally {
        if (!cancelled) setIsLoadingFramework(false);
      }
    };

    fetchFramework();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [countryCode]);

  return {
    countries,
    framework,
    isLoadingCountries,
    isLoadingFramework,
    isLoading: isLoadingCountries || isLoadingFramework,
    error,
  };
}
