-- 005_seed_dev.sql
-- Seed data for local development and testing

-- Sample users
INSERT INTO users (id, role, name, phone, email, telegram_id, whatsapp_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', 'Admin User', '+35699100001', 'admin@dar.mt', NULL, NULL),
  ('22222222-2222-2222-2222-222222222222', 'moderator', 'Mod User', '+35699100002', 'mod@dar.mt', NULL, NULL),
  ('33333333-3333-3333-3333-333333333333', 'poster', 'John Landlord', '+35699100003', 'john.landlord@example.com', NULL, '+35699100003'),
  ('44444444-4444-4444-4444-444444444444', 'poster', 'Maria Agent', '+35699100004', 'maria.agent@example.com', '@maria_agent', '+35699100004'),
  ('55555555-5555-5555-5555-555555555555', 'seeker', 'Tom Seeker', '+35699100005', 'tom.seeker@example.com', '@tom_seeker', NULL),
  ('66666666-6666-6666-6666-666666666666', 'seeker', 'Sarah Buyer', '+35699100006', 'sarah.buyer@example.com', '@sarah_buyer', NULL)
ON CONFLICT DO NOTHING;

-- Sample listings (from different posters, various statuses)
INSERT INTO listings (id, poster_id, title, description, type, price_amount, price_currency, bedrooms, bathrooms, size_sqm, address_text, lat, lng, status, quality_score) VALUES
  (
    'aaaa1111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'Modern 2BR Apartment in Sliema',
    'Beautiful modern apartment with sea views. Fully furnished with high-end finishes. Walking distance to shops and restaurants. Includes parking space and storage. Perfect for professionals or couples.',
    'apartment',
    1200.00,
    'EUR',
    2,
    1,
    85.0,
    'Tower Road, Sliema SLM 1612, Malta',
    35.9131,
    14.5047,
    'published',
    85
  ),
  (
    'aaaa2222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'Spacious 3BR House in Mosta',
    'Family-friendly house with garden and garage. Recently renovated with modern kitchen and bathrooms. Quiet residential area close to schools and parks. Solar panels installed.',
    'house',
    1800.00,
    'EUR',
    3,
    2,
    150.0,
    'Constitution Street, Mosta MST 2345, Malta',
    35.9094,
    14.4283,
    'published',
    90
  ),
  (
    'aaaa3333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    'Luxury Penthouse in Valletta',
    'Stunning penthouse in the heart of Valletta. Panoramic harbour views. Private terrace with jacuzzi. Designer furnishings throughout. Concierge service available.',
    'apartment',
    3500.00,
    'EUR',
    3,
    2,
    200.0,
    'Republic Street, Valletta VLT 1112, Malta',
    35.8989,
    14.5146,
    'approved',
    95
  ),
  (
    'aaaa4444-4444-4444-4444-444444444444',
    '44444444-4444-4444-4444-444444444444',
    'Cozy Studio in St. Julians',
    'Compact studio perfect for young professionals. Close to nightlife and entertainment. Modern finishes and appliances. Bills included in rent.',
    'apartment',
    650.00,
    'EUR',
    0,
    1,
    35.0,
    'Bay Street, St. Julians STJ 3021, Malta',
    35.9178,
    14.4886,
    'submitted',
    70
  ),
  (
    'aaaa5555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    'Commercial Space in Bugibba',
    'Prime retail location on main shopping street. Large storefront with basement storage. Suitable for restaurant, retail, or office use.',
    'commercial',
    2200.00,
    'EUR',
    0,
    1,
    120.0,
    'Tourist Street, Bugibba SPB 2517, Malta',
    35.9506,
    14.4141,
    'under_review',
    75
  )
ON CONFLICT DO NOTHING;

-- Sample listing media
INSERT INTO listing_media (listing_id, url, kind, meta) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'https://example.com/images/sliema-apt-1.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa1111-1111-1111-1111-111111111111', 'https://example.com/images/sliema-apt-2.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa1111-1111-1111-1111-111111111111', 'https://example.com/images/sliema-apt-3.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa1111-1111-1111-1111-111111111111', 'https://example.com/images/sliema-apt-4.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa1111-1111-1111-1111-111111111111', 'https://example.com/images/sliema-apt-5.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa2222-2222-2222-2222-222222222222', 'https://example.com/images/mosta-house-1.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa2222-2222-2222-2222-222222222222', 'https://example.com/images/mosta-house-2.jpg', 'photo', '{"width": 1200, "height": 800}'),
  ('aaaa2222-2222-2222-2222-222222222222', 'https://example.com/images/mosta-house-floorplan.pdf', 'doc', '{"type": "floorplan"}'),
  ('aaaa3333-3333-3333-3333-333333333333', 'https://example.com/images/valletta-penthouse-1.jpg', 'photo', '{}'),
  ('aaaa3333-3333-3333-3333-333333333333', 'https://example.com/images/valletta-penthouse-tour.mp4', 'video', '{"duration": 120}')
