-- =========================================================================
-- JobBridge — Delete the "Launch Promo" test advertisement
--
-- WHY: The "Launch Promo" advert (id 9b278d4f-9115-42e8-87b3-0a2d1667e168)
-- was a placeholder/test ad that shows up in the Business advertisement
-- showcase. It should be removed from the public page so only real
-- business ads appear.
--
-- Scope: Deletes ONLY this single advertisement row; no other data is
-- touched and the advertisements table/schema are left unchanged.
-- =========================================================================

DELETE FROM public.advertisements
WHERE id = '9b278d4f-9115-42e8-87b3-0a2d1667e168'
  AND title = 'Launch Promo';

-- VERIFICATION:
--   SELECT id, title, business_name, category, package, status
--   FROM public.advertisements
--   WHERE title ILIKE '%Launch%';
