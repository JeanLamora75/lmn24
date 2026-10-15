-- SCRUM-69 - LMN24: exactly 66 initial weather cities (15/15/12/12/6/6).
-- Run AFTER database/migrations/011_weather_data_model.sql.
-- Non-destructive/replayable: pre-existing rows are preserved, not overwritten.
-- If a city cannot be inserted due to a different slug occupying its order,
-- the assertion fails and the transaction rolls back rather than silently losing cities.
BEGIN;

INSERT INTO public.weather_city
  (slug, name, country_iso2, continent_code, latitude, longitude, timezone, display_order, is_active)
VALUES
  ('paris', 'Paris', 'FR', 'EU', 48.8566, 2.3522, 'Europe/Paris', 1, TRUE),
  ('london', 'London', 'GB', 'EU', 51.5074, -0.1278, 'Europe/London', 2, TRUE),
  ('berlin', 'Berlin', 'DE', 'EU', 52.5200, 13.4050, 'Europe/Berlin', 3, TRUE),
  ('madrid', 'Madrid', 'ES', 'EU', 40.4168, -3.7038, 'Europe/Madrid', 4, TRUE),
  ('rome', 'Rome', 'IT', 'EU', 41.9028, 12.4964, 'Europe/Rome', 5, TRUE),
  ('lisbon', 'Lisbon', 'PT', 'EU', 38.7223, -9.1393, 'Europe/Lisbon', 6, TRUE),
  ('brussels', 'Brussels', 'BE', 'EU', 50.8503, 4.3517, 'Europe/Brussels', 7, TRUE),
  ('amsterdam', 'Amsterdam', 'NL', 'EU', 52.3676, 4.9041, 'Europe/Amsterdam', 8, TRUE),
  ('warsaw', 'Warsaw', 'PL', 'EU', 52.2297, 21.0122, 'Europe/Warsaw', 9, TRUE),
  ('vienna', 'Vienna', 'AT', 'EU', 48.2082, 16.3738, 'Europe/Vienna', 10, TRUE),
  ('stockholm', 'Stockholm', 'SE', 'EU', 59.3293, 18.0686, 'Europe/Stockholm', 11, TRUE),
  ('athens', 'Athens', 'GR', 'EU', 37.9838, 23.7275, 'Europe/Athens', 12, TRUE),
  ('kyiv', 'Kyiv', 'UA', 'EU', 50.4501, 30.5234, 'Europe/Kyiv', 13, TRUE),
  ('istanbul', 'Istanbul', 'TR', 'EU', 41.0082, 28.9784, 'Europe/Istanbul', 14, TRUE),
  ('moscow', 'Moscow', 'RU', 'EU', 55.7558, 37.6173, 'Europe/Moscow', 15, TRUE),
  ('tokyo', 'Tokyo', 'JP', 'AS', 35.6762, 139.6503, 'Asia/Tokyo', 1, TRUE),
  ('seoul', 'Seoul', 'KR', 'AS', 37.5665, 126.9780, 'Asia/Seoul', 2, TRUE),
  ('beijing', 'Beijing', 'CN', 'AS', 39.9042, 116.4074, 'Asia/Shanghai', 3, TRUE),
  ('shanghai', 'Shanghai', 'CN', 'AS', 31.2304, 121.4737, 'Asia/Shanghai', 4, TRUE),
  ('hong-kong', 'Hong Kong', 'HK', 'AS', 22.3193, 114.1694, 'Asia/Hong_Kong', 5, TRUE),
  ('taipei', 'Taipei', 'TW', 'AS', 25.0330, 121.5654, 'Asia/Taipei', 6, TRUE),
  ('singapore', 'Singapore', 'SG', 'AS', 1.3521, 103.8198, 'Asia/Singapore', 7, TRUE),
  ('bangkok', 'Bangkok', 'TH', 'AS', 13.7563, 100.5018, 'Asia/Bangkok', 8, TRUE),
  ('manila', 'Manila', 'PH', 'AS', 14.5995, 120.9842, 'Asia/Manila', 9, TRUE),
  ('jakarta', 'Jakarta', 'ID', 'AS', -6.2088, 106.8456, 'Asia/Jakarta', 10, TRUE),
  ('new-delhi', 'New Delhi', 'IN', 'AS', 28.6139, 77.2090, 'Asia/Kolkata', 11, TRUE),
  ('mumbai', 'Mumbai', 'IN', 'AS', 19.0760, 72.8777, 'Asia/Kolkata', 12, TRUE),
  ('dubai', 'Dubai', 'AE', 'AS', 25.2048, 55.2708, 'Asia/Dubai', 13, TRUE),
  ('riyadh', 'Riyadh', 'SA', 'AS', 24.7136, 46.6753, 'Asia/Riyadh', 14, TRUE),
  ('tashkent', 'Tashkent', 'UZ', 'AS', 41.2995, 69.2401, 'Asia/Tashkent', 15, TRUE),
  ('cairo', 'Cairo', 'EG', 'AF', 30.0444, 31.2357, 'Africa/Cairo', 1, TRUE),
  ('casablanca', 'Casablanca', 'MA', 'AF', 33.5731, -7.5898, 'Africa/Casablanca', 2, TRUE),
  ('algiers', 'Algiers', 'DZ', 'AF', 36.7538, 3.0588, 'Africa/Algiers', 3, TRUE),
  ('dakar', 'Dakar', 'SN', 'AF', 14.7167, -17.4677, 'Africa/Dakar', 4, TRUE),
  ('abidjan', 'Abidjan', 'CI', 'AF', 5.3600, -4.0083, 'Africa/Abidjan', 5, TRUE),
  ('lagos', 'Lagos', 'NG', 'AF', 6.5244, 3.3792, 'Africa/Lagos', 6, TRUE),
  ('accra', 'Accra', 'GH', 'AF', 5.6037, -0.1870, 'Africa/Accra', 7, TRUE),
  ('kinshasa', 'Kinshasa', 'CD', 'AF', -4.4419, 15.2663, 'Africa/Kinshasa', 8, TRUE),
  ('nairobi', 'Nairobi', 'KE', 'AF', -1.2921, 36.8219, 'Africa/Nairobi', 9, TRUE),
  ('addis-ababa', 'Addis Ababa', 'ET', 'AF', 9.0300, 38.7400, 'Africa/Addis_Ababa', 10, TRUE),
  ('johannesburg', 'Johannesburg', 'ZA', 'AF', -26.2041, 28.0473, 'Africa/Johannesburg', 11, TRUE),
  ('cape-town', 'Cape Town', 'ZA', 'AF', -33.9249, 18.4241, 'Africa/Johannesburg', 12, TRUE),
  ('new-york', 'New York', 'US', 'NA', 40.7128, -74.0060, 'America/New_York', 1, TRUE),
  ('washington-dc', 'Washington, D.C.', 'US', 'NA', 38.9072, -77.0369, 'America/New_York', 2, TRUE),
  ('chicago', 'Chicago', 'US', 'NA', 41.8781, -87.6298, 'America/Chicago', 3, TRUE),
  ('los-angeles', 'Los Angeles', 'US', 'NA', 34.0522, -118.2437, 'America/Los_Angeles', 4, TRUE),
  ('san-francisco', 'San Francisco', 'US', 'NA', 37.7749, -122.4194, 'America/Los_Angeles', 5, TRUE),
  ('miami', 'Miami', 'US', 'NA', 25.7617, -80.1918, 'America/New_York', 6, TRUE),
  ('toronto', 'Toronto', 'CA', 'NA', 43.6532, -79.3832, 'America/Toronto', 7, TRUE),
  ('montreal', 'Montréal', 'CA', 'NA', 45.5017, -73.5673, 'America/Toronto', 8, TRUE),
  ('vancouver', 'Vancouver', 'CA', 'NA', 49.2827, -123.1207, 'America/Vancouver', 9, TRUE),
  ('mexico-city', 'Mexico City', 'MX', 'NA', 19.4326, -99.1332, 'America/Mexico_City', 10, TRUE),
  ('havana', 'Havana', 'CU', 'NA', 23.1136, -82.3666, 'America/Havana', 11, TRUE),
  ('panama-city', 'Panama City', 'PA', 'NA', 8.9824, -79.5199, 'America/Panama', 12, TRUE),
  ('sao-paulo', 'São Paulo', 'BR', 'SA', -23.5505, -46.6333, 'America/Sao_Paulo', 1, TRUE),
  ('rio-de-janeiro', 'Rio de Janeiro', 'BR', 'SA', -22.9068, -43.1729, 'America/Sao_Paulo', 2, TRUE),
  ('buenos-aires', 'Buenos Aires', 'AR', 'SA', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires', 3, TRUE),
  ('santiago', 'Santiago', 'CL', 'SA', -33.4489, -70.6693, 'America/Santiago', 4, TRUE),
  ('lima', 'Lima', 'PE', 'SA', -12.0464, -77.0428, 'America/Lima', 5, TRUE),
  ('bogota', 'Bogotá', 'CO', 'SA', 4.7110, -74.0721, 'America/Bogota', 6, TRUE),
  ('sydney', 'Sydney', 'AU', 'OC', -33.8688, 151.2093, 'Australia/Sydney', 1, TRUE),
  ('melbourne', 'Melbourne', 'AU', 'OC', -37.8136, 144.9631, 'Australia/Melbourne', 2, TRUE),
  ('perth', 'Perth', 'AU', 'OC', -31.9523, 115.8613, 'Australia/Perth', 3, TRUE),
  ('auckland', 'Auckland', 'NZ', 'OC', -36.8485, 174.7633, 'Pacific/Auckland', 4, TRUE),
  ('suva', 'Suva', 'FJ', 'OC', -18.1416, 178.4419, 'Pacific/Fiji', 5, TRUE),
  ('port-moresby', 'Port Moresby', 'PG', 'OC', -9.4438, 147.1803, 'Pacific/Port_Moresby', 6, TRUE)
ON CONFLICT DO NOTHING;

DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM unnest(ARRAY['paris', 'london', 'berlin', 'madrid', 'rome', 'lisbon', 'brussels', 'amsterdam', 'warsaw', 'vienna', 'stockholm', 'athens', 'kyiv', 'istanbul', 'moscow', 'tokyo', 'seoul', 'beijing', 'shanghai', 'hong-kong', 'taipei', 'singapore', 'bangkok', 'manila', 'jakarta', 'new-delhi', 'mumbai', 'dubai', 'riyadh', 'tashkent', 'cairo', 'casablanca', 'algiers', 'dakar', 'abidjan', 'lagos', 'accra', 'kinshasa', 'nairobi', 'addis-ababa', 'johannesburg', 'cape-town', 'new-york', 'washington-dc', 'chicago', 'los-angeles', 'san-francisco', 'miami', 'toronto', 'montreal', 'vancouver', 'mexico-city', 'havana', 'panama-city', 'sao-paulo', 'rio-de-janeiro', 'buenos-aires', 'santiago', 'lima', 'bogota', 'sydney', 'melbourne', 'perth', 'auckland', 'suva', 'port-moresby']::text[]) AS seed_slug
  WHERE NOT EXISTS (SELECT 1 FROM public.weather_city c WHERE c.slug = seed_slug);
  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'Weather seed incomplete: % initial cities absent. Check conflicting continent/display_order; no data was changed.', missing_count;
  END IF;
END $$;

COMMIT;

-- Expected for a pristine database: EU=15 AS=15 AF=12 NA=12 SA=6 OC=6.
-- Additional cities may exist if already managed by LMN24.
SELECT continent_code, COUNT(*) AS city_count
  FROM public.weather_city GROUP BY continent_code ORDER BY continent_code;
SELECT COUNT(*) AS total_cities FROM public.weather_city;