ON CONFLICT DO NOTHING;

-- Sample seeker profiles
INSERT INTO seeker_profiles (user_id, prefs, budget_min, budget_max, areas) VALUES
  (
    '55555555-5555-5555-5555-555555555555',
    '{"bedrooms_min": 2, "type": "apartment", "furnished": true, "parking": true}',
    800.00,
    1500.00,
    '["Sliema", "St. Julians", "Gzira"]'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    '{"bedrooms_min": 3, "type": "house", "garden": true, "garage": true}',
    1500.00,
    2500.00,
    '["Mosta", "Naxxar", "Lija", "Balzan"]'
  )
ON CONFLICT DO NOTHING;

-- Sample matches
INSERT INTO matches (seeker_id, listing_id, score, reasons) VALUES
  ('55555555-5555-5555-5555-555555555555', 'aaaa1111-1111-1111-1111-111111111111', 92.5, '["Location match: Sliema", "Budget match", "Bedroom count match", "Has parking"]'),
  ('55555555-5555-5555-5555-555555555555', 'aaaa3333-3333-3333-3333-333333333333', 78.0, '["Location close to preference", "Over budget but premium property"]'),
  ('66666666-6666-6666-6666-666666666666', 'aaaa2222-2222-2222-2222-222222222222', 95.0, '["Location match: Mosta", "Budget match", "House type match", "Has garden and garage"]')
ON CONFLICT DO NOTHING;

-- Sample viewings
INSERT INTO viewings (listing_id, seeker_id, scheduled_at, status, notes) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', NOW() + INTERVAL '2 days', 'confirmed', 'Afternoon viewing preferred'),
  ('aaaa2222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', NOW() + INTERVAL '5 days', 'proposed', NULL)
ON CONFLICT DO NOTHING;

-- Sample audit log entries
INSERT INTO audit_log (actor_type, actor_id, action, entity, entity_id, payload) VALUES
  ('user', '33333333-3333-3333-3333-333333333333', 'listing.create', 'listings', 'aaaa1111-1111-1111-1111-111111111111', '{"status": "draft"}'),
  ('user', '33333333-3333-3333-3333-333333333333', 'listing.submit', 'listings', 'aaaa1111-1111-1111-1111-111111111111', '{"status": "submitted"}'),
  ('agent', 'admin-agent', 'listing.validate', 'listings', 'aaaa1111-1111-1111-1111-111111111111', '{"score": 85, "passed": true}'),
  ('user', '11111111-1111-1111-1111-111111111111', 'listing.approve', 'listings', 'aaaa1111-1111-1111-1111-111111111111', '{"status": "approved"}'),
  ('system', 'auto-publish', 'listing.publish', 'listings', 'aaaa1111-1111-1111-1111-111111111111', '{"status": "published"}')
ON CONFLICT DO NOTHING;

-- Sample chat sessions
INSERT INTO chat_sessions (user_id, channel, peer_id, agent_id, state) VALUES
  ('55555555-5555-5555-5555-555555555555', 'telegram', '@tom_seeker', 'seeker-agent', '{"step": "searching", "prefs_captured": true}'),
  ('33333333-3333-3333-3333-333333333333', 'whatsapp', '+35699100003', 'poster-agent', '{"step": "listing_creation", "listing_id": "aaaa4444-4444-4444-4444-444444444444"}')
ON CONFLICT DO NOTHING;

-- Verify seed data
DO $$
BEGIN
  RAISE NOTICE 'Seed data inserted successfully';
  RAISE NOTICE 'Users: %', (SELECT COUNT(*) FROM users);
  RAISE NOTICE 'Listings: %', (SELECT COUNT(*) FROM listings);
  RAISE NOTICE 'Media items: %', (SELECT COUNT(*) FROM listing_media);
  RAISE NOTICE 'Seeker profiles: %', (SELECT COUNT(*) FROM seeker_profiles);
  RAISE NOTICE 'Matches: %', (SELECT COUNT(*) FROM matches);
  RAISE NOTICE 'Viewings: %', (SELECT COUNT(*) FROM viewings);
  RAISE NOTICE 'Audit log entries: %', (SELECT COUNT(*) FROM audit_log);
  RAISE NOTICE 'Chat sessions: %', (SELECT COUNT(*) FROM chat_sessions);
END $$;
